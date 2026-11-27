import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { clock } from '../../shared/format.js';
import { KeyHint } from '../../shared/ui/shortcuts.jsx';
import { ResizeGrip, useWindowSize } from '../../shared/ui/window-resize.jsx';
import { Icon, faBullhorn } from '../../shared/ui/icon.jsx';

const group = 'ALL';
const rumor = 'LEAK';

/** 판(근무일) 사이 구분선. 같은 방에서 다시 하면 "2일 차 근무"처럼 하루씩 늘어난다. */
function DayDivider({ round }) {
  return <div role="separator" aria-label={round + '일 차 근무'}
    className="my-1 flex items-center gap-2 text-[11px] font-semibold text-ui-caption">
    <span aria-hidden="true" className="h-px flex-1 bg-ui-border" />
    <span aria-hidden="true">{round}일 차 근무</span>
    <span aria-hidden="true" className="h-px flex-1 bg-ui-border" />
  </div>;
}

function Channel({ active, title, detail, marker, onSelect }) {
  return <button type="button" aria-pressed={active} onClick={onSelect}
    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-ui-muted aria-pressed:bg-blue-50 dark:aria-pressed:bg-[var(--dark-selection)] aria-pressed:text-blue-950 dark:aria-pressed:text-blue-100">
    <span aria-hidden="true" className="hidden h-7 w-7 shrink-0 place-items-center sm:grid rounded-lg bg-ui-surface text-xs font-bold ring-1 ring-ui-border">{marker}</span>
    <span><span className="block font-semibold">{title}</span><span className="block text-xs text-ui-secondary">{detail}</span></span>
  </button>;
}

export function Messenger({ game, send, playing, closing, onDismiss, docked = false, initialChannel = group }) {
  const { room, chats, connected, actionErrors, leakReceipt } = game;
  // 익명 찌라시는 한 판에 여러 번(서버가 정한 횟수, 사이 간격). 다 쓰면 막는다.
  const leakLimit = game.leak?.perRound ?? 1;
  const leaksLeft = leakReceipt ? leakReceipt.remaining ?? 0 : leakLimit;
  const leaksDone = leaksLeft <= 0;
  const lastError = actionErrors.CHAT;
  const me = room.youLabel;
  const members = (room.members ?? []).filter(member => member.label !== me);
  const [channel, setChannel] = useState(initialChannel);
  const [drafts, setDrafts] = useState({});
  const [articleBody, setArticleBody] = useState('');
  const [pending, setPending] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const list = useRef(null);
  const dialog = useRef(null);
  const [size, setSize] = useWindowSize('messenger');

  useLayoutEffect(() => {
    const element = dialog.current;
    if (docked) return;
    element.showModal();
    return () => element.close();
  }, [docked]);
  const available = channel === rumor ? playing : members.some(member => member.label === channel);
  const selected = available ? channel : group;
  const anonymous = selected === rumor;
  const direct = selected !== group && !anonymous;
  const draft = drafts[selected] ?? '';
  const text = draft.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  const length = [...text].length;
  const limit = anonymous ? 60 : 200;
  const body = articleBody.trim();
  const bodyLength = [...body].length;
  const canSubmit = length > 0 && length <= limit && (!anonymous || (bodyLength > 0 && bodyLength <= 300));
  const messages = chats.filter(message => direct
    ? (message.from === me && message.to === selected) || (message.from === selected && message.to === me)
    : message.to === null);
  const lastVisibleId = messages.at(-1)?.id;
  const round = game.room?.round;
  const lastRound = messages.at(-1)?.round;

  function renderMessage(message) {
    if (message.system) return <p role="note"
      className="mx-auto flex max-w-[95%] items-start gap-2 rounded-lg bg-amber-100 px-3 py-1.5 text-xs leading-relaxed font-semibold break-keep text-amber-950 dark:bg-amber-950 dark:text-amber-100">
      <Icon icon={faBullhorn} className="mt-[0.2rem] shrink-0" />
      <span className="min-w-0 [overflow-wrap:anywhere]">{message.text}
        {message.second >= 0 && <span className="ml-1.5 font-normal whitespace-nowrap tabular-nums opacity-70">{clock(message.second)}</span>}
      </span>
    </p>;
    const mine = message.from === me;
    return <article className={mine ? 'max-w-[90%] self-end text-right' : 'max-w-[90%] self-start'}>
      <p className="mb-1 text-xs text-ui-caption">{mine ? '나' : message.from}
        {message.second >= 0 && <span className="ml-2 tabular-nums">{clock(message.second)}</span>}</p>
      <p className={'inline-block max-w-full rounded-xl px-3 py-2 text-left text-sm whitespace-pre-wrap [overflow-wrap:anywhere] ' +
        (mine ? 'bg-blue-700 text-white dark:bg-[#394251] dark:text-[#e0e4ec]' : 'bg-ui-surface text-ui-text ring-1 ring-ui-border')}>{message.text}</p>
    </article>;
  }

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
      if (pending.channel === rumor) setArticleBody('');
      setFeedback(null);
      setPending(null);
    } else if (!connected || lastError !== pending.error) {
      setFeedback({ channel: pending.channel, text: connected ? lastError.message : '연결이 끊겼습니다. 전송 여부를 확인해 주세요.' });
      setPending(null);
    }
  }, [pending, connected, lastError, leakReceipt, chats, me]);

  function submit(event) {
    event.preventDefault();
    if (!connected || closing || pending || !canSubmit || (anonymous && leaksDone)) return;
    if (!send(anonymous ? 'LEAK_ARTICLE ' + JSON.stringify({ headline: text, body }) : 'CHAT ' + selected + ' ' + text)) return;
    setFeedback(null);
    setPending({ channel: selected, text, draft, after: chats.at(-1)?.id ?? 0, error: lastError, receipt: leakReceipt });
  }

  const heading = anonymous ? '익명 찌라시' : direct ? selected + '님과의 귓속말' : '단체방';
  const Frame = docked ? 'section' : 'dialog';
  return <Frame ref={dialog} id="messenger" aria-labelledby="messenger-title"
    className={docked ? 'panel lobby-messenger flex min-w-0 flex-col overflow-hidden' :
      'panel messenger-window fixed inset-auto right-3 bottom-3 m-0 shadow-2xl backdrop:bg-slate-900/15 sm:right-6 sm:bottom-6'}
    style={!docked && size ? { '--window-width': size.width + 'px', '--window-height': size.height + 'px' } : undefined}
    onCancel={docked ? undefined : event => { event.preventDefault(); onDismiss(); }}
    onKeyDown={event => {
      const plain = !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey && !event.nativeEvent.isComposing;
      if (playing && event.key === 'Tab' && plain) {
        event.preventDefault();
        if (!event.repeat) onDismiss(true);
      }
      // M으로 열고 M으로 닫는다. 입력 칸에 쓰던 글이 있으면 글자로 들어간다(빈 칸일 때만 닫힘).
      if (!docked && event.code === 'KeyM' && plain) {
        const field = event.target.closest?.('input, textarea');
        if (field && field.value !== '') return;
        event.preventDefault();
        if (!event.repeat) onDismiss();
      }
    }}>
    {!docked && <ResizeGrip frame={dialog} label="메신저 창 크기 조절" topLeft onResize={setSize} />}
    <header className={'flex shrink-0 items-center justify-between gap-3 border-b border-ui-border bg-ui-muted py-2 pr-3 ' + (docked ? 'pl-3' : 'pl-8')}>
      <div className="flex items-center gap-2">
        <h2 id="messenger-title" className="text-sm font-bold">사내 메신저</h2>
        <span className="text-xs text-ui-secondary">{me}</span>
      </div>
      {!docked && <button type="button" aria-label="메신저 닫기" aria-keyshortcuts="M Escape" disabled={closing}
        className="control px-2 py-0.5" onClick={() => onDismiss()}>× <KeyHint>M</KeyHint></button>}
    </header>
    <div className="grid min-h-0 flex-1 grid-cols-[clamp(6.5rem,26%,10.5rem)_minmax(0,1fr)]">
      <aside className="overflow-y-auto border-r border-ui-border bg-ui-subtle p-1 sm:p-2">
        <nav aria-label="대화 목록" className="space-y-1">
          <Channel active={selected === group} title="단체방" detail={members.length + 1 + '명'} marker="#" onSelect={() => setChannel(group)} />
          {members.map(member => <Channel key={member.label} active={selected === member.label} title={member.label}
            detail={member.online ? '접속 중' : '오프라인'}
            marker={Array.from(member.label.normalize('NFC').trim())[0] ?? '?'}
            onSelect={() => setChannel(member.label)} />)}
          {playing && <Channel active={anonymous} title="익명 찌라시" detail={leaksDone ? '이번 판 모두 사용' : leakReceipt ? `${leaksLeft}번 남음` : `한 판에 ${leakLimit}번`}
            marker="!" onSelect={() => setChannel(rumor)} />}
        </nav>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-col">
        <header className="shrink-0 border-b border-ui-border px-3 py-2.5">
          <h3 className="font-bold">{heading}</h3>
          <p className="mt-0.5 text-xs text-ui-secondary">{anonymous ? '모두의 뉴스 알림에 올라가며 작성자는 퇴근 후 공개됩니다.'
            : direct ? '나와 상대방만 볼 수 있습니다.' : '같은 방에 있는 직원 모두가 볼 수 있습니다.'}</p>
        </header>
        {anonymous ? <div className="flex min-h-0 flex-1 items-center overflow-y-auto px-3 py-4 text-sm text-ui-secondary">
          <p>{leakReceipt?.message ?? `제목과 본문을 작성하세요. 한 판에 ${leakLimit}번까지 뿌릴 수 있어요${game.leak?.gapSeconds ? `(${game.leak.gapSeconds}초 간격)` : ''}.`}</p>
        </div> : <div ref={list} role="log" aria-label={heading + ' 메시지'}
          className={'flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3 ' + (docked ? 'bg-ui-subtle' : 'bg-blue-50/45 dark:bg-ui-desktop')}>
          {messages.length ? messages.map((message, index) => {
            // 앞 메시지와 판이 다르면 그 사이에 구분선을 긋는다.
            const previousRound = messages[index - 1]?.round;
            const divider = previousRound && message.round && message.round !== previousRound
              ? <DayDivider round={message.round} /> : null;
            return <React.Fragment key={message.id}>{divider}{renderMessage(message)}</React.Fragment>;
          }).concat(round && lastRound && round > lastRound ? [<DayDivider key="today" round={round} />] : [])
            : <p className="m-auto text-sm text-ui-caption">아직 대화가 없습니다.</p>}
        </div>}
        <form onSubmit={submit} className="shrink-0 space-y-2 border-t border-ui-border p-2.5">
          {anonymous && <label className="block text-xs font-semibold text-ui-secondary">
            본문 <span className="font-normal">{bodyLength} / 300</span>
            <textarea aria-label="찌라시 본문" rows={3} className="field mt-1 w-full resize-y"
              value={articleBody} disabled={!connected || closing || Boolean(pending) || leaksDone}
              onChange={event => setArticleBody(event.target.value)} />
          </label>}
          <div className="flex gap-2">
            <input aria-label={anonymous ? '찌라시 제목' : '메시지'} className="field min-w-0 flex-1"
              value={draft} autoFocus={!docked} disabled={!connected || closing || Boolean(anonymous && leaksDone)}
              onChange={event => setDrafts({ ...drafts, [selected]: event.target.value })}
              onKeyDown={event => {
                if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault();
              }}
              placeholder={anonymous ? '찌라시 제목' : '메시지 입력'} />
            <button type="submit" disabled={!connected || closing || !canSubmit || Boolean(pending) || (anonymous && leaksDone)}
              className="primary-action rounded-lg px-4 text-sm font-bold">{anonymous ? '소문 보내기' : '전송'}</button>
          </div>
          <div className="flex justify-between gap-3 text-xs text-ui-secondary">
            <p role="status">{feedback?.channel === selected && feedback.text}</p>
            <span className={'shrink-0 tabular-nums ' + (length > limit ? 'text-rose-700 dark:text-rose-300' : '')}>{length} / {limit}</span>
          </div>
        </form>
      </div>
    </div>
  </Frame>;
}
