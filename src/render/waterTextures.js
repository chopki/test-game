import * as THREE from 'three';
import { createRng } from '../sim/rng.js';

let texture = null;

/**
 * Tileable data texture for the water shader (linear, not a colour):
 *  - R: soft foam streaks, short blurred dashes running along x (the shader lines x up with the flow);
 *  - G: soft blotchy noise, used to break up ripples and vary the foam.
 */
export function waterTexture() {
  if (texture) return texture;
  const size = 128;
  const rnd = createRng(0x5f1e).next;
  const layer = (draw) => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, size, size);
    // Draw each mark at the 9 wrapped positions so the texture tiles seamlessly.
    draw(ctx, (fn) => {
      for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) fn(ox, oy);
    });
    return ctx.getImageData(0, 0, size, size).data;
  };
  const streaks = layer((ctx, wrap) => {
    ctx.lineCap = 'round';
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 3;
    for (let i = 0; i < 18; i++) {
      const x = rnd() * size;
      const y = rnd() * size;
      const len = 10 + rnd() * 28;
      const bow = (rnd() - 0.5) * 4;
      ctx.strokeStyle = `rgba(255,255,255,${0.3 + rnd() * 0.45})`;
      ctx.lineWidth = 1.2 + rnd() * 1.8;
      wrap((ox, oy) => {
        ctx.beginPath();
        ctx.moveTo(x + ox, y + oy);
        ctx.quadraticCurveTo(x + ox + len / 2, y + oy + bow, x + ox + len, y + oy);
        ctx.stroke();
      });
    }
  });
  const noise = layer((ctx, wrap) => {
    for (let i = 0; i < 60; i++) {
      const x = rnd() * size;
      const y = rnd() * size;
      const r = 6 + rnd() * 18;
      wrap((ox, oy) => {
        const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        g.addColorStop(0, 'rgba(255,255,255,0.45)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      });
    }
  });
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    data[i * 4] = streaks[i * 4];
    data[i * 4 + 1] = noise[i * 4];
    data[i * 4 + 3] = 255;
  }
  texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
