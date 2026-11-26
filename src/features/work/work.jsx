import React, { useEffect, useState } from 'react';
import { clock, number, won } from '../../shared/format.js';
import { KeyHint } from '../../shared/ui/shortcuts.jsx';

const kinds = {
  sheet: { name: '매출 집계', icon: '▦' },
  approval: { name: '전자결재', icon: '▤' },
  mail: { name: '메일 분류', icon: '✉' },
};

function Sheet({ data, answer, onAnswer, disabled, active }) {
  return <div className="overflow-x-auto rounded-lg border border-ui-border">
    <table className="w-full border-collapse text-sm tabular-nums">
      <caption className="bg-indigo-50 dark:bg-[var(--dark-selection)] px-4 py-3 text-left font-semibold text-indigo-950 dark:text-indigo-100">{data.sheet}</caption>
      <thead>
        <tr className="border-b border-ui-border bg-ui-muted text-xs text-ui-caption">
          <td className="w-10" /><th className="px-4 py-1.5 text-left" scope="col">A</th>
          <th className="px-4 py-1.5 text-right" scope="col">B</th>
        </tr>
      </thead>
      <tbody>
        <tr className="border-b border-ui-border bg-ui-subtle font-semibold">
          <td className="border-r border-ui-border text-center text-xs text-ui-caption">1</td>
          <td className="px-4 py-2">항목</td><td className="px-4 py-2 text-right">금액 ({data.unit})</td>
        </tr>
        {data.rows.map((row, index) => <tr key={index} className="border-b border-ui-border">
          <td className="border-r border-ui-border bg-ui-subtle text-center text-xs text-ui-caption">{index + 2}</td>
          <td className="px-4 py-2.5">{row.name}</td>
          <td className="px-4 py-2.5 text-right font-medium">{number(row.amount)}</td>
        </tr>)}
        <tr className="bg-indigo-50/60 dark:bg-[var(--dark-selection)]">
          <td className="border-r border-ui-border text-center text-xs text-ui-caption">{data.rows.length + 2}</td>
          <th scope="row" className="px-4 py-2 text-left text-indigo-950 dark:text-indigo-100">합계</th>
          <td className="px-2 py-1.5 text-right">
            <input className="field w-full max-w-48 border-indigo-300 dark:border-indigo-700 text-right font-semibold" aria-label={'합계 ' + data.targetCell + ' (' + data.unit + ')'}
              id="answer" autoFocus={active} inputMode="numeric" autoComplete="off" value={answer} disabled={disabled}
              onChange={event => onAnswer(event.target.value)} placeholder={data.targetCell} />
          </td>
        </tr>
      </tbody>
    </table>
  </div>;
}

function Choices({ legend, options, answer, onAnswer, disabled }) {
  return <fieldset disabled={disabled} className="min-w-0">
    <legend className="mb-2 text-sm font-semibold">{legend}</legend>
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map(option => <label key={option.value}
        className="flex items-center gap-2 rounded-lg border border-ui-border px-3 py-2 text-sm font-medium has-checked:border-indigo-400 has-checked:bg-indigo-50 dark:has-checked:bg-[var(--dark-selection)]">
        <input type="radio" name="work-answer" className="accent-indigo-700" value={option.value}
          checked={answer === option.value} onChange={() => onAnswer(option.value)} />
        {option.label}
      </label>)}
    </div>
  </fieldset>;
}

function Approval({ data, ...controls }) {
  return <>
    <div className="rounded-lg border border-ui-border">
      <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 px-4 py-4 text-sm">
        <div><dt className="text-ui-caption">문서 번호</dt><dd className="mt-1 font-semibold">{data.docNo}</dd></div>
        <div><dt className="text-ui-caption">기안자</dt><dd className="mt-1 font-semibold">{data.drafter}</dd></div>
        <div><dt className="text-ui-caption">신청 내역</dt><dd className="mt-1 font-semibold">{data.item}</dd></div>
        <div><dt className="text-ui-caption">신청 금액</dt><dd className="mt-1 font-bold tabular-nums">
          {won(data.amountWon)}{data.people && <span className="ml-2 text-xs font-medium text-ui-secondary">{data.people}명</span>}
        </dd></div>
      </dl>
      <p className="border-t border-indigo-100 dark:border-indigo-800 bg-indigo-50 dark:bg-[var(--dark-selection)] px-4 py-3 text-sm text-indigo-950 dark:text-indigo-100">
        <b className="mr-2">결재 규정</b>{data.rule}
      </p>
    </div>
    <Choices {...controls} legend="처리 방법" options={[
      { value: 'APPROVE', label: '승인' }, { value: 'REJECT', label: '반려' },
    ]} />
  </>;
}

function Mail({ data, ...controls }) {
  return <>
    <article className="rounded-lg border border-ui-border">
      <header className="border-b border-ui-border bg-ui-subtle px-4 py-3">
        <h3 className="font-semibold break-words">{data.subject}</h3>
        <p className="mt-1 text-xs break-words text-ui-secondary">보낸 사람 {data.from}</p>
      </header>
      <p className="px-4 py-5 text-sm leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">{data.body}</p>
    </article>
    <Choices {...controls} legend="이동할 폴더" options={data.folders.map(folder => ({ value: folder, label: folder }))} />
  </>;
}

function WorkForm({ task, connected, lunch, active, workError, send }) {
  const [answer, setAnswer] = useState('');
  const [submission, setSubmission] = useState(null);
  const kind = task.kind ?? 'sheet';
  const data = task.data ?? {
    sheet: '매출 합계', unit: '원', rows: [{ name: 'A1', amount: task.a1 }, { name: 'A2', amount: task.a2 }],
    targetCell: 'B4',
  };
  const error = submission && workError !== submission.error ? workError?.message : null;
  const pending = submission && workError === submission.error && connected;
  const disabled = !connected || lunch || pending;
  const value = answer.trim();
  const valid = kind === 'sheet' ? /^\d+(?:,\d{3})*$/.test(value) : Boolean(value);
  const supported = Object.hasOwn(kinds, kind);

  useEffect(() => {
    if (!connected) setSubmission(null);
  }, [connected]);

  function submit(event) {
    event.preventDefault();
    if (!active || disabled || !valid || !supported) return;
    if (send(['WORK', task.number, value].join(' '))) setSubmission({ error: workError });
  }

  const controls = { answer, disabled, onAnswer: setAnswer };
  return <form id="answerForm" className="space-y-4" onSubmit={submit}>
    {kind === 'sheet' && <Sheet data={data} {...controls} active={active && !disabled} />}
    {kind === 'approval' && <Approval data={data} {...controls} />}
    {kind === 'mail' && <Mail data={data} {...controls} />}
    {!supported && <p className="text-sm text-ui-secondary">이 업무 유형을 표시할 수 없습니다.</p>}
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ui-border pt-4">
      <p className="min-h-5 text-sm text-rose-700 dark:text-rose-300" role="status">{error}</p>
      <button type="submit" className="ml-auto rounded-lg bg-indigo-700 dark:bg-[#3d3b50] dark:hover:bg-[#4a4860] px-4 py-2 text-sm font-bold text-white hover:bg-indigo-800"
        disabled={disabled || !valid || !supported}>
        {pending ? '확인 중…' : kind === 'mail' ? '폴더로 이동' : '업무 제출'}
        {kind === 'sheet' && !pending && <KeyHint>Enter</KeyHint>}
      </button>
    </div>
  </form>;
}

export function Work({ game, visible, active, send, gauges }) {
  const { desk, market, connected, workError, workCompletion } = game;
  const { balance, task, rewardWon } = desk;
  const kind = kinds[task.kind ?? 'sheet'];
  const lunch = market?.lunchStartsInSeconds <= 0 && market.lunchEndsInSeconds > 0;

  return <section id="work" hidden={!visible} aria-labelledby="work-title" className="panel overflow-hidden">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ui-border px-4 py-4 sm:px-6">
      <h2 id="work-title" className="text-lg font-bold">사내 업무</h2>
      <p role="status" className="mr-auto text-sm font-medium text-indigo-800 dark:text-indigo-200">
        {workCompletion && '직전 업무 완료 · ' + won(workCompletion.rewardWon) + ' 지급'}
      </p>
      {visible && gauges}
    </header>
    <div className="grid md:grid-cols-[13rem_minmax(0,1fr)]">
      <aside className="border-b border-ui-border bg-ui-subtle px-4 py-4 md:border-r md:border-b-0 sm:px-6">
        <h3 className="mb-3 text-sm font-bold">근무 현황</h3>
        <dl id="balance" className="grid grid-cols-2 gap-3 text-sm tabular-nums sm:grid-cols-3 md:grid-cols-1">
          <div><dt className="text-ui-secondary">처리한 업무</dt><dd className="mt-1 font-semibold">{balance.completedTasks}건</dd></div>
          <div><dt className="text-ui-secondary">누적 업무 수당</dt><dd className="mt-1 font-semibold text-indigo-800 dark:text-indigo-200">{won(balance.workIncomeWon)}</dd></div>
          <div><dt className="text-ui-secondary">사용 가능 현금</dt><dd className="mt-1 font-semibold">{won(balance.cashWon)}</dd></div>
        </dl>
      </aside>
      <div className="min-w-0 space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            {kind && <span aria-hidden="true" className="grid size-9 place-items-center rounded-lg bg-indigo-50 dark:bg-[var(--dark-selection)] text-lg text-indigo-800 dark:text-indigo-200">{kind.icon}</span>}
            <div><p className="text-xs text-ui-secondary">업무 {task.number} · {kind?.name ?? '업무'}</p>
              <h3 className="mt-0.5 font-bold">{task.title ?? '매출 합계 입력'}</h3></div>
          </div>
          <p className="rounded-md bg-indigo-50 dark:bg-[var(--dark-selection)] px-2.5 py-1 text-xs font-semibold text-indigo-900 dark:text-indigo-200">완료 수당 {won(rewardWon)}</p>
        </div>
        {lunch && <p role="status" className="rounded-lg bg-amber-50 dark:bg-amber-950 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
          점심시간 · {clock(market.lunchEndsInSeconds)} 뒤 업무를 제출할 수 있어요.
        </p>}
        <WorkForm key={task.number} task={task} lunch={lunch} connected={connected} active={active} workError={workError} send={send} />
      </div>
    </div>
  </section>;
}
