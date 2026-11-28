// 로그인 없이 기기에 남기는 것: 닉네임, 기기 열쇠(명예의 전당 꼬리표용), 내 기록.
// 저장소를 못 쓰면(사생활 보호 모드 등) 이번 접속 동안만 쓴다.

const NICKNAME = 'officeStockNickname';
const DEVICE = 'officeStockDevice';
const RECORDS = 'officeStockRecords';
const MAX_RECORDS = 50;

function read(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { /* 이번 접속 동안만 쓴다 */ }
}

export const readNickname = () => read(NICKNAME);
export const saveNickname = name => write(NICKNAME, name);

let sessionDevice;
/** 기기 열쇠: 처음 한 번 무작위로 만들어 보관한다. 서버에는 해시만 남고, 같은 기기면 늘 같은 꼬리표가 된다. */
export function deviceKey() {
  let key = read(DEVICE) ?? sessionDevice;
  if (!key) {
    const bytes = crypto.getRandomValues(new Uint8Array(18));
    key = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    write(DEVICE, key);
    sessionDevice = key;
  }
  return key;
}

/** 서버와 같은 방법(SHA-256 앞 8자리 → 0000~9999)으로 이 기기의 꼬리표를 미리 계산한다. */
export async function deviceTag() {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(deviceKey()));
  const hex = [...new Uint8Array(digest).slice(0, 4)].map(b => b.toString(16).padStart(2, '0')).join('');
  return String(parseInt(hex, 16) % 10000).padStart(4, '0');
}

export function readRecords() {
  try { return JSON.parse(read(RECORDS) ?? '[]'); } catch { return []; }
}

/** 한 판 기록을 맨 앞에 더한다(같은 id면 고친다). 최근 50판까지. */
export function saveRecord(record) {
  const records = readRecords().filter(item => item.id !== record.id);
  records.unshift(record);
  write(RECORDS, JSON.stringify(records.slice(0, MAX_RECORDS)));
}

export function updateRecord(id, change) {
  const records = readRecords();
  const index = records.findIndex(item => item.id === id);
  if (index < 0) return;
  records[index] = { ...records[index], ...change };
  write(RECORDS, JSON.stringify(records));
}

/** 내 기록 요약(내 정보 창이 쓰던 모양). */
export function summarize(records) {
  const returns = records.map(item => item.returnPercent).filter(Number.isFinite);
  const multi = records.filter(item => item.mode === 'multi');
  return {
    games: records.length,
    soloGames: records.length - multi.length,
    multiGames: multi.length,
    multiWins: multi.filter(item => item.rank === 1).length,
    totalProfitWon: records.reduce((sum, item) => sum + (item.profitWon ?? 0), 0),
    bestReturnPercent: returns.length ? Math.max(...returns) : null,
    averageReturnPercent: returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : null,
    bankrupt: records.filter(item => item.bankrupt).length,
  };
}
