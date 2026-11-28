import React, { useEffect, useRef, useState } from 'react';
import { clock } from '../shared/format.js';
import { Icon, faUtensils } from '../shared/ui/icon.jsx';

/** 점심시간인가(서버가 보내는 남은 초로 판단). */
export const isLunch = market => market?.lunchStartsInSeconds <= 0 && market?.lunchEndsInSeconds > 0;

/** 머리줄의 점심시간 남은 시간. 업무 창과 주식 창 어디서나 보인다. */
export function LunchClock({ market }) {
  if (!isLunch(market)) return null;
  return <span className="lunch-chip inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums sm:text-sm"
    aria-label={'점심시간 ' + clock(market.lunchEndsInSeconds) + ' 남음'}>
    <Icon icon={faUtensils} className="text-[0.85em]" />
    <span aria-hidden="true">점심 {clock(market.lunchEndsInSeconds)}</span>
  </span>;
}

/** 점심시간이 시작하고 끝날 때 잠깐 뜨는 알림(6초). 판 중간에 들어왔으면(처음 본 상태) 띄우지 않는다. */
export function LunchNotice({ market }) {
  const lunch = market ? isLunch(market) : undefined;
  const last = useRef(undefined);
  const [notice, setNotice] = useState(null);
  useEffect(() => {
    if (lunch === undefined) { last.current = undefined; return; }
    const was = last.current;
    last.current = lunch;
    if (was === undefined || was === lunch) return;
    setNotice(lunch
      ? { id: Date.now(), lunch: true, title: '점심시간이에요!',
          text: `부장님이 자리를 비웠어요. ${clock(market.lunchEndsInSeconds)} 동안 업무 제출은 쉬어요. 부장님이 일찍 돌아올 수도 있어요.` }
      : { id: Date.now(), lunch: false, title: '점심시간 끝', text: '부장님이 돌아왔어요. 업무로 돌아가세요.' });
  }, [lunch]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  if (!notice) return null;
  return <div key={notice.id} role="status" data-lunch={notice.lunch}
    className="lunch-notice pointer-events-none fixed top-20 left-1/2 z-30 flex w-max max-w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 items-start gap-3 rounded-2xl border px-4 py-3 shadow-xl">
    <Icon icon={faUtensils} className="mt-1 shrink-0 text-lg" />
    <span className="min-w-0 break-keep">
      <b className="block text-base">{notice.title}</b>
      <span className="text-sm opacity-90">{notice.text}</span>
    </span>
  </div>;
}
