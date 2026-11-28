import React, { useEffect, useState } from 'react';
import { useGame } from './use-game.js';
import { useTheme } from './use-theme.js';
import { useVoice } from './use-voice.js';
import { VoicePanel } from './voice-panel.jsx';
import { SettingsPanel } from './settings-panel.jsx';
import { BossLine } from './boss-line.jsx';
import { LunchClock, LunchNotice } from './lunch-notice.jsx';
import { Icon, faCircleQuestion, faClock } from '../shared/ui/icon.jsx';
import { GuideDialog } from '../features/guide/guide-dialog.jsx';
import { BossNearby } from './boss-nearby.jsx';
import { GameGauges } from './game-gauges.jsx';
import { enableSound, sfx } from '../shared/audio/spatial-audio.js';
import { duckMusic, setMusic } from '../shared/audio/music.js';
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

const headerControl = 'control min-h-11 shrink-0 whitespace-nowrap px-2.5 sm:min-h-0 sm:px-3';

export function App() {
  const { game, send, office, dismissNews, dismissRecoveryCode, voiceSignals } = useGame();
  const { theme, toggleTheme } = useTheme();
  const [inbox, setInbox] = useState(false);
  const [activeDialog, setActiveDialog] = useState(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [conversation, setConversation] = useState('ALL');
  const [lobbyMessenger, setLobbyMessenger] = useState(false);
  const [underMessenger, setUnderMessenger] = useState('WORK');
  const [returning, setReturning] = useState(null);
  const [looking, setLooking] = useState(false);
  const [officeReady, setOfficeReady] = useState(null);
  const [monitorVisible, setMonitorVisible] = useState(false);
  const [lastChat, setLastChat] = useState(0);
  const [lastNews, setLastNews] = useState(0);
  const { connected, room, view, market, desk, result, actionErrors, startingSolo } = game;
  const voice = useVoice({ game, send, signals: voiceSignals });
  // 개발 서버에서만: 마이크 대신 합성음 등으로 음성 대화를 시험할 때 콘솔에서 쓴다(window.officeVoice.join(stream)).
  useEffect(() => {
    if (import.meta.env.DEV) window.officeVoice = voice;
  });
  // 장면별 음악: 대기실 → 근무 중 → 퇴근 뒤(가장 많이 잃은 사람은 따로). 방 밖에서는 끈다.
  // 방금 퇴근했으면 퇴근 종·팡파르·직원상 소리가 끝난 뒤 정산 음악을 켠다.
  const biggestLoser = Boolean(result?.awards?.find(award => award.award === 'biggestLoss')?.players.includes(result.you));
  const scene = !room || !connected ? null
    : result ? (biggestLoser ? 'loser' : 'result')
    : room.room.startedAt ? 'office'
    : startingSolo ? null : 'lobby';
  const sceneDelay = scene === 'result' || scene === 'loser' ? (result?.fresh ? 4.5 : 0) : 0;
  useEffect(() => { setMusic(scene, { delay: sceneDelay }); }, [scene, sceneDelay]);
  useEffect(() => () => setMusic(null), []);
  const bossWalking = Boolean(market?.walking);
  useEffect(() => { duckMusic(bossWalking); }, [bossWalking]);
  // 버튼을 누르면 작은 클릭음. 브라우저는 사용자가 누른 뒤에야 소리를 허락하므로 이때 소리도 켠다.
  useEffect(() => {
    const onClick = event => {
      if (!event.target.closest?.('button:not(:disabled)')) return;
      enableSound();
      sfx.click();
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);
  const seated = view === 'WORK' || view === 'MARKET';
  const messaging = view === 'MESSENGER';
  const computer = seated || messaging;
  const solo = Boolean(room?.solo);
  const inLobby = Boolean(room && !room.room.startedAt && !startingSolo);
  const outsideRound = Boolean(room && (inLobby || result));
  const canOpenMessengerPopup = !solo && outsideRound && !inLobby;
  const messengerOpen = !solo && (inLobby || messaging || Boolean(returning) || (canOpenMessengerPopup && lobbyMessenger));
  const desktopView = messaging || returning ? underMessenger : view;
  const officeActive = computer && Boolean(office.current);
  const desktopShown = !officeActive || officeReady === false || (!looking && monitorVisible);
  const desktopInteractive = desktopShown && view !== 'MEETING';
  const showLoan = computer && game.loan && desk && !result;
  const closingSoon = market?.remainingSeconds <= 120;
  const host = room?.you === room?.room.hostId;
  const name = symbol => game.stocks.find(stock => stock.id === symbol)?.name ?? symbol;

  // 방장이 게임 중에 나가 모두 대기실로 돌아오면(새 판) 열려 있던 창을 닫는다.
  useEffect(() => {
    setActiveDialog(null);
  }, [room?.code, room?.round]);

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
    if (solo) return;
    setConversation(typeof target === 'string' ? target : 'ALL');
    if (canOpenMessengerPopup) {
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
      setReturning({ waitingFor: 'WORK', error: game.lastViewError });
    }
  }

  useEffect(() => {
    if (!canOpenMessengerPopup) setLobbyMessenger(false);
  }, [canOpenMessengerPopup]);

  useEffect(() => {
    if (!returning) return;
    if (!connected || !computer || game.lastViewError !== returning.error || view === 'MARKET') {
      setReturning(null);
    } else if (view === 'WORK' && returning.waitingFor === 'WORK') {
      // 서버의 SWITCH는 메신저에서 업무로 돌아온 뒤에만 주식 창을 열 수 있다.
      if (send('SWITCH')) setReturning({ ...returning, waitingFor: 'MARKET' });
      else setReturning(null);
    }
  }, [returning, connected, computer, view, send, game.lastViewError]);

  function toggleInbox() {
    setInbox(open => !open);
  }

  useShortcuts(connected && (computer || outsideRound), {
    Tab: computer && (desktopInteractive || looking) ? switchView : undefined,
    KeyQ: seated && officeReady ? lookAround : undefined,
    KeyM: !solo && ((seated && desktopInteractive) || canOpenMessengerPopup) ? openMessenger : undefined,
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

  const loanAction = showLoan && <button type="button" className="control game-loan-action whitespace-nowrap"
    aria-haspopup="dialog" disabled={!connected} onClick={() => setActiveDialog('loan')}>
    {desk.balance.loanRepayWon > 0 ? '대출 내역' : '비상 대출'}
  </button>;
  const gauges = <GameGauges game={game} />;
  const messenger = room && messengerOpen && <Messenger key={'messenger-' + room.code + '-' + room.round} game={game}
    send={send} initialChannel={conversation} docked={inLobby} playing={!outsideRound} closing={Boolean(returning)} onDismiss={closeMessenger} />;

  // 처음 하는 사람을 위한 도움말(실제 화면에 표시를 겹친 설명). 언제든 머리줄에서 연다.
  const helpButton = <button type="button" className={headerControl + ' inline-flex items-center gap-1.5'} aria-haspopup="dialog"
    onClick={() => setGuideOpen(true)}><Icon icon={faCircleQuestion} /><span className="hidden sm:inline">도움말</span><span className="sr-only sm:hidden">도움말</span></button>;

  return <>
    {officeActive && <OfficeViewport office={office} market={market} players={room.room.players}
      micLevels={connected ? game.micLevels : undefined}
      looking={looking} focused={!looking} onReady={setOfficeReady} onReturn={returnToMonitor} />}
    {view === 'MEETING' && <Meeting key={game.meetingStarted + ':' + game.meetingCharacter}
      reason={game.meeting} startedAt={game.meetingStarted} character={game.meetingCharacter} />}
    <main inert={!desktopInteractive} data-monitor={desktopShown}
      className={(officeActive ? 'game-desktop ' : '') + 'min-h-screen'}>
      <div className="mx-auto max-w-[1520px] space-y-4 px-4 py-5 sm:px-7">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b border-ui-border pb-4 sm:flex sm:flex-wrap">
          <h1 className="text-lg font-extrabold tracking-tight">부장님 몰래</h1>
          {computer && desktopShown && !result && <BossLine boss={market?.boss} />}
          <div className="flex items-center gap-2 text-sm sm:ml-auto">
            {/* 방 안에서는 설정을 나가기 왼쪽에 둔다(자주 누르지 않으니 끝으로). */}
            {(!room || startingSolo) && <>{helpButton}<SettingsPanel theme={theme} onToggleTheme={toggleTheme} /></>}
            {room && !solo && <VoicePanel voice={voice} connected={connected} serverError={actionErrors.VOICE?.message} />}
          </div>
          {room && !startingSolo && <div className="col-span-full flex min-w-0 items-center gap-1.5 text-sm sm:flex-wrap sm:gap-2">
            {/* 퇴근까지 남은 시간: 점심시간 표시와 같은 알약 모양. 마지막 2분은 빨갛게 "장 마감 임박". */}
            {market && !result && <span id="clock" data-closing={closingSoon || undefined}
              className="clock-chip inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap tabular-nums sm:text-sm">
              <Icon icon={faClock} className="text-[0.85em]" />
              <span>퇴근까지</span>
              <b className="grid">
                {/* 자리수가 같으면 폭이 그대로(숫자 고정폭)라, 초가 바뀌어도 옆 칸이 흔들리지 않는다. */}
                <span aria-hidden="true" className="invisible col-start-1 row-start-1">{clock(market.remainingSeconds).replace(/\d/g, '0')}</span>
                <span className="col-start-1 row-start-1">{clock(market.remainingSeconds)}</span>
              </b>
              {closingSoon && <span className="sr-only sm:not-sr-only">· 장 마감 임박</span>}
            </span>}
            {market && !result && <LunchClock market={market} />}
            {canOpenMessengerPopup && <button className={headerControl} disabled={!connected} aria-haspopup="dialog"
              aria-keyshortcuts="M" onClick={openMessenger}>메신저<span className="hidden sm:inline"><KeyHint>M</KeyHint></span></button>}
            {computer && <>
              {seated && <button className={headerControl} id="look" disabled={!connected || !officeReady}
                aria-keyshortcuts="Q" onClick={lookAround}>주변 보기<span className="hidden lg:inline"><KeyHint>Q</KeyHint></span></button>}
              <button className={headerControl} id="switchView" disabled={!connected} aria-keyshortcuts="Tab" onClick={switchView}>
                {view === 'WORK' ? '주식으로' : '업무로'}<span className="hidden lg:inline"><KeyHint>Tab</KeyHint></span>
              </button>
            </>}
            <span className="ml-auto flex gap-1.5 sm:ml-0 sm:gap-2">{helpButton}<SettingsPanel theme={theme} onToggleTheme={toggleTheme} /></span>
            <button type="button" className={headerControl} aria-haspopup="dialog" disabled={!connected}
              onClick={() => setActiveDialog('leave')}>나가기</button>
          </div>}
        </header>
        {room && !startingSolo && !inLobby && (game.status || actionErrors.VIEW || actionErrors.GENERAL || (!activeDialog && game.notice)) &&
          <div role="status" className="panel px-4 py-3 text-sm text-ui-secondary">
            {game.status || actionErrors.VIEW?.message || actionErrors.GENERAL?.message || game.notice?.message}
          </div>}
        {(!room || startingSolo) && <Entry connected={connected && !startingSolo} send={send} status={game.status}
          account={game.account} accountNotice={game.accountNotice} actionErrors={actionErrors} startingSolo={startingSolo}
          leaderboard={game.leaderboard} records={game.records} recoveryCode={game.recoveryCode} gameNotice={game.notice}
          dismissRecoveryCode={dismissRecoveryCode} />}
        {inLobby && <Lobby key={'lobby-' + room.code + '-' + room.round} game={game} host={host} send={send}
          messenger={messenger} />}
        {desk && !result && <Work game={game} visible={desktopView === 'WORK'} active={desktopInteractive && view === 'WORK' && !messengerOpen} gauges={gauges} loanAction={loanAction} send={send} />}
        {market && !result && <Market visible={desktopView === 'MARKET'} active={desktopInteractive && !messengerOpen && view === 'MARKET'} game={game} name={name} gauges={gauges} loanAction={loanAction} theme={theme} send={send} />}
        {result && <Results result={result} name={name} host={host} solo={solo} connected={connected} send={send} restartError={actionErrors.RESTART?.message} />}
        {!inLobby && messenger}
        {computer && desktopShown && <BossNearby market={market} />}
        {computer && desktopShown && !result && <LunchNotice market={market} />}
        {computer && desktopShown && <Notifications game={game} inbox={inbox} toggleInbox={toggleInbox}
          messengerOpen={messengerOpen} openMessenger={openMessenger} lastChat={lastChat} lastNews={lastNews} dismissNews={dismissNews} />}
        {activeDialog === 'loan' && showLoan &&
          <LoanDialog game={game} send={send} onDismiss={() => setActiveDialog(null)} />}
        {guideOpen && <GuideDialog onDismiss={() => setGuideOpen(false)} />}
        {activeDialog === 'leave' && room && view !== 'MEETING' &&
          <LeaveDialog game={game} host={host} send={send} onDismiss={() => setActiveDialog(null)} />}
      </div>
    </main>
  </>;
}
