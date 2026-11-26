import React, { useState } from 'react';
import { clock, number, won } from '../../shared/format.js';

const playerLabel = (player, you) => player === you ? player + ' (나)' : player;

function SettlementDetails({ row, you, name }) {
  const holdings = Object.entries(row.holdings);
  const [loan, margin] = [row.loanRepayWon ?? 0, row.marginDebtWon ?? 0];
  const amounts = [
    ['현금', row.cashWon],
    ['보유 주식 청산가', row.stockValueWon],
    ['비상 대출 원리금', loan ? -loan : 0],
    ['신용 거래 빚', margin ? -margin : 0],
  ];

  return <section className="panel min-w-0 p-5" aria-labelledby="settlement-title">
    <h3 id="settlement-title" className="font-bold">{playerLabel(row.player, you)} 정산 내역</h3>
    <dl className="mt-3 space-y-2 text-sm tabular-nums">
      {amounts.map(([label, amount]) => <div key={label} className="flex justify-between gap-3">
        <dt className="text-ui-secondary">{label}</dt>
        <dd className={amount < 0 ? 'font-semibold text-blue-800 dark:text-blue-200' : 'font-semibold'}>{won(amount)}</dd>
      </div>)}
      <div className="flex justify-between gap-3 border-t border-ui-border pt-2 font-bold">
        <dt>최종 순자산</dt><dd>{won(row.netWorthWon)}</dd>
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
      <h3 id="trade-log-title" className="font-bold">거래 기록</h3>
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
    </div> : <p className="mt-4 text-sm text-ui-secondary">{mineOnly ? '내 거래가 없었어요.' : '이번 판에는 거래가 없었어요.'}</p>}
  </section>;
}

export function Results({ result, name, host, connected, send }) {
  const { standings, trades, you } = result;
  const [selected, setSelected] = useState(you);
  const mine = standings.find(row => row.player === you);
  const viewed = standings.find(row => row.player === selected) ?? mine ?? standings[0];
  const winners = standings.filter(row => row.rank === 1);

  return <section id="results" className="space-y-4" aria-labelledby="results-title">
    <header className="rounded-xl bg-slate-900 px-5 py-6 text-white sm:px-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="results-title" className="text-lg font-bold">퇴근 · 최종 정산</h2>
          {winners.length > 0 && <p className="mt-1 text-sm text-slate-300">
            {winners.length > 1 ? '공동 1위' : '1위'} · {winners.map(row => playerLabel(row.player, you)).join(', ')}
          </p>}
        </div>
        {host ? <button id="restart" className="rounded-lg bg-ui-surface px-3 py-2 text-sm font-bold text-ui-text hover:bg-indigo-50 dark:hover:bg-indigo-950"
          disabled={!connected} onClick={() => send('RESTART')}>같은 방에서 다시 하기</button>
          : <p className="text-sm text-slate-300">방장이 다시 하기를 누르면 대기실로 돌아가요.</p>}
      </div>
      {mine && <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-3">
        <div><dt className="text-sm text-slate-300">내 순위</dt><dd className="mt-1 text-3xl font-extrabold">
          {mine.rank}위 {mine.bankrupt && <span className="rounded bg-rose-100 dark:bg-rose-950 px-2 py-1 align-middle text-xs text-rose-900 dark:text-rose-200">파산</span>}
        </dd></div>
        <div><dt className="text-sm text-slate-300">내 최종 순자산</dt>
          <dd className="mt-1 text-3xl font-extrabold tracking-tight tabular-nums">{won(mine.netWorthWon)}</dd></div>
      </dl>}
    </header>

    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="panel min-w-0 p-5" aria-labelledby="rankings-title">
        <h3 id="rankings-title" className="font-bold">참가자 순위</h3>
        <p className="mt-1 text-xs text-ui-secondary">직원을 선택하면 현금과 빚을 포함한 정산 내역을 볼 수 있어요.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="data-table">
            <thead><tr>{['순위', '직원', '최종 순자산', '업무 수당', '보유 주식 청산가'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
            <tbody id="standings">{standings.map(row => <tr key={row.player} className={viewed?.player === row.player ? 'bg-indigo-50/70 dark:bg-[var(--dark-selection)]' : ''}>
              <td>{row.rank}위</td>
              <td><button aria-pressed={viewed?.player === row.player} className="font-bold text-indigo-800 dark:text-indigo-200 underline-offset-4 hover:underline"
                onClick={() => setSelected(row.player)}>{playerLabel(row.player, you)}</button>
                {row.bankrupt && <span className="ml-2 font-medium text-rose-700 dark:text-rose-300">파산</span>}
              </td>
              <td className="font-bold">{won(row.netWorthWon)}</td>
              <td>{won(row.workIncomeWon)} <span className="text-xs text-ui-secondary">· {number(row.completedTasks)}건</span></td>
              <td>{won(row.stockValueWon)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>
      {viewed && <SettlementDetails row={viewed} you={you} name={name} />}
    </div>

    <TradeLog trades={trades} you={you} name={name} />
    {result.leaks?.length > 0 && <section className="panel p-5" aria-labelledby="rumor-reveal-title">
      <h3 id="rumor-reveal-title" className="font-bold">익명 찌라시 작성자</h3>
      <ul className="mt-3 divide-y divide-ui-border text-sm">{result.leaks.map(leak => <li key={leak.newsNumber} className="flex flex-wrap gap-x-3 gap-y-1 py-2">
        <b>{playerLabel(leak.player, you)}</b><span className="min-w-0 [overflow-wrap:anywhere]">{leak.text}</span>
      </li>)}</ul>
    </section>}
  </section>;
}
