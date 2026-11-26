export const number = value => value.toLocaleString('ko-KR');
export const won = value => number(value) + '원';
export const signed = (value, format = number) => (value > 0 ? '+' : '') + format(value);
export const clock = seconds => {
  const elapsed = Math.abs(seconds);
  return (seconds < 0 ? '−' : '') + Math.floor(elapsed / 60) + ':' + String(elapsed % 60).padStart(2, '0');
};
