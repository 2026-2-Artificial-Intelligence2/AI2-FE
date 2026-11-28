import React, { useEffect, useState } from 'react';
import { sfx } from '../../shared/audio/spatial-audio.js';
import { Icon, faBriefcase, faCrown, faFaceSadTear, faMedal, faTrophy, faUserTie } from '../../shared/ui/icon.jsx';
import { clock, number, signed, won } from '../../shared/format.js';

const playerLabel = (player, you) => player === you ? player + ' (나)' : player;
const percent = value => signed(value, v => v.toFixed(2) + '%');
/** 수익은 빨강, 손해는 파랑(국내 증시 관례). 0이면 기본 글자색. */
const movement = value => value > 0 ? 'text-rose-700 dark:text-[var(--dark-up)]'
  : value < 0 ? 'text-blue-700 dark:text-[var(--dark-down)]' : 'text-ui-secondary';
const arrow = value => value > 0 ? '▲ ' : value < 0 ? '▼ ' : '';
/** 1~3위 메달(금·은·동 색). */
const medalColor = { 1: 'text-amber-500', 2: 'text-slate-400', 3: 'text-orange-700 dark:text-orange-400' };
const Medal = ({ rank }) => medalColor[rank] ? <Icon icon={faMedal} className={medalColor[rank]} /> : null;

/** 출근 자금 대비 손익. 서버가 출근 자금을 보내지 않으면(구버전) null. */
function profitOf(row, startingCashWon) {
  if (!(startingCashWon > 0)) return null;
  const amount = row.netWorthWon - startingCashWon;
  return { won: amount, percent: amount / startingCashWon * 100 };
}

function Profit({ profit, className = '' }) {
  if (!profit) return null;
  return <span className={'tabular-nums ' + movement(profit.won) + ' ' + className}>
    {arrow(profit.won)}{signed(profit.won, won)} <span className="font-semibold">({percent(profit.percent)})</span>
  </span>;
}

function RankBadge({ rank }) {
  return <span data-rank={rank} className="result-rank grid size-10 shrink-0 place-items-center rounded-xl text-sm font-extrabold tabular-nums">
    {rank}위
  </span>;
}

function PlayerResult({ row, you, selected, onSelect, scale, profit }) {
  const barWidth = Math.abs(row.netWorthWon) / scale.max * (scale.hasNegative ? 50 : 100);
  const positive = row.netWorthWon >= 0;
  const barStart = scale.hasNegative ? (positive ? 50 : 50 - barWidth) : 0;
  const tone = profit ? (profit.won > 0 ? 'up' : profit.won < 0 ? 'down' : 'flat') : (positive ? 'up' : 'down');
  return <button type="button" data-rank={row.rank} className="result-player relative grid w-full gap-3 rounded-xl border border-ui-border bg-ui-subtle p-3.5 text-left hover:bg-ui-muted"
    aria-pressed={selected} aria-controls="settlement-details" onClick={() => onSelect(row.player)}>
    {row.rank === 1 && <span className="result-crown" aria-hidden="true"><Icon icon={faCrown} /></span>}
    <span className="flex min-w-0 items-start gap-3">
      <RankBadge rank={row.rank} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-bold [overflow-wrap:anywhere]">{playerLabel(row.player, you)}</span>
          <Medal rank={row.rank} />
          {row.bankrupt && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-900 dark:bg-blue-950 dark:text-blue-200">파산</span>}
        </span>
        <span className="mt-0.5 block text-xs text-ui-secondary">최종 순자산</span>
        <span className="block text-lg font-extrabold tabular-nums [overflow-wrap:anywhere]">{won(row.netWorthWon)}</span>
        <Profit profit={profit} className="block text-sm font-bold" />
      </span>
    </span>
    <span className="result-comparison relative block h-1.5 rounded-full bg-ui-track" aria-hidden="true">
      <span data-tone={tone} className="result-bar absolute inset-y-0 rounded-full"
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

function SettlementDetails({ row, you, name, startingCashWon }) {
  const holdings = Object.entries(row.holdings);
  const [loan, margin] = [row.loanRepayWon ?? 0, row.marginDebtWon ?? 0];
  const profit = profitOf(row, startingCashWon);
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
        <dd className={'font-semibold ' + (amount < 0 ? movement(amount) : '')}>{won(amount)}</dd>
      </div>)}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg bg-ui-muted px-3 py-3">
        <dt className="font-semibold">최종 순자산</dt>
        <dd className="text-lg font-extrabold [overflow-wrap:anywhere]">{won(row.netWorthWon)}</dd>
      </div>
      {profit && <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2.5">
        <dt className="text-ui-secondary">출근 자금 {won(startingCashWon)} 대비</dt>
        <dd className="font-bold"><Profit profit={profit} /></dd>
      </div>}
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
        <thead><tr>{['근무 경과', '직원', '종목', '구분', '수량', '체결 금액'].map(label => <th scope="col" key={label}>{label}</th>)}
          <th scope="col"><abbr title="매도: 평균 매수가 대비 실현 수익률 · 매수: 퇴근 때 시세로 팔았다면" className="no-underline">수익률</abbr></th></tr></thead>
        <tbody id="trades">{rows.map((trade, index) => <tr key={index}>
          <td>{clock(trade.second)}</td><td>{playerLabel(trade.player, you)}</td><td>{name(trade.symbol)}</td>
          <td className={'font-semibold ' + movement(trade.side.endsWith('매수') ? 1 : -1)}>{trade.side}</td>
          <td>{number(trade.quantity)}주</td><td>{won(trade.amountWon)}</td>
          <td className={'whitespace-nowrap tabular-nums font-semibold ' + movement(trade.returnPercent ?? 0)}>
            {trade.returnPercent == null ? '—' : signed(trade.returnPercent, v => v.toFixed(1) + '%')}
            {trade.returnPercent != null && <span className="ml-1 text-[11px] font-normal text-ui-caption">{trade.side.endsWith('매수') ? '퇴근 기준' : '실현'}</span>}
          </td>
        </tr>)}</tbody>
      </table>
    </div> : null}
    {rows.length > 0 && <p className="mt-2 text-xs text-ui-caption break-keep">수익률: 매도는 평균 매수가 대비 실현 수익률, 매수는 퇴근 때 시세로 팔았다면 얻었을 수익률이에요(거래 비용 포함).</p>}
    {!rows.length && <p className="mt-4 rounded-lg border border-dashed border-ui-border bg-ui-subtle px-4 py-5 text-center text-sm text-ui-secondary">{mineOnly ? '내 거래가 없었어요.' : '이번 판에는 거래가 없었어요.'}</p>}
  </section>;
}

/** 1등 화면에 한 번 쏟아지는 꽃가루. 움직임 줄이기 설정이면 CSS에서 숨긴다. */
const confetti = Array.from({ length: 36 }, (_, index) => ({
  left: (index * 37 % 100) + Math.random() * 3,
  delay: (index % 9) * 0.12 + Math.random() * 0.3,
  duration: 2.4 + Math.random() * 1.4,
  drift: (Math.random() - 0.5) * 120,
  spin: 360 + Math.random() * 540,
  color: ['#f5445a', '#f5b82e', '#4491ff', '#22b07d', '#a66cff'][index % 5],
  round: index % 3 === 0,
}));

function Confetti() {
  return <div className="result-confetti" aria-hidden="true">
    {confetti.map((piece, index) => <i key={index} data-round={piece.round} style={{
      left: piece.left + '%', background: piece.color, animationDelay: piece.delay + 's', animationDuration: piece.duration + 's',
      '--drift': piece.drift + 'px', '--spin': piece.spin + 'deg',
    }} />)}
  </div>;
}

/** 오늘의 직원상. 서버의 award 이름별 제목·설명·값 표시. */
const awardInfo = {
  scolded: { icon: faUserTie, title: '부장님 단골상', caption: '부장님과 가장 자주 면담했어요', value: v => number(v) + '번 훈계' },
  biggestLoss: { icon: faFaceSadTear, title: '눈물의 퇴근상', caption: '오늘 가장 많이 잃었어요', value: v => won(v) },
  hardestWorker: { icon: faBriefcase, title: '업무왕', caption: '주식보다 업무에 진심이었어요', value: v => number(v) + '건 처리' },
};

function EmployeeAwards({ awards, you }) {
  const shown = awards.filter(award => awardInfo[award.award]);
  if (!shown.length) return null;
  return <section className="panel p-5" aria-labelledby="awards-title">
    <h3 id="awards-title" className="text-lg font-bold">오늘의 직원상</h3>
    <ul className="mt-3 grid gap-2.5 sm:grid-cols-3">
      {shown.map(award => {
        const info = awardInfo[award.award];
        const mine = award.players.includes(you);
        return <li key={award.award} data-award={award.award} data-mine={mine}
          className="result-award flex min-w-0 items-start gap-3 rounded-xl border border-ui-border bg-ui-subtle p-3.5 data-[mine=true]:border-amber-400 data-[mine=true]:bg-amber-50 dark:data-[mine=true]:bg-amber-950/40">
          <span className="result-award-icon grid size-11 shrink-0 place-items-center rounded-xl bg-ui-surface text-xl text-amber-600 dark:text-amber-300" aria-hidden="true"><Icon icon={info.icon} /></span>
          <span className="min-w-0">
            <span className="block font-bold">{info.title}{award.players.length > 1 && <span className="ml-1 text-xs font-semibold text-ui-secondary">공동</span>}</span>
            <span className="block text-xs text-ui-secondary">{info.caption}</span>
            <span className="mt-1 block font-semibold [overflow-wrap:anywhere]">{award.players.map(player => playerLabel(player, you)).join(', ')}</span>
            <span className={'block text-sm font-bold tabular-nums ' + (award.award === 'biggestLoss' ? movement(award.value) : '')}>
              {award.award === 'biggestLoss' && arrow(award.value)}{info.value(award.value)}
            </span>
          </span>
        </li>;
      })}
    </ul>
  </section>;
}

function headline({ mine, winners, solo, profit }) {
  if (!mine) return { title: '퇴근 · 최종 정산' };
  if (solo) {
    if (mine.bankrupt) return { title: '파산 퇴근…', sub: '다음엔 부장님 몰래 조금만 덜 걸어 봐요.' };
    if (profit?.won > 0) return { title: '수익 내고 퇴근!', sub: '오늘 장사 잘했어요. 명예의 전당을 노려 봐요.', celebrate: true };
    return { title: '퇴근 · 최종 정산', sub: profit?.won < 0 ? '오늘은 시장이 야속했어요.' : undefined };
  }
  if (mine.rank === 1) return {
    title: winners.length > 1 ? '공동 주식왕!' : '오늘의 주식왕!',
    sub: '부장님 몰래 누구보다 많이 불렸어요. 축하해요!', celebrate: true,
  };
  return { title: '퇴근 · 최종 정산', sub: mine.rank + '위로 퇴근했어요. 다음 판엔 왕관을 노려 봐요!' };
}

export function Results({ result, name, host, solo, connected, send, restartError }) {
  const { standings, trades, you, startingCashWon } = result;
  const [selected, setSelected] = useState(you);
  const mine = standings.find(row => row.player === you);
  const viewed = standings.find(row => row.player === selected) ?? mine ?? standings[0];
  const winners = standings.filter(row => row.rank === 1);
  const myProfit = mine && profitOf(mine, startingCashWon);
  const { title, sub, celebrate } = headline({ mine, winners, solo, profit: myProfit });
  const showAwards = !solo && result.awards?.length > 0;

  // 방금 퇴근했을 때만(재접속으로 다시 받은 결과는 조용히): 퇴근 종 → 축하·실망 → 직원상.
  useEffect(() => {
    if (!result.fresh) return;
    const timers = [];
    const sad = solo && myProfit?.won < 0;
    if (celebrate) timers.push(setTimeout(sfx.winner, 1100));
    else if (sad) timers.push(setTimeout(sfx.loss, 1100));
    if (showAwards) timers.push(setTimeout(sfx.award, celebrate || sad ? 3600 : 1400));
    return () => timers.forEach(clearTimeout);
  }, [result]);   // eslint-disable-line react-hooks/exhaustive-deps
  const scale = {
    max: Math.max(1, ...standings.map(row => Math.abs(row.netWorthWon))),
    hasNegative: standings.some(row => row.netWorthWon < 0),
  };

  return <section id="results" className="mx-auto max-w-6xl space-y-4" aria-labelledby="results-title">
    <header data-celebrate={Boolean(celebrate)} className="panel results-summary relative isolate overflow-hidden px-5 py-6 sm:px-8 sm:py-8">
      {celebrate && <Confetti />}
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {celebrate && <span className="result-trophy grid size-16 shrink-0 place-items-center rounded-2xl text-4xl sm:size-20 sm:text-4xl" aria-hidden="true"><Icon icon={faTrophy} /></span>}
          <div className="min-w-0">
            <h2 id="results-title" className="results-title text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h2>
            {sub && <p className="mt-1 text-sm leading-relaxed break-keep text-ui-secondary">{sub}</p>}
            {!solo && winners.length > 0 && <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-ui-secondary">
              <span data-rank="1" className="result-rank shrink-0 rounded-full px-3 py-1 text-xs font-bold">
                <Icon icon={faCrown} className="mr-1" />{winners.length > 1 ? '공동 1위' : '1위'}
              </span>
              <span className="min-w-0 font-semibold text-ui-text [overflow-wrap:anywhere]">{winners.map(row => playerLabel(row.player, you)).join(', ')}</span>
            </p>}
          </div>
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
          {myProfit && <dd className="mt-1 text-base font-bold sm:text-lg">
            <span className="mr-1.5 text-sm font-semibold text-ui-secondary">출근 때보다</span>
            <Profit profit={myProfit} />
          </dd>}
        </div>
        <div className="min-w-0 rounded-xl border border-ui-border bg-ui-surface px-3 py-2.5 sm:px-4">
          <dt className="text-sm text-ui-secondary">내 순위</dt>
          <dd className="mt-1 flex flex-wrap items-center gap-x-2 text-xl font-extrabold">
            {mine.rank}위{!solo && <Medal rank={mine.rank} />}
            {mine.bankrupt && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-900 dark:bg-blue-950 dark:text-blue-200">파산</span>}
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

    {showAwards && <EmployeeAwards awards={result.awards} you={you} />}

    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.65fr)]">
      <section className="panel min-w-0 p-5" aria-labelledby="rankings-title">
        <h3 id="rankings-title" className="text-lg font-bold">참가자 순위</h3>
        <p className="mt-1 text-sm text-ui-secondary">직원을 선택해 정산 내역을 확인하세요.</p>
        <ol id="standings" className="mt-4 grid gap-2.5 min-[30rem]:grid-cols-2">
          {standings.map(row => <li key={row.player} className="min-w-0">
            <PlayerResult row={row} you={you} selected={viewed?.player === row.player} onSelect={setSelected} scale={scale}
              profit={profitOf(row, startingCashWon)} />
          </li>)}
        </ol>
      </section>
      {viewed && <SettlementDetails row={viewed} you={you} name={name} startingCashWon={startingCashWon} />}
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
