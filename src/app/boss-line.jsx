import React from 'react';
import { Icon, faUserTie } from '../shared/ui/icon.jsx';

/** 부장님 혼잣말: 매매하고 나서 중얼거린 말이 몇 초 동안 화면 왼쪽 아래에 뜬다(서버가 6초만 보낸다). */
export function BossLine({ market }) {
  const line = market?.boss?.line;
  if (!line) return null;
  return <div role="status" aria-label={'부장님 혼잣말: ' + line} key={market.boss.lineSecond}
    className="boss-line pointer-events-none fixed bottom-6 left-4 z-20 flex max-w-[min(22rem,calc(100vw-8rem))] items-start gap-2 rounded-2xl rounded-bl-sm border border-ui-border bg-ui-surface px-3.5 py-2 text-sm shadow-lg sm:left-6">
    <Icon icon={faUserTie} className="mt-0.5 shrink-0 text-ui-secondary" />
    <span aria-hidden="true" className="min-w-0 break-keep">
      <b className="mr-1 text-xs text-ui-secondary">부장님</b>{line}
    </span>
  </div>;
}
