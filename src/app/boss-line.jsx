import React from 'react';
import { Icon, faDesktop, faMobileScreenButton, faUserTie } from '../shared/ui/icon.jsx';

/**
 * 부장님 혼잣말: 매매하고 나서 중얼거린 말(서버가 6초만 보낸다). 맨 위 머리줄 빈자리 오른쪽(설정 버튼 옆)에 말풍선으로 떠서
 * 버튼을 가리지 않는다. 자리에서는 모니터를, 걸어 다닐 때는 휴대폰을 보며 한 말이다(3D에서는 머리 위에 뜬다).
 */
export function BossLine({ boss }) {
  const line = boss?.line;
  return <div className="relative hidden min-w-0 self-stretch sm:block sm:flex-1" aria-live="polite">
    {line && <div key={boss.lineSecond} role="status" aria-label={'부장님 혼잣말: ' + line}
      className="boss-line pointer-events-none absolute top-1/2 right-4 flex w-max max-w-[calc(100%-1rem)] -translate-y-1/2 items-center gap-2.5">
      <span aria-hidden="true" className="relative grid size-9 shrink-0 place-items-center rounded-full bg-slate-800 text-white shadow-md dark:bg-slate-200 dark:text-slate-900">
        <Icon icon={faUserTie} />
        <span className="absolute -right-1 -bottom-1 grid size-4.5 place-items-center rounded-full bg-white text-[9px] text-slate-700 ring-1 ring-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:ring-slate-500">
          <Icon icon={boss.atDesk ? faDesktop : faMobileScreenButton} />
        </span>
      </span>
      <span aria-hidden="true" className="boss-line-bubble relative min-w-0 rounded-2xl border px-3.5 py-1.5 text-[15px] leading-snug font-semibold break-keep shadow-md">
        <b className="mr-1.5 text-xs font-bold opacity-70">부장님</b>{line}
      </span>
    </div>}
  </div>;
}
