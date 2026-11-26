import React, { useEffect, useState } from 'react';
import { useGame } from './use-game.js';
import { enableSound } from '../shared/audio/spatial-audio.js';
import { clock } from '../shared/format.js';
import { Market } from '../features/market/market.jsx';
import { Work } from '../features/work/work.jsx';
import { Results } from '../features/results/results.jsx';
import { Entry, Lobby } from '../features/lobby/lobby.jsx';
import { LeaveDialog } from '../features/lobby/leave-dialog.jsx';
import { LoanDialog } from '../features/loan/loan-dialog.jsx';
import { Messenger } from '../features/messenger/messenger.jsx';
import { Meeting } from '../features/meeting/meeting.jsx';
import { Notifications } from './notifications.jsx';
import { OfficeViewport } from '../features/office/office-viewport.jsx';
import { KeyHint, useShortcuts } from '../shared/ui/shortcuts.jsx';

export function App() {
  const { game, send, office, dismissNews } = useGame();
  const [inbox, setInbox] = useState(false);
  const [activeDialog, setActiveDialog] = useState(null);
  const [conversation, setConversation] = useState('ALL');
  const [lobbyMessenger, setLobbyMessenger] = useState(false);
  const [underMessenger, setUnderMessenger] = useState('WORK');
  const [returning, setReturning] = useState(null);
  const [looking, setLooking] = useState(false);
  const [officeReady, setOfficeReady] = useState(null);
  const [monitorVisible, setMonitorVisible] = useState(false);
  const [lastChat, setLastChat] = useState(0);
  const [lastNews, setLastNews] = useState(0);
  const { connected, room, view, market, desk, result } = game;
  const seated = view === 'WORK' || view === 'MARKET';
  const messaging = view === 'MESSENGER';
  const computer = seated || messaging;
  const outsideRound = Boolean(room && (!room.room.startedAt || result));
  const messengerOpen = messaging || Boolean(returning) || (outsideRound && lobbyMessenger);
  const desktopView = messaging || returning ? underMessenger : view;
  const inLobby = Boolean(room && !room.room.startedAt);
  const officeActive = computer && Boolean(office.current);
  const desktopShown = !officeActive || officeReady === false || (!looking && monitorVisible);
  const desktopInteractive = desktopShown && view !== 'MEETING';
  const canOpenLoan = connected && computer && game.loan && desk && !result;
  const host = room?.you === room?.room.hostId;
  const name = symbol => game.stocks.find(stock => stock.id === symbol)?.name ?? symbol;

  useEffect(() => {
    if (!officeActive) {
      setLooking(false);
      setOfficeReady(null);
      setMonitorVisible(false);
    }
  }, [officeActive]);

  useEffect(() => {
    if (!officeActive || looking || officeReady !== true) return;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = setTimeout(() => setMonitorVisible(true), reducedMotion ? 0 : 820);
    return () => clearTimeout(timer);
  }, [officeActive, looking, officeReady]);

  useEffect(() => {
    if (!computer || !connected || looking) setInbox(false);
  }, [computer, connected, looking]);

  useEffect(() => {
    setLastChat(0);
    setLastNews(0);
  }, [room?.code, room?.round]);

  useEffect(() => {
    if (messengerOpen) setLastChat(game.chats.at(-1)?.id ?? 0);
  }, [messengerOpen, game.chats]);

  useEffect(() => {
    if (inbox) setLastNews(game.history.at(-1)?.number ?? 0);
  }, [inbox, game.history]);

  useEffect(() => {
    if (!room || view === 'MEETING') setActiveDialog(null);
    else if (result) setActiveDialog(current => current === 'loan' ? null : current);
  }, [room, view, result]);

  function switchView() {
    enableSound();
    if (looking) {
      setLooking(false);
      if (view !== 'WORK') return;
    }
    send('SWITCH');
  }

  function openMessenger(target) {
    setConversation(typeof target === 'string' ? target : 'ALL');
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
    Tab: computer && (desktopInteractive || looking) ? switchView : undefined,
    KeyQ: seated && officeReady ? lookAround : undefined,
    KeyM: (seated && desktopInteractive) || outsideRound ? openMessenger : undefined,
    KeyN: computer && desktopInteractive ? toggleInbox : undefined,
    Escape: looking ? returnToMonitor : inbox ? () => setInbox(false) : undefined,
  });

  useEffect(() => {
    if (inbox && computer && connected) send('NEWS HISTORY');
  }, [inbox, computer, connected, send]);

  function lookAround() {
    if (!officeReady) return;
    setMonitorVisible(false);
    setLooking(value => !value);
  }

  function returnToMonitor() {
    setLooking(false);
  }

  const messenger = room && messengerOpen && <Messenger key={'messenger-' + room.code + '-' + room.round} game={game}
    send={send} initialChannel={conversation} docked={inLobby} playing={!outsideRound} closing={Boolean(returning)} onDismiss={closeMessenger} />;

  return <>
    {officeActive && <OfficeViewport office={office} market={market} players={room.room.players}
      looking={looking} focused={!looking} onReady={setOfficeReady} onReturn={returnToMonitor} />}
    {view === 'MEETING' && <Meeting reason={game.meeting} startedAt={game.meetingStarted} />}
    <main inert={!desktopInteractive} data-monitor={desktopShown}
      className={(officeActive ? 'game-desktop ' : '') + 'min-h-screen'}>
      <div className="mx-auto max-w-[1520px] space-y-4 px-4 py-5 sm:px-7">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <h1 className="text-lg font-extrabold tracking-tight">부장님 몰래</h1>
          {room && <div className="flex flex-wrap items-center gap-2 text-sm">
            {market && !result && <span id="clock" className="mr-2 tabular-nums">퇴근까지 <b>{clock(market.remainingSeconds)}</b>
              {market.remainingSeconds <= 120 && <span className="ml-2 text-rose-700">장 마감 임박</span>}</span>}
            {outsideRound && <button className="control" disabled={!connected} aria-haspopup={inLobby ? undefined : 'dialog'}
              aria-keyshortcuts="M" onClick={openMessenger}>메신저 <KeyHint>M</KeyHint></button>}
            {computer && <>
              {seated && <>
                <button className="control" id="look" disabled={!connected || !officeReady} aria-keyshortcuts="Q" onClick={lookAround}>주변 보기 <KeyHint>Q</KeyHint></button>
              </>}
              <button className="control" id="switchView" disabled={!connected} aria-keyshortcuts="Tab" onClick={switchView}>
                {view === 'WORK' ? '주식으로' : '업무로'} <KeyHint>Tab</KeyHint>
              </button>
            </>}
            {computer && <button type="button" className="control" aria-haspopup="dialog" disabled={!canOpenLoan}
              onClick={() => setActiveDialog('loan')}>비상 대출</button>}
            <button type="button" className="control" aria-haspopup="dialog" disabled={!connected}
              onClick={() => setActiveDialog('leave')}>나가기</button>
          </div>}
        </header>
        {!room && <Entry connected={connected} send={send} />}
        {inLobby && <div className={'grid items-start gap-4 ' + (messengerOpen ? 'lg:grid-cols-[minmax(0,1fr)_minmax(20rem,27rem)]' : '')}>
          <Lobby key={'lobby-' + room.code + '-' + room.round} game={game} host={host} send={send} />
          {messenger}
        </div>}
        {desk && !result && <Work game={game} visible={desktopView === 'WORK'} active={desktopInteractive && view === 'WORK' && !messengerOpen} send={send} />}
        {market && !result && <Market visible={desktopView === 'MARKET'} active={desktopInteractive && !messengerOpen && view === 'MARKET'} game={game} name={name} send={send} />}
        {result && <Results result={result} name={name} host={host} connected={connected} send={send} />}
        {!inLobby && messenger}
        {computer && desktopShown && <Notifications game={game} inbox={inbox} toggleInbox={toggleInbox}
          messengerOpen={messengerOpen} openMessenger={openMessenger} lastChat={lastChat} lastNews={lastNews} dismissNews={dismissNews} />}
        {activeDialog === 'loan' && computer && game.loan && desk && !result &&
          <LoanDialog game={game} send={send} onDismiss={() => setActiveDialog(null)} />}
        {activeDialog === 'leave' && room && view !== 'MEETING' &&
          <LeaveDialog game={game} host={host} send={send} onDismiss={() => setActiveDialog(null)} />}
        <p id="status" role="status" className="text-sm text-slate-600">{game.status}</p>
      </div>
    </main>
  </>;
}
