import React, { useEffect, useState } from 'react';
import { Dialog } from '../../shared/ui/dialog.jsx';

export function LeaveDialog({ game, host, send, onDismiss }) {
  const [request, setRequest] = useState(null);
  const { connected, room, result, actionErrors } = game;
  const lastError = actionErrors.LEAVE;
  const inRound = Boolean(room.room.startedAt && !result);
  const pending = Boolean(request && connected && lastError === request.error);

  useEffect(() => {
    if (!connected) setRequest(null);
  }, [connected]);

  const description = host ? (inRound
    ? '방을 나가면 참가자 모두의 게임이 즉시 종료돼요.'
    : '방을 나가면 방이 닫히고 다른 참가자도 입장 화면으로 돌아가요.')
    : (inRound ? '방을 나가면 이번 판의 순위에서 제외되고 같은 자리로 돌아올 수 없어요.'
      : '입장 화면으로 돌아가요.');

  return <Dialog id="leave-dialog" title="방을 나갈까요?" pending={pending} onDismiss={onDismiss}>
    <div className="space-y-4 p-5">
      <p className="text-sm leading-relaxed text-ui-secondary">{description}</p>
      {request && request.error !== lastError && lastError?.message && <p className="text-sm text-rose-700 dark:text-rose-300" role="alert">{lastError.message}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="control" disabled={pending} onClick={onDismiss}>계속하기</button>
        <button type="button" disabled={pending || !connected} className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-bold text-white hover:bg-rose-800"
          onClick={() => { if (send('LEAVE')) setRequest({ error: lastError }); }}>{pending ? '나가는 중…' : '방 나가기'}</button>
      </div>
    </div>
  </Dialog>;
}
