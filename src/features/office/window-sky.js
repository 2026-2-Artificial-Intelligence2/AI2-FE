import { CanvasTexture, MeshBasicMaterial, SRGBColorSpace, TextureLoader } from 'three';

const palettes = [
  [[187, 216, 228], [255, 221, 208], [213, 198, 202], [185, 181, 194]],
  [[129, 131, 170], [240, 172, 139], [147, 130, 148], [110, 101, 127]],
  [[31, 41, 72], [84, 83, 117], [64, 73, 99], [43, 53, 78]],
];

function mixColor(from, to, amount) {
  return 'rgb(' + from.map((channel, index) => Math.round(channel + (to[index] - channel) * amount)).join(',') + ')';
}

// Colour keyframes over the work day (0 = start of the round, 1 = quitting time).
const VIEW_TINT = [
  [0, [0.9, 0.92, 0.96]],
  [0.3, [1, 1, 1]],
  [0.6, [1, 0.94, 0.84]],
  [0.8, [0.98, 0.7, 0.52]],
  [1, [0.3, 0.33, 0.5]],
];

// Smoothly interpolate keyframes [[time, value | [values]], ...] at time t.
export function dayCurve(t, stops) {
  let i = 1;
  while (i < stops.length - 1 && t > stops[i][0]) i++;
  const [t0, a] = stops[i - 1], [t1, b] = stops[i];
  const k = Math.max(0, Math.min(1, (t - t0) / (t1 - t0)));
  const e = k * k * (3 - 2 * k);
  return Array.isArray(a) ? a.map((v, j) => v + (b[j] - v) * e) : a + (b - a) * e;
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
  let illustrated = false, disposed = false;
  const material = new MeshBasicMaterial({ map: texture, toneMapped: false });
  new TextureLoader().load(
    `${import.meta.env.BASE_URL}models/office-props/city-window.jpg`,
    city => {
      if (disposed) { city.dispose(); return; }
      city.colorSpace = SRGBColorSpace;
      city.anisotropy = 4;
      material.map = city;
      material.needsUpdate = true;
      illustrated = true;
      const progress = paintedStep / 72;
      paintedStep = -1;
      update(progress);
    }, undefined, () => {}
  );

  function update(progress) {
    const step = Math.round(Math.max(0, Math.min(1, progress)) * 72);
    if (step === paintedStep) return;
    paintedStep = step;
    const day = step / 72;
    if (illustrated) {
      // morning -> bright midday -> golden sunset -> dusk at quitting time
      material.color.setRGB(...dayCurve(day, VIEW_TINT));
      return;
    }
    const t = Math.max(0, Math.min(1, (day - 0.55) / 0.45));   // the painted fallback only darkens
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
  return { material, update, dispose() {
    disposed = true;
    texture.dispose();
  }};
}
