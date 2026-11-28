import React, { useEffect, useRef, useState } from 'react';

// 머리글의 음성 대화: 버튼 하나만 두고, 누르면 아래로 설정 창(참여·음소거·참여자·사람별 음량·나가기)을 펼친다.
// 바깥을 누르거나 Esc를 누르면 닫힌다.
// 중계 서버(TURN)를 두지 않으므로 휴대폰 데이터망(LTE·5G)에서는 연결되지 않는다. 와이파이에서 쓰라고 미리 알리고,
// 누군가와 한동안 연결이 안 되면 그 사람 이름과 함께 다시 알린다.

/** 이만큼(ms) 연결이 안 되면 "연결 안 됨"으로 본다. */
const STUCK_AFTER_MS = 12_000;
/** 브라우저가 알려 주면(안드로이드 크롬 등) 휴대폰 데이터로 접속했는지. 모르면 false. */
const onCellular = () => navigator.connection?.type === 'cellular';

/** 음성에 참여한 뒤 STUCK_AFTER_MS 넘게 연결되지 않은 사람들. */
function useStuckPeers(voice) {
  const since = useRef(new Map());
  const [stuck, setStuck] = useState([]);
  useEffect(() => {
    if (!voice.joined) { since.current.clear(); setStuck([]); return; }
    const check = () => {
      const now = Date.now();
      const waiting = voice.people.filter(person => !person.me && person.state !== 'connected').map(person => person.label);
      for (const label of [...since.current.keys()]) if (!waiting.includes(label)) since.current.delete(label);
      for (const label of waiting) if (!since.current.has(label)) since.current.set(label, now);
      const next = waiting.filter(label => now - since.current.get(label) >= STUCK_AFTER_MS);
      setStuck(current => current.join() === next.join() ? current : next);
    };
    check();
    const timer = setInterval(check, 2000);
    return () => clearInterval(timer);
  }, [voice.joined, voice.people]);
  return stuck;
}
export function VoicePanel({ voice, connected, serverError }) {
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

  const stuck = useStuckPeers(voice);
  if (!voice.available) return null;

  const others = voice.people.filter(person => !person.me);
  const error = voice.error || serverError;
  const someoneSpeaking = voice.people.some(person => person.speaking && !person.me);
  const label = !voice.joined ? '음성' : voice.micStalled ? '음성 · 마이크 멈춤' : voice.blocked ? '음성 · 소리 켜기'
    : stuck.length ? '음성 · 연결 안 됨'
    : voice.muted ? '음성 · 음소거'
    : '음성 · ' + voice.people.length + '명';

  return <div ref={box} className="relative">
    <button type="button" className="control flex min-h-11 items-center gap-1.5 whitespace-nowrap sm:min-h-0" aria-haspopup="dialog" aria-expanded={open}
      aria-label={'음성 대화 설정 (' + label + ')'} title={label} onClick={() => { voice.unlock(); setOpen(value => !value); }}>
      <span aria-hidden="true" className={'inline-block size-2 shrink-0 rounded-full ' + (!voice.joined ? 'bg-ui-track'
        : voice.micStalled || voice.blocked || stuck.length ? 'bg-amber-500'
        : voice.muted ? 'bg-rose-500' : someoneSpeaking ? 'bg-emerald-500' : 'bg-emerald-300')} />
      <span className="lg:hidden">음성</span>
      <span className="hidden lg:inline">{label}</span>
    </button>

    {open && <div role="dialog" aria-label="음성 대화"
      className="absolute right-0 z-40 mt-2 w-72 space-y-3 rounded-xl border border-ui-border bg-ui-surface p-4 text-sm shadow-lg">
      {error && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{error}</p>}
      {!voice.joined ? <>
        <p className="leading-relaxed text-ui-secondary">같은 방 사람들과 목소리로 이야기해요.</p>
        <p className={'rounded-lg px-3 py-2 text-xs leading-relaxed break-keep ' + (onCellular()
          ? 'bg-amber-50 font-semibold text-amber-950 dark:bg-amber-950 dark:text-amber-100' : 'bg-ui-subtle text-ui-secondary')}>
          {onCellular() ? '지금 휴대폰 데이터로 접속한 것 같아요. ' : ''}
          음성 대화는 와이파이에서만 돼요. 휴대폰 데이터(LTE·5G)로는 연결되지 않아요.
        </p>
        <button type="button" className="primary-action w-full rounded-lg px-3 py-2 font-bold"
          disabled={!connected || voice.requesting} onClick={() => voice.join()}>
          {voice.requesting ? '마이크 권한 확인 중…' : '음성 참여'}
        </button>
      </> : <>
        {voice.micStalled && <div role="alert" className="space-y-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-950 dark:bg-amber-950 dark:text-amber-100">
          <p>내 마이크 소리가 상대에게 가지 않고 있어요. 다른 앱이나 탭이 마이크를 쓰고 있을 수 있어요.</p>
          <button type="button" className="control w-full" onClick={voice.restartMic}>마이크 다시 잡기</button>
        </div>}
        {voice.blocked && <div role="alert" className="space-y-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-950 dark:bg-amber-950 dark:text-amber-100">
          <p>브라우저가 상대 목소리 재생을 막았어요. 아래 버튼을 누르면 들려요.</p>
          <button type="button" className="control w-full" onClick={voice.unlock}>소리 켜기</button>
        </div>}
        {stuck.length > 0 && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-xs leading-relaxed break-keep text-amber-950 dark:bg-amber-950 dark:text-amber-100">
          <b>{stuck.join(', ')}</b> 님과 음성이 연결되지 않아요. 둘 중 한 사람이 휴대폰 데이터를 쓰고 있다면 와이파이로 바꿔 주세요.
          (음성은 와이파이에서만 돼요.)
        </p>}
        <div className="flex gap-2">
          <button type="button" className="control flex-1" aria-pressed={voice.muted} disabled={!connected}
            onClick={voice.toggleMute}>{voice.muted ? '음소거 해제' : '음소거'}</button>
          <button type="button" className="control flex-1" onClick={() => { voice.leave(); setOpen(false); }}>음성 나가기</button>
        </div>

        <ul className="space-y-2" aria-label="음성 참여자">
          {voice.people.map(person => <li key={person.label} className="space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <span aria-hidden="true" className={'inline-block h-2 w-2 shrink-0 rounded-full ' +
                (person.speaking ? 'bg-emerald-500' : 'bg-ui-track')} />
              <span className="truncate font-semibold">{person.label}{person.me ? ' (나)' : ''}</span>
              {person.speaking && <span className="sr-only">말하는 중</span>}
              <span className="ml-auto shrink-0 text-ui-secondary">
                {person.muted ? '음소거' : !person.me && person.state !== 'connected' ? stateText(person.state) : ''}
              </span>
            </div>
            {!person.me && <input type="range" min="0" max="1" step="0.05" value={person.volume}
              aria-label={person.label + ' 음량'} className="w-full"
              onChange={event => voice.setVolume(person.label, Number(event.target.value))} />}
          </li>)}
        </ul>
        {others.length === 0 && <p className="text-xs text-ui-secondary">아직 음성에 참여한 사람이 없어요.</p>}
      </>}
    </div>}
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
