import React from 'react';
import { Icon, faDesktop, faMobileScreenButton } from '../shared/ui/icon.jsx';

/**
 * 부장님 혼잣말: 매매하고 나서 중얼거린 말(서버가 6초만 보낸다). 뉴스 알림 바로 위에 뜬다.
 * 자리에서는 모니터를, 걸어 다닐 때는 휴대폰을 보며 한 말이다(3D 사무실에서는 머리 위에 뜬다).
 */
export function BossLine({ boss }) {
  const line = boss?.line;
  if (!line) return null;
  const where = boss.atDesk ? '모니터 보며' : '휴대폰 보며';
  return <div role="status" aria-label={'부장님 혼잣말: ' + line} key={boss.lineSecond}
    className="boss-line notification-preview notification-preview--boss pointer-events-none mr-14 flex w-[min(22rem,calc(100vw-5rem))] items-start gap-2 rounded-br-sm">
    <Icon icon={boss.atDesk ? faDesktop : faMobileScreenButton} className="mt-0.5 shrink-0 text-ui-secondary" />
    <span aria-hidden="true" className="min-w-0 text-sm break-keep">
      <b className="block text-xs text-ui-secondary">부장님 · {where}</b>{line}
    </span>
  </div>;
}
