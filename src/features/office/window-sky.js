import { CanvasTexture, MeshBasicMaterial, SRGBColorSpace } from 'three';

const palettes = [
  [[187, 216, 228], [255, 221, 208], [213, 198, 202], [185, 181, 194]],
  [[129, 131, 170], [240, 172, 139], [147, 130, 148], [110, 101, 127]],
  [[31, 41, 72], [84, 83, 117], [64, 73, 99], [43, 53, 78]],
];

function mixColor(from, to, amount) {
  return 'rgb(' + from.map((channel, index) => Math.round(channel + (to[index] - channel) * amount)).join(',') + ')';
}

export function makeWindowSky() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  let paintedStep = -1;

  function update(progress) {
    const step = Math.round(Math.max(0, Math.min(1, progress)) * 72);
    if (step === paintedStep) return;
    paintedStep = step;
    const t = step / 72;
    const first = t < 0.60 ? 0 : 1;
    const transition = first === 0 ? t / 0.60 : (t - 0.60) / 0.40;
    const color = index => mixColor(palettes[first][index], palettes[first + 1][index], transition);
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, color(0));
    gradient.addColorStop(1, color(1));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let layer = 0; layer < 2; layer++) {
      for (let i = 0; i < 26; i++) {
        const x = i * 49 - layer * 23;
        const y = 110 + layer * 60 + Math.sin(i * 5.4 + layer) * 48;
        ctx.fillStyle = color(2 + layer);
        ctx.fillRect(x, y, 36 + (i % 3) * 7, canvas.height - y);
        for (let a = 5; a < 34; a += 10) {
          for (let b = y + 10; b < canvas.height; b += 15) {
            const lit = t > 0.46 + ((i * 11 + a + Math.floor(b) * 3) % 15) * 0.03;
            ctx.fillStyle = lit ? '#d7b78a' : mixColor([209, 215, 213], [66, 77, 104], t);
            ctx.fillRect(x + a, b, 4, 7);
          }
        }
      }
    }
    texture.needsUpdate = true;
  }

  update(0);
  return { material: new MeshBasicMaterial({ map: texture }), update };
}
