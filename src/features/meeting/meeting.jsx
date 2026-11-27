import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { sfx } from '../../shared/audio/spatial-audio.js';
import { MEETING_IMPACTS } from './meeting-timing.js';

const dialogue = {
  idle: '아까부터 일이 하나도 안 올라오던데. 자리로 돌아가면 밀린 일부터 처리해.',
  market: '근무 시간에 주식 차트를 보고 있었어? 자리로 돌아가면 업무부터 해.',
  messenger: '근무 시간에 메신저로 수다야? 자리로 돌아가면 하던 일부터 마저 해.',
  mood: '뭘 잘했다고 쳐다봐? 그냥… 요즘 다들 해이해서 그래. 자리로 돌아가서 똑바로 해.',
};

export function Meeting({ reason, startedAt, character }) {
  const container = useRef(null);
  const canvas = useRef(null);
  const [renderState, setRenderState] = useState('loading');
  const [attempt, setAttempt] = useState(0);

  useLayoutEffect(() => {
    container.current.focus({ preventScroll: true });
  }, []);

  // 빠따가 닿는 순간마다 타격음. 재접속 등으로 이미 지난 타격은 건너뛴다.
  useEffect(() => {
    const elapsed = (performance.now() - startedAt) / 1000;
    const timers = MEETING_IMPACTS.filter(at => at > elapsed)
      .map(at => setTimeout(sfx.hit, (at - elapsed) * 1000));
    return () => timers.forEach(clearTimeout);
  }, [startedAt]);

  useEffect(() => {
    let closed = false;
    let unmountScene;
    import('./meeting-scene.js').then(({ mountMeetingScene }) => {
      if (closed) return;
      unmountScene = mountMeetingScene(canvas.current, startedAt, character, {
        onFrame: () => { if (!closed) setRenderState('ready'); },
        onError: () => { if (!closed) setRenderState('failed'); },
      });
    }).catch(() => {
      if (!closed) setRenderState('failed');
    });
    return () => {
      closed = true;
      unmountScene?.();
    };
  }, [startedAt, character, attempt]);

  const ready = renderState === 'ready';
  return <section ref={container} id="meeting-scene" tabIndex={-1} aria-labelledby="meeting-title"
    className="fixed inset-0 z-30 isolate flex flex-col justify-between overflow-hidden bg-slate-900 text-white">
    <canvas key={attempt} ref={canvas} aria-hidden="true" data-ready={ready}
      className={'absolute inset-0 size-full ' + (ready ? '' : 'invisible')} />
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-linear-to-b from-slate-950/65 via-transparent to-slate-950/75" />
    <header className="relative flex items-center justify-between border-b border-white/15 px-5 py-4 sm:px-8">
      <h2 id="meeting-title" className="font-bold">회의실</h2>
      <p className="text-sm text-slate-200">면담 중</p>
    </header>
    {!ready && <div className="relative mx-auto text-sm text-slate-200">
      {renderState === 'loading' ? <p role="status">회의실을 불러오는 중…</p> :
        <button type="button" className="rounded border border-white/30 bg-slate-800 px-3 py-2" onClick={() => {
          setRenderState('loading');
          setAttempt(value => value + 1);
        }}>회의실 화면 다시 열기</button>}
    </div>}
    <div className="relative mx-auto mb-6 w-[calc(100%-2rem)] max-w-2xl rounded-xl border border-white/20 bg-slate-950/90 px-5 py-4 text-center shadow-xl sm:mb-10"
      role="status">
      <p className="text-xs font-bold text-amber-300">부장님</p>
      <p className="mt-2 text-base font-semibold sm:text-lg">{dialogue[reason] ?? '잠깐 이야기 좀 하자.'}</p>
      <p className="mt-2 text-xs text-slate-300">면담이 끝나면 자리로 돌아가요.</p>
    </div>
  </section>;
}
