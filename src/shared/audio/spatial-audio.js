// 게임 소리. 부장님 소리(발소리·헛기침·복귀)는 방향이 있고, 나머지 효과음은 가운데에서 난다.
// 녹음 파일(public/sounds)은 처음 소리를 켤 때 불러와, 앞뒤 무음을 자르고 모노로 바꾸고 크기를 맞춘다.
// 파일이 아직 없거나 못 불러오면 합성 소리로 대신한다. 나머지 효과음은 Web Audio로 합성한다.
// 소리 크기: 효과음(effects)과 부장님 소리(boss)를 따로 조절하고, 둘 다 전체(output)를 거친다.

import { level as channelLevel, soundSettings, subscribeSound } from '../sound-settings.js';

let audio;
let output;    // 전체
let effects;   // 체결·알림·업무·정산
let boss;      // 부장님 발소리·헛기침·복귀
let music;     // 배경음악(music.js가 쓴다)

/** 파일 이름 → 맞출 최대 크기(0~1). 같은 소리의 변형은 -1, -2로 이어 붙인다. */
const FILES = {
  'boss-footstep': 0.55,
  'boss-cough-1': 0.6, 'boss-cough-2': 0.6,
  'boss-return': 0.45,
  caught: 0.5,
  'task-stamp': 0.5,
  messenger: 0.4,
  'meeting-hit-1': 0.6, 'meeting-hit-2': 0.6,
  award: 0.35,
};
const buffers = new Map();
let loading;

export function enableSound() {
  if (!audio) {
    audio = new AudioContext();
    output = audio.createGain();
    effects = audio.createGain();
    boss = audio.createGain();
    music = audio.createGain();
    effects.connect(output);
    boss.connect(output);
    music.connect(output);
    output.connect(audio.destination);
    applyLevels(soundSettings());
    subscribeSound(applyLevels);
  }
  audio.resume().catch(() => {});
  loading ??= loadFiles();
}

const ready = () => audio?.state === 'running';

/** 설정을 바꾸면 끊김 없이 0.05초에 걸쳐 크기를 맞춘다. */
function applyLevels(settings) {
  const t = audio.currentTime;
  for (const [node, channel] of [[output, 'master'], [effects, 'effects'], [boss, 'boss'], [music, 'music']]) {
    node.gain.setTargetAtTime(channelLevel(settings, channel), t, 0.015);
  }
}

/** 배경음악을 소리 갈래(음악)에 잇는다. 소리를 켠 뒤에만 쓸 수 있다. */
export function musicInput() {
  enableSound();
  return { context: audio, input: music };
}

/** 설정 창에서 막대를 움직일 때 들려주는 소리. */
export function previewSound(channel) {
  enableSound();
  if (channel === 'boss') {
    const step = buffers.get('boss-footstep');
    if (step) playBuffer(step, { dest: boss });
    else tone({ freq: 120, to: 55, decay: 0.15, gain: 0.3, dest: boss });
  } else if (channel !== 'voice' && channel !== 'music') sfx.buy();
}

async function loadFiles() {
  await Promise.all(Object.entries(FILES).map(async ([name, peak]) => {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}sounds/${name}.mp3`);
      if (!response.ok) return;
      const decoded = await audio.decodeAudioData(await response.arrayBuffer());
      buffers.set(name, prepare(decoded, peak));
    } catch {
      // 합성 소리로 대신한다.
    }
  }));
}

/** 모노로 섞고, 앞뒤 무음을 자르고(앞 5ms·뒤 40ms 여유), 가장 큰 소리를 peak에 맞춘다. */
function prepare(buffer, peak) {
  const length = buffer.length;
  const mono = new Float32Array(length);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) mono[i] += data[i] / buffer.numberOfChannels;
  }
  let max = 0;
  for (const sample of mono) max = Math.max(max, Math.abs(sample));
  if (max === 0) return null;
  const threshold = max * 0.02;
  let start = 0;
  while (start < length && Math.abs(mono[start]) < threshold) start++;
  let end = length - 1;
  while (end > start && Math.abs(mono[end]) < threshold) end--;
  start = Math.max(0, start - Math.round(buffer.sampleRate * 0.005));
  end = Math.min(length, end + Math.round(buffer.sampleRate * 0.04));
  const trimmed = audio.createBuffer(1, end - start, buffer.sampleRate);
  const data = trimmed.getChannelData(0);
  const scale = peak / max;
  const fade = Math.min(data.length, Math.round(buffer.sampleRate * 0.03));
  for (let i = 0; i < data.length; i++) {
    const tail = data.length - i;
    data[i] = mono[start + i] * scale * (tail < fade ? tail / fade : 1);
  }
  return trimmed;
}

/** 같은 소리의 변형(-1, -2 …) 가운데 하나. 하나뿐이면 그것. */
function pick(name) {
  if (buffers.has(name)) return buffers.get(name);
  const variants = [...buffers.keys()].filter(key => key.startsWith(name + '-'));
  return variants.length ? buffers.get(variants[Math.floor(Math.random() * variants.length)]) : null;
}

function playBuffer(buffer, { at = 0, dest = effects, gain = 1, rate = 1 } = {}) {
  const source = new AudioBufferSourceNode(audio, { buffer, playbackRate: rate });
  const level = new GainNode(audio, { gain });
  source.connect(level).connect(dest);
  source.start(audio.currentTime + at);
  source.onended = () => { source.disconnect(); level.disconnect(); };
}

/** 바로 뒤에서 날 때 높은 소리를 깎는 한계(Hz). 앞에서는 거의 깎지 않는다. */
const FRONT_CUTOFF = 12000, BEHIND_CUTOFF = 1300;

/**
 * 부장님이 있는 쪽에서 들리게 하는 출력. Web Audio 듣는 이는 -Z를 보고 +X가 오른쪽이다.
 * 이어폰의 HRTF만으로는 앞뒤가 잘 구분되지 않아, 뒤에서 나는 소리일수록 먹먹하게(높은 소리를 깎아)
 * 들려준다. 실제로도 귀 뒤쪽에서 오는 소리는 귓바퀴에 가려 둔해진다. 이를 과장한 것이다.
 */
function spatial({ x, z, y = -1, at = 0 }, listener) {
  const ahead = listener.forwardZ * z;   // 듣는 이 기준 앞(+)·뒤(−) 거리
  const distance = Math.hypot(x, z) || 1;
  const behind = Math.max(0, -ahead / distance);   // 0 = 옆이나 앞, 1 = 바로 뒤
  const muffle = new BiquadFilterNode(audio, {
    type: 'lowpass', Q: 0.5, frequency: FRONT_CUTOFF * Math.pow(BEHIND_CUTOFF / FRONT_CUTOFF, behind),
  });
  const pan = new PannerNode(audio, {
    panningModel: 'HRTF', distanceModel: 'inverse', refDistance: 1,
    positionX: -listener.forwardZ * x, positionY: y, positionZ: -ahead,
  });
  muffle.connect(pan).connect(boss);
  setTimeout(() => { muffle.disconnect(); pan.disconnect(); }, (at + 4) * 1000);
  return muffle;
}

export function footsteps({ from, to, listener }) {
  if (!ready()) return;
  const step = buffers.get('boss-footstep');
  for (const delay of [0, 0.5, 1, 1.5]) {
    const fraction = delay / 2;
    const x = from.x + (to.x - from.x) * fraction - listener.position.x;
    const z = from.z + (to.z - from.z) * fraction - listener.position.z;
    const pan = spatial({ x, z, at: delay }, listener);
    if (step) {
      playBuffer(step, { at: delay, dest: pan, rate: 0.93 + Math.random() * 0.14 });
      continue;
    }
    const t = audio.currentTime + delay;
    const sound = audio.createOscillator();
    const gain = audio.createGain();
    sound.frequency.setValueAtTime(120, t);
    sound.frequency.exponentialRampToValueAtTime(55, t + 0.1);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.19, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    sound.connect(gain).connect(pan);
    sound.start(t);
    sound.stop(t + 0.16);
  }
}

export function cough({ to, listener }) {
  if (!ready()) return;
  const x = to.x - listener.position.x;
  const z = to.z - listener.position.z;
  const pan = spatial({ x, z, y: 0.6 }, listener);
  const recorded = pick('boss-cough');
  if (recorded) {
    playBuffer(recorded, { dest: pan });
    return;
  }
  for (const at of [0, 0.35]) burst({ at, type: 'bandpass', freq: 520, q: 1.4, attack: 0.02, decay: 0.18, gain: 0.55, dest: pan });
}

export function turnListener(yaw) {
  if (!audio) return;
  const listener = audio.listener;
  if (listener.forwardX) {
    listener.forwardX.value = -Math.sin(yaw);
    listener.forwardZ.value = -Math.cos(yaw);
  } else listener.setOrientation(-Math.sin(yaw), 0, -Math.cos(yaw), 0, 1, 0);
}

// ───────── 합성 도구 ─────────

let noise;
function noiseSource() {
  if (!noise) {
    noise = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return new AudioBufferSourceNode(audio, { buffer: noise });
}

function envelope(param, t, attack, peak, decay) {
  param.setValueAtTime(0.0001, t);
  param.exponentialRampToValueAtTime(peak, t + attack);
  param.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function tone({ type = 'sine', freq, to, at = 0, attack = 0.005, decay = 0.2, gain = 0.3, dest = effects, filter }) {
  const t = audio.currentTime + at;
  const osc = new OscillatorNode(audio, { type });
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + attack + decay);
  const level = audio.createGain();
  envelope(level.gain, t, attack, gain, decay);
  const lowpass = filter ? new BiquadFilterNode(audio, { type: 'lowpass', frequency: filter }) : null;
  (lowpass ? osc.connect(lowpass) : osc).connect(level).connect(dest);
  osc.start(t);
  osc.stop(t + attack + decay + 0.05);
  osc.onended = () => { osc.disconnect(); lowpass?.disconnect(); level.disconnect(); };
}

function burst({ at = 0, attack = 0.002, decay = 0.08, gain = 0.3, type = 'lowpass', freq = 1000, to, q = 1, dest = effects }) {
  const t = audio.currentTime + at;
  const source = noiseSource();
  const filter = new BiquadFilterNode(audio, { type, Q: q });
  filter.frequency.setValueAtTime(freq, t);
  if (to) filter.frequency.exponentialRampToValueAtTime(to, t + attack + decay);
  const level = audio.createGain();
  envelope(level.gain, t, attack, gain, decay);
  source.connect(filter).connect(level).connect(dest);
  source.start(t, Math.random());
  source.stop(t + attack + decay + 0.05);
  source.onended = () => { source.disconnect(); filter.disconnect(); level.disconnect(); };
}

/** 종소리: 어긋난 배음이 높은 것부터 빨리 사라진다. */
function bell(freq, { at = 0, decay = 1.2, gain = 0.25 } = {}) {
  [[1, 1], [2, 0.45], [2.76, 0.3], [5.4, 0.12], [8.93, 0.05]].forEach(([ratio, amp], i) =>
    tone({ freq: freq * ratio, at, attack: 0.002, decay: decay / (1 + i * 0.8), gain: gain * amp }));
}

/** 금관 느낌: 톱니파 + 열렸다 닫히는 저역 필터. */
function brass(freq, { at = 0, length = 0.25, gain = 0.18, vibrato = 0, bend } = {}) {
  const t = audio.currentTime + at;
  const osc = new OscillatorNode(audio, { type: 'sawtooth' });
  osc.frequency.setValueAtTime(freq, t);
  if (bend) osc.frequency.linearRampToValueAtTime(bend, t + length);
  let lfo;
  if (vibrato) {
    lfo = new OscillatorNode(audio, { frequency: 5.5 });
    lfo.connect(new GainNode(audio, { gain: vibrato })).connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + length + 0.2);
  }
  const filter = new BiquadFilterNode(audio, { type: 'lowpass', Q: 2 });
  filter.frequency.setValueAtTime(freq * 1.5, t);
  filter.frequency.linearRampToValueAtTime(freq * 6, t + 0.05);
  filter.frequency.linearRampToValueAtTime(freq * 3, t + length);
  const level = audio.createGain();
  level.gain.setValueAtTime(0.0001, t);
  level.gain.linearRampToValueAtTime(gain, t + 0.03);
  level.gain.setValueAtTime(gain * 0.8, t + length - 0.04);
  level.gain.linearRampToValueAtTime(0.0001, t + length + 0.12);
  osc.connect(filter).connect(level).connect(effects);
  osc.start(t);
  osc.stop(t + length + 0.2);
  osc.onended = () => { osc.disconnect(); filter.disconnect(); level.disconnect(); lfo?.disconnect(); };
}

const note = n => 440 * Math.pow(2, (n - 69) / 12);   // MIDI 번호 → Hz
const C5 = 72, E5 = 76, G5 = 79, C6 = 84;
const between = (a, b) => a + Math.random() * (b - a);

/** 녹음 파일이 있으면 그것을, 없으면 합성 소리를 낸다. */
function recordedOr(name, synth, dest = effects) {
  const buffer = pick(name);
  if (buffer) playBuffer(buffer, { dest });
  else synth();
}

const synthesized = {
  buy() {
    tone({ type: 'triangle', freq: 988, decay: 0.06, gain: 0.25 });
    tone({ type: 'triangle', freq: 1480, at: 0.055, decay: 0.12, gain: 0.25 });
  },
  sell() {
    tone({ type: 'triangle', freq: 1480, decay: 0.06, gain: 0.22 });
    tone({ type: 'triangle', freq: 988, at: 0.055, decay: 0.12, gain: 0.22 });
  },
  news() {
    bell(note(88), { decay: 0.9, gain: 0.16 });
    bell(note(93), { at: 0.1, decay: 1.1, gain: 0.14 });
  },
  rumor() {
    burst({ type: 'bandpass', freq: 400, to: 2200, q: 3, attack: 0.08, decay: 0.3, gain: 0.25 });
    tone({ freq: 1568, at: 0.12, attack: 0.03, decay: 0.35, gain: 0.07 });
    tone({ freq: 1175, at: 0.2, attack: 0.03, decay: 0.4, gain: 0.06 });
  },
  taskDone() {
    tone({ type: 'triangle', freq: note(G5), decay: 0.1, gain: 0.22 });
    tone({ type: 'triangle', freq: note(C6), at: 0.08, decay: 0.22, gain: 0.22 });
  },
  taskWrong() {
    tone({ type: 'square', freq: 220, decay: 0.12, gain: 0.12, filter: 1200 });
    tone({ type: 'square', freq: 175, at: 0.13, decay: 0.22, gain: 0.12, filter: 1000 });
  },
  limitFill() {
    [C5, E5, G5].forEach((n, i) => bell(note(n + 12), { at: i * 0.07, decay: 0.6, gain: 0.12 }));
  },
  marginCall() {
    for (let i = 0; i < 4; i++) {
      tone({ type: 'square', freq: 880, at: i * 0.26, decay: 0.11, gain: 0.09, filter: 3000 });
      tone({ type: 'square', freq: 622, at: i * 0.26 + 0.13, decay: 0.11, gain: 0.09, filter: 3000 });
    }
  },
  lunchBell() {
    [E5, C5, 74, 67].forEach((n, i) => bell(note(n), { at: i * 0.42, decay: 1.6, gain: 0.2 }));
  },
  clockOut() {
    [C5, E5, G5].forEach((n, i) => bell(note(n), { at: i * 0.32, decay: i === 2 ? 2 : 1.2, gain: 0.22 }));
  },
  winner() {
    [[67, 0, 0.13], [C5, 0.15, 0.13], [E5, 0.3, 0.13], [G5, 0.45, 0.3], [E5, 0.8, 0.13], [G5, 0.95, 0.13], [C6, 1.1, 1.0]]
      .forEach(([n, at, length]) => { brass(note(n), { at, length }); brass(note(n - 12), { at, length, gain: 0.08 }); });
    bell(note(C6), { at: 1.1, decay: 1.5, gain: 0.08 });
  },
  loss() {
    [[55, 0], [54, 0.36], [53, 0.72]].forEach(([n, at]) => brass(note(n), { at, length: 0.32, gain: 0.2 }));
    brass(note(52), { at: 1.08, length: 1.0, gain: 0.2, vibrato: 6, bend: note(51) });
  },
  windowSwitch() {
    burst({ type: 'bandpass', freq: 700, to: 3500, q: 2, attack: 0.02, decay: 0.12, gain: 0.3 });
  },
  gameStart() {
    bell(note(E5), { decay: 1.0, gain: 0.2 });
    bell(note(C5), { at: 0.35, decay: 1.6, gain: 0.2 });
  },
  loan() {
    for (let i = 0; i < 9; i++) burst({ at: i * 0.045 + between(0, 0.01), type: 'highpass', freq: between(2500, 4000), decay: 0.03, gain: 0.18 });
    tone({ type: 'triangle', freq: 2093, at: 0.45, decay: 0.3, gain: 0.08 });
  },
  /** 맑고 짧은 "톡" + 아주 작은 접점 소리. 매번 높이가 살짝 다르다. */
  click() {
    const pitch = between(0.96, 1.04);
    tone({ freq: 1750 * pitch, to: 1150 * pitch, attack: 0.001, decay: 0.028, gain: 0.16 });
    tone({ freq: 3500 * pitch, attack: 0.001, decay: 0.012, gain: 0.035 });
    burst({ type: 'bandpass', freq: 6000, q: 1.5, attack: 0.0005, decay: 0.006, gain: 0.08 });
  },
};

/** 효과음 이름. 소리를 켜기 전(브라우저가 막은 동안)에는 조용히 넘어간다. */
export const sfx = Object.fromEntries([
  ...Object.entries(synthesized),
  ['caught', () => recordedOr('caught', synthesized.taskWrong)],
  ['stamp', () => recordedOr('task-stamp', synthesized.taskDone)],
  ['messenger', () => recordedOr('messenger', () => tone({ freq: 1900, to: 700, decay: 0.07, gain: 0.3 }))],
  ['bossReturn', () => recordedOr('boss-return', () => burst({ freq: 300, decay: 0.2, gain: 0.4, dest: boss }), boss)],
  ['hit', () => recordedOr('meeting-hit', () => { burst({ freq: 650, decay: 0.12, gain: 0.85 }); tone({ freq: 160, to: 55, decay: 0.14, gain: 0.7 }); })],
  ['award', () => recordedOr('award', () => [C5, E5, G5].forEach(n => bell(note(n), { decay: 1.2, gain: 0.1 })))],
].map(([name, play]) => [name, () => { if (ready()) play(); }]));
