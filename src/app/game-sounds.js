import { sfx } from '../shared/audio/spatial-audio.js';

/**
 * 서버 메시지를 보고 효과음을 낸다. 접속(재접속 포함) 뒤 처음 받는 업무·시세는 기준으로만 삼아,
 * 다시 들어왔을 때 지난 일로 소리가 나지 않게 한다.
 */
export function createSoundCues() {
  let task;          // { number, kind } 마지막으로 받은 업무
  let loanTaken;     // 비상 대출을 받았는가
  let lunch;         // 점심시간인가
  let meeting = false;
  let started;       // 판이 시작됐는가(대기실을 본 뒤에만 출근 소리)
  let playing = false;   // 이번 접속에서 시세를 받았는가(퇴근 소리는 실제로 판을 하다 끝났을 때만)

  return {
    reset() {
      task = loanTaken = lunch = started = undefined;
      meeting = playing = false;
    },

    /** @returns 메시지(결과면 fresh 표시를 붙인다) */
    cue(message, { popup, you }) {
      switch (message.type) {
        case 'state': {
          const now = Boolean(message.room.startedAt);
          if (started === false && now) sfx.gameStart();
          started = now;
          if (!now) task = loanTaken = lunch = undefined;
          break;
        }
        case 'work': {
          const { task: next, balance } = message.desk;
          if (task && next.number > task.number) (task.kind === 'approval' ? sfx.stamp : sfx.taskDone)();
          if (loanTaken === false && balance.loanRepayWon > 0) sfx.loan();
          task = { number: next.number, kind: next.kind };
          loanTaken = balance.loanRepayWon > 0;
          break;
        }
        case 'workError': sfx.taskWrong(); break;
        case 'fill':
          if (message.forced) sfx.marginCall();
          else if (message.limit) sfx.limitFill();
          else (message.side.endsWith('매도') ? sfx.sell : sfx.buy)();
          break;
        case 'chat':
          if (message.message.from !== you) sfx.messenger();
          break;
        case 'view': sfx.windowSwitch(); break;
        case 'meeting':
          if (!meeting && playing) sfx.caught();
          meeting = true;
          playing = true;
          break;
        case 'market': {
          const nowLunch = message.lunchStartsInSeconds <= 0 && message.lunchEndsInSeconds > 0;
          if (lunch === false && nowLunch) sfx.lunchBell();
          if (lunch === true && !nowLunch) sfx.bossReturn();
          lunch = nowLunch;
          meeting = false;
          playing = true;
          if (popup) (popup.kind === 'rumor' ? sfx.rumor : sfx.news)();
          break;
        }
        case 'result':
          if (playing) {
            playing = false;
            sfx.clockOut();
            return { ...message, fresh: true };
          }
          break;
        default:
      }
      return message;
    },
  };
}
