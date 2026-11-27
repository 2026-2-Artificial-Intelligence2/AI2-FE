// 근무 중 사무실 배경음악. 4분짜리 곡을 두 벌 번갈아 틀며, 끝나기 4초 전부터 다음 벌과 겹쳐(크로스페이드)
// 이음매가 들리지 않게 반복한다. 부장님이 걷는 동안에는 발소리가 묻히지 않게 소리를 줄인다.
import { musicInput } from './spatial-audio.js';

const SRC = `${import.meta.env.BASE_URL}sounds/office-music.m4a`;
const CROSSFADE = 4;      // 초
const FADE_IN = 2.5, FADE_OUT = 1.5;
const DUCKED = 0.4;       // 부장님이 걷는 동안 음악 크기

let player;

function createPlayer() {
  const { context, input } = musicInput();
  const master = new GainNode(context, { gain: 0 });   // 켜기·끄기 페이드
  const duck = new GainNode(context, { gain: 1 });     // 부장님 걸을 때 줄이기
  master.connect(duck).connect(input);
  const decks = [0, 1].map(() => {
    const element = Object.assign(new Audio(SRC), { preload: 'auto', crossOrigin: 'anonymous' });
    const gain = new GainNode(context, { gain: 0 });
    context.createMediaElementSource(element).connect(gain).connect(master);
    return { element, gain };
  });
  let current = 0;
  let timer;

  const fade = (param, value, seconds) => {
    const t = context.currentTime;
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    param.linearRampToValueAtTime(value, t + seconds);
  };
  const startDeck = (index, fadeSeconds) => {
    const deck = decks[index];
    deck.element.currentTime = 0;
    deck.element.play().catch(() => {});
    fade(deck.gain.gain, 1, fadeSeconds);
  };

  return {
    playing: false,
    start() {
      if (this.playing) return;
      this.playing = true;
      context.resume().catch(() => {});
      startDeck(current, 0.01);
      fade(master.gain, 1, FADE_IN);
      timer = setInterval(() => {
        const { element, gain } = decks[current];
        if (!element.duration || element.duration - element.currentTime > CROSSFADE) return;
        fade(gain.gain, 0, CROSSFADE);
        setTimeout(() => element.pause(), CROSSFADE * 1000 + 200);
        current = 1 - current;
        startDeck(current, CROSSFADE);
      }, 250);
    },
    stop() {
      if (!this.playing) return;
      this.playing = false;
      clearInterval(timer);
      fade(master.gain, 0, FADE_OUT);
      setTimeout(() => {
        if (this.playing) return;
        decks.forEach(deck => { deck.element.pause(); deck.gain.gain.value = 0; });
      }, FADE_OUT * 1000 + 100);
    },
    duck(on) {
      fade(duck.gain, on ? DUCKED : 1, on ? 0.4 : 1.2);
    },
  };
}

/** 근무를 시작하면 켜고(페이드 인), 퇴근하거나 나가면 끈다(페이드 아웃). */
export function setOfficeMusic(on) {
  if (!on && !player) return;
  player ??= createPlayer();
  if (on) player.start();
  else player.stop();
}

/** 부장님이 걷는 동안 음악을 줄인다. */
export function duckMusic(on) {
  player?.duck(on);
}
