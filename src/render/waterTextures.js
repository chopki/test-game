import * as THREE from 'three';
import { createRng } from '../sim/rng.js';

let streaks = null;

/**
 * Tileable foam streaks for flowing water: short soft dashes running along x (the shader lines x up with the
 * flow). White = foam. Linear data, not a colour.
 */
export function streakTexture() {
  if (streaks) return streaks;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  const rnd = createRng(0x5f1e).next;
  ctx.lineCap = 'round';
  for (let i = 0; i < 46; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const len = 8 + rnd() * 26;
    ctx.strokeStyle = `rgba(255,255,255,${0.35 + rnd() * 0.5})`;
    ctx.lineWidth = 1 + rnd() * 1.6;
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        ctx.beginPath();
        ctx.moveTo(x + ox, y + oy);
        ctx.quadraticCurveTo(x + ox + len / 2, y + oy + (rnd() - 0.5) * 3, x + ox + len, y + oy);
        ctx.stroke();
      }
    }
  }
  streaks = new THREE.CanvasTexture(canvas);
  streaks.wrapS = streaks.wrapT = THREE.RepeatWrapping;
  return streaks;
}
