import React, { useEffect, useId, useState } from 'react';
import { number, signed, won } from '../../shared/format.js';
import { Dialog } from '../../shared/ui/dialog.jsx';
import { useCommand } from './use-command.js';

// 회원의 "내 정보" 창: 내 전적(요약과 최근 20판)과 계정 관리(이름·비밀번호·복구 코드·회원 탈퇴).
const namePattern = '[가-힣A-Za-z0-9_\\-]{2,10}';
const percent = value => value == null ? '—' : signed(value, v => v.toFixed(2) + '%');
/** 수익은 빨강, 손해는 파랑(국내 증시 관례). */
const tone = value => value > 0 ? 'text-rose-700 dark:text-[var(--dark-up)]'
  : value < 0 ? 'text-blue-700 dark:text-[var(--dark-down)]' : 'text-ui-secondary';
const when = iso => {
  const date = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

function Stat({ label, value, sub, className = '' }) {
  return <div className="min-w-0 rounded-xl border border-ui-border bg-ui-subtle px-3 py-2.5">
    <dt className="text-xs text-ui-secondary">{label}</dt>
    <dd className={'mt-0.5 text-lg font-extrabold tabular-nums [overflow-wrap:anywhere] ' + className}>{value}</dd>
    {sub && <dd className="text-[11px] text-ui-caption">{sub}</dd>}
  </div>;
}

export function Records({ records, error }) {
  if (error) return <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>;
  if (!records) return <p role="status" className="py-8 text-center text-sm text-ui-secondary">전적을 불러오는 중…</p>;
  const { summary, recent } = records;
  if (!summary.games) return <p className="rounded-lg border border-dashed border-ui-border bg-ui-subtle px-4 py-8 text-center text-sm text-ui-secondary">
    아직 끝낸 판이 없어요. 한 판을 끝내면 여기에 쌓여요.
  </p>;
  return <div className="space-y-4">
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <Stat label="전체" value={number(summary.games) + '판'} sub={`함께 ${number(summary.multiGames)} · 혼자 ${number(summary.soloGames)}`} />
      <Stat label="함께 하기 1위" value={number(summary.multiWins) + '번'}
        sub={summary.multiGames ? `${Math.round(summary.multiWins / summary.multiGames * 100)}%` : '함께 한 판 없음'} />
      <Stat label="누적 손익" value={signed(summary.totalProfitWon, won)} className={tone(summary.totalProfitWon)} />
      <Stat label="최고 수익률" value={percent(summary.bestReturnPercent)} className={tone(summary.bestReturnPercent)} />
      <Stat label="평균 수익률" value={percent(summary.averageReturnPercent)} className={tone(summary.averageReturnPercent)} />
      <Stat label="파산" value={number(summary.bankrupt) + '번'} />
    </dl>
    <section aria-labelledby="recent-title">
      <h3 id="recent-title" className="mb-2 text-sm font-bold">최근 {recent.length}판</h3>
      <div className="max-h-72 overflow-auto rounded-lg border border-ui-border">
        <table className="data-table">
          <thead><tr>{['날짜', '방식', '순위', '손익', '수익률'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
          <tbody>{recent.map((row, index) => <tr key={index}>
            <td className="whitespace-nowrap tabular-nums">{when(row.finishedAt)}</td>
            <td className="whitespace-nowrap">{row.mode === 'solo' ? `혼자 ${row.minutes}분` : `함께 ${row.playerCount}명 · ${row.minutes}분`}</td>
            <td className="whitespace-nowrap">{row.mode === 'solo' ? '—' : row.rank ? `${row.rank}위` : '—'}{row.bankrupt && <span className="ml-1 text-xs text-blue-700 dark:text-blue-300">파산</span>}</td>
            <td className={'whitespace-nowrap tabular-nums font-semibold ' + tone(row.profitWon)}>{signed(row.profitWon, won)}</td>
            <td className={'whitespace-nowrap tabular-nums ' + tone(row.returnPercent)}>{percent(row.returnPercent)}
              {row.shared && <span title="명예의 전당에 올린 판" className="ml-1 text-xs text-amber-700 dark:text-amber-300">🏆</span>}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
  </div>;
}

function Feedback({ status, error, done }) {
  if (status === 'failed') return <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{error}</p>;
  if (status === 'done') return <p role="status" className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{done}</p>;
  return null;
}

function Manage({ account, command }) {
  const ids = useId();
  const [mismatch, setMismatch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { run, pending, status, error } = command;

  function changeName(event) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get('name')).trim();
    if (name && name !== account.name) run('PROFILE NAME ' + name, 'PROFILE_NAME');
  }
  function changePassword(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get('password'));
    if (password !== data.get('confirm')) { setMismatch('비밀번호 확인이 일치하지 않아요.'); return; }
    setMismatch('');
    if (run('PROFILE PASSWORD ' + password, 'PROFILE_PASSWORD')) event.currentTarget.reset();
  }
  function deleteAccount(event) {
    event.preventDefault();
    run('PROFILE DELETE ' + new FormData(event.currentTarget).get('password'), 'PROFILE_DELETE');
  }

  return <div className="space-y-5">
    <form className="space-y-2" onSubmit={changeName}>
      <label htmlFor={ids + '-name'} className="text-sm font-bold">이름 바꾸기</label>
      <div className="flex gap-2">
        <input id={ids + '-name'} name="name" className="field min-w-0 flex-1" defaultValue={account.name} required
          minLength={2} maxLength={10} pattern={namePattern} title="한글·영문·숫자·_·- 2~10자, 공백 없이" disabled={pending} />
        <button type="submit" className="control shrink-0" disabled={pending}>바꾸기</button>
      </div>
      <p className="text-xs text-ui-caption">명예의 전당과 다음에 들어가는 방에서 새 이름으로 보여요.</p>
      <Feedback status={status('PROFILE_NAME')} error={error('PROFILE_NAME')} done="이름을 바꿨어요." />
    </form>

    <form className="space-y-2 border-t border-ui-border pt-4" onSubmit={changePassword}>
      <p className="text-sm font-bold">비밀번호 바꾸기</p>
      <div className="grid grid-cols-2 gap-2">
        <input name="password" type="password" className="field min-w-0" placeholder="새 비밀번호(6자 이상)" aria-label="새 비밀번호"
          autoComplete="new-password" minLength={6} maxLength={64} required disabled={pending} />
        <input name="confirm" type="password" className="field min-w-0" placeholder="한 번 더" aria-label="새 비밀번호 확인"
          autoComplete="new-password" minLength={6} maxLength={64} required disabled={pending} />
      </div>
      <button type="submit" className="control" disabled={pending}>비밀번호 바꾸기</button>
      {mismatch ? <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{mismatch}</p>
        : <Feedback status={status('PROFILE_PASSWORD')} error={error('PROFILE_PASSWORD')} done="비밀번호를 바꿨어요." />}
    </form>

    <div className="space-y-2 border-t border-ui-border pt-4">
      <p className="text-sm font-bold">복구 코드</p>
      <p className="text-xs leading-relaxed break-keep text-ui-secondary">
        비밀번호를 잊으면 이름과 복구 코드로 새 비밀번호를 정할 수 있어요. 코드를 잃어버렸다면 새로 만드세요.
        새로 만들면 예전 코드는 더는 쓸 수 없어요.
      </p>
      <button type="button" className="control" disabled={pending}
        onClick={() => run('PROFILE RECOVERY', 'PROFILE_RECOVERY')}>새 복구 코드 만들기</button>
      <Feedback status={status('PROFILE_RECOVERY')} error={error('PROFILE_RECOVERY')} />
    </div>

    <form className="space-y-2 rounded-xl border border-rose-200 bg-rose-50/60 p-3 dark:border-rose-900 dark:bg-rose-950/30" onSubmit={deleteAccount}>
      <p className="text-sm font-bold text-rose-800 dark:text-rose-200">회원 탈퇴</p>
      <p className="text-xs leading-relaxed break-keep text-ui-secondary">
        프로필과 모든 전적, 명예의 전당 기록이 지워지고 되돌릴 수 없어요. 다른 기기의 로그인도 함께 풀려요.
      </p>
      <input name="password" type="password" className="field w-full" placeholder="비밀번호 확인" aria-label="탈퇴할 계정의 비밀번호"
        autoComplete="current-password" minLength={6} maxLength={64} required disabled={pending} />
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={confirmDelete} onChange={event => setConfirmDelete(event.target.checked)} />
        기록이 모두 지워지는 것을 확인했어요.
      </label>
      <button type="submit" disabled={!confirmDelete || pending}
        className="w-full rounded-lg bg-rose-700 px-3 py-2 text-sm font-bold text-white hover:bg-rose-800 disabled:opacity-50">
        탈퇴하기
      </button>
      <Feedback status={status('PROFILE_DELETE')} error={error('PROFILE_DELETE')} />
    </form>
  </div>;
}

export function AccountDialog({ account, records, recoveryCode, notice, actionErrors, connected, send, onDismiss }) {
  const [tab, setTab] = useState('RECORDS');
  // 명령마다 성공했는지 알 수 있는 값: 전적이 새로 오거나, 이름·알림·복구 코드가 바뀌거나, 계정이 사라졌다.
  const watched = { RECORDS: records, PROFILE_NAME: account?.name, PROFILE_PASSWORD: notice,
    PROFILE_RECOVERY: recoveryCode, PROFILE_DELETE: account };
  const command = useCommand({ actionErrors, connected, send }, scope => watched[scope]);

  // 열 때마다 최신 전적을 받아 온다.
  useEffect(() => { if (connected) command.run('RECORDS', 'RECORDS'); }, [connected]);   // eslint-disable-line react-hooks/exhaustive-deps
  // 탈퇴하면 창을 닫는다(입장 화면이 안내 문구를 보여 준다).
  useEffect(() => { if (!account?.member) onDismiss(); }, [account, onDismiss]);

  return <Dialog id="account-dialog" title={'내 정보 · ' + (account?.name ?? '')} pending={command.pending} onDismiss={onDismiss} width="40rem">
    <div className="space-y-4 p-5">
      <div role="tablist" aria-label="내 정보" className="segments grid w-full grid-cols-2">
        <button type="button" role="tab" aria-selected={tab === 'RECORDS'} aria-pressed={tab === 'RECORDS'} onClick={() => setTab('RECORDS')}>내 전적</button>
        <button type="button" role="tab" aria-selected={tab === 'MANAGE'} aria-pressed={tab === 'MANAGE'} onClick={() => setTab('MANAGE')}>계정 관리</button>
      </div>
      {tab === 'RECORDS'
        ? <Records records={records} error={command.error('RECORDS')} />
        : account && <Manage account={account} command={command} />}
    </div>
  </Dialog>;
}
