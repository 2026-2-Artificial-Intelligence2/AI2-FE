import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { clock } from './format.js';
import { KeyHint } from './shortcuts.jsx';
import { ResizeGrip, useWindowSize } from './window-resize.jsx';

const group = 'ALL';
const rumor = 'LEAK';

function Channel({ active, title, detail, marker, onSelect }) {
  return <button type="button" aria-pressed={active} onClick={onSelect}
    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-100 aria-pressed:bg-blue-50 aria-pressed:text-blue-950">
    <span aria-hidden="true" className="hidden h-7 w-7 shrink-0 place-items-center sm:grid rounded-lg bg-white text-xs font-bold ring-1 ring-slate-200">{marker}</span>
    <span><span className="block font-semibold">{title}</span><span className="block text-xs text-slate-600">{detail}</span></span>
  </button>;
}

export function Messenger({ game, send, playing, closing, onDismiss }) {
  const { room, chats, connected, lastError, leakReceipt } = game;
  const me = room.youLabel;
  const members = (room.members ?? []).filter(member => member.label !== me);
  const [channel, setChannel] = useState(group);
  const [drafts, setDrafts] = useState({});
  const [pending, setPending] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const list = useRef(null);
  const dialog = useRef(null);
  const [size, setSize] = useWindowSize('messenger');

  useLayoutEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);
  const available = channel === rumor ? playing : members.some(member => member.label === channel);
  const selected = available ? channel : group;
  const anonymous = selected === rumor;
  const direct = selected !== group && !anonymous;
  const draft = drafts[selected] ?? '';
  const text = draft.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  const length = [...text].length;
  const limit = anonymous ? 60 : 200;
  const messages = chats.filter(message => direct
    ? (message.from === me && message.to === selected) || (message.from === selected && message.to === me)
    : message.to === null);
  const lastVisibleId = messages.at(-1)?.id;

  useLayoutEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [selected, lastVisibleId]);

  useEffect(() => {
    if (!pending) return;
    const confirmed = pending.channel === rumor ? leakReceipt && leakReceipt !== pending.receipt
      : chats.some(message => message.id > pending.after && message.from === me &&
          (message.to ?? group) === pending.channel && message.text === pending.text);
    if (confirmed) {
      setDrafts(current => current[pending.channel] === pending.draft
        ? { ...current, [pending.channel]: '' } : current);
      setFeedback(null);
      setPending(null);
    } else if (!connected || lastError !== pending.error) {
      setFeedback({ channel: pending.channel, text: connected ? lastError.message : '연결이 끊겼습니다. 전송 여부를 확인해 주세요.' });
      setPending(null);
    }
  }, [pending, connected, lastError, leakReceipt, chats, me]);

  function submit(event) {
    event.preventDefault();
    if (!connected || closing || pending || !length || length > limit || (anonymous && leakReceipt)) return;
    if (!send(anonymous ? 'LEAK ' + text : 'CHAT ' + selected + ' ' + text)) return;
    setFeedback(null);
    setPending({ channel: selected, text, draft, after: chats.at(-1)?.id ?? 0, error: lastError, receipt: leakReceipt });
  }

  const heading = anonymous ? '익명 찌라시' : direct ? selected + '님과의 귓속말' : '단체방';
  return <dialog ref={dialog} id="messenger" aria-labelledby="messenger-title"
    className="panel messenger-window fixed inset-auto right-3 bottom-3 m-0 shadow-2xl backdrop:bg-slate-900/15 sm:right-6 sm:bottom-6"
    style={size ? { '--window-width': size.width + 'px', '--window-height': size.height + 'px' } : undefined}
    onCancel={event => { event.preventDefault(); onDismiss(); }}
    onKeyDown={event => {
      if (playing && event.key === 'Tab' && !event.shiftKey && !event.ctrlKey && !event.altKey &&
          !event.metaKey && !event.nativeEvent.isComposing) {
        event.preventDefault();
        if (!event.repeat) onDismiss(true);
      }
    }}>
    <ResizeGrip frame={dialog} label="메신저 창 크기 조절" topLeft onResize={setSize} />
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-slate-100 py-2 pr-3 pl-8">
      <div className="flex items-center gap-2">
        <h2 id="messenger-title" className="text-sm font-bold">사내 메신저</h2>
        <span className="text-xs text-slate-600">{me}</span>
      </div>
      <button type="button" aria-label="메신저 닫기" aria-keyshortcuts="Escape" disabled={closing}
        className="control px-2 py-0.5" onClick={() => onDismiss()}>× <KeyHint>Esc</KeyHint></button>
    </header>
    <div className="grid min-h-0 flex-1 grid-cols-[clamp(6.5rem,26%,10.5rem)_minmax(0,1fr)]">
      <aside className="overflow-y-auto border-r border-slate-200 bg-slate-50 p-1 sm:p-2">
        <nav aria-label="대화 목록" className="space-y-1">
          <Channel active={selected === group} title="단체방" detail={members.length + 1 + '명'} marker="#" onSelect={() => setChannel(group)} />
          {members.map(member => <Channel key={member.label} active={selected === member.label} title={member.label}
            detail={member.online ? '접속 중' : '오프라인'} marker={member.label} onSelect={() => setChannel(member.label)} />)}
          {playing && <Channel active={anonymous} title="익명 찌라시" detail={leakReceipt ? '이번 판 전송 완료' : '한 판에 한 번'}
            marker="!" onSelect={() => setChannel(rumor)} />}
        </nav>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-col">
        <header className="shrink-0 border-b border-slate-200 px-3 py-2.5">
          <h3 className="font-bold">{heading}</h3>
          <p className="mt-0.5 text-xs text-slate-600">{anonymous ? '모두의 뉴스 알림에 올라가며 작성자는 퇴근 후 공개됩니다.'
            : direct ? '나와 상대방만 볼 수 있습니다.' : '같은 방에 있는 직원 모두가 볼 수 있습니다.'}</p>
        </header>
        {anonymous ? <div className="flex min-h-0 flex-1 items-center overflow-y-auto px-3 py-4 text-sm text-slate-600">
          <p>{leakReceipt?.message ?? '보내고 싶은 소문을 60자 이내로 작성하세요.'}</p>
        </div> : <div ref={list} role="log" aria-label={heading + ' 메시지'}
          className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto bg-blue-50/45 p-3">
          {messages.length ? messages.map(message => {
            const mine = message.from === me;
            return <article key={message.id} className={mine ? 'max-w-[90%] self-end text-right' : 'max-w-[90%] self-start'}>
              <p className="mb-1 text-xs text-slate-500">{mine ? '나' : message.from}
                {message.second >= 0 && <span className="ml-2 tabular-nums">{clock(message.second)}</span>}</p>
              <p className={'inline-block max-w-full rounded-xl px-3 py-2 text-left text-sm whitespace-pre-wrap [overflow-wrap:anywhere] ' +
                (mine ? 'bg-blue-700 text-white' : 'bg-white text-slate-900 ring-1 ring-slate-200')}>{message.text}</p>
            </article>;
          }) : <p className="m-auto text-sm text-slate-500">아직 대화가 없습니다.</p>}
        </div>}
        <form onSubmit={submit} className="shrink-0 space-y-2 border-t border-slate-200 p-2.5">
          <div className="flex gap-2">
            <input aria-label={anonymous ? '찌라시 내용' : '메시지'} className="field min-w-0 flex-1"
              value={draft} autoFocus disabled={!connected || closing || Boolean(anonymous && leakReceipt)}
              onChange={event => setDrafts({ ...drafts, [selected]: event.target.value })}
              onKeyDown={event => {
                if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault();
              }}
              placeholder={anonymous ? '소문 작성' : '메시지 입력'} />
            <button type="submit" disabled={!connected || closing || !length || length > limit || Boolean(pending || (anonymous && leakReceipt))}
              className="rounded-lg bg-blue-700 px-4 text-sm font-bold text-white">{anonymous ? '소문 보내기' : '전송'}</button>
          </div>
          <div className="flex justify-between gap-3 text-xs text-slate-600">
            <p role="status">{feedback?.channel === selected && feedback.text}</p>
            <span className={'shrink-0 tabular-nums ' + (length > limit ? 'text-rose-700' : '')}>{length} / {limit}</span>
          </div>
        </form>
      </div>
    </div>
  </dialog>;
}
