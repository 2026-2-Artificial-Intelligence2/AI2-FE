import React, { useRef, useState } from 'react';
import { number, signed, won, clock } from './format.js';
import { PriceChart } from './price-chart.jsx';
import { ResizeGrip, useWindowSize } from './window-resize.jsx';
import { KeyHint, useShortcuts } from './shortcuts.jsx';

const percent = value => signed(value, v => v.toFixed(2) + '%');
const movement = value => value > 0 ? 'text-rose-700' : value < 0 ? 'text-blue-700' : 'text-slate-600';
const positive = value => /^[1-9]\d*$/.test(value) ? BigInt(value) : 0n;
const ceilDiv = (a, b) => (a + b - 1n) / b;

function Book({ book, onPrice }) {
  const max = book ? Math.max(1, ...book.asks.map(level => level.shares), ...book.bids.map(level => level.shares)) : 1;
  function levelRow(level, ask) {
    const bar = <span className={'book-quantity ' + (ask ? 'ask' : 'bid')}
      style={{ '--depth': 100 * level.shares / max + '%' }}>{number(level.shares)}</span>;
    return <tr key={(ask ? 'ask-' : 'bid-') + level.priceWon}>
      <td>{ask && bar}</td>
      <td><button className={'book-price ' + (ask ? 'text-blue-700' : 'text-rose-700')}
        aria-label={won(level.priceWon) + ' 지정가 입력'}
        onClick={() => onPrice(level.priceWon)}>{number(level.priceWon)}</button></td>
      <td>{!ask && bar}</td>
    </tr>;
  }
  return <section className="panel p-4">
    <div className="mb-3 flex items-center justify-between gap-2">
      <h3 className="font-bold">5단 호가</h3>
      <span className="text-xs text-slate-500">간격 {book ? won(book.stepWon) : '–'}</span>
    </div>
    {book ? <table className="book-table" aria-label="호가창">
      <thead><tr><th>매도 수량</th><th>가격</th><th>매수 수량</th></tr></thead>
      <tbody>
        {[...book.asks].reverse().map(level => levelRow(level, true))}
        <tr className="bg-slate-100"><td colSpan={3} className="py-2 font-bold">현재가 {won(book.priceWon)}</td></tr>
        {book.bids.map(level => levelRow(level, false))}
      </tbody>
    </table> : <p className="text-sm text-slate-500">호가를 기다리는 중입니다.</p>}
    <p className="mt-3 text-xs leading-relaxed text-slate-500">호가 수량은 직전 가격에서 해당 가격까지 움직이는 데 필요한 주식 수입니다.</p>
  </section>;
}

function orderPreview({ pool, side, mode, quantity, limit, feeBps, cash, available }) {
  const qty = positive(quantity), price = positive(limit);
  if (!pool || !qty || (mode === 'LIMIT' && !price)) return { error: '주문 수량과 가격을 확인하세요.' };
  const buying = side === 'BUY';
  if (!buying && qty > BigInt(available)) return { error: '매도 가능 수량을 초과했습니다.' };
  const shares = BigInt(pool.shares), poolCash = BigInt(pool.cashWon);
  if ((buying || mode === 'LIMIT') && qty >= shares) return { error: '주문 가능 수량을 초과했습니다.' };

  const gross = mode === 'LIMIT' ? qty * price : buying
    ? ceilDiv(shares * poolCash, shares - qty) - poolCash
    : poolCash - ceilDiv(shares * poolCash, shares + qty);
  const fee = ceilDiv(gross * BigInt(feeBps ?? 0), 10000n);
  const total = buying ? gross + fee : gross - fee;
  if (gross > 9223372036854775807n || total > 9223372036854775807n) return { error: '주문 금액 범위를 초과했습니다.' };
  return { total, error: buying && total > BigInt(cash) ? '주문 가능 현금이 부족합니다.' : null };
}

function Order({ game, symbol, mode, setMode, limit, setLimit, name, send }) {
  const [side, setSide] = useState('BUY');
  const [quantity, setQuantity] = useState('1');
  const { market, desk, orders, fill, feeBps, connected } = game;
  const buy = side === 'BUY';
  useShortcuts(connected, { KeyB: () => setSide('BUY'), KeyS: () => setSide('SELL') });
  const cash = desk?.balance.cashWon ?? 0;
  const locked = orders.filter(order => order.symbol === symbol && order.side === '매도')
    .reduce((sum, order) => sum + order.quantity, 0);
  const available = Math.max(0, (market.holdings[symbol] ?? 0) - locked);
  const { total, error } = orderPreview({ pool: market.pools[symbol], side, mode, quantity, limit, feeBps, cash, available });
  const limitOrder = mode === 'LIMIT';
  return <section className="panel p-4">
    <h3 className="mb-3 font-bold">주문</h3>
    <form className="space-y-4" onSubmit={event => {
      event.preventDefault();
      if (error || !desk || !connected) return;
      send((limitOrder ? ['LIMIT', side, symbol, limit, quantity] : [side, symbol, quantity]).join(' '));
    }}>
      <div className="segments grid grid-cols-2" aria-label="주문 방향">
        <button type="button" className="buy" aria-pressed={buy} aria-keyshortcuts="B" onClick={() => setSide('BUY')}>매수 <KeyHint>B</KeyHint></button>
        <button type="button" className="sell" aria-pressed={!buy} aria-keyshortcuts="S" onClick={() => setSide('SELL')}>매도 <KeyHint>S</KeyHint></button>
      </div>
      <label className="block text-sm font-medium">주문 유형
        <select className="field mt-1 w-full" value={mode} onChange={event => setMode(event.target.value)}>
          <option value="MARKET">시장가</option><option value="LIMIT">지정가</option>
        </select>
      </label>
      {limitOrder && <label className="block text-sm font-medium">지정가 (원)
        <input id="limit" className="field mt-1 w-full" type="number" min="1" step="1" required value={limit}
          onChange={event => setLimit(event.target.value)} />
      </label>}
      <label className="block text-sm font-medium">수량 (주)
        <input id="quantity" className="field mt-1 w-full" type="number" min="1" step="1" required value={quantity}
          onChange={event => setQuantity(event.target.value)} />
      </label>
      <dl className="space-y-2 border-t border-slate-200 pt-3 text-sm tabular-nums">
        <div className="flex justify-between gap-2"><dt className="text-slate-600">주문 가능 현금</dt><dd id="cash">{won(cash)}</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-slate-600">매도 가능 수량</dt><dd>{number(available)}주</dd></div>
        {total !== undefined && <div className="flex justify-between gap-2 font-bold">
          <dt>{limitOrder ? buy ? '주문에 묶일 현금' : '지정가 기준 수령액' : '예상 체결 금액'}</dt><dd>{won(total)}</dd>
        </div>}
      </dl>
      <button className={`w-full rounded-lg px-3 py-2.5 font-bold text-white ${buy ? 'bg-rose-700' : 'bg-blue-700'}`}
        type="submit" disabled={!connected || !desk || Boolean(error)}>{buy ? '매수 주문' : '매도 주문'}</button>
      <p className="text-xs text-slate-600">{error ?? '거래 비용 포함 · 체결 금액은 시세에 따라 달라질 수 있습니다.'}</p>
    </form>
    {fill && <p id="fill" role="status" className="mt-3 text-sm">
      {name(fill.symbol)} {fill.quantity}주 {fill.side} 체결 · {won(fill.amount)}
    </p>}
  </section>;
}

function Account({ game, name, send }) {
  const [tab, setTab] = useState('보유 종목');
  const { portfolio } = game.market;
  const positions = Object.entries(portfolio.positions);
  const openProfit = positions.reduce((sum, [, position]) => sum + position.profitWon, 0);
  const tabNames = ['보유 종목', '미체결 주문', '체결 내역'];
  useShortcuts(game.connected, {
    Digit1: () => setTab(tabNames[0]),
    Digit2: () => setTab(tabNames[1]),
    Digit3: () => setTab(tabNames[2]),
  });
  let headings, rows;
  if (tab === tabNames[0]) {
    headings = ['종목', '보유 수량', '평균 매수가', '청산가', '손익'];
    rows = positions.map(([symbol, p]) => [name(symbol), p.shares + '주', won(p.avgPriceWon), won(p.valueWon),
      <span className={movement(p.profitWon)}>{signed(p.profitWon, won)} ({percent(p.profitPercent)})</span>]);
  } else if (tab === tabNames[1]) {
    headings = ['종목', '구분', '지정가', '수량', '주문 관리'];
    rows = game.orders.map(order => [name(order.symbol), order.side, won(order.limitWon), order.quantity + '주',
      <button className="control" disabled={!game.connected} onClick={() => send('CANCEL ' + order.id)}>취소</button>]);
  } else {
    headings = ['시각', '종목', '구분', '수량', '체결 금액', '주당 평균'];
    rows = [...game.trades].reverse().map(trade => [
      clock(trade.second), name(trade.symbol), trade.side, trade.quantity + '주', won(trade.amountWon),
      won(Math.round(trade.amountWon / trade.quantity)),
    ]);
  }
  return <section className="panel p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="segments" aria-label="내 계좌">{tabNames.map((label, index) => <button key={label} aria-pressed={tab === label}
        aria-keyshortcuts={String(index + 1)} onClick={() => setTab(label)}>{label} <KeyHint>{index + 1}</KeyHint></button>)}</div>
      <p className="text-sm text-slate-600">평가 손익 <b className={movement(openProfit)}>{signed(openProfit, won)}</b>
        {' · '}확정 손익 <b className={movement(portfolio.realizedWon)}>{signed(portfolio.realizedWon, won)}</b></p>
    </div>
    <div className="mt-3 overflow-x-auto">
      <table className="data-table">
        <thead><tr>{headings.map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
        <tbody>{rows.length ? rows.map((row, index) => <tr key={index}>{row.map((cell, column) => <td key={column}>{cell}</td>)}</tr>)
          : <tr><td colSpan={headings.length} className="text-slate-500">내역이 없습니다.</td></tr>}</tbody>
      </table>
    </div>
  </section>;
}

export function Market({ visible, game, name, send }) {
  const [selected, setSelected] = useState('');
  const frame = useRef(null);
  const [size, setSize] = useWindowSize('market');
  const [mode, setMode] = useState('MARKET');
  const [limit, setLimit] = useState('');
  const { market, candles } = game;
  const symbols = Object.keys(market.prices);
  const symbol = symbols.includes(selected) ? selected : symbols[0];
  if (!visible || !symbol) return null;
  const price = market.prices[symbol];
  const series = candles[symbol] ?? [];
  const opening = series.find(candle => candle.startSecond === 0)?.open ?? series.findLast(candle => candle.startSecond < 0)?.close;
  const change = opening ? price - opening : null;

  return <section id="market" ref={frame} className="market-window relative"
    style={size ? { width: size.width, height: size.height, maxHeight: '86dvh' } : undefined}>
    <div className="market-content min-h-0 flex-1 space-y-3 overflow-y-auto pb-1">
      <section className="panel flex flex-wrap items-end justify-between gap-4 p-5">
        <div>
          <div className="mb-2 flex items-center gap-2"><h2 className="text-lg font-bold">{name(symbol)}</h2>
            <span className="text-xs font-semibold tracking-wide text-slate-500">{symbol}</span></div>
          <div className="flex flex-wrap items-baseline gap-x-3">
            <p className="text-4xl font-extrabold tracking-tight tabular-nums">{won(price)}</p>
            {change !== null && <p className={'text-sm font-semibold tabular-nums ' + movement(change)}>
              {change > 0 ? '▲ ' : change < 0 ? '▼ ' : ''}{signed(change, won)} ({percent(100 * change / opening)})
              <span className="ml-2 font-normal text-slate-500">출근 시점 대비</span>
            </p>}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium">종목
          <select id="symbol" className="field" value={symbol} onChange={event => {
            setSelected(event.target.value);
            setLimit('');
          }}>
            {symbols.map(id => <option key={id} value={id}>{name(id)}</option>)}
          </select>
        </label>
      </section>
      <div className="market-grid grid items-start gap-3">
        <div className="market-chart min-w-0"><PriceChart key={symbol} candles={series}
          seconds={game.candleSeconds ?? 10} price={price} name={name(symbol)} /></div>
        <Book book={market.books?.[symbol]} onPrice={value => { setLimit(String(value)); setMode('LIMIT'); }} />
        <Order game={game} symbol={symbol} mode={mode} setMode={setMode} limit={limit} setLimit={setLimit}
          name={name} send={send} />
      </div>
      <Account game={game} name={name} send={send} />
    </div>
    <div className="relative mt-1 h-6 shrink-0 rounded-md border border-slate-200 bg-white">
      <ResizeGrip frame={frame} label="주식 창 크기 조절" onResize={setSize} />
    </div>
  </section>;
}
