import React, { useEffect, useState } from 'react';
import { won } from '../../shared/format.js';
import { Dialog } from '../../shared/ui/dialog.jsx';

export function LoanDialog({ game, send, onDismiss }) {
  const [draft, setDraft] = useState('');
  const [request, setRequest] = useState(null);
  const { connected, loan, desk, actionErrors } = game;
  const lastError = actionErrors.LOAN;
  const balance = desk.balance;
  const repayment = balance.loanRepayWon ?? 0;
  const amount = /^\d+$/.test(draft) ? BigInt(draft) : 0n;
  const cap = BigInt(loan.maxWon);
  const valid = amount > 0n && amount <= cap;
  const interest = valid ? (amount * BigInt(loan.interestPercent) + 99n) / 100n : 0n;
  const pending = Boolean(request && request.error === lastError && connected && !repayment);
  const error = request && request.error !== lastError && !repayment ? lastError?.message : null;

  useEffect(() => {
    if (!connected) setRequest(null);
  }, [connected]);

  function submit(event) {
    event.preventDefault();
    if (!valid || !connected || pending || repayment) return;
    if (send('LOAN ' + amount)) setRequest({ error: lastError });
  }

  return <Dialog id="loan-dialog" title="비상 대출" pending={pending} onDismiss={onDismiss}>
    {repayment ? <div className="space-y-4 p-5">
      <p role="status" className="rounded-lg bg-indigo-50 dark:bg-[var(--dark-selection)] px-3 py-2 text-sm font-semibold text-indigo-900 dark:text-indigo-200">
        이번 판 비상 대출을 받았어요.
      </p>
      <dl className="space-y-2 text-sm tabular-nums">
        <div className="flex justify-between gap-2"><dt>사용 가능 현금</dt><dd>{won(balance.cashWon)}</dd></div>
        <div className="flex justify-between gap-2 font-bold"><dt>퇴근 때 상환</dt><dd>{won(repayment)}</dd></div>
      </dl>
      <button type="button" className="control w-full" onClick={onDismiss}>확인</button>
    </div> : <form className="space-y-4 p-5" onSubmit={submit}>
      <p className="text-sm text-ui-secondary">한 판에 한 번 받을 수 있어요. 대출을 받으면 같은 방의 직원들에게 알려져요.</p>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>최대 <b>{won(cap)}</b></span>
        <span>이자율 <b>{loan.interestPercent}%</b></span>
      </div>
      <div className="space-y-1">
        <label htmlFor="loan-amount" className="text-sm font-semibold">신청 금액 (원)</label>
        <div className="flex gap-2">
          <input id="loan-amount" className="field w-full min-w-0" type="text" inputMode="numeric" maxLength={String(cap).length}
            value={draft} disabled={pending || !connected} onChange={event => setDraft(event.target.value)} />
          <button className="control shrink-0" type="button" disabled={pending || !connected}
            onClick={() => setDraft(String(cap))}>최대 금액</button>
        </div>
        {draft && !valid && <p className="text-xs text-rose-700 dark:text-rose-300">1원에서 {won(cap)} 사이의 정수를 입력해 주세요.</p>}
      </div>
      <dl className="space-y-2 rounded-lg bg-ui-subtle px-3 py-3 text-sm tabular-nums">
        <div className="flex justify-between gap-2"><dt>이자</dt><dd>{valid ? won(interest) : '—'}</dd></div>
        <div className="flex justify-between gap-2 border-t border-ui-border pt-2 font-bold">
          <dt>퇴근 때 상환</dt><dd data-loan-repayment>{valid ? won(amount + interest) : '—'}</dd>
        </div>
      </dl>
      {error && <p className="text-sm text-rose-700 dark:text-rose-300" role="alert">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="control" disabled={pending} onClick={onDismiss}>취소</button>
        <button type="submit" disabled={!valid || !connected || pending}
          className="rounded-lg bg-indigo-700 dark:bg-[#3d3b50] dark:hover:bg-[#4a4860] px-4 py-2 text-sm font-bold text-white hover:bg-indigo-800">
          {pending ? '신청 중…' : '대출 받기'}
        </button>
      </div>
    </form>}
  </Dialog>;
}
