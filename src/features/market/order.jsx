import React, { useState } from 'react';
import { number, won } from '../../shared/format.js';
import { KeyHint, useShortcuts } from '../../shared/ui/shortcuts.jsx';

const positive = value => /^[1-9]\d*$/.test(value) ? BigInt(value) : 0n;
const ceilDiv = (a, b) => (a + b - 1n) / b;
const maxLong = 9223372036854775807n;

function estimate({ pool, buy, mode, value, limit, feeBps, cash, available, leverage, position }) {
  if (!pool || !value || value > maxLong || (mode === 'LIMIT' && (!limit || limit > maxLong))) return {};
  const shares = BigInt(pool.shares), poolCash = BigInt(pool.cashWon), invariant = shares * poolCash;
  const feeRate = BigInt(feeBps ?? 0);
  const fee = gross => ceilDiv(gross * feeRate, 10000n);
  const grossBuy = qty => ceilDiv(invariant, shares - qty) - poolCash;
  const multiplier = BigInt(leverage);
  let quantity = value;
  if (mode === 'AMOUNT') {
    if (value > cash) return { error: '주문 가능 현금이 부족합니다.' };
    const budget = value * multiplier * 10000n / (10000n + feeRate);
    let low = 0n, high = shares - 1n;
    while (low < high) {
      const middle = (low + high + 1n) / 2n;
      if (grossBuy(middle) <= budget) low = middle;
      else high = middle - 1n;
    }
    quantity = low;
    if (!quantity) return { error: '이 금액으로는 1주도 살 수 없습니다.' };
  }
  if (!buy && quantity > available) return { error: '매도 가능 수량을 초과했습니다.' };
  if ((buy || mode === 'LIMIT') && quantity >= shares) return { error: '주문 가능 수량을 초과했습니다.' };
  const gross = mode === 'LIMIT' ? quantity * limit : buy
    ? grossBuy(quantity) : poolCash - ceilDiv(invariant, shares + quantity);
  if (gross > maxLong || gross * feeRate > maxLong - 9999n) return { error: '주문 금액 범위를 초과했습니다.' };
  const total = buy ? gross + fee(gross) : gross - fee(gross);
  if (total > maxLong) return { error: '주문 금액 범위를 초과했습니다.' };
  const own = buy ? ceilDiv(total, multiplier) : null;
  let repaid = 0n;
  if (!buy && position?.debtWon && position.shares > 0) {
    const owned = BigInt(position.shares);
    repaid = (2n * BigInt(position.debtWon) * quantity + owned) / (2n * owned);
  }
  return { quantity, total, own, repaid, error: buy && own > cash ? '주문 가능 현금이 부족합니다.' : null };
}

export function Order({ game, symbol, mode, setMode, limit, setLimit, name, active, send }) {
  const [side, setSide] = useState('BUY');
  const [quantity, setQuantity] = useState('1');
  const [amount, setAmount] = useState('');
  const [leverage, setLeverage] = useState(1);
  const [all, setAll] = useState(false);
  const { market, desk, orders, fill, feeBps, margin, connected } = game;
  const buy = side === 'BUY';
  const cash = BigInt(desk?.balance.cashWon ?? 0);
  const locked = orders.filter(order => order.symbol === symbol && order.side === '매도')
    .reduce((sum, order) => sum + order.quantity, 0);
  const available = BigInt(Math.max(0, (market.holdings[symbol] ?? 0) - locked));
  const position = market.portfolio.positions[symbol];
  const limitOrder = mode === 'LIMIT', cashOrder = mode === 'AMOUNT' && buy;
  const multiple = buy && !limitOrder && margin?.leverages.includes(leverage) ? leverage : 1;
  const useAll = all && !limitOrder;
  const spendable = cash > 0n ? cash : 0n;
  const maxBuy = useAll && buy && !cashOrder
    ? estimate({ pool: market.pools[symbol], buy, mode: 'AMOUNT', value: spendable,
      feeBps, cash, available, leverage: multiple, position }).quantity ?? 0n
    : 0n;
  const allValue = buy ? (cashOrder ? spendable : maxBuy) : available;
  const value = useAll ? allValue : positive(cashOrder ? amount : quantity);
  const quote = estimate({ pool: market.pools[symbol], buy, mode, value, limit: positive(limit),
    feeBps, cash, available, leverage: multiple, position });
  const error = quote.error ?? game.actionErrors['ORDER:' + symbol]?.message;
  const submitDisabled = !active || !connected || !desk || !quote.quantity || Boolean(quote.error);

  function selectSide(next) {
    setSide(next);
    setAll(false);
    if (next === 'SELL' && mode === 'AMOUNT') setMode('MARKET');
  }
  useShortcuts(active && connected, { KeyB: () => selectSide('BUY'), KeyS: () => selectSide('SELL') });

  function selectAll() {
    setAll(true);
    if (limitOrder) setMode('MARKET');
  }
  function changeQuantity(change) {
    const next = (useAll ? allValue : positive(quantity)) + change;
    setAll(false);
    setQuantity(String(next < 1n ? 1n : next));
  }
  function submit(event) {
    event.preventDefault();
    if (submitDisabled) return;
    const command = limitOrder ? ['LIMIT', side, symbol, limit, value]
      : [cashOrder ? 'BUYWON' : side, symbol, value];
    if (multiple > 1) command.push('x' + multiple);
    send(command.join(' '));
  }

  return <section className="panel market-panel market-order flex min-w-0 flex-col p-4">
    <h3 className="mb-3 shrink-0 font-bold">주문</h3>
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
      <div className="segments mb-2 grid shrink-0 grid-cols-2" aria-label="주문 방향">
        <button type="button" className="buy" aria-pressed={buy} aria-keyshortcuts="B" onClick={() => selectSide('BUY')}>매수 <KeyHint>B</KeyHint></button>
        <button type="button" className="sell" aria-pressed={!buy} aria-keyshortcuts="S" onClick={() => selectSide('SELL')}>매도 <KeyHint>S</KeyHint></button>
      </div>
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-0.5 pb-2 pt-0.5">
        <div className="grid grid-cols-2 gap-2">
          <label className="block min-w-0 text-xs font-semibold">주문 유형
            <select className="field mt-1 w-full px-2" value={mode} onChange={event => { setAll(false); setMode(event.target.value); }}>
              <option value="MARKET">수량 시장가</option>{buy && <option value="AMOUNT">금액 시장가</option>}
              <option value="LIMIT">지정가</option>
            </select>
          </label>
          {buy && !limitOrder && margin?.leverages.length > 0 && <label className="block min-w-0 text-xs font-semibold">매수 방식
            <select className="field mt-1 w-full px-2" value={multiple} onChange={event => setLeverage(Number(event.target.value))}>
              <option value="1">현금</option>
              {margin.leverages.map(value => <option key={value} value={value}>신용 {value}배</option>)}
            </select>
          </label>}
          {limitOrder && <label className="block min-w-0 text-xs font-semibold">지정가 (원)
            <input id="limit" className="field mt-1 w-full px-2" type="number" min="1" step="1" required value={limit}
              onChange={event => setLimit(event.target.value)} />
          </label>}
        </div>
        <div>
          <label className="block text-xs font-semibold" htmlFor={cashOrder ? 'order-amount' : 'quantity'}>
            {cashOrder ? '내 돈 기준 주문 금액 (원)' : '수량 (주)'}
          </label>
          <div className="mt-1 flex items-stretch gap-1">
            <input id={cashOrder ? 'order-amount' : 'quantity'} className="field min-w-0 flex-1 px-2" type="number" min="1" step="1" required
              value={useAll ? String(value) : cashOrder ? amount : quantity}
              onChange={event => { setAll(false); (cashOrder ? setAmount : setQuantity)(event.target.value); }} />
            {!cashOrder && <>
              <button type="button" className="control shrink-0 px-1.5 text-xs" aria-label="수량 10주 줄이기" onClick={() => changeQuantity(-10n)}>−10</button>
              <button type="button" className="control shrink-0 px-1.5 text-xs" aria-label="수량 10주 늘리기" onClick={() => changeQuantity(10n)}>+10</button>
            </>}
            <button type="button" className="control shrink-0 px-1.5 text-xs" aria-pressed={useAll} onClick={selectAll}
              disabled={buy ? cash <= 0n : available <= 0n}>{buy ? '전량 매수' : '전량 매도'}</button>
          </div>
        </div>
        <dl className="space-y-2 border-t border-ui-border pt-3 text-sm tabular-nums">
          <div className="flex justify-between gap-2"><dt className="text-ui-secondary">주문 가능 현금</dt><dd id="cash">{won(cash)}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-ui-secondary">매도 가능 수량</dt><dd>{number(available)}주</dd></div>
          {quote.total !== undefined && <div className="flex justify-between gap-2 font-bold">
            <dt>{limitOrder ? buy ? '주문에 묶일 현금' : '지정가 기준 수령액' : '예상 체결 금액'}</dt><dd>{won(quote.total)}</dd>
          </div>}
          {cashOrder && quote.quantity > 0n && <div className="flex justify-between gap-2"><dt>예상 매수 수량</dt><dd>{number(quote.quantity)}주</dd></div>}
          {multiple > 1 && quote.own !== null && quote.own !== undefined && <>
            <div className="flex justify-between gap-2"><dt>예상 내 돈</dt><dd>{won(quote.own)}</dd></div>
            <div className="flex justify-between gap-2"><dt>예상 신용 빚</dt><dd>{won(quote.total - quote.own)}</dd></div>
          </>}
          {quote.repaid > 0n && <div className="flex justify-between gap-2"><dt>예상 빚 상환</dt><dd>{won(quote.repaid)}</dd></div>}
        </dl>
        {multiple > 1 && <p className="text-xs text-ui-secondary">담보 비율 {margin.maintenancePercent}% 미만이면 반대매매돼요.
          {' '}분당 이자 {(margin.interestBpsPerMinute / 100).toFixed(2)}%.</p>}
        {fill && <p id="fill" role="status" className="rounded bg-ui-muted p-2 text-xs">
          {name(fill.symbol)} {fill.quantity}주 {fill.side} 체결 · {won(fill.amount)}
          {fill.borrowedWon > 0 && ' · 신용 빚 ' + won(fill.borrowedWon)}
          {fill.debtRepaidWon > 0 && ' · 빚 상환 ' + won(fill.debtRepaidWon)}
        </p>}
      </div>
      <p role="status" className={`my-2 min-h-8 shrink-0 text-xs ${error ? 'text-rose-700 dark:text-rose-300' : 'text-ui-secondary'}`}>
        {error ?? '거래 비용 포함 · 체결 금액은 시세에 따라 달라질 수 있습니다.'}
      </p>
      <button className={`w-full shrink-0 rounded-lg px-3 py-2.5 font-bold text-white ${buy
        ? 'bg-rose-700 dark:bg-ui-desktop dark:text-[var(--dark-up)] dark:ring-1 dark:ring-inset dark:ring-ui-input dark:hover:ring-[var(--dark-up)]'
        : 'bg-blue-700 dark:bg-ui-desktop dark:text-[var(--dark-down)] dark:ring-1 dark:ring-inset dark:ring-ui-input dark:hover:ring-[var(--dark-down)]'}`}
        type="submit" disabled={submitDisabled}>{buy ? '매수 주문' : '매도 주문'}</button>
    </form>
  </section>;
}
