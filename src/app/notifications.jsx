import React, { useEffect, useState } from 'react';
import { KeyHint } from '../shared/ui/shortcuts.jsx';

function Bubble({ label, hint, icon, count, expanded, onClick }) {
  return <button type="button" aria-label={label} aria-keyshortcuts={hint} aria-expanded={expanded}
    className="relative grid size-12 place-items-center rounded-full bg-slate-900 text-lg text-white shadow-lg hover:bg-blue-800"
    onClick={onClick}>
    <span aria-hidden="true">{icon}</span>
    {count > 0 && <span className="absolute -top-1 -right-1 min-w-5 rounded-full bg-rose-700 px-1 text-xs text-white">{count}</span>}
  </button>;
}

export function Notifications({ game, inbox, toggleInbox, messengerOpen, openMessenger, lastChat, lastNews, dismissNews }) {
  const [preview, setPreview] = useState(null);
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
    aria-label="컴퓨터 알림과 메신저">
    {inbox && <section id="news-history" className="panel absolute right-0 bottom-32 max-h-[55vh] w-[min(24rem,calc(100vw-2rem))] overflow-auto p-4"
      aria-label="뉴스 알림함">
      <div className="flex justify-between gap-2">
        <h2 className="font-bold">뉴스 알림함</h2><button type="button" aria-label="뉴스 알림함 닫기" onClick={toggleInbox}>×</button>
      </div>
      {game.history.length ? <ul className="mt-2 divide-y divide-slate-100">
        {[...game.history].reverse().map(item => <li className="py-2" key={item.number}>
          <strong className="text-sm">{item.kind === 'rumor' ? '찌라시' : '속보'} · {item.headline}</strong>
          {item.body && <p className="mt-1 text-sm text-slate-600 [overflow-wrap:anywhere]">{item.body}</p>}
        </li>)}
      </ul> : <p className="mt-2 text-sm text-slate-600">아직 발표된 뉴스가 없습니다.</p>}
    </section>}
    <div className="flex items-end gap-2">
      {news && !inbox && <div id="news" role="status" className="relative w-[min(22rem,calc(100vw-5rem))] rounded-xl border border-slate-200 bg-white p-3 pr-10 shadow-lg">
        <b className="block text-sm">{news.kind === 'rumor' ? '찌라시' : '속보'} · {news.headline}</b>
        {news.body && <p className="mt-1 max-h-28 overflow-y-auto text-sm text-slate-600 [overflow-wrap:anywhere]">{news.body}</p>}
        <button type="button" aria-label="뉴스 팝업 닫기" className="absolute top-1 right-1 grid size-8 place-items-center rounded hover:bg-slate-100"
          onClick={dismissNews}>×</button>
      </div>}
      <Bubble label="뉴스 알림함" hint="N" icon="▤" count={inbox ? 0 : count} expanded={inbox} onClick={toggleInbox} />
    </div>
    <div className="flex items-end gap-2">
      {preview && !messengerOpen && <button type="button" onClick={() => openMessenger(preview.to ? preview.from : 'ALL')}
        className="w-[min(20rem,calc(100vw-5rem))] rounded-xl border border-slate-200 bg-white p-3 text-left shadow-lg">
        <b className="block text-xs">{preview.from} · {preview.to ? '귓속말' : '단체방'} <KeyHint>M</KeyHint></b>
        <span className="mt-1 line-clamp-2 block text-sm [overflow-wrap:anywhere]">{preview.text}</span>
      </button>}
      <Bubble label="메신저" hint="M" icon="✉" count={messengerOpen ? 0 : messages} expanded={messengerOpen} onClick={openMessenger} />
    </div>
  </aside>;
}
