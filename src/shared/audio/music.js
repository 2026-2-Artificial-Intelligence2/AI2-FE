// 장면별 배경음악. 한 번에 한 곡만 흐르고, 장면이 바뀌면 앞 곡은 서서히 꺼지고 새 곡이 서서히 켜진다.
// 근무 중 음악은 두 벌을 번갈아 틀며 끝나기 4초 전부터 겹쳐(크로스페이드) 이음매 없이 반복하고,
// 부장님이 걷는 동안 발소리가 묻히지 않게 소리를 줄인다. 대기실 음악은 끝나면 처음부터 다시, 퇴근 음악은 한 번만 튼다.
// 음량은 근무 중 음악(music)과 대기실·퇴근 음악(breakMusic)을 따로 조절한다.
import { musicInput } from './spatial-audio.js';

const base = `${import.meta.env.BASE_URL}sounds/`;
/** 장면 → 곡. 출처는 public/sounds/CREDITS.md. */
const TRACKS = {
  lobby: { src: base + 'music-lobby.m4a', channel: 'breakMusic', play: 'loop' },        // Silent Partner - Dog Park
  office: { src: base + 'office-music.m4a', channel: 'music', play: 'crossfade' },      // 사무실 음악(14:00~18:00)
  result: { src: base + 'music-result.m4a', channel: 'breakMusic', play: 'once' },      // Kevin MacLeod - Hyperfun
  loser: { src: base + 'music-loser.m4a', channel: 'breakMusic', play: 'once' },        // Reed Mathis - Here Come The Raindrops
};
const CROSSFADE = 4;      // 초
const FADE_IN = 2.5, FADE_OUT = 1.5;
const DUCKED = 0.4;       // 부장님이 걷는 동안 음악 크기

function fade(context, param, value, seconds) {
  const t = context.currentTime;
  param.cancelScheduledValues(t);
  param.setValueAtTime(param.value, t);
  param.linearRampToValueAtTime(value, t + seconds);
}

/** 곡 하나. play: 'crossfade'(두 벌 겹쳐 반복), 'loop'(끝나면 처음부터), 'once'(한 번만). */
function createTrack({ src, channel, play }) {
  const { context, input } = musicInput(channel);
  const level = new GainNode(context, { gain: 0 });    // 켜기·끄기 페이드
  const duck = new GainNode(context, { gain: 1 });     // 부장님 걸을 때 줄이기
  level.connect(duck).connect(input);
  const decks = (play === 'crossfade' ? [0, 1] : [0]).map(() => {
    const element = Object.assign(new Audio(src), { preload: 'auto', loop: play === 'loop' });
    const gain = new GainNode(context, { gain: 0 });
    context.createMediaElementSource(element).connect(gain).connect(level);
    return { element, gain };
  });
  let current = 0;
  let timer;
  let playing = false;

  const startDeck = (index, seconds) => {
    const deck = decks[index];
    deck.element.currentTime = 0;
    deck.element.play().catch(() => {});
    fade(context, deck.gain.gain, 1, seconds);
  };

  return {
    start() {
      if (playing) return;
      playing = true;
      context.resume().catch(() => {});
      startDeck(current, 0.01);
      fade(context, level.gain, 1, FADE_IN);
      if (play !== 'crossfade') return;
      timer = setInterval(() => {
        const { element, gain } = decks[current];
        if (!element.duration || element.duration - element.currentTime > CROSSFADE) return;
        fade(context, gain.gain, 0, CROSSFADE);
        setTimeout(() => element.pause(), CROSSFADE * 1000 + 200);
        current = 1 - current;
        startDeck(current, CROSSFADE);
      }, 250);
    },
    stop() {
      if (!playing) return;
      playing = false;
      clearInterval(timer);
      fade(context, level.gain, 0, FADE_OUT);
      setTimeout(() => {
        if (playing) return;
        decks.forEach(deck => { deck.element.pause(); deck.gain.gain.value = 0; });
      }, FADE_OUT * 1000 + 100);
    },
    duck(on) {
      fade(context, duck.gain, on ? DUCKED : 1, on ? 0.4 : 1.2);
    },
  };
}

const tracks = new Map();
let currentName = null;
let pending;

/**
 * 장면 음악을 바꾼다. name이 null이면 끈다. delay(초)를 주면 그만큼 기다렸다 켠다
 * (퇴근 종과 팡파르가 끝난 뒤 정산 음악을 켤 때). 같은 곡이면 그대로 둔다.
 */
export function setMusic(name, { delay = 0 } = {}) {
  clearTimeout(pending);
  if (name === currentName) return;
  if (currentName) tracks.get(currentName)?.stop();
  currentName = name;
  if (!name || !TRACKS[name]) return;
  const play = () => {
    if (currentName !== name) return;
    if (!tracks.has(name)) tracks.set(name, createTrack(TRACKS[name]));
    tracks.get(name).start();
  };
  if (delay > 0) pending = setTimeout(play, delay * 1000);
  else play();
}

/** 부장님이 걷는 동안 근무 음악을 줄인다. */
export function duckMusic(on) {
  tracks.get('office')?.duck(on && currentName === 'office');
}
