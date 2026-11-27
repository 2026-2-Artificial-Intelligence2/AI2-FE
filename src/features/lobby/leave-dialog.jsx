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

  const description = room.solo
    ? (inRound ? '진행 중인 1인 플레이가 끝나고 입장 화면으로 돌아가요.' : '입장 화면으로 돌아가요.')
    : host ? (inRound
    ? '이번 판이 바로 끝나고 참가자 모두 대기실로 돌아가요.'
    : result ? '참가자 모두 대기실로 돌아가요.'
    : '방을 나가면 방이 닫히고 다른 참가자도 입장 화면으로 돌아가요.')
    : (inRound ? '방을 나가면 이번 판의 순위에서 제외되고 같은 자리로 돌아올 수 없어요.'
      : '입장 화면으로 돌아가요.');

  // 팀 방의 방장은 게임 중이나 퇴근 뒤에 나가도 방이 닫히지 않고 모두 대기실로 돌아간다.
  const toLobby = host && !room.solo && Boolean(room.room.startedAt);

  return <Dialog id="leave-dialog" title={toLobby ? '대기실로 돌아갈까요?' : '방을 나갈까요?'} pending={pending} onDismiss={onDismiss}>
    <div className="space-y-4 p-5">
      <p className="text-sm leading-relaxed text-ui-secondary">{description}</p>
      {request && request.error !== lastError && lastError?.message && <p className="text-sm text-rose-700 dark:text-rose-300" role="alert">{lastError.message}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="control" disabled={pending} onClick={onDismiss}>계속하기</button>
        <button type="button" disabled={pending || !connected} className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-bold text-white hover:bg-rose-800"
          onClick={() => { if (send('LEAVE')) setRequest({ error: lastError }); }}>{pending ? (toLobby ? '돌아가는 중…' : '나가는 중…') : (toLobby ? '대기실로 가기' : '방 나가기')}</button>
      </div>
    </div>
  </Dialog>;
}
