import * as THREE from 'three';

// Procedural canvas textures, so the game still ships no image assets. Each texture tiles once per
// world unit (geometries scale their UVs to world size, see models.js), so bricks and roof tiles
// stay the same size on every building. Textures are created lazily and shared.

const cache = new Map();

function make(key, size, draw) {
  if (cache.has(key)) return cache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  draw(ctx, size, seeded(hash(key)));
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}

// Deterministic randomness so textures look the same on every load.
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h;
}

const shade = (hex, amount) => {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amount);
  return `#${c.getHexString()}`;
};

/** Running-bond sandstone blocks: 4 courses per unit. */
export function stoneTexture(base = '#c9a679') {
  return make(`stone:${base}`, 128, (ctx, s, rnd) => {
    const mortar = shade(base, -0.22);
    ctx.fillStyle = mortar;
    ctx.fillRect(0, 0, s, s);
    const rows = 4;
    const rh = s / rows;
    for (let r = 0; r < rows; r++) {
      const cols = 2;
      const bw = s / cols;
      const offset = r % 2 ? bw / 2 : 0;
      for (let c = -1; c < cols; c++) {
        const x = c * bw + offset;
        ctx.fillStyle = shade(base, (rnd() - 0.5) * 0.12);
        ctx.fillRect(x + 2, r * rh + 2, bw - 4, rh - 4);
        // Light top edge and a few speckles for a chiselled look.
        ctx.fillStyle = shade(base, 0.08);
        ctx.fillRect(x + 2, r * rh + 2, bw - 4, 2);
        ctx.fillStyle = shade(base, -0.1);
        for (let i = 0; i < 6; i++) ctx.fillRect(x + 4 + rnd() * (bw - 10), r * rh + 5 + rnd() * (rh - 10), 2, 2);
      }
    }
  });
}

/** Overlapping clay roof tiles, rows running horizontally. */
export function roofTexture(base = '#b4472f') {
  return make(`roof:${base}`, 128, (ctx, s, rnd) => {
    ctx.fillStyle = shade(base, -0.18);
    ctx.fillRect(0, 0, s, s);
    const rows = 5;
    const rh = s / rows;
    const tw = s / 6;
    for (let r = 0; r < rows; r++) {
      const offset = r % 2 ? tw / 2 : 0;
      for (let c = -1; c < 7; c++) {
        const x = c * tw + offset;
        const y = r * rh;
        ctx.fillStyle = shade(base, (rnd() - 0.5) * 0.1);
        ctx.beginPath();
        ctx.moveTo(x + 1, y);
        ctx.lineTo(x + tw - 1, y);
        ctx.lineTo(x + tw - 1, y + rh * 0.7);
        ctx.quadraticCurveTo(x + tw / 2, y + rh + 2, x + 1, y + rh * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = shade(base, 0.1);
        ctx.fillRect(x + 3, y + 2, tw - 6, 2);
      }
    }
  });
}

/** Vertical wooden planks. */
export function woodTexture(base = '#8a5a34') {
  return make(`wood:${base}`, 128, (ctx, s, rnd) => {
    const planks = 5;
    const pw = s / planks;
    for (let i = 0; i < planks; i++) {
      ctx.fillStyle = shade(base, (rnd() - 0.5) * 0.12);
      ctx.fillRect(i * pw, 0, pw, s);
      ctx.strokeStyle = shade(base, -0.12);
      ctx.lineWidth = 1;
      for (let g = 0; g < 4; g++) {
        const gx = i * pw + 3 + rnd() * (pw - 6);
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.bezierCurveTo(gx + 2, s * 0.3, gx - 2, s * 0.6, gx + 1, s);
        ctx.stroke();
      }
      ctx.fillStyle = shade(base, -0.25);
      ctx.fillRect(i * pw, 0, 2, s);
    }
  });
}

/** Half-timbered plaster: cream panels with dark beams and diagonal braces. */
export function timberTexture() {
  return make('timber', 128, (ctx, s) => {
    ctx.fillStyle = '#eadcbc';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#e2d2ae';
    for (let i = 0; i < 40; i++) ctx.fillRect((i * 37) % s, (i * 53) % s, 6, 3);
    const beam = '#5b3a22';
    ctx.fillStyle = beam;
    const w = 9;
    ctx.fillRect(0, 0, s, w);
    ctx.fillRect(0, s - w, s, w);
    ctx.fillRect(0, 0, w, s);
    ctx.fillRect(s / 2 - w / 2, 0, w, s);
    ctx.strokeStyle = beam;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(w, s - w);
    ctx.lineTo(s / 2, w);
    ctx.stroke();
  });
}

/** Grass with soft blotches and blade speckles. */
export function grassTexture() {
  return make('grass', 256, (ctx, s, rnd) => {
    ctx.fillStyle = '#6fa64b';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = rnd() < 0.5 ? 'rgba(90,140,55,0.35)' : 'rgba(140,185,90,0.3)';
      ctx.beginPath();
      ctx.arc(rnd() * s, rnd() * s, 8 + rnd() * 22, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = rnd() < 0.5 ? '#5d9440' : '#86bb5d';
      ctx.fillRect(rnd() * s, rnd() * s, 1.5, 3);
    }
  });
}

/** Packed dirt with pebbles. */
export function dirtTexture() {
  return make('dirt', 128, (ctx, s, rnd) => {
    ctx.fillStyle = '#a58a5d';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 300; i++) {
      ctx.fillStyle = rnd() < 0.5 ? '#8f7650' : '#b89d6e';
      const r = 1 + rnd() * 2.5;
      ctx.beginPath();
      ctx.arc(rnd() * s, rnd() * s, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}
