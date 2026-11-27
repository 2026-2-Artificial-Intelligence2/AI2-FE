import React, { useEffect, useId, useState } from 'react';
import { AccountDialog } from '../account/account-dialog.jsx';
import { RecoveryCodeDialog, ResetPasswordDialog } from '../account/recovery-dialogs.jsx';

// 첫 화면의 "누구로 출근할까요?" 카드. 로그인·회원가입·게스트를 탭으로 바꿔 가며 같은 자리에서 바로 입력한다.
// 들어오면 이름표(이름, 회원/게스트, 기록 저장 여부)로 바뀐다.
const tabs = [
  { id: 'LOGIN', label: '로그인' },
  { id: 'SIGNUP', label: '회원가입' },
  { id: 'GUEST', label: '게스트' },
];
const namePattern = '[가-힣A-Za-z0-9_\\-]{2,10}';

function useRequest({ account, actionErrors, connected, send }) {
  const [request, setRequest] = useState(null);
  const replyError = request ? actionErrors[request.verb] : null;
  const pending = Boolean(request && connected && account === request.account &&
    (!replyError || replyError === request.previousError));
  useEffect(() => {
    if (request && !pending) setRequest(null);
  }, [request, pending]);
  function submit(verb, args = '') {
    if (!connected || pending || !send(verb + args)) return false;
    setRequest({ verb, account, previousError: actionErrors[verb] });
    return true;
  }
  return { pending, submit, error: verb => actionErrors[verb]?.message };
}

function PasswordField({ id, label, autoComplete, disabled, shown, name = 'password', placeholder }) {
  return <div className="min-w-0 space-y-1">
    <label htmlFor={id} className="text-xs font-semibold text-ui-secondary">{label}</label>
    <input id={id} name={name} type={shown ? 'text' : 'password'} className="field w-full"
      autoComplete={autoComplete} minLength={6} maxLength={64} disabled={disabled} placeholder={placeholder} required />
  </div>;
}

function ShowPassword({ shown, onChange }) {
  return <label className="flex items-center gap-1.5 text-xs text-ui-secondary">
    <input type="checkbox" checked={shown} onChange={event => onChange(event.target.checked)} />
    비밀번호 보기
  </label>;
}

function NameField({ id, label, autoComplete, disabled, hint, placeholder }) {
  return <div className="space-y-1">
    <label htmlFor={id} className="text-xs font-semibold text-ui-secondary">{label}</label>
    <input id={id} name="name" className="field w-full" autoComplete={autoComplete} minLength={2} maxLength={10}
      pattern={namePattern} title="한글·영문·숫자·_·- 2~10자, 공백 없이" placeholder={placeholder} disabled={disabled} required />
    {hint && <p className="text-[11px] text-ui-caption">{hint}</p>}
  </div>;
}

export function AccountEntry({ account, notice, actionErrors, connected, send, records, recoveryCode, gameNotice, dismissRecoveryCode }) {
  const ids = useId();
  const [tab, setTab] = useState('LOGIN');
  const [switching, setSwitching] = useState(false);
  const [mismatch, setMismatch] = useState('');
  const [shown, setShown] = useState(false);
  const { pending, submit, error } = useRequest({ account, actionErrors, connected, send });
  const [dialog, setDialog] = useState(null);   // 'ACCOUNT' 내 정보, 'RESET' 비밀번호 찾기
  const [renaming, setRenaming] = useState(false);   // 게스트 닉네임 바꾸기
  const closeDialog = React.useCallback(() => setDialog(null), []);
  // 가입·복구 뒤 새 복구 코드는 다른 창보다 먼저 보여 준다.
  const dialogs = <>
    {dialog === 'ACCOUNT' && <AccountDialog account={account} records={records} recoveryCode={recoveryCode} notice={gameNotice}
      actionErrors={actionErrors} connected={connected} send={send} onDismiss={closeDialog} />}
    {dialog === 'RESET' && <ResetPasswordDialog account={account} actionErrors={actionErrors} connected={connected} send={send}
      onDismiss={closeDialog} />}
    {recoveryCode && dialog !== 'RESET' && <RecoveryCodeDialog key={recoveryCode} code={recoveryCode} onDismiss={dismissRecoveryCode} />}
  </>;

  // 로그인·가입·게스트가 되면 입력 화면을 닫는다.
  useEffect(() => { setSwitching(false); setRenaming(false); setMismatch(''); }, [account?.name, account?.member]);

  // 게스트는 GUEST를 새 닉네임으로 다시 보내면 이름이 바뀐다(방 밖에서만, 저장하는 것은 없다).
  function renameGuest(event) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get('name') ?? '').trim();
    if (!name || name === account.name) { setRenaming(false); return; }
    submit('GUEST', ' ' + name);
  }

  function onSubmit(event, verb) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    if (verb === 'GUEST') {
      submit('GUEST', ' ' + name);
      return;
    }
    const password = String(data.get('password') ?? '');
    if (verb === 'SIGNUP' && password !== data.get('confirm')) {
      setMismatch('비밀번호 확인이 일치하지 않아요.');
      return;
    }
    setMismatch('');
    submit(verb, ' ' + name + ' ' + password);
  }

  if (account && !switching) {
    return <section aria-label="내 이름표" className="rounded-xl border border-ui-border bg-ui-subtle p-4">
      {dialogs}
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className={'grid size-11 shrink-0 place-items-center rounded-full text-base font-extrabold ' +
          (account.member ? 'bg-indigo-700 text-white dark:bg-[#3d3b50]' : 'bg-ui-surface text-ui-secondary ring-1 ring-ui-border')}>
          {account.name.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-base font-bold">{account.name}</span>
            <span className={'rounded px-1.5 py-0.5 text-[11px] font-semibold ' + (account.member
              ? 'bg-indigo-100 text-indigo-900 dark:bg-indigo-900 dark:text-indigo-200'
              : 'bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100')}>
              {account.member ? '회원' : '게스트'}
            </span>
          </p>
          <p className="mt-0.5 text-xs break-keep text-ui-secondary">
            {account.member ? '판 결과와 1인 플레이 기록이 저장돼요.' : '기록이 저장되지 않아요.'}
          </p>
        </div>
        {account.member
          ? <div className="flex shrink-0 flex-col gap-1.5">
            <button type="button" className="control text-xs" disabled={!connected}
              onClick={() => setDialog('ACCOUNT')}>내 정보</button>
            <button type="button" className="control text-xs" disabled={!connected || pending}
              onClick={() => submit('LOGOUT')}>로그아웃</button>
          </div>
          : <div className="flex shrink-0 flex-col gap-1.5">
            <button type="button" className="control text-xs" disabled={!connected || renaming}
              onClick={() => setRenaming(true)}>이름 바꾸기</button>
            <button type="button" className="control text-xs" disabled={!connected}
              onClick={() => { setTab('SIGNUP'); setSwitching(true); }}>회원으로 저장하기</button>
          </div>}
      </div>
      {renaming && <form className="mt-3 flex gap-2 border-t border-ui-border pt-3" onSubmit={renameGuest}>
        <input name="name" aria-label="새 닉네임" className="field min-w-0 flex-1" defaultValue={account.name} autoFocus
          minLength={2} maxLength={10} pattern={namePattern} title="한글·영문·숫자·_·- 2~10자, 공백 없이" required disabled={pending} />
        <button type="submit" className="control shrink-0 text-xs" disabled={!connected || pending}>{pending ? '확인 중…' : '바꾸기'}</button>
        <button type="button" className="shrink-0 text-xs font-semibold text-ui-secondary underline" disabled={pending}
          onClick={() => setRenaming(false)}>취소</button>
      </form>}
      {renaming && error('GUEST') && <p role="alert" className="mt-2 text-xs text-rose-700 dark:text-rose-300">{error('GUEST')}</p>}
      {error('LOGOUT') && <p role="alert" className="mt-2 text-xs text-rose-700 dark:text-rose-300">{error('LOGOUT')}</p>}
    </section>;
  }

  return <section aria-labelledby={ids + '-title'} className="rounded-xl border border-ui-border p-4">
    {dialogs}
    <div className="mb-3 flex items-center justify-between gap-2">
      <h3 id={ids + '-title'} className="text-sm font-bold">누구로 출근할까요?</h3>
      {switching && <button type="button" className="text-xs font-semibold text-ui-secondary underline"
        onClick={() => setSwitching(false)}>취소</button>}
    </div>
    <div role="tablist" aria-label="입장 방법" className="segments grid w-full grid-cols-3">
      {tabs.map(item => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id}
        aria-pressed={tab === item.id} disabled={pending}
        onClick={() => { setTab(item.id); setMismatch(''); }}>{item.label}</button>)}
    </div>

    {/* 입력칸만 같은 칸에 겹쳐 두고(높이 = 가장 큰 입력 화면), 안내·버튼·바로가기는 세 탭이 함께 쓴다.
        그래서 탭을 바꿔도 카드 크기와 버튼 위치가 그대로다. 버튼은 form 속성으로 지금 탭의 입력과 이어진다. */}
    <div className="mt-3 grid">
      {tabs.map(item => {
        const active = tab === item.id;
        return <form key={item.id} id={ids + '-' + item.id} aria-hidden={!active} inert={!active}
          className={'col-start-1 row-start-1 flex flex-col gap-3 ' + (active ? '' : 'invisible')}
          onSubmit={event => onSubmit(event, item.id)}>
          {item.id === 'LOGIN' && <>
            <NameField id={ids + '-login-name'} label="이름" autoComplete="username" disabled={pending} />
            <PasswordField id={ids + '-login-password'} label="비밀번호" autoComplete="current-password" disabled={pending} shown={shown} />
            <ShowPassword shown={shown} onChange={setShown} />
          </>}
          {item.id === 'SIGNUP' && <>
            <NameField id={ids + '-signup-name'} label="이름" autoComplete="username" disabled={pending}
              placeholder="한글·영문·숫자 2~10자" />
            <div className="grid grid-cols-2 gap-2">
              <PasswordField id={ids + '-signup-password'} label="비밀번호" autoComplete="new-password" disabled={pending}
                shown={shown} placeholder="6자 이상" />
              <PasswordField id={ids + '-signup-confirm'} name="confirm" label="비밀번호 확인" autoComplete="new-password"
                disabled={pending} shown={shown} placeholder="한 번 더" />
            </div>
            <ShowPassword shown={shown} onChange={setShown} />
          </>}
          {item.id === 'GUEST' && <>
            <NameField id={ids + '-guest-name'} label="닉네임" autoComplete="nickname" disabled={pending}
              placeholder="한글·영문·숫자 2~10자" />
            {/* 낱말 중간에서 줄이 바뀌지 않게(break-keep) 두 줄로 나눠 쓴다. */}
            <p className="space-y-0.5 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed break-keep text-amber-950 dark:bg-amber-950 dark:text-amber-100">
              <span className="block">게스트 기록은 저장되지 않고 명예의 전당에도 오르지 않아요.</span>
              <span className="block">기록을 남기려면 <button type="button" className="font-semibold underline" onClick={() => setTab('SIGNUP')}>회원가입</button>하세요.</span>
            </p>
          </>}
        </form>;
      })}
    </div>

    {(() => {
      const message = mismatch || error(tab) || (!account && notice) || '';
      const isError = Boolean(mismatch || error(tab));
      return <p role={isError ? 'alert' : 'status'} className={'mt-2 min-h-4 text-xs leading-4 ' +
        (isError ? 'text-rose-700 dark:text-rose-300' : 'text-ui-secondary')}>{message}</p>;
    })()}
    <button type="submit" form={ids + '-' + tab} className="primary-action mt-2 w-full rounded-lg px-4 py-2.5 text-sm font-bold"
      disabled={!connected || pending}>
      {pending ? '확인 중…' : tab === 'LOGIN' ? '로그인' : tab === 'SIGNUP' ? '가입하고 시작하기' : '게스트로 시작하기'}
    </button>
    {/* 바로가기는 로그인 탭에서만 보이지만 자리는 늘 잡아 둔다(카드 높이 고정). */}
    <p aria-hidden={tab !== 'LOGIN'} inert={tab !== 'LOGIN'}
      className={'mt-3 text-center text-xs text-ui-secondary ' + (tab === 'LOGIN' ? '' : 'invisible')}>
      처음이라면 <button type="button" className="font-semibold text-ui-text underline" onClick={() => setTab('SIGNUP')}>회원가입</button>
      {' '}또는 <button type="button" className="font-semibold text-ui-text underline" onClick={() => setTab('GUEST')}>게스트로 시작</button>
      <span className="mx-1.5 text-ui-caption" aria-hidden="true">·</span>
      <button type="button" className="font-semibold text-ui-text underline" onClick={() => setDialog('RESET')}>비밀번호를 잊었어요</button>
    </p>
  </section>;
}
