import { useSyncExternalStore } from 'react';

// 소리 크기 설정. 브라우저에 저장해서 다음에 들어와도 그대로다(서버에는 보내지 않는다).
const key = 'office-stock-sound';

/** 소리 갈래. master는 나머지 모두에 곱해진다. */
export const SOUND_CHANNELS = ['master', 'effects', 'boss', 'voice'];

const defaults = {
  master: 0.8, effects: 1, boss: 1, voice: 1,
  muted: { master: false, effects: false, boss: false, voice: false },
};

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (!saved) return defaults;
    const clamp = value => (typeof value === 'number' && value >= 0 && value <= 1 ? value : null);
    const settings = { ...defaults, muted: { ...defaults.muted } };
    for (const channel of SOUND_CHANNELS) {
      settings[channel] = clamp(saved[channel]) ?? defaults[channel];
      settings.muted[channel] = saved.muted?.[channel] === true;
    }
    return settings;
  } catch {
    return defaults;
  }
}

let settings = load();
const listeners = new Set();

export const soundSettings = () => settings;

/** 갈래의 실제 크기(음소거면 0). master는 곱하지 않는다. */
export const level = (current, channel) => (current.muted[channel] ? 0 : current[channel]);

/** 목소리처럼 AudioContext를 거치지 않는 소리에 쓸 최종 크기(master까지 곱함). */
export const finalLevel = (current, channel) => level(current, 'master') * level(current, channel);

export function updateSound(change) {
  settings = { ...settings, ...change, muted: { ...settings.muted, ...change.muted } };
  try {
    localStorage.setItem(key, JSON.stringify(settings));
  } catch {
    // 저장이 막혀도 이번 접속 동안은 바뀐 크기로 낸다.
  }
  listeners.forEach(listener => listener(settings));
}

export function subscribeSound(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const useSoundSettings = () => useSyncExternalStore(subscribeSound, soundSettings);
