import { useCallback, useEffect, useRef, useState } from 'react';
import { footsteps, cough } from '../shared/audio/spatial-audio.js';

const seatKey = 'officeStockSeat';
const initial = {
  stocks: [], candles: {}, orders: [], trades: [], history: [], chats: [],
  status: '연결 중…', actionErrors: {},
};

// The server sends an unlabelled error or a command-specific success packet.
function commandResponse(command) {
  const [verb, target, symbol, price, quantity] = command.split(' ', 5);
  switch (verb) {
    case 'CREATE':
    case 'JOIN': return [verb, message => message.type === 'state'];
    case 'START': return [verb, message => message.type === 'state' && message.room.startedAt];
    case 'RESTART': return [verb, message => message.type === 'state' && !message.room.startedAt];
    case 'LENGTH': return [verb, message => message.type === 'state' && message.sessionSeconds === Number(target) * 60];
    case 'WORK': return [verb, message => message.type === 'work' && message.desk.task.number >= Number(target)];
    case 'LIMIT': return ['ORDER:' + symbol, message => message.type === 'orders' &&
      message.orders.some(order => order.symbol === symbol && order.limitWon === Number(price) &&
        order.quantity === Number(quantity) && order.side === (target === 'BUY' ? '매수' : '매도'))];
    case 'BUY':
    case 'BUYWON':
    case 'SELL': return ['ORDER:' + target, message => message.type === 'fill' && !message.limit && !message.forced &&
      message.symbol === target && message.side.endsWith(verb === 'SELL' ? '매도' : '매수')];
    case 'CANCEL': return [verb, message => message.type === 'orders' && !message.orders.some(order => order.id === Number(target))];
    case 'LOAN': return [verb, message => message.type === 'work' && message.desk.balance.loanRepayWon > 0];
    case 'LEAVE': return [verb, message => message.type === 'closed'];
    case 'CHAT': return [verb, (message, you) => message.type === 'chat' && message.message.from === you &&
      (message.message.to ?? 'ALL') === target && message.message.text === command.slice(6 + target.length)];
    case 'LEAK_ARTICLE': return ['CHAT', message => message.type === 'leakSent'];
    case 'SWITCH':
    case 'MESSENGER': return ['GENERAL', message => message.type === 'view'];
    case 'NEWS': return ['NEWS', message => message.type === 'newsHistory'];
    default: return null;
  }
}

function mergeCandles(history, latest) {
  const next = { ...history };
  for (const [symbol, candle] of Object.entries(latest ?? {})) {
    const list = history[symbol] ?? [];
    const last = list.at(-1);
    if (last && last.startSecond > candle.startSecond) continue;
    next[symbol] = [...(last?.startSecond === candle.startSecond ? list.slice(0, -1) : list), candle];
  }
  return next;
}

function reduce(game, message, receivedAt) {
  switch (message.type) {
    case 'state': {
      const sameRoom = game.room?.code === message.code;
      const sameRound = sameRoom && game.room.round === message.round;
      return {
        ...(message.room.startedAt ? game : {
          ...initial, chats: sameRoom ? game.chats : [],
          micLevels: sameRoom ? game.micLevels : undefined,
          actionErrors: sameRound ? game.actionErrors : initial.actionErrors,
        }),
        status: '',
        connected: true,
        room: message,
      };
    }
    case 'chart': return { ...game, candles: message.candles, candleSeconds: message.candleSeconds };
    case 'catalog': return { ...game, stocks: message.stocks, feeBps: message.feeBps, margin: message.margin, loan: message.loan };
    case 'market': return {
      ...game, view: message.view, market: message, micLevels: message.micLevels ?? game.micLevels,
      candles: mergeCandles(game.candles, message.candles),
    };
    case 'work': {
      const advanced = game.desk && message.desk.task.number > game.desk.task.number;
      return {
        ...game,
        desk: message.desk,
        workCompletion: advanced
          ? { rewardWon: message.desk.balance.workIncomeWon - game.desk.balance.workIncomeWon }
          : game.workCompletion,
      };
    }
    case 'view': return { ...game, view: message.view };
    case 'meeting': return {
      ...game, view: 'MEETING', meeting: message.reason, popup: null,
      meetingStarted: game.view === 'MEETING' ? game.meetingStarted : receivedAt,
    };
    case 'result': return { ...game, view: null, result: message, popup: null, status: '' };
    case 'fill': return { ...game, fill: message };
    case 'myTrades': return { ...game, trades: message.trades };
    case 'orders': return { ...game, orders: message.orders };
    case 'chatHistory': return { ...game, chats: message.messages, chatHistoryEnd: message.messages.at(-1)?.id ?? 0 };
    case 'chat': return { ...game, chats: [...game.chats, message.message].slice(-300) };
    case 'leakSent': return { ...game, leakReceipt: message };
    case 'mic': {
      const micLevels = { ...game.micLevels };
      if (message.on) micLevels[message.player] = message.level;
      else delete micLevels[message.player];
      return { ...game, micLevels };
    }
    case 'workError': return { ...game, workError: message };
    case 'error': return {
      ...game, lastError: message, actionErrors: { ...game.actionErrors, [message.scope]: message },
    };
    case 'notice': return { ...game, notice: message };
    case 'replaced': return { ...game, status: message.message };
    case 'dismissNews': return { ...game, popup: null };
    case 'newsHistory': return { ...game, history: message.items };
    case 'closed':
    case 'resumeFailed': return { ...initial, connected: true, status: message.message };
    default: return game;
  }
}

export function useGame() {
  const [game, setGame] = useState(initial);
  const socket = useRef(null);
  const office = useRef(null);
  const pendingCommands = useRef([]);
  const send = useCallback(command => {
    if (socket.current?.readyState !== WebSocket.OPEN) return false;
    const response = commandResponse(command);
    if (response) {
      const [scope, matches] = response;
      pendingCommands.current.push({ scope, matches, sentAt: performance.now() });
      if (scope !== 'WORK' && scope !== 'LOAN' && scope !== 'LEAVE' && scope !== 'CHAT') {
        setGame(game => game.actionErrors[scope]
          ? { ...game, actionErrors: { ...game.actionErrors, [scope]: undefined } } : game);
      }
    }
    socket.current.send(command);
    return true;
  }, []);

  const dismissNews = useCallback(() => setGame(game => reduce(game, { type: 'dismissNews' })), []);

  useEffect(() => {
    const url = new URL('/ws/lobby', location.href);
    url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const savedSeat = () => JSON.parse(sessionStorage.getItem(seatKey) ?? 'null');
    let stopped = false;
    let replaced = false;
    let resuming = false;
    let retryTimer;
    let popupTimer;
    let noticeTimer;
    let retries = 0;
    let newsNumber = 0;
    let lastStep = -1;
    let lastCough = -1;
    let beatStarted = 0;
    let seatLabels = [];
    let roomStartedAt;
    let roundSeconds;
    let youLabel;

    function connect() {
      const connection = socket.current = new WebSocket(url);
      connection.onopen = () => {
        if (stopped) return;
        const seat = savedSeat();
        resuming = Boolean(seat);
        if (seat) connection.send('RESUME ' + seat.code + ' ' + seat.token);
        setGame(game => ({
          ...game, connected: !seat,
          status: seat ? '자리로 돌아가는 중…' : '방을 만들거나 초대 코드로 입장하세요.',
        }));
      };
      connection.onmessage = event => {
        if (stopped) return;
        let message = JSON.parse(event.data);
        const receivedAt = performance.now();
        const pending = pendingCommands.current;
        while (pending.length && receivedAt - pending[0].sentAt >= 15000) pending.shift();
        if (message.type === 'error') {
          const scope = pending.shift()?.scope ?? 'GENERAL';
          message = { ...message, scope, type: scope === 'WORK' ? 'workError' : 'error' };
          if (resuming && !pending.length) {
            resuming = false;
            message = { ...message, type: 'resumeFailed' };
          }
        } else {
          const index = pending.findIndex(request => request.matches(message, youLabel));
          if (index !== -1) pending.splice(index, 1);
        }
        if (message.type === 'notice') {
          clearTimeout(noticeTimer);
          noticeTimer = setTimeout(() => setGame(game => ({ ...game, notice: null })), 10000);
        }
        if (message.type === 'state') {
          sessionStorage.setItem(seatKey, JSON.stringify({ code: message.code, token: message.token }));
          retries = 0;
          if (!message.room.startedAt) resuming = false;
          youLabel = message.youLabel;
          roundSeconds = message.sessionSeconds;
          if (roomStartedAt !== message.room.startedAt) {
            roomStartedAt = message.room.startedAt;
            seatLabels = roomStartedAt ? (message.members ?? []).map(member => member.label) : [];
          }
          if (!message.room.startedAt) {
            newsNumber = 0;
            lastStep = lastCough = -1;
            office.current = null;
            clearTimeout(popupTimer);
          }
        }
        if (message.type === 'closed' || message.type === 'resumeFailed') {
          pendingCommands.current = [];
          sessionStorage.removeItem(seatKey);
          office.current = null;
        }
        if (message.type === 'replaced') replaced = true;
        if (message.type === 'meeting') newsNumber = Math.max(newsNumber, message.newsNumber ?? 0);

        let popup;
        if (message.type === 'market') {
          const previous = office.current;
          if (previous?.packet.beat !== message.beat) beatStarted = receivedAt;
          const meetingStarts = new Map();
          for (const colleague of message.colleagues ?? []) {
            if (colleague.meeting) meetingStarts.set(colleague.label, previous?.meetingStarts.get(colleague.label) ?? receivedAt);
          }
          office.current = { packet: message, beatStarted, meetingStarts, seatLabels, youLabel, roundSeconds };
          if (message.walking && lastStep !== message.beat && message.step) {
            lastStep = message.beat;
            footsteps(message.step);
          }
          if (resuming) {
            resuming = false;
            newsNumber = Math.max(newsNumber, message.newsNumber);
            lastCough = Math.max(lastCough, message.coughBeat);
            send('NEWS HISTORY');
          }
          if (message.coughBeat > lastCough && message.step) {
            lastCough = message.coughBeat;
            cough(message.step);
          }
          if (message.newsNumber > newsNumber) {
            newsNumber = message.newsNumber;
            popup = { number: message.newsNumber, headline: message.headline, body: message.newsBody, kind: message.newsKind };
            send('NEWS HISTORY');
            clearTimeout(popupTimer);
            popupTimer = setTimeout(() => setGame(game => ({ ...game, popup: null })), popup.body ? 15000 : 12000);
          }
        }

        setGame(game => {
          const next = reduce(game, message, receivedAt);
          return popup ? { ...next, popup } : next;
        });
      };
      connection.onclose = () => {
        pendingCommands.current = [];
        if (stopped) return;
        const retry = savedSeat() && !replaced && retries < 30;
        setGame(game => ({
          ...game, connected: false, popup: null,
          status: retry ? '연결이 끊겼습니다. 다시 연결하는 중…'
            : replaced ? game.status : '연결이 끊겼습니다. 새로고침해 다시 접속하세요.',
        }));
        if (retry) retryTimer = setTimeout(connect, Math.min(1000 * 2 ** retries++, 10000));
      };
    }

    connect();
    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      clearTimeout(popupTimer);
      clearTimeout(noticeTimer);
      pendingCommands.current = [];
      socket.current?.close();
    };
  }, [send]);

  return { game, send, office, dismissNews };
}
