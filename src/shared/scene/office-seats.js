export const OFFICE_SEATS = [
  [-1, -1], [1, -1], [-1, 1], [1, 1],
  [5, -1], [7, -1], [5, 1], [7, 1],
];

export const STAFF = [
  'young_worker', 'male_1_glasses', 'female_1_bob', 'male_2_hoodie',
  'female_2_ponytail', 'male_3_cardigan', 'female_3_jacket', 'male_4_plaid',
];

export function staffAtSeat(position) {
  if (!position) return undefined;
  return STAFF[OFFICE_SEATS.findIndex(([x, z]) => x === position.x && z === position.z)];
}
