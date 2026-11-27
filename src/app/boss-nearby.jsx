import React from 'react';
import { useSoundSettings } from '../shared/sound-settings.js';
import { Icon, faArrowUp, faShoePrints } from '../shared/ui/icon.jsx';

// 8방향(내 자리에서 앞이 위쪽 화살표). 화살표(45°씩 돌림)와 글이 늘 같은 방향을 말하도록 한 곳에서 정한다.
// 앞과 옆은 눈으로 보이니 알리지 않고, 보이지 않는 뒤쪽 세 방향만 알린다.
const WHERE = [null, null, null, '오른쪽 뒤', '바로 뒤', '왼쪽 뒤', null, null];

/**
 * 부장님 발소리가 어디서 나는지(내 자리 기준 방향·거리). 발소리와 같은 정보만 보여 준다:
 * 부장님이 걷는 동안, 내 뒤쪽(왼쪽 뒤·바로 뒤·오른쪽 뒤)으로 가까이 왔을 때만 뜨고, 누구에게 가는지는 알려주지 않는다.
 */
export function describeStep(step) {
  const { to, listener } = step;
  const x = to.x - listener.position.x;
  const z = to.z - listener.position.z;
  const ahead = listener.forwardZ * z;     // 앞(+)·뒤(−)
  const right = -listener.forwardZ * x;    // 오른쪽(+)·왼쪽(−)
  const distance = Math.hypot(x, z);
  const angle = Math.atan2(right, ahead);  // 0 = 앞, π/2 = 오른쪽
  const sector = (Math.round(angle / (Math.PI / 4)) + 8) % 8;
  const near = distance <= 1.6 ? 'close' : distance <= 3.2 ? 'near' : 'far';
  return { rotation: sector * 45, where: WHERE[sector], near };
}

const nearLabel = { close: '바로 근처', near: '가까워요' };

export function BossNearby({ market }) {
  const { footstepHint } = useSoundSettings();
  if (!footstepHint || !market?.walking || !market.step) return null;
  const { rotation, where, near } = describeStep(market.step);
  if (near === 'far' || !where) return null;
  return <div role="status" aria-label={'부장님 발소리 ' + where + ' ' + nearLabel[near]} data-near={near}
    className="boss-nearby pointer-events-none fixed bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-bold shadow-lg">
    <Icon icon={faShoePrints} className="text-sm" />
    <span aria-hidden="true" className="boss-nearby-arrow grid size-6 place-items-center rounded-full text-xs">
      <Icon icon={faArrowUp} style={{ transform: `rotate(${rotation}deg)` }} />
    </span>
    <span aria-hidden="true">{where}</span>
    <span aria-hidden="true" className="text-xs font-semibold opacity-80">{nearLabel[near]}</span>
  </div>;
}
