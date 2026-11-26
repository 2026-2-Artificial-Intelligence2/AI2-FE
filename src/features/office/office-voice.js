import { CanvasTexture, SRGBColorSpace } from 'three';

const voiceThresholds = [12, 35, 65];

export function voiceArcCount(level) {
  return voiceThresholds.filter(threshold => level >= threshold).length;
}

export function makeVoiceTextures() {
  return voiceThresholds.map((_, index) => {
    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    context.lineCap = 'round';

    for (let arc = 0; arc <= index; arc++) {
      context.beginPath();
      context.arc(48, 63, 19 + arc * 13, -Math.PI * 0.78, -Math.PI * 0.22);
      context.lineWidth = 8;
      context.strokeStyle = '#153b55';
      context.stroke();
      context.lineWidth = 4;
      context.strokeStyle = '#70e0ff';
      context.stroke();
    }

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  });
}
