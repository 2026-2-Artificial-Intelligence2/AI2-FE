import React from 'react';

function Gauge({ label, value, volume = false, compact = false, meterLabel = label }) {
  const level = Number.isFinite(value) ? Math.max(0, Math.min(value, 100)) : null;
  const color = level >= 70 ? 'bg-rose-600' : level >= 40 ? 'bg-amber-500' : volume ? 'bg-blue-600 dark:bg-[var(--dark-action)]' : 'bg-indigo-600 dark:bg-[var(--dark-safe)]';
  return <div className={compact
    ? "grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(1.5rem,1fr)] items-center gap-1.5"
    : "min-w-0 space-y-1"}>
    <div className="flex justify-between gap-2 text-xs leading-tight">
      <span className="truncate font-medium text-ui-secondary" title={compact ? label : undefined}>{label}</span>
      {!compact && <span className="font-semibold tabular-nums">{level ?? '—'}</span>}
    </div>
    <div className={'overflow-hidden rounded-full bg-ui-track ' + (compact ? 'h-1' : 'h-1.5')}
      role="meter" aria-label={meterLabel} aria-valuemin={0} aria-valuemax={100}
      aria-valuenow={level ?? 0} aria-valuetext={volume && level === null ? '마이크 꺼짐' : undefined}>
      <div className={'h-full rounded-full transition-[width] duration-150 ' + color} style={{ width: (level ?? 0) + '%' }} />
    </div>
  </div>;
}

export function GameGauges({ game, microphone }) {
  const you = game.room?.youLabel;
  const levels = game.micLevels ?? {};
  const others = (game.room?.members ?? []).filter(member => member.label !== you);
  return <section className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-lg border border-ui-border bg-ui-subtle p-3 min-[48rem]:w-auto min-[48rem]:grid-cols-[minmax(7rem,1fr)_minmax(11rem,1.5fr)_auto]"
    aria-label="업무 및 마이크 게이지">
    <div className="col-span-full min-w-0 min-[48rem]:col-auto">
      <Gauge label="내 업무 게이지" value={game.market?.suspicion} />
    </div>
    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 min-[48rem]:border-l min-[48rem]:border-ui-border min-[48rem]:pl-3"
      role="group" aria-label="마이크 볼륨">
      <Gauge label="내 볼륨" meterLabel="내 마이크 볼륨" value={levels[you]} volume compact />
      {others.map(member => <Gauge key={member.label} label={member.label} meterLabel={member.label + ' 마이크 볼륨'}
        value={member.online ? levels[member.label] : undefined} volume compact />)}
    </div>
    <button type="button" className="control self-center px-2 py-1 text-xs whitespace-nowrap"
      aria-pressed={microphone.status === 'on'} disabled={!game.connected} onClick={microphone.toggle}>
      {microphone.status === 'on' ? '내 마이크 끄기' : microphone.status === 'requesting' ? '권한 요청 취소' : '내 마이크 켜기'}
    </button>
    {microphone.error && <p role="status" className="col-span-full text-xs text-rose-700 dark:text-rose-300">{microphone.error}</p>}
  </section>;
}
