import React from 'react';

function Gauge({ label, value, volume = false, compact = false, meterLabel = label }) {
  const level = Number.isFinite(value) ? Math.max(0, Math.min(value, 100)) : null;
  const color = level >= 70 ? 'bg-rose-600' : level >= 40 ? 'bg-amber-500' : volume ? 'bg-blue-600 dark:bg-[var(--dark-action)]' : 'bg-indigo-600 dark:bg-[var(--dark-safe)]';
  return <div className={compact
    ? "col-span-2 grid min-w-0 grid-cols-subgrid items-center"
    : "min-w-0 space-y-1"}>
    <div className={'text-xs leading-tight ' + (compact ? 'min-w-0 text-right' : 'flex justify-between gap-2')}>
      <span className={'truncate font-medium text-ui-secondary ' + (compact ? 'block max-w-[3.25rem]' : '')}
        title={compact ? label : undefined}>{label}</span>
      {!compact && <span className="font-semibold tabular-nums">{level ?? '—'}</span>}
    </div>
    <div className={'overflow-hidden rounded-full bg-ui-track ' + (compact ? 'h-1' : 'h-1.5')}
      role="meter" aria-label={meterLabel} aria-valuemin={0} aria-valuemax={100}
      aria-valuenow={level ?? 0} aria-valuetext={volume && level === null ? '마이크 꺼짐' : undefined}>
      <div className={'h-full rounded-full transition-[width] duration-150 ' + color} style={{ width: (level ?? 0) + '%' }} />
    </div>
  </div>;
}

export function GameGauges({ game }) {
  const you = game.room?.youLabel;
  const levels = game.micLevels ?? {};
  const others = (game.room?.members ?? []).filter(member => member.label !== you);
  return <section className="game-gauges grid min-w-0 items-center gap-x-3 gap-y-2 rounded-lg border border-ui-border bg-ui-subtle p-3"
    aria-label="업무 및 마이크 게이지">
    <Gauge label="내 업무 게이지" value={game.market?.suspicion} />
    {!game.room?.solo && <div className="game-volume-meters grid min-w-0 grid-cols-[fit-content(3.25rem)_minmax(0,1fr)_fit-content(3.25rem)_minmax(0,1fr)] gap-x-1 gap-y-1.5"
      role="group" aria-label="마이크 볼륨">
      <Gauge label="내 볼륨" meterLabel="내 마이크 볼륨" value={levels[you]} volume compact />
      {others.map(member => <Gauge key={member.label} label={member.label} meterLabel={member.label + ' 마이크 볼륨'}
        value={member.online ? levels[member.label] : undefined} volume compact />)}
    </div>}
  </section>;
}
