import React, { useEffect, useId, useState } from 'react';
import { Dialog } from '../../shared/ui/dialog.jsx';
import { useCommand } from './use-command.js';

/** 새 복구 코드를 한 번 보여 준다(가입·비밀번호 복구·새로 만들기 뒤). 닫으면 다시 볼 수 없다. */
export function RecoveryCodeDialog({ code, onDismiss }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return <Dialog id="recovery-code" title="복구 코드를 저장하세요" onDismiss={onDismiss}>
    <div className="space-y-4 p-5">
      <p className="text-sm leading-relaxed break-keep text-ui-secondary">
        비밀번호를 잊으면 <b className="text-ui-text">이름과 이 코드</b>로 새 비밀번호를 정할 수 있어요.
        이 창을 닫으면 다시 볼 수 없으니 메모하거나 복사해 두세요.
      </p>
      <p className="rounded-xl border border-ui-border bg-ui-subtle px-4 py-3 text-center font-mono text-xl font-bold tracking-wider select-all">{code}</p>
      <div className="flex gap-2">
        <button type="button" className="control flex-1" onClick={copy}>{copied ? '복사했어요' : '복사하기'}</button>
        <button type="button" className="primary-action flex-1 rounded-lg px-3 py-2 text-sm font-bold" onClick={onDismiss}>저장했어요</button>
      </div>
      <p className="text-xs text-ui-caption">코드를 잃어버렸다면 로그인한 뒤 내 정보 → 계정 관리에서 새로 만들 수 있어요.</p>
    </div>
  </Dialog>;
}

/** 비밀번호를 잊었을 때: 이름 + 복구 코드 + 새 비밀번호. 성공하면 로그인되고 새 복구 코드가 뜬다. */
export function ResetPasswordDialog({ account, actionErrors, connected, send, onDismiss }) {
  const ids = useId();
  const [mismatch, setMismatch] = useState('');
  const command = useCommand({ actionErrors, connected, send }, () => account);

  useEffect(() => {
    if (command.status('RESET') === 'done') onDismiss();
  }, [command, onDismiss]);

  function submit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get('password'));
    if (password !== data.get('confirm')) { setMismatch('비밀번호 확인이 일치하지 않아요.'); return; }
    setMismatch('');
    const code = String(data.get('code')).trim().replace(/\s+/g, '-');
    command.run(`RESET ${String(data.get('name')).trim()} ${code} ${password}`, 'RESET');
  }

  const message = mismatch || command.error('RESET');
  return <Dialog id="reset-password" title="비밀번호를 잊었어요" pending={command.pending} onDismiss={onDismiss}>
    <form className="space-y-3 p-5" onSubmit={submit}>
      <p className="text-sm leading-relaxed break-keep text-ui-secondary">
        가입할 때 받은 복구 코드로 새 비밀번호를 정해요. 다른 기기의 로그인은 모두 풀려요.
      </p>
      <div className="space-y-1">
        <label htmlFor={ids + '-name'} className="text-xs font-semibold text-ui-secondary">이름</label>
        <input id={ids + '-name'} name="name" className="field w-full" autoComplete="username" required minLength={2} maxLength={10}
          disabled={command.pending} />
      </div>
      <div className="space-y-1">
        <label htmlFor={ids + '-code'} className="text-xs font-semibold text-ui-secondary">복구 코드</label>
        <input id={ids + '-code'} name="code" className="field w-full font-mono uppercase" placeholder="ABCD-EFGH-JKMN-PQRS"
          autoComplete="off" spellCheck={false} required minLength={16} maxLength={24} disabled={command.pending} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="min-w-0 space-y-1">
          <label htmlFor={ids + '-password'} className="text-xs font-semibold text-ui-secondary">새 비밀번호</label>
          <input id={ids + '-password'} name="password" type="password" className="field w-full" autoComplete="new-password"
            placeholder="6자 이상" minLength={6} maxLength={64} required disabled={command.pending} />
        </div>
        <div className="min-w-0 space-y-1">
          <label htmlFor={ids + '-confirm'} className="text-xs font-semibold text-ui-secondary">확인</label>
          <input id={ids + '-confirm'} name="confirm" type="password" className="field w-full" autoComplete="new-password"
            placeholder="한 번 더" minLength={6} maxLength={64} required disabled={command.pending} />
        </div>
      </div>
      <p role={message ? 'alert' : undefined} className="min-h-4 text-xs text-rose-700 dark:text-rose-300">{message}</p>
      <button type="submit" className="primary-action w-full rounded-lg px-4 py-2.5 text-sm font-bold"
        disabled={!connected || command.pending}>{command.pending ? '확인 중…' : '새 비밀번호로 로그인'}</button>
    </form>
  </Dialog>;
}
