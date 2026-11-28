import React, { useEffect, useState } from 'react';
import { number, signed } from '../../shared/format.js';
import { deviceTag } from '../../shared/local-profile.js';

// 첫 화면의 이달의 명예의 전당. 혼자 하기에서 퇴근할 때 올린 기록만, 근무 시간별로 따로 겨룬다(최고 수익률 순, 상위 10명).
// 이름 옆 #숫자는 기기 꼬리표라 같은 이름도 구분되고, 이 기기의 꼬리표와 같으면 (나)로 표시한다. 매달 1일 새로 시작한다.
const percent = value => signed(value, result => result.toFixed(2) + '%');
const podium = [
  'bg-amber-400 text-amber-950', 'bg-slate-300 text-slate-900', 'bg-orange-300 text-orange-950',
];

export function LeaderboardPanel({ durations, minutes, onMinutes, boards, month, me, connected, error, onRetry }) {
  const [myTag, setMyTag] = useState(null);
  useEffect(() => { deviceTag().then(setMyTag, () => setMyTag(null)); }, []);
  const monthLabel = month ? Number(month.split('-')[1]) + '월' : '이달';
  const entries = boards?.find(board => board.minutes === minutes)?.entries ?? [];
  const loadError = error || (!connected && !boards ? '서버에 연결되면 순위를 불러와요.' : '');

  return <section aria-labelledby="leaderboard-title" className="panel leaderboard-panel p-4 sm:p-6">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 id="leaderboard-title" className="text-xl font-extrabold tracking-tight">{monthLabel} 명예의 전당</h2>
        <p className="mt-1 text-sm text-ui-secondary">혼자 하기에서 올린 최고 수익률 · 매달 1일에 새로 시작해요</p>
      </div>
      <div role="group" aria-label="근무 시간" className="segments">
        {durations.map(duration => <button key={duration} type="button" aria-pressed={minutes === duration}
          onClick={() => onMinutes(duration)}>{duration}분</button>)}
      </div>
    </header>

    <div className="mt-4">
      {boards ? (entries.length ? <ol className="grid gap-1.5" aria-label={minutes + '분 순위'}>
        {entries.map(row => {
          const mine = row.name === me && row.tag === myTag;
          return <li key={row.name + '#' + row.tag} className={'grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-3 py-2 ' +
            (mine ? 'bg-indigo-50 ring-1 ring-indigo-200 dark:bg-[var(--dark-selection)] dark:ring-indigo-800'
              : row.rank <= 3 ? 'bg-ui-subtle' : '')}>
            <span aria-label={row.rank + '위'} className={'grid size-8 place-items-center rounded-full text-sm font-extrabold tabular-nums ' +
              (podium[row.rank - 1] ?? 'bg-ui-muted text-ui-secondary')}>{row.rank}</span>
            <span className="min-w-0">
              <span className="block truncate font-bold">{row.name}<span className="ml-0.5 text-xs font-medium text-ui-caption">#{row.tag}</span>{mine && <span className="ml-1 text-xs font-semibold text-ui-secondary">(나)</span>}</span>
              <span className="block text-xs text-ui-secondary tabular-nums">
                평균 {percent(row.averageReturnPercent)} · {number(row.games)}판
              </span>
            </span>
            <span className={'text-right text-base font-extrabold tabular-nums ' +
              (row.bestReturnPercent > 0 ? 'text-rose-700 dark:text-rose-300' : row.bestReturnPercent < 0 ? 'text-blue-700 dark:text-blue-300' : '')}>
              {percent(row.bestReturnPercent)}
            </span>
          </li>;
        })}
      </ol> : <p role="status" className="rounded-lg bg-ui-subtle py-8 text-center text-sm text-ui-secondary">
        {monthLabel} {minutes}분 기록이 아직 없어요. 첫 주인공이 되어 보세요!
      </p>)
        : loadError ? <div className="space-y-3 py-6 text-center">
          <p role="alert" className="text-sm text-ui-secondary">{loadError}</p>
          {connected && <button type="button" className="control" onClick={onRetry}>다시 불러오기</button>}
        </div>
          : <p role="status" className="py-8 text-center text-sm text-ui-secondary">순위를 불러오는 중…</p>}
    </div>
  </section>;
}
