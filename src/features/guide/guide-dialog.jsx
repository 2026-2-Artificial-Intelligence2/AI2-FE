import React, { useEffect, useId, useState } from 'react';
import { Dialog } from '../../shared/ui/dialog.jsx';
import { GUIDE_PAGES } from './guide-pages.js';
import './guide.css';

// 도움말: 실제 게임 화면 위에 번호 상자와 화살표를 겹쳐 그리고, 같은 번호로 설명한다.
// 휴대폰(폭 640px 미만)에서는 쪽마다 있으면 휴대폰 화면 그림과 설명(page.mobile)을 보여 준다.
const DESKTOP_SIZE = [800, 500];
const PHONE = '(max-width: 639px)';

function usePhone() {
  const [phone, setPhone] = useState(() => matchMedia(PHONE).matches);
  useEffect(() => {
    const query = matchMedia(PHONE);
    const change = () => setPhone(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  return phone;
}

/** @param scale 그림이 작게 보일수록 번호·선을 키운다(휴대폰 그림은 크게 찍어 줄여 보여 준다). */
function Marks({ marks, size: [WIDTH, HEIGHT], scale = 1 }) {
  const arrowId = useId();
  return <svg className="guide-marks" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true"
    style={{ '--mark-stroke': 3 * scale, '--mark-font': 14 * scale + 'px' }}>
    <defs>
      <marker id={arrowId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M0 0L10 5L0 10z" className="guide-arrow-head" />
      </marker>
    </defs>
    {marks.map(mark => {
      if (mark.type === 'arrow') {
        const [x1, y1] = mark.from, [x2, y2] = mark.to;
        return <g key={mark.n}>
          <line x1={x1} y1={y1} x2={x2} y2={y2} className="guide-arrow" markerEnd={`url(#${arrowId})`} />
          <Badge n={mark.n} x={x1} y={y1} size={[WIDTH, HEIGHT]} scale={scale} />
        </g>;
      }
      return <g key={mark.n}>
        <rect x={mark.x} y={mark.y} width={mark.w} height={mark.h} rx={8 * scale} className="guide-box" />
        <Badge n={mark.n} x={mark.x} y={mark.y} size={[WIDTH, HEIGHT]} scale={scale} />
      </g>;
    })}
  </svg>;
}

function Badge({ n, x, y, size: [WIDTH, HEIGHT], scale }) {
  // 번호는 상자 왼쪽 위 모서리에 걸친다(그림 밖으로 나가지 않게 안쪽으로 당긴다).
  const r = 12 * scale, edge = r + 1;
  const cx = Math.min(WIDTH - edge, Math.max(edge, x)), cy = Math.min(HEIGHT - edge, Math.max(edge, y));
  return <g className="guide-badge">
    <circle cx={cx} cy={cy} r={r} />
    <text x={cx} y={cy} dy="0.35em" textAnchor="middle">{n}</text>
  </g>;
}

export function GuideDialog({ onDismiss }) {
  const [index, setIndex] = useState(0);
  const phone = usePhone();
  // 휴대폰이면 그 쪽의 휴대폰판으로 덮어쓴다(그림·표시·설명). 없으면 컴퓨터 화면 그대로.
  const page = phone && GUIDE_PAGES[index].mobile ? { ...GUIDE_PAGES[index], ...GUIDE_PAGES[index].mobile } : GUIDE_PAGES[index];
  const size = page.size ?? DESKTOP_SIZE;
  const last = GUIDE_PAGES.length - 1;
  const go = next => setIndex(Math.max(0, Math.min(last, next)));
  // ←/→로 쪽을 넘긴다(대화창 안에서는 게임 단축키가 꺼져 있어 여기서 따로 받는다).
  function onKeyDown(event) {
    if (event.key === 'ArrowLeft') { event.preventDefault(); go(index - 1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); go(index + 1); }
  }

  return <Dialog id="guide-dialog" title="도움말 · 게임 방법" onDismiss={onDismiss} width="58rem">
    <div className="grid grid-cols-[minmax(0,1fr)] gap-0 md:grid-cols-[11rem_minmax(0,1fr)]" onKeyDown={onKeyDown}>
      <nav aria-label="도움말 목차" className="border-b border-ui-border p-3 md:border-r md:border-b-0">
        <ol className="flex gap-1 overflow-x-auto md:flex-col">
          {GUIDE_PAGES.map((item, i) => <li key={item.id} className="shrink-0">
            <button type="button" aria-current={i === index ? 'step' : undefined} onClick={() => setIndex(i)}
              className="guide-toc w-full rounded-md px-2.5 py-1.5 text-left text-sm whitespace-nowrap">
              <span className="mr-1.5 text-xs tabular-nums opacity-60">{i + 1}</span>{item.title}
            </button>
          </li>)}
        </ol>
      </nav>
      <section className="min-w-0 space-y-3 p-4 sm:p-5" aria-live="polite">
        <h3 className="text-lg font-extrabold">{page.title}</h3>
        <p className="text-sm leading-relaxed break-keep text-ui-secondary">{page.lead}</p>
        <figure className={'guide-figure relative overflow-hidden rounded-xl border border-ui-border ' + (page.size ? 'mx-auto max-w-sm' : '')}>
          <img src={`${import.meta.env.BASE_URL}guide/${page.image}.webp`} alt={page.alt} width={size[0]} height={size[1]}
            className="block h-auto w-full" />
          <Marks marks={page.marks} size={size} scale={page.markScale ?? 1} />
        </figure>
        <ol className="space-y-2">
          {page.notes.map(([name, text], i) => <li key={name} className="flex gap-2.5 text-sm leading-relaxed break-keep">
            <span aria-hidden="true" className="guide-number mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold">{i + 1}</span>
            <span><b>{name}</b> · {text}</span>
          </li>)}
        </ol>
        {page.tips && <ul className="space-y-1.5 rounded-lg bg-ui-subtle px-4 py-3 text-sm leading-relaxed break-keep text-ui-secondary">
          {page.tips.map(tip => <li key={tip} className="flex gap-2"><span aria-hidden="true">💡</span><span>{tip}</span></li>)}
        </ul>}
        <div className="flex items-center justify-between gap-2 pt-1">
          <button type="button" className="control" disabled={index === 0} onClick={() => go(index - 1)}>← 이전</button>
          <span className="text-xs tabular-nums text-ui-caption">{index + 1} / {GUIDE_PAGES.length}</span>
          {index < last
            ? <button type="button" className="control" onClick={() => go(index + 1)}>다음 →</button>
            : <button type="button" className="control" onClick={onDismiss}>다 봤어요</button>}
        </div>
      </section>
    </div>
  </Dialog>;
}
