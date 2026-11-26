import React from 'react';
import { won } from '../shared/format.js';

function Gauge({ label, value, volume = false }) {
  const level = Number.isFinite(value) ? Math.max(0, Math.min(value, 100)) : null;
  const color = level >= 70 ? 'bg-rose-600' : level >= 40 ? 'bg-amber-500' : volume ? 'bg-blue-600 dark:bg-[var(--dark-action)]' : 'bg-indigo-600 dark:bg-[var(--dark-safe)]';
  return <div className="min-w-0 space-y-1">
    <div className="flex justify-between gap-2 text-xs leading-tight">
      <span className="truncate font-medium text-ui-secondary">{label}</span>
      <span className="font-semibold tabular-nums">{level ?? '—'}</span>
    </div>
    <div className="h-1.5 overflow-hidden rounded-full bg-ui-track" role="meter" aria-label={label}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={level ?? undefined}>
      <div className={'h-full rounded-full transition-[width] duration-150 ' + color} style={{ width: (level ?? 0) + '%' }} />
    </div>
  </div>;
}

export function GameGauges({ game, microphone, canOpenLoan, openLoan }) {
  const you = game.room?.youLabel;
  const levels = game.micLevels ?? {};
  const others = Object.entries(levels).filter(([label]) => label !== you);
  const repayment = game.desk?.balance.loanRepayWon ?? 0;
  return <section className="grid w-full min-w-0 gap-x-4 gap-y-3 rounded-lg border border-ui-border bg-ui-subtle p-3 sm:w-auto sm:min-w-80 sm:grid-cols-2"
    aria-label="근무 게이지와 대출">
    <div className="grid content-start gap-2">
      <Gauge label="내 업무 게이지" value={game.market?.suspicion} />
      <button type="button" className="control px-2 py-1 text-xs" aria-haspopup="dialog" disabled={!canOpenLoan}
        onClick={openLoan}>{repayment ? '대출 상환 ' + won(repayment) : '비상 대출'}</button>
    </div>
    <div className="grid content-start gap-2">
      <Gauge label="내 마이크 볼륨" value={levels[you]} volume />
      <button type="button" className="control px-2 py-1 text-xs" aria-pressed={microphone.status === 'on'}
        disabled={!game.connected} onClick={microphone.toggle}>
        {microphone.status === 'on' ? '마이크 끄기' : microphone.status === 'requesting' ? '권한 요청 취소' : '마이크 켜기'}
      </button>
    </div>
    {others.map(([label, value]) => <Gauge key={label} label={label + ' 볼륨'} value={value} volume />)}
    {microphone.error && <p role="status" className="text-xs text-rose-700 dark:text-rose-300 sm:col-span-2">{microphone.error}</p>}
  </section>;
}
