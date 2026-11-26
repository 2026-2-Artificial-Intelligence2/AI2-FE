import { useCallback, useEffect, useRef, useState } from 'react';

// 음성 대화(WebRTC). 음성은 브라우저끼리 직접 주고받고, 서버는 연결 정보(offer·answer·ICE 후보)만 전달한다.
// 같은 방에서 음성에 참여한 사람과 한 명씩 연결한다(메시). 두 사람 중 이름이 사전순으로 앞서는 쪽이 연결을 제안해
// 양쪽이 동시에 제안하는 충돌을 막는다. 서버 규약은 AI2-BE의 PROTOCOL.md "음성 대화"에 있다.
const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
const speakingThreshold = 0.02;

function levelOf(analyser, samples) {
  if (!analyser) return 0;
  analyser.getFloatTimeDomainData(samples);
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.sqrt(sum / samples.length);
}

/** 소리 크기(0~100). use-microphone.js와 같은 계산: -60dB → 0, -10dB → 100. */
function micLevel(rms) {
  const db = 20 * Math.log10(Math.max(rms, 1e-6));
  return Math.max(0, Math.min(100, Math.round((db + 60) * 2)));
}

/**
 * @param shareLevel 음성 참여 중 소리 크기(MIC)도 같은 마이크로 보낼지. '내 마이크 켜기'로 따로 보내는 중이면 false.
 */
export function useVoice({ game, send, signals, shareLevel = true }) {
  const room = game.room;
  const connected = game.connected;
  const you = room?.youLabel;
  const solo = Boolean(room?.solo);
  const members = room?.members;
  const local = useRef(null);            // { stream, context, analyser }
  const peers = useRef(new Map());       // label → { pc, audio, analyser, pending }
  const volumes = useRef(new Map());     // label → 0~1, 다시 연결돼도 유지한다
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState('');
  const [speaking, setSpeaking] = useState({});
  const [, redraw] = useState(0);
  const refresh = useCallback(() => redraw(n => n + 1), []);

  const signal = useCallback((label, data) => send('VOICE SIGNAL ' + label + ' ' + JSON.stringify(data)), [send]);

  const closePeer = useCallback(label => {
    const peer = peers.current.get(label);
    if (!peer) return;
    peer.pc.close();
    peer.audio?.remove();
    peers.current.delete(label);
  }, []);

  const attachAudio = useCallback((label, stream) => {
    const peer = peers.current.get(label);
    if (!peer || peer.audio || !local.current) return;
    const audio = Object.assign(document.createElement('audio'), { autoplay: true, srcObject: stream });
    audio.volume = volumes.current.get(label) ?? 1;
    audio.dataset.voicePeer = label;
    document.body.append(audio);
    peer.audio = audio;
    const analyser = local.current.context.createAnalyser();
    analyser.fftSize = 512;
    local.current.context.createMediaStreamSource(stream).connect(analyser);
    peer.analyser = analyser;
    refresh();
  }, [refresh]);

  const makePeer = useCallback(label => {
    const pc = new RTCPeerConnection({ iceServers });
    local.current.stream.getTracks().forEach(track => pc.addTrack(track, local.current.stream));
    pc.onicecandidate = event => { if (event.candidate) signal(label, { candidate: event.candidate }); };
    pc.ontrack = event => attachAudio(label, event.streams[0]);
    pc.onconnectionstatechange = refresh;
    peers.current.set(label, { pc, audio: null, analyser: null, pending: [] });
    return pc;
  }, [signal, attachAudio, refresh]);

  const leave = useCallback((notify = true) => {
    for (const label of [...peers.current.keys()]) closePeer(label);
    const current = local.current;
    local.current = null;
    if (current) {
      current.stream.getTracks().forEach(track => track.stop());
      void current.context.close().catch(() => {});
      if (notify) send('VOICE LEAVE');
    }
    setJoined(false);
    setMuted(false);
    setSpeaking({});
  }, [closePeer, send]);

  async function join(stream) {
    if (local.current || requesting || !connected || !room || solo) return;
    setRequesting(true);
    setError('');
    try {
      if (!stream && !navigator.mediaDevices?.getUserMedia) throw new Error('HTTPS 또는 localhost에서만 음성 대화를 할 수 있어요.');
      const media = stream ?? await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      context.createMediaStreamSource(media).connect(analyser);
      local.current = { stream: media, context, analyser };
      for (const track of media.getAudioTracks()) track.addEventListener('ended', () => leave(), { once: true });
      setJoined(true);
      setMuted(false);
      send('VOICE JOIN');
    } catch (failure) {
      setError(failure.name === 'NotAllowedError' ? '브라우저에서 마이크 권한을 허용해 주세요.' : failure.message);
    } finally {
      setRequesting(false);
    }
  }

  function toggleMute() {
    if (!local.current) return;
    const next = !muted;
    local.current.stream.getAudioTracks().forEach(track => { track.enabled = !next; });
    setMuted(next);
    send(next ? 'VOICE MUTE' : 'VOICE UNMUTE');
  }

  function setVolume(label, value) {
    volumes.current.set(label, value);
    const audio = peers.current.get(label)?.audio;
    if (audio) audio.volume = value;
    refresh();
  }

  // 서버가 보낸 연결 정보 처리
  useEffect(() => {
    signals.current = async ({ from, data }) => {
      if (!local.current) return;
      if (!peers.current.has(from)) makePeer(from);
      const peer = peers.current.get(from);
      const pc = peer.pc;
      try {
        if (data.sdp) {
          await pc.setRemoteDescription(data.sdp);
          for (const candidate of peer.pending.splice(0)) await pc.addIceCandidate(candidate);
          if (data.sdp.type === 'offer') {
            await pc.setLocalDescription(await pc.createAnswer());
            signal(from, { sdp: pc.localDescription });
          }
        } else if (data.candidate) {
          if (pc.remoteDescription) await pc.addIceCandidate(data.candidate);
          else peer.pending.push(data.candidate);
        }
      } catch (failure) {
        console.warn('음성 연결 정보 처리 실패', from, failure);
      }
    };
    return () => { signals.current = null; };
  }, [signals, makePeer, signal]);

  // 방 상태가 바뀔 때마다 음성에 참여한 다른 사람과 연결하고, 빠진 사람과는 끊는다.
  useEffect(() => {
    if (!joined || !local.current) return;
    const others = (members ?? []).filter(member => member.voice && member.online && member.label !== you);
    for (const label of [...peers.current.keys()]) {
      if (!others.some(member => member.label === label)) closePeer(label);
    }
    for (const member of others) {
      if (peers.current.has(member.label)) continue;
      const pc = makePeer(member.label);
      if (you < member.label) {
        void pc.createOffer()
          .then(offer => pc.setLocalDescription(offer))
          .then(() => signal(member.label, { sdp: pc.localDescription }))
          .catch(failure => console.warn('음성 연결 제안 실패', member.label, failure));
      }
    }
    refresh();
  }, [joined, members, you, makePeer, closePeer, signal, refresh]);

  // 재접속하면 서버는 음성 참여를 지우므로 다시 참여를 알리고, 끊긴 연결은 새로 맺는다.
  const wasConnected = useRef(connected);
  useEffect(() => {
    if (connected && !wasConnected.current && local.current) {
      for (const label of [...peers.current.keys()]) closePeer(label);
      send('VOICE JOIN');
      if (muted) send('VOICE MUTE');
    }
    wasConnected.current = connected;
  }, [connected, muted, closePeer, send]);

  // 방을 나가거나 솔로 방이면 음성을 끈다.
  useEffect(() => {
    if (!room?.code || solo) leave(false);
  }, [room?.code, solo, leave]);

  useEffect(() => () => leave(false), [leave]);

  // 말하는 사람 표시와 내 소리 크기 보내기
  useEffect(() => {
    if (!joined) return;
    const samples = new Float32Array(512);
    let sentLevel = -1;
    const timer = setInterval(() => {
      const next = {};
      const rms = local.current && !muted ? levelOf(local.current.analyser, samples) : 0;
      if (you && local.current && !muted) next[you] = rms > speakingThreshold;
      if (shareLevel) {
        const level = micLevel(rms);
        if (sentLevel === -1 || Math.abs(level - sentLevel) >= 3 || (level === 0 && sentLevel !== 0)) {
          if (send('MIC ' + level)) sentLevel = level;
        }
      }
      for (const [label, peer] of peers.current) next[label] = levelOf(peer.analyser, samples) > speakingThreshold;
      setSpeaking(current => JSON.stringify(current) === JSON.stringify(next) ? current : next);
    }, 150);
    return () => {
      clearInterval(timer);
      if (shareLevel && sentLevel !== -1) send('MIC OFF');
    };
  }, [joined, muted, you, shareLevel, send]);

  const people = (members ?? []).filter(member => member.voice).map(member => {
    const peer = peers.current.get(member.label);
    const me = member.label === you;
    return {
      label: member.label, me, muted: member.muted, speaking: Boolean(speaking[member.label]),
      state: me ? 'connected' : peer?.pc.connectionState ?? 'waiting',
      volume: volumes.current.get(member.label) ?? 1,
    };
  });

  return { available: Boolean(room) && !solo, joined, muted, requesting, error, people, join, leave, toggleMute, setVolume };
}
