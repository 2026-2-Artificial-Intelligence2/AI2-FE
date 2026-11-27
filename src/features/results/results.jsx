import React, { useState } from 'react';
import { clock, number, won } from '../../shared/format.js';

const playerLabel = (player, you) => player === you ? player + ' (나)' : player;

function RankBadge({ rank }) {
  return <span data-rank={rank} className="result-rank grid size-10 shrink-0 place-items-center rounded-xl text-sm font-extrabold tabular-nums">
    {rank}위
  </span>;
}

function PlayerResult({ row, you, selected, onSelect, scale }) {
  const barWidth = Math.abs(row.netWorthWon) / scale.max * (scale.hasNegative ? 50 : 100);
  const positive = row.netWorthWon >= 0;
  const barStart = scale.hasNegative ? (positive ? 50 : 50 - barWidth) : 0;
  return <button type="button" className="result-player grid w-full gap-3 rounded-xl border border-ui-border bg-ui-subtle p-3.5 text-left hover:bg-ui-muted"
    aria-pressed={selected} aria-controls="settlement-details" onClick={() => onSelect(row.player)}>
    <span className="flex min-w-0 items-start gap-3">
      <RankBadge rank={row.rank} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-bold [overflow-wrap:anywhere]">{playerLabel(row.player, you)}</span>
          {row.bankrupt && <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">파산</span>}
        </span>
        <span className="mt-0.5 block text-xs text-ui-secondary">최종 순자산</span>
        <span className="block text-lg font-extrabold tabular-nums [overflow-wrap:anywhere]">{won(row.netWorthWon)}</span>
      </span>
    </span>
    <span className="result-comparison relative block h-1.5 rounded-full bg-ui-track" aria-hidden="true">
      <span className={'absolute inset-y-0 rounded-full ' + (positive ? 'result-bar-positive' : 'result-bar-negative')}
        style={{ insetInlineStart: barStart + '%', inlineSize: barWidth + '%' }} />
      {scale.hasNegative && <span className="result-bar-zero absolute inset-y-0 left-1/2 w-px" />}
    </span>
    <span className="grid grid-cols-2 gap-2 border-t border-ui-border pt-2 text-xs tabular-nums">
      <span className="min-w-0">
        <span className="block text-ui-secondary">업무 수당 · {number(row.completedTasks)}건</span>
        <span className="mt-0.5 block font-semibold [overflow-wrap:anywhere]">{won(row.workIncomeWon)}</span>
      </span>
      <span className="min-w-0">
        <span className="block text-ui-secondary">주식 청산가</span>
        <span className="mt-0.5 block font-semibold [overflow-wrap:anywhere]">{won(row.stockValueWon)}</span>
      </span>
    </span>
  </button>;
}

function SettlementDetails({ row, you, name }) {
  const holdings = Object.entries(row.holdings);
  const [loan, margin] = [row.loanRepayWon ?? 0, row.marginDebtWon ?? 0];
  const amounts = [
    ['현금', row.cashWon],
    ['보유 주식 청산가', row.stockValueWon],
    ['비상 대출 원리금', loan ? -loan : 0],
    ['신용 거래 빚', margin ? -margin : 0],
  ];

  return <section id="settlement-details" className="panel min-w-0 self-start p-5" aria-labelledby="settlement-title">
    <h3 id="settlement-title" className="text-lg font-bold [overflow-wrap:anywhere]">{playerLabel(row.player, you)} 정산 내역</h3>
    <dl className="mt-4 divide-y divide-ui-border text-sm tabular-nums">
      {amounts.map(([label, amount]) => <div key={label} className="flex justify-between gap-3 py-2.5">
        <dt className="text-ui-secondary">{label}</dt>
        <dd className={amount < 0 ? 'font-semibold text-blue-800 dark:text-blue-200' : 'font-semibold'}>{won(amount)}</dd>
      </div>)}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg bg-ui-muted px-3 py-3">
        <dt className="font-semibold">최종 순자산</dt>
        <dd className="text-lg font-extrabold [overflow-wrap:anywhere]">{won(row.netWorthWon)}</dd>
      </div>
    </dl>
    <p className="mt-4 text-xs leading-relaxed text-ui-secondary">
      주식 청산가는 퇴근 시점에 보유 주식을 전부 팔았을 때 받을 금액이에요.
    </p>
    {holdings.length > 0 && <ul aria-label="퇴근 시 보유 주식" className="mt-3 flex flex-wrap gap-1.5">
      {holdings.map(([symbol, shares]) => <li key={symbol} className="rounded-md bg-ui-muted px-2 py-1 text-xs">
        {name(symbol)} {number(shares)}주
      </li>)}
    </ul>}
  </section>;
}

function TradeLog({ trades, you, name }) {
  const [mineOnly, setMineOnly] = useState(false);
  const rows = (mineOnly ? trades.filter(trade => trade.player === you) : trades).slice().reverse();
  return <section className="panel min-w-0 p-5" aria-labelledby="trade-log-title">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 id="trade-log-title" className="text-lg font-bold">거래 기록</h3>
      <div className="segments" aria-label="거래 기록 범위">
        <button aria-pressed={!mineOnly} onClick={() => setMineOnly(false)}>전체</button>
        <button aria-pressed={mineOnly} onClick={() => setMineOnly(true)}>내 거래</button>
      </div>
    </div>
    {rows.length ? <div className="mt-3 max-h-72 overflow-auto">
      <table className="data-table">
        <thead><tr>{['근무 경과', '직원', '종목', '구분', '수량', '체결 금액'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
        <tbody id="trades">{rows.map((trade, index) => <tr key={index}>
          <td>{clock(trade.second)}</td><td>{playerLabel(trade.player, you)}</td><td>{name(trade.symbol)}</td>
          <td>{trade.side}</td><td>{number(trade.quantity)}주</td><td>{won(trade.amountWon)}</td>
        </tr>)}</tbody>
      </table>
    </div> : <p className="mt-4 rounded-lg border border-dashed border-ui-border bg-ui-subtle px-4 py-5 text-center text-sm text-ui-secondary">{mineOnly ? '내 거래가 없었어요.' : '이번 판에는 거래가 없었어요.'}</p>}
  </section>;
}

export function Results({ result, name, host, solo, connected, send, restartError }) {
  const { standings, trades, you } = result;
  const [selected, setSelected] = useState(you);
  const mine = standings.find(row => row.player === you);
  const viewed = standings.find(row => row.player === selected) ?? mine ?? standings[0];
  const winners = standings.filter(row => row.rank === 1);
  const scale = {
    max: Math.max(1, ...standings.map(row => Math.abs(row.netWorthWon))),
    hasNegative: standings.some(row => row.netWorthWon < 0),
  };

  return <section id="results" className="mx-auto max-w-6xl space-y-4" aria-labelledby="results-title">
    <header className="panel results-summary relative isolate overflow-hidden px-5 py-6 sm:px-8 sm:py-8">
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id="results-title" className="text-2xl font-extrabold tracking-tight sm:text-3xl">퇴근 · 최종 정산</h2>
          {winners.length > 0 && <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-ui-secondary">
            <span data-rank="1" className="result-rank shrink-0 rounded-full px-3 py-1 text-xs font-bold">
              {winners.length > 1 ? '공동 1위' : '1위'}
            </span>
            <span className="min-w-0 font-medium [overflow-wrap:anywhere]">{winners.map(row => playerLabel(row.player, you)).join(', ')}</span>
          </p>}
        </div>
        {host && <div className="space-y-2">
          <button id="restart" className="primary-action rounded-lg px-4 py-2.5 text-sm font-bold"
            disabled={!connected} onClick={() => send('RESTART')}>{solo ? '다시 하기' : '같은 방에서 다시 하기'}</button>
          {restartError && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{restartError}</p>}
        </div>}
      </div>
      {!host && <p className="relative mt-3 text-sm leading-relaxed break-keep text-ui-secondary">
        방장이 다시 하기를 누르면 대기실로 돌아가요.
      </p>}
      {mine && <dl className="relative mt-6 grid min-w-0 grid-cols-2 gap-3 border-t border-ui-border pt-5 tabular-nums sm:grid-cols-[minmax(0,1.7fr)_minmax(0,0.8fr)_minmax(0,1fr)]">
        <div className="col-span-full min-w-0 sm:col-auto">
          <dt className="text-sm font-semibold text-ui-secondary">내 최종 순자산</dt>
          <dd className="results-net-worth mt-1 leading-tight font-extrabold tracking-tight [overflow-wrap:anywhere]">{won(mine.netWorthWon)}</dd>
        </div>
        <div className="min-w-0 rounded-xl border border-ui-border bg-ui-surface px-3 py-2.5 sm:px-4">
          <dt className="text-sm text-ui-secondary">내 순위</dt>
          <dd className="mt-1 flex flex-wrap items-center gap-x-2 text-xl font-extrabold">
            {mine.rank}위 {mine.bankrupt && <span className="rounded bg-rose-100 px-1.5 py-0.5 text-xs text-rose-900 dark:bg-rose-950 dark:text-rose-200">파산</span>}
          </dd>
        </div>
        <div className="min-w-0 rounded-xl border border-ui-border bg-ui-surface px-3 py-2.5 sm:px-4">
          <dt className="text-sm text-ui-secondary">업무 수당</dt>
          <dd className="mt-1 text-xl font-extrabold [overflow-wrap:anywhere]">{won(mine.workIncomeWon)}</dd>
          <dd className="mt-0.5 text-xs text-ui-secondary">업무 {number(mine.completedTasks)}건 완료</dd>
        </div>
      </dl>}
      {result.recordNotice && <p data-recorded={result.recorded} className="relative mt-4 text-sm leading-relaxed text-ui-secondary data-[recorded=true]:font-semibold data-[recorded=true]:text-ui-text">
        {result.recordNotice}
      </p>}
    </header>

    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.65fr)]">
      <section className="panel min-w-0 p-5" aria-labelledby="rankings-title">
        <h3 id="rankings-title" className="text-lg font-bold">참가자 순위</h3>
        <p className="mt-1 text-sm text-ui-secondary">직원을 선택해 정산 내역을 확인하세요.</p>
        <ol id="standings" className="mt-4 grid gap-2.5 min-[30rem]:grid-cols-2">
          {standings.map(row => <li key={row.player} className="min-w-0">
            <PlayerResult row={row} you={you} selected={viewed?.player === row.player} onSelect={setSelected} scale={scale} />
          </li>)}
        </ol>
      </section>
      {viewed && <SettlementDetails row={viewed} you={you} name={name} />}
    </div>

    <TradeLog trades={trades} you={you} name={name} />
    {result.leaks?.length > 0 && <section className="panel p-5" aria-labelledby="rumor-reveal-title">
      <h3 id="rumor-reveal-title" className="text-lg font-bold">익명 찌라시 작성자</h3>
      <ul className="mt-3 divide-y divide-ui-border text-sm">{result.leaks.map(leak => <li key={leak.newsNumber} className="flex flex-wrap gap-x-3 gap-y-1 py-2">
        <b>{playerLabel(leak.player, you)}</b><span className="min-w-0 [overflow-wrap:anywhere]">{leak.text}</span>
      </li>)}</ul>
    </section>}
  </section>;
}
