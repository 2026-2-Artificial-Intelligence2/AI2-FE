import { useCallback, useEffect, useRef, useState } from 'react';

export function useMicrophone({ connected, roomCode, send }) {
  const capture = useRef(null);
  const generation = useRef(0);
  const [status, setStatus] = useState('off');
  const [error, setError] = useState('');

  const stop = useCallback((notify = true) => {
    generation.current++;
    const current = capture.current;
    capture.current = null;
    if (current) {
      clearInterval(current.timer);
      current.stream.getTracks().forEach(track => track.stop());
      void current.context.close().catch(() => {});
      if (notify) send('MIC OFF');
    }
    setStatus('off');
  }, [send]);

  useEffect(() => {
    if (!connected || !roomCode) stop(false);
    return () => stop(false);
  }, [connected, roomCode, stop]);

  async function toggle() {
    if (status === 'on' || status === 'requesting') {
      stop();
      return;
    }
    if (!connected || !roomCode) return;
    const request = ++generation.current;
    setStatus('requesting');
    setError('');
    let stream;
    let context;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('HTTPS 또는 localhost에서 마이크를 사용할 수 있어요.');
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (request !== generation.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      let last = -1;
      const timer = setInterval(() => {
        analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (const sample of samples) sum += sample * sample;
        const rms = Math.sqrt(sum / samples.length);
        const db = 20 * Math.log10(Math.max(rms, 1e-6));
        const level = Math.max(0, Math.min(100, Math.round((db + 60) * 2)));
        if (last === -1 || Math.abs(level - last) >= 3 || (level === 0 && last !== 0)) {
          if (send('MIC ' + level)) last = level;
        }
      }, 160);
      capture.current = { context, stream, timer };
      for (const track of stream.getAudioTracks()) track.addEventListener('ended', () => stop(), { once: true });
      setStatus('on');
    } catch (failure) {
      stream?.getTracks().forEach(track => track.stop());
      if (context) void context.close().catch(() => {});
      if (request === generation.current) {
        setStatus('off');
        setError(failure.name === 'NotAllowedError' ? '브라우저에서 마이크 권한을 허용해 주세요.' : failure.message);
      }
    }
  }

  return { status, error, toggle };
}
