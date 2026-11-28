import React, { useEffect, useRef } from 'react';
import { KeyHint } from '../../shared/ui/shortcuts.jsx';

export function OfficeViewport({ office, market, players, micLevels, focused, looking, onReady, onReturn }) {
  const canvas = useRef(null);
  const scene = useRef(null);
  const pointer = useRef(null);
  const settings = useRef(null);
  settings.current = { focused, players, micLevels };

  useEffect(() => {
    let closed = false;
    let release;
    import('./office.js').then(renderer => {
      if (closed) return;
      renderer.setOfficePlayers(settings.current.players);
      renderer.setOfficeMicLevels(settings.current.micLevels);
      renderer.updateOffice(office.current);
      release = renderer.mountOffice(canvas.current);
      scene.current = renderer;
      renderer.setOfficeFocus(settings.current.focused);
      onReady(true);
    }).catch(() => {
      if (!closed) onReady(false);
    });
    return () => {
      closed = true;
      scene.current = null;
      release?.();
    };
  }, [office, onReady]);

  useEffect(() => {
    scene.current?.setOfficePlayers(players);
    scene.current?.updateOffice(office.current);
  }, [office, market, players]);

  useEffect(() => {
    scene.current?.setOfficeMicLevels(micLevels);
  }, [micLevels]);

  useEffect(() => {
    scene.current?.setOfficeFocus(focused);
  }, [focused]);

  return <section id="office" data-looking={looking} className="office-viewport" aria-label="3D 사무실">
    <canvas ref={canvas} id="officeCanvas" aria-label="좌석에서 본 사무실"
      onPointerDown={event => {
        if (!looking || event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
      }}
      onPointerMove={event => {
        const start = pointer.current;
        if (start?.id !== event.pointerId) return;
        scene.current?.turnOffice(event.clientX - start.x, event.clientY - start.y);
        pointer.current = { id: start.id, x: event.clientX, y: event.clientY };
      }}
      onLostPointerCapture={() => { pointer.current = null; }}
    />
    {looking && <footer>
      {/* 3D 장면 위라 어두운 알약 바탕을 깔아 읽히게 한다. 터치 화면에서는 "끌어서". */}
      <span className="rounded-full bg-slate-950/60 px-3 py-1 text-white backdrop-blur-sm">
        <span className="touch-hidden">드래그해서</span><span className="touch-only">끌어서</span> 둘러보기
      </span>
      <button id="back" className="control text-ui-text" type="button" onClick={onReturn}>모니터 보기 <KeyHint>Q</KeyHint></button>
    </footer>}
  </section>;
}
