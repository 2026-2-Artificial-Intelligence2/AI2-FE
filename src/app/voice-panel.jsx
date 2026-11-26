import React, { useEffect, useRef, useState } from 'react';

// 음량 조절 팝업. 바깥을 누르거나 Esc를 누르면 닫힌다.
function VolumePopover({ people, onVolume }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
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
    <button type="button" className="control" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(v => !v)}>음량</button>
    {open && <div className="absolute right-0 z-30 mt-1 w-56 space-y-2 rounded-lg border border-ui-border bg-ui-surface p-3 shadow-lg">
      {people.map(person => <label key={person.label} className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate font-medium">{person.label}</span>
        <input type="range" min="0" max="1" step="0.05" value={person.volume}
          aria-label={person.label + ' 음량'} className="w-28"
          onChange={event => onVolume(person.label, Number(event.target.value))} />
      </label>)}
    </div>}
  </div>;
}

// 머리글의 음성 대화 조작: 참여·음소거·나가기, 참여한 사람(말하면 초록 점), 사람별 음량.
export function VoicePanel({ voice, connected }) {
  if (!voice.available) return null;
  if (!voice.joined) {
    return <div className="flex items-center gap-2">
      <button type="button" className="control" disabled={!connected || voice.requesting}
        title="같은 방 사람들과 목소리로 이야기해요. 목소리는 서버를 거치지 않아요."
        onClick={() => voice.join()}>
        {voice.requesting ? '마이크 권한 확인 중…' : '음성 참여'}
      </button>
      {voice.error && <span role="alert" className="text-xs text-rose-700 dark:text-rose-300">{voice.error}</span>}
    </div>;
  }
  const others = voice.people.filter(person => !person.me);
  return <div className="flex flex-wrap items-center gap-2" role="group" aria-label="음성 대화">
    <ul className="flex flex-wrap items-center gap-1.5" aria-label="음성 참여자">
      {voice.people.map(person => <li key={person.label}
        className="flex items-center gap-1 rounded-full border border-ui-border px-2 py-0.5 text-xs">
        <span aria-hidden="true" className={'inline-block h-2 w-2 rounded-full ' +
          (person.speaking ? 'bg-emerald-500' : 'bg-ui-track')} />
        <span className="font-semibold">{person.label}{person.me ? '(나)' : ''}</span>
        {person.muted && <span className="text-ui-secondary">· 음소거</span>}
        {!person.me && person.state !== 'connected' && <span className="text-ui-secondary">· {stateText(person.state)}</span>}
        {person.speaking && <span className="sr-only">말하는 중</span>}
      </li>)}
    </ul>
    {others.length > 0 && <VolumePopover people={others} onVolume={voice.setVolume} />}
    <button type="button" className="control" aria-pressed={voice.muted} disabled={!connected} onClick={voice.toggleMute}>
      {voice.muted ? '음소거 해제' : '음소거'}
    </button>
    <button type="button" className="control" onClick={() => voice.leave()}>음성 나가기</button>
  </div>;
}

function stateText(state) {
  switch (state) {
    case 'waiting':
    case 'new': return '연결 대기';
    case 'connecting': return '연결 중';
    case 'disconnected': return '끊김';
    case 'failed': return '연결 실패';
    default: return state;
  }
}
