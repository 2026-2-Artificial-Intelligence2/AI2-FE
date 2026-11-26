import { useCallback, useEffect, useRef, useState } from 'react';
import { footsteps, cough } from './spatial-audio.js';

const seatKey = 'officeStockSeat';
const initial = {
  stocks: [], candles: {}, orders: [], trades: [], history: [], chats: [],
  status: '연결 중…',
};

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
    case 'state':
      return {
        ...(message.room.startedAt ? game : {
          ...initial, chats: game.room?.code === message.code ? game.chats : [],
        }),
        status: message.room.startedAt ? (game.result ? game.status : '게임 진행 중') : '시작 대기 중',
        connected: true,
        room: message,
      };
    case 'chart': return { ...game, candles: message.candles, candleSeconds: message.candleSeconds };
    case 'catalog': return { ...game, stocks: message.stocks, feeBps: message.feeBps };
    case 'market': return {
      ...game, view: message.view, market: message,
      candles: mergeCandles(game.candles, message.candles),
    };
    case 'work': {
      const advanced = game.desk && message.desk.task.number > game.desk.task.number;
      return {
        ...game,
        desk: message.desk,
        status: advanced ? '게임 진행 중' : game.status,
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
    case 'chatHistory': return { ...game, chats: message.messages };
    case 'chat': return { ...game, chats: [...game.chats, message.message].slice(-300) };
    case 'leakSent': return { ...game, leakReceipt: message };
    case 'error': return { ...game, lastError: message, status: message.message };
    case 'newsHistory': return { ...game, history: message.items };
    case 'closed':
    case 'resumeFailed': return { ...initial, connected: true, status: message.message };
    default: return message.message ? { ...game, status: message.message } : game;
  }
}

export function useGame() {
  const [game, setGame] = useState(initial);
  const socket = useRef(null);
  const office = useRef(null);
  const send = useCallback(command => {
    if (socket.current?.readyState !== WebSocket.OPEN) return false;
    socket.current.send(command);
    return true;
  }, []);

  useEffect(() => {
    const url = new URL('/ws/lobby', location.href);
    url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const savedSeat = () => JSON.parse(sessionStorage.getItem(seatKey) ?? 'null');
    let stopped = false;
    let replaced = false;
    let resuming = false;
    let retryTimer;
    let popupTimer;
    let retries = 0;
    let newsNumber = 0;
    let lastStep = -1;
    let lastCough = -1;
    let beatStarted = 0;
    let seatLabels = [];
    let roomStartedAt;
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
        const message = JSON.parse(event.data);
        const receivedAt = performance.now();
        if (message.type === 'state') {
          sessionStorage.setItem(seatKey, JSON.stringify({ code: message.code, token: message.token }));
          retries = 0;
          youLabel = message.youLabel;
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
          office.current = { packet: message, beatStarted, meetingStarts, seatLabels, youLabel };
          if (message.walking && lastStep !== message.beat && message.step) {
            lastStep = message.beat;
            footsteps(message.step);
          }
          if (resuming) {
            resuming = false;
            newsNumber = Math.max(newsNumber, message.newsNumber);
            lastCough = Math.max(lastCough, message.coughBeat);
          }
          if (message.coughBeat > lastCough && message.step) {
            lastCough = message.coughBeat;
            cough(message.step);
          }
          if (message.newsNumber > newsNumber) {
            newsNumber = message.newsNumber;
            popup = { headline: message.headline, body: message.newsBody, kind: message.newsKind };
            clearTimeout(popupTimer);
            popupTimer = setTimeout(() => setGame(game => ({ ...game, popup: null })), popup.body ? 5000 : 4000);
          }
        }

        setGame(game => {
          const next = reduce(game, message, receivedAt);
          return popup ? { ...next, popup } : next;
        });
      };
      connection.onclose = () => {
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
      socket.current?.close();
    };
  }, []);

  return { game, send, office };
}
