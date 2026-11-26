import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

const dialogue = {
  idle: '아까부터 일이 하나도 안 올라오던데. 자리로 돌아가면 밀린 일부터 처리해.',
  market: '근무 시간에 주식 차트를 보고 있었어? 자리로 돌아가면 업무부터 해.',
  messenger: '근무 시간에 메신저로 수다야? 자리로 돌아가면 하던 일부터 마저 해.',
};

export function Meeting({ reason, startedAt }) {
  const container = useRef(null);
  const canvas = useRef(null);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    container.current.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    let closed = false;
    let unmountScene;
    import('./meeting-scene.js').then(({ mountMeetingScene }) => {
      if (closed) return;
      unmountScene = mountMeetingScene(canvas.current, startedAt);
      setReady(true);
    }).catch(() => {
      // The subtitle remains available if WebGL is unavailable.
    });
    return () => {
      closed = true;
      unmountScene?.();
    };
  }, [startedAt]);

  return <section ref={container} id="meeting-scene" tabIndex={-1} aria-labelledby="meeting-title"
    className="fixed inset-0 z-30 isolate flex flex-col justify-between overflow-hidden bg-slate-900 text-white">
    <canvas ref={canvas} aria-hidden="true" data-ready={ready}
      className={'absolute inset-0 size-full ' + (ready ? '' : 'invisible')} />
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-linear-to-b from-slate-950/65 via-transparent to-slate-950/75" />
    <header className="relative flex items-center justify-between border-b border-white/15 px-5 py-4 sm:px-8">
      <h2 id="meeting-title" className="font-bold">회의실</h2>
      <p className="text-sm text-slate-200">면담 중</p>
    </header>
    <div className="relative mx-auto mb-6 w-[calc(100%-2rem)] max-w-2xl rounded-xl border border-white/20 bg-slate-950/90 px-5 py-4 text-center shadow-xl sm:mb-10"
      role="status">
      <p className="text-xs font-bold text-amber-300">부장님</p>
      <p className="mt-2 text-base font-semibold sm:text-lg">{dialogue[reason] ?? '잠깐 이야기 좀 하자.'}</p>
      <p className="mt-2 text-xs text-slate-300">면담이 끝나면 자리로 돌아가요.</p>
    </div>
  </section>;
}
