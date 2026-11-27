import React, { useEffect, useState } from 'react';
import { clock } from '../shared/format.js';
import { KeyHint } from '../shared/ui/shortcuts.jsx';

function Bubble({ label, hint, icon, count, expanded, onClick }) {
  return <button type="button" aria-label={label} aria-keyshortcuts={hint} aria-expanded={expanded}
    className="relative grid size-12 place-items-center rounded-full bg-slate-900 text-lg text-white shadow-lg hover:bg-blue-800 dark:bg-ui-muted dark:text-ui-text dark:ring-1 dark:ring-ui-input dark:hover:bg-[var(--dark-selection-hover)]"
    onClick={onClick}>
    <span aria-hidden="true">{icon}</span>
    {count > 0 && <span className="absolute -top-1 -right-1 min-w-5 rounded-full bg-rose-700 px-1 text-xs text-white dark:bg-ui-muted dark:text-ui-text dark:ring-1 dark:ring-ui-input">{count}</span>}
  </button>;
}

export function Notifications({ game, inbox, toggleInbox, messengerOpen, openMessenger, lastChat, lastNews, dismissNews }) {
  const [preview, setPreview] = useState(null);
  const solo = Boolean(game.room?.solo);
  const chat = game.chats.findLast(item => item.id > Math.max(lastChat, game.chatHistoryEnd ?? 0) &&
    item.from !== game.room?.youLabel);
  const messages = game.chats.filter(item => item.id > Math.max(lastChat, game.chatHistoryEnd ?? 0) &&
    item.from !== game.room?.youLabel).length;
  useEffect(() => {
    if (!chat || messengerOpen) {
      setPreview(null);
      return;
    }
    setPreview(chat);
    const timer = setTimeout(() => setPreview(null), 8000);
    return () => clearTimeout(timer);
  }, [chat, messengerOpen]);
  const news = game.popup;
  const count = Math.max(0, (game.history.at(-1)?.number ?? 0) - lastNews);

  return <aside className="fixed right-4 bottom-4 z-20 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-3 sm:right-6 sm:bottom-6"
    aria-label={solo ? "컴퓨터 알림" : "컴퓨터 알림과 메신저"}>
    {inbox && <section id="news-history"
      className={'panel absolute right-0 flex max-h-[min(33rem,calc(100dvh-10rem))] w-[min(30rem,calc(100vw-2rem))] flex-col overflow-hidden shadow-xl ' +
        (solo ? 'bottom-16' : 'bottom-32')}
      aria-labelledby="news-history-title">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-ui-border bg-ui-muted px-4 py-2.5">
        <h2 id="news-history-title" className="font-bold">뉴스 알림함</h2>
        <button type="button" className="control size-8 p-0 text-lg leading-none" aria-label="뉴스 알림함 닫기"
          onClick={toggleInbox}>×</button>
      </header>
      <div className="min-h-0 overflow-y-auto overscroll-contain p-3">
        {game.actionErrors.NEWS && <p role="alert" className="mb-3 text-sm text-rose-700 dark:text-rose-300">{game.actionErrors.NEWS.message}</p>}
        {game.history.length ? <ul className="space-y-2.5">
          {[...game.history].reverse().map(item => <li key={item.number}
            className="rounded-lg border border-ui-border bg-ui-subtle p-3.5">
            <div className="flex items-center justify-between gap-2 text-xs font-medium text-ui-secondary">
              <span>{item.kind === 'rumor' ? '찌라시' : '속보'}</span>
              {Number.isFinite(item.second) && <span aria-label={'근무 경과 ' + clock(item.second)} className="tabular-nums">{clock(item.second)}</span>}
            </div>
            <h3 className="mt-1 text-base leading-snug font-bold [overflow-wrap:anywhere]">{item.headline}</h3>
            {item.body && <p className="mt-2 text-[0.9375rem] leading-relaxed text-ui-text whitespace-pre-wrap [overflow-wrap:anywhere]">{item.body}</p>}
          </li>)}
        </ul> : <p className="px-1 py-2 text-sm text-ui-secondary">아직 발표된 뉴스가 없습니다.</p>}
      </div>
    </section>}
    <div className="flex items-end gap-2">
      {news && !inbox && <div id="news" role="status" className="notification-preview notification-preview--news relative w-[min(22rem,calc(100vw-5rem))] pr-10">
        <b className="block text-sm">{news.kind === 'rumor' ? '찌라시' : '속보'} · {news.headline}</b>
        {news.body && <p className="mt-1 max-h-28 overflow-y-auto text-sm text-ui-secondary [overflow-wrap:anywhere]">{news.body}</p>}
        <button type="button" aria-label="뉴스 팝업 닫기" className="absolute top-1 right-1 grid size-8 place-items-center rounded text-ui-secondary hover:bg-ui-subtle"
          onClick={dismissNews}>×</button>
      </div>}
      <Bubble label="뉴스 알림함" hint="N" icon="▤" count={inbox ? 0 : count} expanded={inbox} onClick={toggleInbox} />
    </div>
    {!solo && <div className="flex items-end gap-2">
      {preview && !messengerOpen && <button type="button" onClick={() => openMessenger(preview.to ? preview.from : 'ALL')}
        className="notification-preview notification-preview--chat w-[min(22rem,calc(100vw-5rem))]">
        <b className="block text-xs text-ui-secondary">{preview.from} · {preview.to ? '귓속말' : '단체방'} <KeyHint>M</KeyHint></b>
        <span className="mt-1 line-clamp-2 block text-sm [overflow-wrap:anywhere]">{preview.text}</span>
      </button>}
      <Bubble label="메신저" hint="M" icon="✉" count={messengerOpen ? 0 : messages} expanded={messengerOpen} onClick={openMessenger} />
    </div>}
  </aside>;
}
