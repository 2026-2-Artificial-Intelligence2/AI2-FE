let audio;

export function enableSound() {
  audio ??= new AudioContext();
  audio.resume().catch(() => {});
}

export function footsteps({from, to, listener}) {
  if (audio?.state !== 'running') return;
  for (const delay of [0, 0.5, 1, 1.5]) {
    const t = audio.currentTime + delay;
    const sound = audio.createOscillator();
    const gain = audio.createGain();
    const fraction = delay / 2;
    const x = from.x + (to.x - from.x) * fraction - listener.position.x;
    const z = from.z + (to.z - from.z) * fraction - listener.position.z;
    // Web Audio listener faces -Z, with +X to its right.
    const pan = new PannerNode(audio, {
      panningModel: 'HRTF', distanceModel: 'inverse', refDistance: 1,
      positionX: -listener.forwardZ * x, positionY: -1, positionZ: -listener.forwardZ * z
    });
    sound.frequency.setValueAtTime(120, t);
    sound.frequency.exponentialRampToValueAtTime(55, t + 0.1);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.19, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    sound.connect(gain).connect(pan).connect(audio.destination);
    sound.start(t);
    sound.stop(t + 0.16);
    sound.onended = () => { sound.disconnect(); gain.disconnect(); pan.disconnect(); };
  }
}

export function cough({to, listener}) {
  if (audio?.state !== 'running') return;
  const x = to.x - listener.position.x;
  const z = to.z - listener.position.z;
  const length = Math.floor(audio.sampleRate * 0.22);
  const noise = audio.createBuffer(1, length, audio.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  for (const delay of [0, 0.35]) {
    const t = audio.currentTime + delay;
    const source = new AudioBufferSourceNode(audio, {buffer: noise});
    const voice = new BiquadFilterNode(audio, {type: 'bandpass', frequency: 520, Q: 1.4});
    const gain = audio.createGain();
    const pan = new PannerNode(audio, {
      panningModel: 'HRTF', distanceModel: 'inverse', refDistance: 1,
      positionX: -listener.forwardZ * x, positionY: 0.6, positionZ: -listener.forwardZ * z
    });
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.55, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    source.connect(voice).connect(gain).connect(pan).connect(audio.destination);
    source.start(t);
    source.stop(t + 0.22);
    source.onended = () => { source.disconnect(); voice.disconnect(); gain.disconnect(); pan.disconnect(); };
  }
}

export function turnListener(yaw) {
  if (!audio) return;
  const listener=audio.listener;
  if (listener.forwardX) {
    listener.forwardX.value=-Math.sin(yaw);
    listener.forwardZ.value=-Math.cos(yaw);
  } else listener.setOrientation(-Math.sin(yaw),0,-Math.cos(yaw),0,1,0);
}
