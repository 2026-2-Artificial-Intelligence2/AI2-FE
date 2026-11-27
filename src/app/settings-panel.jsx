import React, { useEffect, useRef, useState } from 'react';
import { previewSound } from '../shared/audio/spatial-audio.js';
import { updateSound, useSoundSettings } from '../shared/sound-settings.js';

const channels = [
  { id: 'master', label: '전체 음량', hint: '모든 소리' },
  { id: 'effects', label: '효과음', hint: '체결·알림·업무·정산' },
  { id: 'boss', label: '부장님 소리', hint: '발소리·헛기침·문 소리' },
  { id: 'voice', label: '음성 채팅', hint: '동료 목소리 전체' },
];

/** 막대를 놓을 때 미리듣기. 너무 자주 나지 않게 0.25초에 한 번까지. */
function usePreview() {
  const last = useRef(0);
  return channel => {
    const now = performance.now();
    if (now - last.current < 250) return;
    last.current = now;
    previewSound(channel);
  };
}

function VolumeRow({ channel, settings, preview }) {
  const muted = settings.muted[channel.id];
  const percent = Math.round(settings[channel.id] * 100);
  const inputId = 'volume-' + channel.id;
  return <li className="space-y-1.5">
    <div className="flex items-baseline justify-between gap-2">
      <label htmlFor={inputId} className="font-semibold">{channel.label}
        <span className="ml-1.5 text-xs font-normal text-ui-secondary">{channel.hint}</span>
      </label>
      <span className="text-xs tabular-nums text-ui-secondary">{muted ? '음소거' : percent + '%'}</span>
    </div>
    <div className="flex items-center gap-2">
      <button type="button" className="control grid size-8 shrink-0 place-items-center p-0" aria-pressed={muted}
        aria-label={channel.label + (muted ? ' 음소거 해제' : ' 음소거')}
        onClick={() => updateSound({ muted: { [channel.id]: !muted } })}>
        <span aria-hidden="true">{muted ? '🔇' : '🔊'}</span>
      </button>
      <input id={inputId} type="range" min="0" max="1" step="0.05" value={settings[channel.id]}
        className="w-full disabled:opacity-40" disabled={muted}
        onChange={event => updateSound({ [channel.id]: Number(event.target.value) })}
        onPointerUp={() => preview(channel.id)}
        onKeyUp={event => { if (event.key.startsWith('Arrow')) preview(channel.id); }} />
    </div>
  </li>;
}

// 머리글의 설정: 버튼 하나만 두고, 누르면 아래로 설정 창(화면 테마·소리 크기)을 펼친다.
// 바깥을 누르거나 Esc를 누르면 닫힌다. 설정은 이 브라우저에 저장된다.
export function SettingsPanel({ theme, onToggleTheme }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const settings = useSoundSettings();
  const preview = usePreview();

  useEffect(() => {
    if (!open) return;
    const outside = event => { if (!box.current?.contains(event.target)) setOpen(false); };
    const escape = event => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return <div ref={box} className="relative">
    <button type="button" id="settings" className="control grid size-11 place-items-center p-0 text-base sm:flex sm:size-auto sm:items-center sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-sm"
      aria-haspopup="dialog" aria-expanded={open} aria-label="설정" onClick={() => setOpen(value => !value)}>
      <span aria-hidden="true">⚙</span>
      <span aria-hidden="true" className="hidden sm:inline">설정</span>
    </button>

    {open && <div role="dialog" aria-label="설정"
      className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] space-y-4 rounded-xl border border-ui-border bg-ui-surface p-4 text-sm shadow-lg">
      <section className="space-y-2" aria-labelledby="settings-screen">
        <h2 id="settings-screen" className="text-xs font-bold text-ui-secondary">화면</h2>
        <div className="segments w-full" aria-label="화면 테마">
          <button type="button" className="flex-1" aria-pressed={theme !== 'dark'} onClick={() => theme === 'dark' && onToggleTheme()}>☀ 라이트</button>
          <button type="button" className="flex-1" aria-pressed={theme === 'dark'} onClick={() => theme !== 'dark' && onToggleTheme()}>☾ 다크</button>
        </div>
      </section>
      <section className="space-y-3 border-t border-ui-border pt-4" aria-labelledby="settings-sound">
        <h2 id="settings-sound" className="text-xs font-bold text-ui-secondary">소리</h2>
        <ul className="space-y-3">
          {channels.map(channel => <VolumeRow key={channel.id} channel={channel} settings={settings} preview={preview} />)}
        </ul>
        <p className="text-xs leading-relaxed text-ui-secondary">
          부장님 발소리는 뒤에서 날수록 먹먹하게 들려요. 이어폰을 끼면 방향을 더 잘 알 수 있어요.
        </p>
      </section>
    </div>}
  </div>;
}
