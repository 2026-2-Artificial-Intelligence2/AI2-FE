import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useGame } from './use-game.js';
import { enableSound } from './spatial-audio.js';
import { clock } from './format.js';
import { Market } from './market.jsx';
import { Work } from './work.jsx';
import { Results } from './results.jsx';
import { Entry, Lobby } from './lobby.jsx';
import { Messenger } from './messenger.jsx';
import { Meeting } from './meeting.jsx';
import { KeyHint, useShortcuts } from './shortcuts.jsx';
import './desktop.css';

function App() {
  const { game, send, office } = useGame();
  const [inbox, setInbox] = useState(false);
  const [lobbyMessenger, setLobbyMessenger] = useState(false);
  const [underMessenger, setUnderMessenger] = useState('WORK');
  const [returning, setReturning] = useState(null);
  const [officeError, setOfficeError] = useState('');
  const scene = useRef(null);
  const openRequest = useRef(null);
  const dialog = useRef(null);
  const { connected, room, view, market, desk, result, popup } = game;
  const seated = view === 'WORK' || view === 'MARKET';
  const messaging = view === 'MESSENGER';
  const computer = seated || messaging;
  const outsideRound = Boolean(room && (!room.room.startedAt || result));
  const messengerOpen = messaging || Boolean(returning) || (outsideRound && lobbyMessenger);
  const desktopView = messaging || returning ? underMessenger : view;
  const host = room?.you === room?.room.hostId;
  const name = symbol => game.stocks.find(stock => stock.id === symbol)?.name ?? symbol;

  useEffect(() => {
    if (!seated || !connected) {
      openRequest.current = null;
      scene.current?.closeOffice();
    }
  }, [seated, connected]);

  useEffect(() => {
    if (!computer || !connected) setInbox(false);
  }, [computer, connected]);

  useEffect(() => {
    if (!office.current || !seated || !connected) return;
    scene.current?.setOfficePlayers(room.room.players);
    scene.current?.updateOffice(office.current);
  }, [market, room, seated, connected, office]);

  function switchView() {
    enableSound();
    send('SWITCH');
  }

  function openMessenger() {
    if (outsideRound) {
      setLobbyMessenger(true);
    } else if (seated) {
      enableSound();
      if (send('MESSENGER')) setUnderMessenger(view);
    }
  }

  function closeMessenger(goToWork = false) {
    if (!messaging) {
      setLobbyMessenger(false);
      return;
    }
    if (returning) return;
    if (send('SWITCH') && underMessenger === 'MARKET' && !goToWork) {
      setReturning({ waitingFor: 'WORK', error: game.lastError });
    }
  }

  useEffect(() => {
    if (!outsideRound) setLobbyMessenger(false);
  }, [outsideRound]);

  useEffect(() => {
    if (!returning) return;
    if (!connected || !computer || game.lastError !== returning.error || view === 'MARKET') {
      setReturning(null);
    } else if (view === 'WORK' && returning.waitingFor === 'WORK') {
      // 서버의 SWITCH는 메신저에서 업무로 돌아온 뒤에만 주식 창을 열 수 있다.
      if (send('SWITCH')) setReturning({ ...returning, waitingFor: 'MARKET' });
      else setReturning(null);
    }
  }, [returning, connected, computer, view, send, game.lastError]);

  function toggleInbox() {
    setInbox(open => !open);
  }

  useShortcuts(connected && (computer || outsideRound), {
    Tab: computer ? switchView : undefined,
    KeyQ: seated ? lookAround : undefined,
    KeyM: seated || outsideRound ? openMessenger : undefined,
    KeyN: computer ? toggleInbox : undefined,
    Escape: inbox ? () => setInbox(false) : undefined,
  });

  useEffect(() => {
    if (inbox && computer && connected) send('NEWS HISTORY');
  }, [inbox, computer, connected, popup?.headline, send]); // 새 알림이 오면 열린 알림함 갱신

  async function lookAround() {
    if (openRequest.current || dialog.current.open || !office.current) return;
    const request = openRequest.current = Symbol();
    setOfficeError('');
    try {
      scene.current ??= await import('./office.js');
      if (openRequest.current !== request || !office.current) return;
      scene.current.setOfficePlayers(room.room.players);
      scene.current.updateOffice(office.current);
      scene.current.openOffice();
    } catch {
      if (openRequest.current === request) setOfficeError('사무실을 열 수 없습니다. 다시 시도해 주세요.');
    } finally {
      if (openRequest.current === request) openRequest.current = null;
    }
  }

  return <>
    {view === 'MEETING' && <Meeting reason={game.meeting} startedAt={game.meetingStarted} />}
    <main inert={view === 'MEETING'} className="mx-auto max-w-[1520px] space-y-4 px-4 py-5 sm:px-7">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <h1 className="text-lg font-extrabold tracking-tight">부장님 몰래</h1>
        {room && <div className="flex flex-wrap items-center gap-2 text-sm">
          {market && !result && <span id="clock" className="mr-2 tabular-nums">퇴근까지 <b>{clock(market.remainingSeconds)}</b>
            {market.remainingSeconds <= 120 && <span className="ml-2 text-rose-700">장 마감 임박</span>}</span>}
          {(computer || outsideRound) && <button className="control" disabled={!connected} aria-haspopup="dialog"
            aria-keyshortcuts="M" onClick={openMessenger}>메신저 <KeyHint>M</KeyHint></button>}
          {computer && <>
            {seated && <>
              <button className="control" id="look" disabled={!connected || !market} aria-keyshortcuts="Q" onClick={lookAround}>주변 보기 <KeyHint>Q</KeyHint></button>
            </>}
            <button className="control" aria-expanded={inbox} aria-keyshortcuts="N" onClick={toggleInbox}>알림함 <KeyHint>N</KeyHint></button>
            <button className="control" id="switchView" disabled={!connected} aria-keyshortcuts="Tab" onClick={switchView}>
              {view === 'WORK' ? '주식으로' : '업무로'} <KeyHint>Tab</KeyHint>
            </button>
          </>}
          <button className="control" disabled={!connected}
            onClick={() => { if (confirm('방에서 나갈까요?')) send('LEAVE'); }}>나가기</button>
        </div>}
      </header>
      <dialog ref={dialog} id="office" aria-label="사무실 주변 보기">
        <canvas id="officeCanvas" aria-label="좌석에서 본 사무실" />
        <footer>드래그하여 둘러보기 <button id="back" className="control text-slate-900" aria-keyshortcuts="Escape" autoFocus>모니터로 돌아가기 <KeyHint>Esc</KeyHint></button></footer>
      </dialog>
      {popup && computer && <aside id="news" role="status">
        <strong>{popup.kind === 'rumor' ? '찌라시' : '속보'} · {popup.headline}</strong>
        {popup.body && <span className="body">{popup.body}</span>}
      </aside>}
      {computer && inbox && <section className="panel max-h-72 overflow-auto p-4" aria-label="알림함">
        <h2 className="mb-2 font-bold">지난 뉴스</h2>
        {game.history.length ? <ul className="divide-y divide-slate-100">
          {[...game.history].reverse().map(item => <li className="py-2" key={item.number}>
            <strong>{item.kind === 'rumor' ? '찌라시' : '속보'} · {item.headline}</strong>
            {item.body && <p className="text-sm text-slate-600">{item.body}</p>}
          </li>)}
        </ul> : <p>아직 발표된 뉴스가 없습니다.</p>}
      </section>}
      {!room && <Entry connected={connected} send={send} />}
      {room && !room.room.startedAt && <Lobby key={room.code + '-' + room.round} game={game} host={host} send={send} />}
      {desk && !result && <Work game={game} visible={desktopView === 'WORK'} active={view === 'WORK' && !messengerOpen} send={send} />}
      {market && !result && <Market visible={desktopView === 'MARKET'} game={game} name={name} send={send} />}
      {result && <Results result={result} name={name} host={host} connected={connected} send={send} />}
      {room && messengerOpen && <Messenger key={room.code + '-' + room.round} game={game} send={send}
        playing={!outsideRound} closing={Boolean(returning)} onDismiss={closeMessenger} />}
      <p id="status" role="status" className="text-sm text-slate-600">{officeError || game.status}</p>
    </main>
  </>;
}

createRoot(document.getElementById('root')).render(<App />);
