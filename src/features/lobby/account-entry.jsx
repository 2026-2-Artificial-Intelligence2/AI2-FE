import React, { useEffect, useId, useState } from 'react';
import { Dialog } from '../../shared/ui/dialog.jsx';
import { readRecords, summarize } from '../../shared/local-profile.js';
import { Records } from '../account/account-dialog.jsx';

// 첫 화면의 "누구로 출근할까요?" 카드. 로그인 없이 닉네임만 정하고, 이 기기가 기억한다.
// 내 기록도 이 기기에 남고, 혼자 하기는 퇴근 화면에서 명예의 전당에 올릴지 고른다.
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

/** 내 기록: 이 기기에 남은 판들(최근 50판). */
function MyRecordsDialog({ name, onDismiss }) {
  const recent = readRecords();
  return <Dialog id="my-records" title={'내 기록 · ' + name} onDismiss={onDismiss} width="40rem">
    <div className="space-y-3 p-5">
      <Records records={{ summary: summarize(recent), recent }} />
      <p className="text-xs leading-relaxed break-keep text-ui-caption">
        기록은 이 기기(브라우저)에만 남아요. 다른 기기나 브라우저에서는 따로 쌓여요.
      </p>
    </div>
  </Dialog>;
}

function NameInput({ id, defaultValue, disabled, autoFocus }) {
  return <input id={id} name="name" className="field min-w-0 flex-1" autoComplete="nickname" defaultValue={defaultValue}
    minLength={2} maxLength={10} pattern={namePattern} title="한글·영문·숫자·_·- 2~10자, 공백 없이"
    placeholder="한글·영문·숫자 2~10자" disabled={disabled} autoFocus={autoFocus} required />;
}

export function AccountEntry({ account, notice, actionErrors, connected, send }) {
  const ids = useId();
  const { pending, submit, error } = useRequest({ account, actionErrors, connected, send });
  const [renaming, setRenaming] = useState(false);
  const [recordsOpen, setRecordsOpen] = useState(false);

  useEffect(() => { setRenaming(false); }, [account?.name]);

  function onSubmit(event) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get('name') ?? '').trim();
    if (!name || name === account?.name) { setRenaming(false); return; }
    submit('GUEST', ' ' + name);
  }

  if (account && !renaming) {
    return <section aria-label="내 이름표" className="rounded-xl border border-ui-border bg-ui-subtle p-4">
      {recordsOpen && <MyRecordsDialog name={account.name} onDismiss={() => setRecordsOpen(false)} />}
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-indigo-700 text-base font-extrabold text-white dark:bg-[#3d3b50]">
          {account.name.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold">{account.name}</p>
          <p className="mt-0.5 text-xs break-keep text-ui-secondary">내 기록은 이 기기에 남아요.</p>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <button type="button" className="control text-xs" onClick={() => setRecordsOpen(true)}>내 기록</button>
          <button type="button" className="control text-xs" disabled={!connected} onClick={() => setRenaming(true)}>이름 바꾸기</button>
        </div>
      </div>
    </section>;
  }

  return <section aria-labelledby={ids + '-title'} className="rounded-xl border border-ui-border p-4">
    <div className="mb-3 flex items-center justify-between gap-2">
      <h3 id={ids + '-title'} className="text-sm font-bold">{account ? '이름 바꾸기' : '누구로 출근할까요?'}</h3>
      {account && <button type="button" className="text-xs font-semibold text-ui-secondary underline" disabled={pending}
        onClick={() => setRenaming(false)}>취소</button>}
    </div>
    <form className="space-y-2" onSubmit={onSubmit}>
      <label htmlFor={ids + '-name'} className="text-xs font-semibold text-ui-secondary">닉네임</label>
      <div className="flex gap-2">
        <NameInput id={ids + '-name'} defaultValue={account?.name ?? ''} disabled={pending} autoFocus={Boolean(account)} />
        <button type="submit" className="primary-action shrink-0 rounded-lg px-4 py-2 text-sm font-bold" disabled={!connected || pending}>
          {pending ? '확인 중…' : account ? '바꾸기' : '시작하기'}
        </button>
      </div>
      <p className="text-xs leading-relaxed break-keep text-ui-secondary">
        가입 없이 닉네임만 정하면 돼요. 이 기기가 기억해 두고, 혼자 하기 기록은 퇴근할 때 명예의 전당에 올릴지 고를 수 있어요.
      </p>
      {(error('GUEST') || (!account && notice)) && <p role={error('GUEST') ? 'alert' : 'status'}
        className={'text-xs ' + (error('GUEST') ? 'text-rose-700 dark:text-rose-300' : 'text-ui-secondary')}>
        {error('GUEST') || notice}
      </p>}
    </form>
  </section>;
}
