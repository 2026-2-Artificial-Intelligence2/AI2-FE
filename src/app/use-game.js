import { useCallback, useEffect, useRef, useState } from 'react';
import { footsteps, cough } from '../shared/audio/spatial-audio.js';
import { STAFF, staffAtSeat } from '../shared/scene/office-seats.js';
import { createSoundCues } from './game-sounds.js';

const seatKey = 'officeStockSeat';
const loginKey = 'officeStockLogin';

function readLoginToken() {
  try {
    return localStorage.getItem(loginKey);
  } catch {
    return null;
  }
}

function saveLoginToken(token) {
  try {
    if (token) localStorage.setItem(loginKey, token);
    else localStorage.removeItem(loginKey);
  } catch {
    // The open connection can still use the account if device storage is unavailable.
  }
}
const initial = {
  stocks: [], candles: {}, orders: [], trades: [], history: [], chats: [],
  status: '연결 중…', actionErrors: {}, account: null, accountNotice: '',
};

// Success predicates are used only with servers that do not advertise request IDs.
function commandResponse(command) {
  const [verb, target, symbol, price, quantity] = command.split(' ', 5);
  switch (verb) {
    case 'SIGNUP':
    case 'LOGIN':
    case 'RESET': return [verb, message => message.type === 'profile'];
    case 'RECORDS': return [verb, message => message.type === 'records'];
    // 내 정보: PROFILE NAME·PASSWORD·RECOVERY·DELETE는 각각 따로 오류를 받는다(PROFILE_NAME 등).
    case 'PROFILE': return ['PROFILE_' + target, {
      NAME: message => message.type === 'profile',
      PASSWORD: message => message.type === 'notice',
      RECOVERY: message => message.type === 'recoveryCode',
      DELETE: message => message.type === 'accountDeleted',
    }[target] ?? (() => false)];
    case 'GUEST': return [verb, message => message.type === 'guest'];
    case 'LOGOUT': return [verb, message => message.type === 'loggedOut'];
    case 'LEADERBOARD': return [verb, message => message.type === 'leaderboard'];
    case 'CREATE':
    case 'JOIN': return [verb, message => message.type === 'state'];
    case 'SOLO':
    case 'START': return [verb, message => message.type === 'state' && message.room.startedAt];
    case 'RESTART': return [verb, message => message.type === 'state' && !message.room.startedAt];
    case 'LENGTH': return [verb, message => message.type === 'state' && message.sessionSeconds === Number(target) * 60];
    case 'WORK': return [verb, message => message.type === 'work' && message.desk.task.number >= Number(target)];
    case 'LIMIT': return ['ORDER:' + symbol, message => message.type === 'orders' &&
      message.orders.some(order => order.symbol === symbol && order.limitWon === Number(price) &&
        order.quantity === Number(quantity) && order.side === (target === 'BUY' ? '매수' : '매도'))];
    case 'BUY':
    case 'BUYWON':
    case 'SELL': return ['ORDER:' + target, message => message.type === 'fill' && !message.limit && !message.forced &&
      message.symbol === target && message.side.endsWith(verb === 'SELL' ? '매도' : '매수')];
    case 'CANCEL': return [verb, message => message.type === 'orders' && !message.orders.some(order => order.id === Number(target))];
    case 'LOAN': return [verb, message => message.type === 'work' && message.desk.balance.loanRepayWon > 0];
    // 방장이 게임 중이나 퇴근 뒤에 나가면 방이 닫히지 않고 같은 방 대기실로 돌아온다.
    case 'LEAVE': return [verb, message => message.type === 'closed' || (message.type === 'state' && !message.room.startedAt)];
    case 'CHAT': return [verb, (message, you) => message.type === 'chat' && message.message.from === you &&
      (message.message.to ?? 'ALL') === target && message.message.text === command.slice(6 + target.length)];
    case 'LEAK_ARTICLE': return ['CHAT', message => message.type === 'leakSent'];
    case 'SWITCH':
    case 'MESSENGER': return ['VIEW', message => message.type === 'view'];
    case 'NEWS': return ['NEWS', message => message.type === 'newsHistory'];
    // 음성 연결 정보(VOICE SIGNAL)는 따로 답이 없으므로 기다리지 않는다.
    case 'VOICE': return target === 'SIGNAL' ? null : ['VOICE', message => message.type === 'state'];
    default: return null;
  }
}

function mergeCandles(history, latest) {
  const next = { ...history };
  for (const [symbol, candle] of Object.entries(latest ?? {})) {
    const list = history[symbol] ?? [];
    const last = list.at(-1);
    if (last && last.startSecond > candle.startSecond) continue;
    next[symbol] = [...(last?.startSecond === candle.startSecond ? list.slice(0, -1) : list), candle];
  }
  return next;
}

function reduce(game, message, receivedAt) {
  switch (message.type) {
    case 'profile': return {
      ...game, account: { member: true, name: message.name }, accountNotice: '',
      // 가입·복구 때 한 번만 오는 복구 코드. 화면이 보여 주고 사용자가 확인하면 지운다.
      recoveryCode: message.recoveryCode ?? game.recoveryCode,
    };
    case 'recoveryCode': return { ...game, recoveryCode: message.code };
    case 'dismissRecoveryCode': return { ...game, recoveryCode: null };
    case 'records': return { ...game, records: { summary: message.summary, recent: message.recent } };
    case 'accountDeleted': return {
      ...game, account: null, accountNotice: message.message, records: null, recoveryCode: null,
    };
    case 'guest': return {
      ...game, account: { member: false, name: message.name }, accountNotice: message.notice,
    };
    case 'profileFailed': return { ...game, account: null, accountNotice: message.message };
    case 'loggedOut': return { ...game, account: null, accountNotice: '', records: null, recoveryCode: null };
    case 'leaderboard': return { ...game, leaderboard: message.boards };
    case 'state': {
      const sameRoom = game.room?.code === message.code;
      const sameRound = sameRoom && game.room.round === message.round;
      return {
        ...(message.room.startedAt ? game : {
          // 메신저 기록은 같은 방이면 판이 바뀌어도 남긴다(판 사이에는 메신저가 구분선을 긋는다).
          ...initial, chats: sameRoom ? game.chats : [],
          account: game.account, accountNotice: game.accountNotice,
          micLevels: sameRoom ? game.micLevels : undefined,
          actionErrors: sameRound ? game.actionErrors : initial.actionErrors,
        }),
        startingSolo: game.startingSolo && message.solo && !message.room.startedAt,
        status: '',
        connected: true,
        room: message,
      };
    }
    case 'chart': return { ...game, candles: message.candles, candleSeconds: message.candleSeconds };
    case 'catalog': return { ...game, stocks: message.stocks, feeBps: message.feeBps, margin: message.margin, loan: message.loan };
    case 'market': return {
      ...game, view: message.view, market: message, micLevels: message.micLevels ?? game.micLevels,
      candles: mergeCandles(game.candles, message.candles),
    };
    case 'work': {
      const advanced = game.desk && message.desk.task.number > game.desk.task.number;
      return {
        ...game,
        desk: message.desk,
        workCompletion: advanced
          ? { rewardWon: message.desk.balance.workIncomeWon - game.desk.balance.workIncomeWon }
          : game.workCompletion,
      };
    }
    case 'view': return { ...game, view: message.view };
    case 'meeting': return {
      ...game, view: 'MEETING', meeting: message.reason, popup: null,
      meetingCharacter: message.character ?? (game.view === 'MEETING' ? game.meetingCharacter : undefined),
      meetingStarted: game.view === 'MEETING' ? game.meetingStarted : receivedAt,
    };
    case 'result': return { ...game, view: null, result: message, popup: null, status: '' };
    case 'fill': return { ...game, fill: message };
    case 'myTrades': return { ...game, trades: message.trades };
    case 'orders': return { ...game, orders: message.orders };
    case 'chatHistory': return { ...game, chats: message.messages, chatHistoryEnd: message.messages.at(-1)?.id ?? 0 };
    case 'chat': return { ...game, chats: [...game.chats, message.message].slice(-300) };
    case 'leakSent': return { ...game, leakReceipt: message };
    case 'mic': {
      const micLevels = { ...game.micLevels };
      if (message.on) micLevels[message.player] = message.level;
      else delete micLevels[message.player];
      return { ...game, micLevels };
    }
    case 'voiceConfig': return { ...game, voiceIceServers: message.iceServers };
    case 'workError': return { ...game, workError: message };
    case 'error': return {
      ...game,
      lastViewError: message.scope === 'VIEW' ? message : game.lastViewError,
      startingSolo: message.scope === 'SOLO' ? false : game.startingSolo,
      actionErrors: { ...game.actionErrors, [message.scope]: message },
    };
    case 'notice': return { ...game, notice: message };
    case 'replaced': return { ...game, status: message.message };
    case 'dismissNews': return { ...game, popup: null };
    case 'newsHistory': return { ...game, history: message.items };
    case 'closed':
    case 'resumeFailed': return {
      ...initial, connected: true, status: message.message,
      account: game.account, accountNotice: game.accountNotice,
    };
    default: return game;
  }
}

export function useGame() {
  const [game, setGame] = useState(initial);
  const socket = useRef(null);
  const office = useRef(null);
  /** 음성 연결 정보(voiceSignal)를 받을 함수. 화면 상태에 넣지 않고 바로 넘긴다(use-voice.js). */
  const voiceSignals = useRef(null);
  const requestIds = useRef(false);
  const nextRequestId = useRef(0);
  const requests = useRef(new Map());
  const legacyCommands = useRef([]);
  const send = useCallback(command => {
    if (socket.current?.readyState !== WebSocket.OPEN) return false;
    const response = commandResponse(command);
    let payload = command;
    if (response) {
      const [scope, matches] = response;
      if (requestIds.current) {
        const requestId = String(++nextRequestId.current);
        requests.current.set(requestId, scope);
        payload = JSON.stringify({ requestId, command });
      } else {
        legacyCommands.current.push({ scope, matches, command: command.split(' ', 1)[0], sentAt: performance.now() });
      }
      if (scope === 'SOLO') {
        setGame(game => ({ ...game, startingSolo: true, actionErrors: { ...game.actionErrors, SOLO: undefined } }));
      } else if (scope === 'LEADERBOARD') {
        setGame(game => ({ ...game, leaderboard: null, actionErrors: { ...game.actionErrors, LEADERBOARD: undefined } }));
      } else if (scope !== 'WORK' && scope !== 'LOAN' && scope !== 'LEAVE' && scope !== 'CHAT') {
        setGame(game => game.actionErrors[scope]
          ? { ...game, actionErrors: { ...game.actionErrors, [scope]: undefined } } : game);
      }
    }
    socket.current.send(payload);
    return true;
  }, []);

  const dismissNews = useCallback(() => setGame(game => reduce(game, { type: 'dismissNews' })), []);
  const dismissRecoveryCode = useCallback(() => setGame(game => reduce(game, { type: 'dismissRecoveryCode' })), []);

  useEffect(() => {
    const url = new URL('/ws/lobby', location.href);
    url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const savedSeat = () => JSON.parse(sessionStorage.getItem(seatKey) ?? 'null');
    let stopped = false;
    let replaced = false;
    let resuming = false;
    let retryTimer;
    let popupTimer;
    let noticeTimer;
    let retries = 0;
    let newsNumber = 0;
    let lastStep = -1;
    let lastCough = -1;
    let beatStarted = 0;
    let seatLabels = [];
    let roomStartedAt;
    let roundSeconds;
    let youLabel;
    const sounds = createSoundCues();

    function connect() {
      requestIds.current = false;
      const connection = socket.current = new WebSocket(url);
      let restoringAccount = false;
      function restoreSeat() {
        const seat = savedSeat();
        resuming = Boolean(seat);
        if (seat) connection.send('RESUME ' + seat.code + ' ' + seat.token);
        setGame(game => ({
          ...game, connected: !seat,
          status: seat ? '자리로 돌아가는 중…' : '방을 만들거나 초대 코드로 입장하세요.',
        }));
      }
      connection.onopen = () => {
        sounds.reset();
        if (stopped) return;
        const token = readLoginToken();
        if (!token) {
          setGame(game => ({ ...game, account: null }));
          restoreSeat();
          return;
        }
        restoringAccount = true;
        setGame(game => ({ ...game, connected: false, status: '로그인 확인 중…' }));
        connection.send('AUTOLOGIN ' + token);
      };
      connection.onmessage = event => {
        if (stopped) return;
        let message = JSON.parse(event.data);
        if (message.type === 'voiceSignal') {
          voiceSignals.current?.(message);
          return;
        }
        if (message.type === 'hello') {
          requestIds.current = message.requestIds === true;
          return;
        }
        if (message.type === 'ack') {
          requests.current.delete(message.requestId);
          return;
        }

        const receivedAt = performance.now();
        if (restoringAccount &&
            (message.type === 'profile' || message.type === 'profileFailed' || message.type === 'error')) {
          restoringAccount = false;
          if (message.type !== 'profile') {
            saveLoginToken(null);
            message = { ...message, type: 'profileFailed' };
          }
          const identity = message;
          setGame(game => reduce(game, identity, receivedAt));
          restoreSeat();
          return;
        }
        if (message.type === 'profile' && message.token) saveLoginToken(message.token);
        if (message.type === 'loggedOut' || message.type === 'guest' || message.type === 'accountDeleted') saveLoginToken(null);

        const pending = legacyCommands.current;
        while (pending.length && receivedAt - pending[0].sentAt >= 15000) pending.shift();
        if (message.type === 'error') {
          if (message.command === 'RESUME' || (resuming && !requestIds.current && !message.command && !pending.length)) {
            resuming = false;
            message = { ...message, type: 'resumeFailed' };
          } else {
            let scope;
            if (message.requestId !== undefined) {
              scope = requests.current.get(message.requestId);
              if (!scope) return;
              requests.current.delete(message.requestId);
            } else if (message.command === 'MIC' || message.command === 'VOICE SIGNAL') {
              scope = 'VOICE';
            } else {
              const index = message.command ? pending.findIndex(request => request.command === message.command) : 0;
              if (index >= 0) scope = pending.splice(index, 1)[0]?.scope;
            }
            message = { ...message, scope: scope ?? 'GENERAL', type: scope === 'WORK' ? 'workError' : 'error' };
          }
        } else {
          const index = pending.findIndex(request => request.matches(message, youLabel));
          if (index !== -1) pending.splice(index, 1);
        }
        if (message.type === 'notice') {
          clearTimeout(noticeTimer);
          noticeTimer = setTimeout(() => setGame(game => ({ ...game, notice: null })), 10000);
        }
        if (message.type === 'state') {
          sessionStorage.setItem(seatKey, JSON.stringify({ code: message.code, token: message.token }));
          retries = 0;
          if (!message.room.startedAt) resuming = false;
          youLabel = message.youLabel;
          roundSeconds = message.sessionSeconds;
          if (roomStartedAt !== message.room.startedAt) {
            roomStartedAt = message.room.startedAt;
            seatLabels = roomStartedAt ? (message.members ?? []).map(member => member.label) : [];
          }
          if (!message.room.startedAt) {
            newsNumber = 0;
            lastStep = lastCough = -1;
            office.current = null;
            clearTimeout(popupTimer);
          }
        }
        if (message.type === 'closed' || message.type === 'resumeFailed') {
          requests.current.clear();
          legacyCommands.current = [];
          sessionStorage.removeItem(seatKey);
          office.current = null;
        }
        if (message.type === 'replaced') replaced = true;
        if (message.type === 'meeting') {
          newsNumber = Math.max(newsNumber, message.newsNumber ?? 0);
          const position = message.seat ?? office.current?.packet?.step?.listener?.position;
          message = { ...message, character: staffAtSeat(position) ?? STAFF[seatLabels.indexOf(youLabel)] };
        }

        let popup;
        if (message.type === 'market') {
          const previous = office.current;
          if (previous?.packet.beat !== message.beat) beatStarted = receivedAt;
          const meetingStarts = new Map();
          for (const colleague of message.colleagues ?? []) {
            if (!colleague.meeting) continue;
            meetingStarts.set(colleague.label, {
              startedAt: previous?.meetingStarts.get(colleague.label)?.startedAt ?? receivedAt,
              character: staffAtSeat(colleague.seat) ?? STAFF[seatLabels.indexOf(colleague.label)],
            });
          }
          office.current = { packet: message, beatStarted, meetingStarts, seatLabels, youLabel, roundSeconds };
          if (message.walking && lastStep !== message.beat && message.step) {
            lastStep = message.beat;
            footsteps(message.step);
          }
          if (resuming) {
            resuming = false;
            newsNumber = Math.max(newsNumber, message.newsNumber);
            lastCough = Math.max(lastCough, message.coughBeat);
            send('NEWS HISTORY');
          }
          if (message.coughBeat > lastCough && message.step) {
            lastCough = message.coughBeat;
            cough(message.step);
          }
          if (message.newsNumber > newsNumber) {
            newsNumber = message.newsNumber;
            popup = { number: message.newsNumber, headline: message.headline, body: message.newsBody, kind: message.newsKind };
            send('NEWS HISTORY');
            clearTimeout(popupTimer);
            popupTimer = setTimeout(() => setGame(game => ({ ...game, popup: null })), popup.body ? 15000 : 12000);
          }
        }

        message = sounds.cue(message, { popup, you: youLabel });
        setGame(game => {
          const next = reduce(game, message, receivedAt);
          return popup ? { ...next, popup } : next;
        });
      };
      connection.onclose = () => {
        requests.current.clear();
        legacyCommands.current = [];
        if (stopped) return;
        const retry = savedSeat() && !replaced && retries < 30;
        setGame(game => ({
          ...game, connected: false, popup: null, startingSolo: false,
          status: retry ? '연결이 끊겼습니다. 다시 연결하는 중…'
            : replaced ? game.status : '연결이 끊겼습니다. 새로고침해 다시 접속하세요.',
        }));
        if (retry) retryTimer = setTimeout(connect, Math.min(1000 * 2 ** retries++, 10000));
      };
    }

    connect();
    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      clearTimeout(popupTimer);
      clearTimeout(noticeTimer);
      requests.current.clear();
      legacyCommands.current = [];
      socket.current?.close();
    };
  }, [send]);

  return { game, send, office, dismissNews, dismissRecoveryCode, voiceSignals };
}
