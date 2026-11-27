import React, { useEffect, useId, useState } from 'react';

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

function PasswordField({ id, label, autoComplete, disabled, shown, name = 'password' }) {
  return <div className="min-w-0 space-y-1">
    <label htmlFor={id} className="text-xs font-semibold text-ui-secondary">{label}</label>
    <input id={id} name={name} type={shown ? 'text' : 'password'} className="field w-full"
      autoComplete={autoComplete} minLength={6} maxLength={64} disabled={disabled} required />
  </div>;
}

function ShowPassword({ shown, onChange }) {
  return <label className="flex items-center gap-1.5 text-xs text-ui-secondary">
    <input type="checkbox" checked={shown} onChange={event => onChange(event.target.checked)} />
    비밀번호 보기
  </label>;
}

function NameField({ id, label, autoComplete, disabled, hint }) {
  return <div className="space-y-1">
    <label htmlFor={id} className="text-xs font-semibold text-ui-secondary">{label}</label>
    <input id={id} name="name" className="field w-full" autoComplete={autoComplete} minLength={2} maxLength={10}
      pattern={namePattern} title="한글·영문·숫자·_·- 2~10자, 공백 없이" disabled={disabled} required />
    {hint && <p className="text-[11px] text-ui-caption">{hint}</p>}
  </div>;
}

export function AccountEntry({ account, notice, actionErrors, connected, send }) {
  const ids = useId();
  const [tab, setTab] = useState('LOGIN');
  const [switching, setSwitching] = useState(false);
  const [mismatch, setMismatch] = useState('');
  const [shown, setShown] = useState(false);
  const { pending, submit, error } = useRequest({ account, actionErrors, connected, send });

  // 로그인·가입·게스트가 되면 입력 화면을 닫는다.
  useEffect(() => { setSwitching(false); setMismatch(''); }, [account?.name, account?.member]);

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
          <p className="mt-0.5 text-xs text-ui-secondary">
            {account.member ? '판 결과와 1인 플레이 기록이 저장돼요.' : '기록이 저장되지 않아요.'}
          </p>
        </div>
        {account.member
          ? <button type="button" className="control shrink-0 text-xs" disabled={!connected || pending}
            onClick={() => submit('LOGOUT')}>로그아웃</button>
          : <button type="button" className="control shrink-0 text-xs" disabled={!connected}
            onClick={() => { setTab('SIGNUP'); setSwitching(true); }}>회원으로 저장하기</button>}
      </div>
      {error('LOGOUT') && <p role="alert" className="mt-2 text-xs text-rose-700 dark:text-rose-300">{error('LOGOUT')}</p>}
    </section>;
  }

  return <section aria-labelledby={ids + '-title'} className="rounded-xl border border-ui-border p-4">
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

    {/* 세 입력 화면을 같은 칸에 겹쳐 두고 보이는 것만 바꾼다. 칸 높이가 가장 큰 화면(회원가입)에 맞춰져
        탭을 바꿔도 카드 크기가 그대로다. */}
    <div className="mt-3 grid">
      {tabs.map(item => {
        const active = tab === item.id;
        const message = active ? (mismatch || error(item.id) || (!account && notice) || '') : '';
        const isError = active && Boolean(mismatch || error(item.id));
        return <form key={item.id} aria-hidden={!active} inert={!active}
          className={'col-start-1 row-start-1 flex flex-col gap-3 ' + (active ? '' : 'invisible')}
          onSubmit={event => onSubmit(event, item.id)}>
          {item.id === 'LOGIN' && <>
            <NameField id={ids + '-login-name'} label="이름" autoComplete="username" disabled={pending} />
            <PasswordField id={ids + '-login-password'} label="비밀번호" autoComplete="current-password" disabled={pending} shown={shown} />
            <ShowPassword shown={shown} onChange={setShown} />
          </>}
          {item.id === 'SIGNUP' && <>
            <NameField id={ids + '-signup-name'} label="이름" autoComplete="username" disabled={pending}
              hint="한글·영문·숫자 2~10자 · 방과 명예의 전당에 보여요" />
            <div className="grid grid-cols-2 gap-2">
              <PasswordField id={ids + '-signup-password'} label="비밀번호 (6자 이상)" autoComplete="new-password" disabled={pending} shown={shown} />
              <PasswordField id={ids + '-signup-confirm'} name="confirm" label="비밀번호 확인" autoComplete="new-password" disabled={pending} shown={shown} />
            </div>
            <ShowPassword shown={shown} onChange={setShown} />
          </>}
          {item.id === 'GUEST' && <>
            <NameField id={ids + '-guest-name'} label="닉네임" autoComplete="nickname" disabled={pending} />
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950 dark:bg-amber-950 dark:text-amber-100">
              게스트는 판 결과와 꾸미기가 저장되지 않고 명예의 전당에도 오르지 않아요.
            </p>
          </>}
          {/* 안내·오류 자리를 미리 잡아 두어 문구가 생겨도 높이가 바뀌지 않게 한다. */}
          <p role={isError ? 'alert' : 'status'} className={'min-h-4 text-xs leading-4 ' +
            (isError ? 'text-rose-700 dark:text-rose-300' : 'text-ui-secondary')}>{message}</p>
          <div className="mt-auto space-y-3">
            <button type="submit" className="primary-action w-full rounded-lg px-4 py-2.5 text-sm font-bold"
              disabled={!connected || pending}>
              {pending && active ? '확인 중…' : item.id === 'LOGIN' ? '로그인' : item.id === 'SIGNUP' ? '가입하고 시작하기' : '게스트로 시작하기'}
            </button>
            {item.id === 'LOGIN' && <p className="text-center text-xs text-ui-secondary">
              처음이라면 <button type="button" className="font-semibold text-ui-text underline" onClick={() => setTab('SIGNUP')}>회원가입</button>
              {' '}또는 <button type="button" className="font-semibold text-ui-text underline" onClick={() => setTab('GUEST')}>게스트로 시작</button>
            </p>}
          </div>
        </form>;
      })}
    </div>
  </section>;
}
