import React, { useEffect, useRef, useState } from 'react';
import { clock, number } from '../../shared/format.js';

export function PriceChart({ candles, seconds, price, name }) {
  const [view, setView] = useState({ range: 60, end: null });
  const drag = useRef(null);
  const canvas = useRef(null);
  const count = Math.min(view.range, candles.length);
  const end = Math.max(count, Math.min(view.end ?? candles.length, candles.length));
  const points = candles.slice(end - count, end);
  const historical = end < candles.length;

  function pan(target) {
    const nextEnd = Math.max(count, Math.min(target, candles.length));
    setView(current => ({ ...current, end: nextEnd >= candles.length ? null : nextEnd }));
  }
  function zoom(direction) {
    setView(current => ({ ...current, range: Math.min(540, Math.max(12, Math.round(current.range * (direction > 0 ? 1.18 : 0.84)))) }));
  }
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    function wheel(event) {
      event.preventDefault();
      if (event.deltaY) zoom(event.deltaY);
    }
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [points.length > 0]);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    function draw() {
      const reference = historical ? points.at(-1)?.close : price;
      const { width, height } = element.getBoundingClientRect();
      if (!width || !height || !points.length) return;
      const scale = window.devicePixelRatio || 1;
      element.width = Math.round(width * scale);
      element.height = Math.round(height * scale);
      const ctx = element.getContext('2d');
      ctx.scale(scale, scale);
      const left = 12, right = width - 58, top = 20, bottom = height - 96;
      const volumeEnd = height - 30;
      const step = (right - left) / points.length;
      const low = Math.min(...points.map(point => point.low), reference);
      const high = Math.max(...points.map(point => point.high), reference);
      const padding = Math.max(2, Math.ceil((high - low) * 0.08));
      const min = Math.max(1, low - padding), max = high + padding;
      const y = value => bottom - (value - min) / (max - min) * (bottom - top);
      const volumeMax = Math.max(1, ...points.map(point => point.volume));
      const line = (x1, y1, x2, y2, color) => {
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      };

      ctx.font = '11px system-ui';
      ctx.textBaseline = 'middle';
      for (let index = 0; index < 5; index++) {
        const value = max - (max - min) * index / 4;
        const row = y(value);
        line(left, row, right, row, '#e8edf4');
        if (Math.abs(row - y(reference)) > 13) {
          ctx.fillStyle = '#64748b';
          ctx.fillText(number(Math.round(value)), right + 7, row);
        }
      }

      const markerCount = Math.min(points.length, width < 420 ? 3 : 5);
      for (let index = 0; index < markerCount; index++) {
        const slot = markerCount === 1 ? 0 : Math.round(index * (points.length - 1) / (markerCount - 1));
        const x = left + (slot + 0.5) * step;
        line(x, top, x, volumeEnd, '#edf1f6');
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'center';
        ctx.fillText(clock(points[slot].startSecond), Math.min(right - 17, Math.max(28, x)), height - 13);
      }
      ctx.textAlign = 'start';
      line(left, bottom + 15, right, bottom + 15, '#e8edf4');
      ctx.fillStyle = '#64748b';
      ctx.fillText('거래량', left, bottom + 27);

      points.forEach((point, index) => {
        const x = left + (index + 0.5) * step;
        const body = Math.max(1, Math.min(15, step * 0.68));
        const color = point.close > point.open ? '#cf304d' : point.close < point.open ? '#2d65cc' : '#738298';
        line(x, y(point.high), x, y(point.low), color);
        ctx.fillStyle = color;
        ctx.fillRect(x - body / 2, Math.min(y(point.open), y(point.close)), body,
          Math.max(1.5, Math.abs(y(point.open) - y(point.close))));
        const volume = point.volume / volumeMax * (volumeEnd - bottom - 38);
        ctx.globalAlpha = 0.35;
        ctx.fillRect(x - body / 2, volumeEnd - volume, body, volume);
        ctx.globalAlpha = 1;
      });

      ctx.setLineDash([4, 4]);
      line(left, y(reference), right, y(reference), '#334155');
      ctx.setLineDash([]);
      ctx.fillStyle = '#18263c';
      ctx.fillRect(right, y(reference) - 9, width - right, 18);
      ctx.fillStyle = '#fff';
      ctx.fillText(number(reference), right + 4, y(reference), width - right - 8);
    }
    const observer = new ResizeObserver(draw);
    observer.observe(element);
    draw();
    return () => observer.disconnect();
  }, [points, price, historical]);

  return <section className="panel min-w-0 p-4 lg:p-5">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <h3 className="font-bold">가격 차트 <span className="ml-1 text-xs font-normal text-slate-500">{seconds}초봉</span></h3>
      <div className="segments" aria-label="차트 조작">
        <button type="button" aria-label="이전 봉" onClick={() => pan(end - Math.ceil(count / 3))}>◀</button>
        <button type="button" aria-label="다음 봉" onClick={() => pan(end + Math.ceil(count / 3))}>▶</button>
        <button type="button" aria-label="차트 축소" onClick={() => zoom(1)}>−</button>
        <button type="button" aria-label="차트 확대" onClick={() => zoom(-1)}>+</button>
        <button type="button" aria-pressed={!historical} onClick={() => setView(current => ({ ...current, end: null }))}>실시간</button>
      </div>
    </div>
    {points.length ? <canvas ref={canvas} className="block h-[340px] w-full touch-none cursor-grab active:cursor-grabbing lg:h-[390px]"
      role="img" aria-label={name + ' 가격과 거래량 차트. 드래그로 이동, 휠로 확대 및 축소'}
      onPointerDown={event => {
        if (event.button !== 0) return;
        drag.current = { id: event.pointerId, x: event.clientX, end, width: Math.max(1, event.currentTarget.clientWidth - 70) };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        const pointer = drag.current;
        if (pointer?.id === event.pointerId) pan(pointer.end - Math.round((event.clientX - pointer.x) * count / pointer.width));
      }}
      onLostPointerCapture={() => { drag.current = null; }}
    /> : <p className="p-4 text-sm text-slate-500">차트 데이터를 기다리는 중입니다.</p>}
  </section>;
}
