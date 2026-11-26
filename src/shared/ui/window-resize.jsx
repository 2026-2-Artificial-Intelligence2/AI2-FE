import React, { useEffect, useRef, useState } from 'react';

export function useWindowSize(name) {
  const key = 'office-stock-window-' + name;
  const [size, setSize] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) ?? 'null');
      if (Number.isFinite(saved?.width) && Number.isFinite(saved?.height) &&
          saved.width > 0 && saved.height > 0) return saved;
    } catch {
      // A blocked storage area still permits resizing the current window.
    }
    return null;
  });

  useEffect(() => {
    if (!size) return;
    try {
      sessionStorage.setItem(key, JSON.stringify(size));
    } catch {
      // The current window retains its size even when storage is unavailable.
    }
  }, [key, size]);

  return [size, setSize];
}

export function ResizeGrip({ frame, onResize, topLeft = false, label }) {
  const drag = useRef(null);
  const direction = topLeft ? -1 : 1;

  function update(width, height) {
    const style = getComputedStyle(frame.current);
    // CSS also clamps the requested size to the viewport or parent container.
    const minWidth = parseFloat(style.getPropertyValue('--resize-min-width'));
    const minHeight = parseFloat(style.getPropertyValue('--resize-min-height'));
    onResize({
      width: Math.max(minWidth, Math.round(width)),
      height: Math.max(minHeight, Math.round(height)),
    });
  }

  return <button type="button" aria-label={label} title="드래그 또는 방향키로 창 크기 조절"
    className={'resize-grip ' + (topLeft ? 'resize-grip-top' : 'resize-grip-bottom')}
    onPointerDown={event => {
      if (event.button !== 0 || drag.current) return;
      event.preventDefault();
      const { width, height } = frame.current.getBoundingClientRect();
      drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, width, height };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => {
      const start = drag.current;
      if (!start || start.id !== event.pointerId) return;
      update(start.width + direction * (event.clientX - start.x), start.height + direction * (event.clientY - start.y));
    }}
    onLostPointerCapture={() => { drag.current = null; }}
    onKeyDown={event => {
      const offsets = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      const offset = offsets[event.key];
      if (!offset) return;
      event.preventDefault();
      const { width, height } = frame.current.getBoundingClientRect();
      update(width + direction * 24 * offset[0], height + direction * 24 * offset[1]);
    }}>
    <span aria-hidden="true">⋰</span>
  </button>;
}
