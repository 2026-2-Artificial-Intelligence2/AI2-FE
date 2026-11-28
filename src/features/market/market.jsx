import React, { useEffect, useRef, useState } from 'react';
import { number, signed, won, clock } from '../../shared/format.js';
import { PriceChart } from './price-chart.jsx';
import { Order } from './order.jsx';
import { ResizeGrip, useWindowSize } from '../../shared/ui/window-resize.jsx';
import { KeyHint, useShortcuts } from '../../shared/ui/shortcuts.jsx';

const percent = value => signed(value, v => v.toFixed(2) + '%');
const movement = value => value > 0 ? 'text-rose-700 dark:text-[var(--dark-up)]' : value < 0 ? 'text-blue-700 dark:text-[var(--dark-down)]' : 'text-ui-secondary';
const openingPrice = candles => candles?.find(candle => candle.startSecond === 0)?.open ??
  candles?.findLast(candle => candle.startSecond < 0)?.close;

function Book({ book, onPrice }) {
  const max = book ? Math.max(1, ...book.asks.map(level => level.shares), ...book.bids.map(level => level.shares)) : 1;
  function levelRow(level, ask) {
    const bar = <span className={'book-quantity ' + (ask ? 'ask' : 'bid')}
      style={{ '--depth': 100 * level.shares / max + '%' }}>{number(level.shares)}</span>;
    return <tr key={(ask ? 'ask-' : 'bid-') + level.priceWon}>
      <td>{ask && bar}</td>
      <td><button className={'book-price ' + (ask ? 'text-blue-700 dark:text-[var(--dark-down)]' : 'text-rose-700 dark:text-[var(--dark-up)]')}
        aria-label={won(level.priceWon) + ' 지정가 입력'}
        onClick={() => onPrice(level.priceWon)}>{number(level.priceWon)}</button></td>
      <td>{!ask && bar}</td>
    </tr>;
  }
  return <section className="panel market-panel overflow-y-auto p-4">
    <div className="mb-3 flex items-center justify-between gap-2">
      <h3 className="font-bold">5단 호가</h3>
      <span className="text-xs text-ui-caption">간격 {book ? won(book.stepWon) : '–'}</span>
    </div>
    {book ? <table className="book-table" aria-label="호가창">
      <thead><tr><th>매도 수량</th><th>가격</th><th>매수 수량</th></tr></thead>
      <tbody>
        {[...book.asks].reverse().map(level => levelRow(level, true))}
        <tr className="bg-ui-muted"><td colSpan={3} className="py-2 font-bold">현재가 {won(book.priceWon)}</td></tr>
        {book.bids.map(level => levelRow(level, false))}
      </tbody>
    </table> : <p className="text-sm text-ui-caption">호가를 기다리는 중입니다.</p>}
    <p className="mt-3 text-xs leading-relaxed text-ui-caption">호가 수량은 직전 가격에서 해당 가격까지 움직이는 데 필요한 주식 수입니다.</p>
  </section>;
}

/**
 * 체결 한 건의 손익. 매도는 평균 매수가 대비 실현 손익(서버가 계산), 매수는 지금 시세로 팔면 얼마인지(거래 비용 뺌).
 * 신용 매수의 빚은 따로 갚아야 하므로 여기서는 주식 값만 비교한다.
 */
function TradeProfit({ trade, buying, price, feeBps = 0 }) {
  let profit = trade.profitWon, rate = trade.returnPercent, note = '실현';
  if (buying) {
    if (!price || !trade.amountWon) return <span className="text-ui-caption">–</span>;
    const gross = price * trade.quantity;
    profit = gross - Math.ceil(gross * feeBps / 10000) - trade.amountWon;
    rate = profit / trade.amountWon * 100;
    note = '지금 팔면';
  }
  if (profit == null) return <span className="text-ui-caption">–</span>;
  return <span className="whitespace-nowrap tabular-nums">
    <b className={movement(profit)}>{signed(profit, won)}</b>
    {rate != null && <span className={'ml-1 ' + movement(profit)}>({percent(rate)})</span>}
    <span className="ml-1.5 text-[11px] text-ui-caption">{note}</span>
  </span>;
}

function Account({ game, name, active, send, onSelect, current }) {
  // 줄 아무 데나 누르면 그 종목 화면(호가·주문)으로 바로 간다: 보유 종목을 빨리 팔 수 있게.
  const stockLink = symbol => <span className="font-semibold">{name(symbol)}</span>;
  let symbols = [];
  const [tab, setTab] = useState('보유 종목');
  const { portfolio } = game.market;
  const positions = Object.entries(portfolio.positions);
  const openProfit = positions.reduce((sum, [, position]) => sum + position.profitWon, 0);
  const tabNames = ['보유 종목', '미체결 주문', '체결 내역'];
  useShortcuts(active && game.connected, {
    Digit1: () => setTab(tabNames[0]),
    Digit2: () => setTab(tabNames[1]),
    Digit3: () => setTab(tabNames[2]),
  });
  let headings, rows;
  if (tab === tabNames[0]) {
    headings = ['종목', '보유 수량', '평균 매수가', '청산가', '손익', '신용 빚', '담보 비율'];
    symbols = positions.map(([symbol]) => symbol);
    rows = positions.map(([symbol, p]) => [stockLink(symbol), p.shares + '주', won(p.avgPriceWon), won(p.valueWon),
      <span className={movement(p.profitWon)}>{signed(p.profitWon, won)} ({percent(p.profitPercent)})</span>, p.debtWon ? won(p.debtWon) : '–', p.debtWon ? p.marginRatioPercent + '%' : '–']);
  } else if (tab === tabNames[1]) {
    headings = ['종목', '구분', '지정가', '수량', '주문 관리'];
    symbols = game.orders.map(order => order.symbol);
    rows = game.orders.map(order => [stockLink(order.symbol), order.side, won(order.limitWon), order.quantity + '주',
      <button className="control" disabled={!active || !game.connected} onClick={() => send('CANCEL ' + order.id)}>취소</button>]);
  } else {
    headings = ['시각', '종목', '구분', '수량', '체결 금액', '주당 평균', '손익'];
    symbols = [...game.trades].reverse().map(trade => trade.symbol);
    rows = [...game.trades].reverse().map(trade => {
      const buying = trade.side.endsWith('매수');
      return [
        clock(trade.second), stockLink(trade.symbol),
        // 매수는 빨강, 매도는 파랑(국내 증권사 관례).
        <span className={'font-semibold ' + movement(buying ? 1 : -1)}>{trade.side}</span>,
        trade.quantity + '주', won(trade.amountWon), won(Math.round(trade.amountWon / trade.quantity)),
        <TradeProfit trade={trade} buying={buying} price={game.market.prices?.[trade.symbol]} feeBps={game.feeBps} />,
      ];
    });
  }
  return <section className="panel p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="segments" aria-label="내 계좌">{tabNames.map((label, index) => <button key={label} aria-pressed={tab === label}
        aria-keyshortcuts={String(index + 1)} onClick={() => setTab(label)}>{label} <KeyHint>{index + 1}</KeyHint></button>)}</div>
      <p className="text-sm text-ui-secondary">평가 손익 <b className={movement(openProfit)}>{signed(openProfit, won)}</b>
        {' · '}확정 손익 <b className={movement(portfolio.realizedWon)}>{signed(portfolio.realizedWon, won)}</b></p>
    </div>
    {tab === tabNames[1] && game.actionErrors.CANCEL && <p role="alert" className="mt-2 text-sm text-rose-700 dark:text-rose-300">
      {game.actionErrors.CANCEL.message}
    </p>}
    <div className="mt-3 overflow-x-auto">
      <table className="data-table">
        <thead><tr>{headings.map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
        <tbody>{rows.length ? rows.map((row, index) => <tr key={index} tabIndex={0} aria-current={symbols[index] === current || undefined}
          title={name(symbols[index]) + ' 주문 화면으로'} className="account-row cursor-pointer"
          // 줄 안의 버튼(주문 취소)은 그대로 버튼으로 쓴다.
          onClick={event => { if (!event.target.closest('button')) onSelect(symbols[index]); }}
          onKeyDown={event => { if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) { event.preventDefault(); onSelect(symbols[index]); } }}>
          {row.map((cell, column) => <td key={column}>{cell}</td>)}</tr>)
          : <tr><td colSpan={headings.length} className="text-ui-caption">내역이 없습니다.</td></tr>}</tbody>
      </table>
    </div>
  </section>;
}

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Market({ visible, active, game, name, send, gauges, loanAction, theme }) {
  const [selected, setSelected] = useState('');
  const [sortBy, setSortBy] = useState('rate');
  const frame = useRef(null);
  const [size, setSize] = useWindowSize('market');
  const [mode, setMode] = useState('MARKET');
  const [limit, setLimit] = useState('');
  const { market, candles } = game;
  const catalogById = new Map(game.stocks.map(stock => [stock.id, stock]));
  const listedStocks = Object.entries(market.prices).map(([id, price]) => {
    const opening = openingPrice(candles[id]);
    const change = opening > 0 ? price - opening : null;
    const sector = catalogById.get(id)?.sector;
    const subtitle = sector ? `${id} · ${sector}` : id;
    return { id, label: name(id), subtitle, price, change, rate: change === null ? null : 100 * change / opening };
  });
  listedStocks.sort((a, b) => {
    if (sortBy === 'rate' && a.rate !== b.rate) {
      if (a.rate === null) return 1;
      if (b.rate === null) return -1;
      return b.rate - a.rate;
    }
    return a.label.localeCompare(b.label, 'ko-KR') || a.id.localeCompare(b.id);
  });
  const selectedStock = listedStocks.find(({ id }) => id === selected) ?? listedStocks[0];
  const symbol = selectedStock?.id;

  useEffect(() => {
    if (!visible || !symbol || selected === symbol) return;
    setSelected(symbol);
    setLimit('');
    setMode('MARKET');
  }, [visible, symbol, selected]);

  if (!visible || !selectedStock) return null;
  const { price, change, rate, subtitle } = selectedStock;
  const series = candles[symbol] ?? [];
  const stock = catalogById.get(symbol);
  const news = (game.history ?? []).filter(item => item.symbols?.some(id => id === symbol || id === stock?.underlying));
  function select(id) {
    setSelected(id);
    setLimit('');
    setMode('MARKET');
  }
  /** 계좌 표에서 고르면 그 종목의 주문 칸이 보이게 올라간다(창 크기에 따라 창 안이나 페이지가 스크롤된다). */
  function open(id) {
    select(id);
    requestAnimationFrame(() => frame.current?.querySelector('.market-order')
      ?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'nearest' }));
  }

  return <section id="market" ref={frame} className="market-window relative"
    style={size ? { width: size.width, height: size.height, maxHeight: '86dvh' } : undefined}>
    <div className="market-content min-h-0 flex-1 space-y-3 overflow-y-auto pb-1">
      <div className="market-layout grid items-start gap-3">
        <div className="market-main min-w-0 space-y-3">
          <header className="panel game-section-header p-5">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1"><h2 className="text-lg font-bold">{name(symbol)}</h2>
                <span className="text-xs font-semibold tracking-wide text-ui-caption">{subtitle}</span></div>
              <div className="flex flex-wrap items-baseline gap-x-3">
                <p className="text-4xl font-extrabold tracking-tight tabular-nums">{won(price)}</p>
                {change !== null && <p className={'text-sm font-semibold tabular-nums ' + movement(change)}>
                  {change > 0 ? '▲ ' : change < 0 ? '▼ ' : ''}{signed(change, won)} ({percent(rate)})
                  <span className="ml-2 font-normal whitespace-nowrap text-ui-caption">출근 시점 대비</span>
                </p>}
              </div>
            </div>
            {loanAction}
            {gauges}
          </header>
          <div className="market-grid grid items-start gap-3">
            <div className="market-chart min-w-0"><PriceChart key={symbol} candles={series}
              seconds={game.candleSeconds ?? 10} theme={theme} price={price} name={name(symbol)} /></div>
            <Book book={market.books?.[symbol]} onPrice={value => { setLimit(String(value)); setMode('LIMIT'); }} />
            <Order key={symbol} game={game} symbol={symbol} mode={mode} setMode={setMode} limit={limit} setLimit={setLimit}
              name={name} active={active} send={send} />
          </div>
          <Account game={game} name={name} active={active} send={send} onSelect={open} current={symbol} />
          <details className="panel p-4">
            <summary className="cursor-pointer font-bold">{name(symbol)} 관련 뉴스 <span className="text-sm text-ui-caption">{news.length}건</span></summary>
            {news.length > 0 ? <ul className="mt-2 divide-y divide-ui-border">
              {[...news].reverse().map(item => <li key={item.number} className="py-2">
                <b className="text-sm">{item.headline}</b>
                {item.body && <p className="mt-1 text-sm text-ui-secondary">{item.body}</p>}
              </li>)}
            </ul> : <p className="mt-2 text-sm text-ui-secondary">아직 관련 뉴스가 없습니다.</p>}
          </details>
        </div>
        <aside className="stock-list panel min-w-0 p-3" aria-label="종목 목록">
          <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-2">
            <h3 className="text-sm font-bold">종목</h3>
            <select className="field px-2 py-1 text-xs" aria-label="종목 정렬" value={sortBy}
              onChange={event => setSortBy(event.target.value)}>
              <option value="rate">상승률순</option>
              <option value="name">이름순</option>
            </select>
          </div>
          <ul className="max-h-72 overflow-y-auto min-[900px]:max-h-[70vh]">
            {listedStocks.map(({ id, label, subtitle, price: latest, rate }) =>
              <li key={id}><button type="button" aria-pressed={id === symbol}
                className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-2 rounded-md px-2 py-2 text-left text-xs hover:bg-ui-muted aria-pressed:bg-blue-50 dark:aria-pressed:bg-[var(--dark-selection)]"
                onClick={() => select(id)}>
                <span className="truncate font-semibold">{label}</span>
                <span className={'text-right font-semibold tabular-nums ' + movement(rate)}>{rate === null ? '–' : percent(rate)}</span>
                <span className="truncate text-ui-caption" title={subtitle}>{subtitle}</span><span className="text-right tabular-nums">{won(latest)}</span>
              </button></li>)}
          </ul>
        </aside>
      </div>
    </div>
    {/* 창 크기 조절은 넓은 화면에서만(휴대폰은 화면 폭 그대로). */}
    <div className="relative mt-1 hidden h-6 shrink-0 rounded-md border border-ui-border bg-ui-surface sm:block">
      <ResizeGrip frame={frame} label="주식 창 크기 조절" onResize={setSize} />
    </div>
  </section>;
}
