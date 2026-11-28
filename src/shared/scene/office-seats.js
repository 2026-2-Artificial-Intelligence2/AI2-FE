export const OFFICE_SEATS = [
  [-1, -1], [1, -1], [-1, 1], [1, 1],
  [5, -1], [7, -1], [5, 1], [7, 1],
];

/** 부장님 의자 자리(서쪽, 직원들 쪽을 본다). 서버 Patrol.DESK와 같아야 한다. */
export const BOSS_DESK = { x: -5.3, z: 0, facing: Math.PI / 2 };

export const STAFF = [
  'young_worker', 'male_1_glasses', 'female_1_bob', 'male_2_hoodie',
  'female_2_ponytail', 'male_3_cardigan', 'female_3_jacket', 'male_4_plaid',
];

export function staffAtSeat(position) {
  if (!position) return undefined;
  return STAFF[OFFICE_SEATS.findIndex(([x, z]) => x === position.x && z === position.z)];
}
