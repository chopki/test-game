import { createNoise } from '../sim/noise.js';
import { createRng } from '../sim/rng.js';
import { T } from '../sim/terrain.js';

/**
 * Paints the ground for a map into one canvas, once per game (after docs/reference/art-style.jpg: warm olive
 * grass with dry patches, darker forest floor, gravel round rocks, blue water with damp banks, pebbly fords).
 *
 * Painting runs in two passes:
 *  1. A low-resolution colour pass (BASE_PX per tile) where every pixel blends the terrain around it, with noise
 *     to break up tile edges, so shorelines and woods have natural, wobbly outlines.
 *  2. That image is scaled up (smoothly) to the final resolution, and small details are stamped on top: grass
 *     tufts, flowers, pebbles and fallen leaves.
 *
 * The painted area is the map plus `border` tiles all round; beyond it the renderer draws a flat ground in
 * OUTER_GROUND colour, which the border fades into. The woods outside the map (`outsideForest`) are decoration.
 */

const BASE_PX = 8;
const BANK_DEPTH = 0.45; // how far (in tiles) the far bank's wall shows above the water
export const PAINT_BORDER = 14;
export const OUTER_GROUND = '#9c9a4c';

const C = {
  lush: [134, 146, 58],
  dry: [178, 168, 88],
  forestFloor: [104, 108, 46],
  earth: [168, 140, 88],
  gravel: [176, 162, 128],
  shore: [164, 140, 90],
  bankWall: [122, 88, 54],
  bankTop: [150, 112, 68],
  shallow: [120, 190, 206],
  deep: [74, 146, 186],
  ford: [156, 184, 168],
  outer: hexRgb(OUTER_GROUND),
};

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function mix(out, c, t) {
  out[0] += (c[0] - out[0]) * t;
  out[1] += (c[1] - out[1]) * t;
  out[2] += (c[2] - out[2]) * t;
}

/** How wooded the land outside the map is at sim tile (x, z): 0..1. Shared by the painter and the renderer. */
export function outsideForest(noise, x, z, width, height) {
  const out = Math.max(-x, -z, x - (width - 1), z - (height - 1)); // tiles beyond the map edge
  if (out <= 0) return 0;
  const n = noise.fbm(x * 0.09 + 300, z * 0.09 + 300);
  return smooth(0.42, 0.62, n + Math.min(1, out / 6) * 0.25) * smooth(0, 2, out);
}

/**
 * Paint the ground for `grid` (a sim Grid with `terrain`). `pxPerTile` is the final resolution and `detail`
 * scales how many small details are stamped (0 = none). Returns { canvas, waterMask, hasWater, tiles, border,
 * noise } where `tiles` is the painted size in tiles (map + 2 × border) and `waterMask` is a small
 * canvas (white where there's water) for the shimmer effect.
 */
export function paintTerrain(grid, { pxPerTile = 16, detail = 1, seed = 1, border = PAINT_BORDER } = {}) {
  const { width: W, height: H } = grid;
  const TW = W + 2 * border;
  const TH = H + 2 * border;
  const noise = createNoise(createRng(seed ^ 0x51ed));

  // Per-tile fields over the painted area (index (z + border) * TW + (x + border)).
  const field = () => new Float32Array(TW * TH);
  const water = field();
  const ford = field();
  const forest = field();
  const rock = field();
  let hasWater = false;
  for (let tz = 0; tz < TH; tz++) {
    for (let tx = 0; tx < TW; tx++) {
      const x = tx - border;
      const z = tz - border;
      const i = tz * TW + tx;
      if (!grid.inBounds(x, z)) {
        // Outside the map the woods are decoration with fewer trees, so the forest floor is fainter.
        forest[i] = outsideForest(noise, x, z, W, H) * 0.55;
        continue;
      }
      const t = grid.terrain[z * W + x];
      if (t === T.water) water[i] = 1;
      if (t === T.ford) {
        water[i] = 0.75;
        ford[i] = 1;
      }
      if (t === T.forest) forest[i] = 1;
      if (t === T.rock) rock[i] = 1;
      if (t === T.water || t === T.ford) hasWater = true;
    }
  }
  const sample = (f, u, v) => {
    // Bilinear between tile centres.
    const fu = Math.min(TW - 1.001, Math.max(0, u - 0.5));
    const fv = Math.min(TH - 1.001, Math.max(0, v - 0.5));
    const x0 = fu | 0;
    const z0 = fv | 0;
    const ax = fu - x0;
    const az = fv - z0;
    const i = z0 * TW + x0;
    const a = f[i] + (f[i + 1] - f[i]) * ax;
    const b = f[i + TW] + (f[i + TW + 1] - f[i + TW]) * ax;
    return a + (b - a) * az;
  };

  // Pass 1: colour at BASE_PX per tile.
  const bw = TW * BASE_PX;
  const bh = TH * BASE_PX;
  const base = document.createElement('canvas');
  base.width = bw;
  base.height = bh;
  const bctx = base.getContext('2d');
  const img = bctx.createImageData(bw, bh);
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = bw;
  maskCanvas.height = bh;
  const mctx = maskCanvas.getContext('2d');
  const mask = mctx.createImageData(bw, bh);
  const col = [0, 0, 0];
  for (let py = 0; py < bh; py++) {
    const v = (py + 0.5) / BASE_PX;
    const z = v - border;
    for (let px = 0; px < bw; px++) {
      const u = (px + 0.5) / BASE_PX;
      const x = u - border;
      const o = (py * bw + px) * 4;

      // Grass: lush to dry by a broad noise, then a little fine mottling.
      const dryness = noise.fbm(x * 0.07, z * 0.07);
      col[0] = C.lush[0];
      col[1] = C.lush[1];
      col[2] = C.lush[2];
      mix(col, C.dry, smooth(0.38, 0.72, dryness));
      const wobble = noise.value(x * 0.85 + 11, z * 0.85 + 5) - 0.5;
      const fine = noise.value(x * 2.3, z * 2.3) - 0.5;

      // Bare earth here and there (worn ground, never in lines).
      const earth = noise.fbm(x * 0.16 + 70, z * 0.16 + 20, 2);
      mix(col, C.earth, smooth(0.66, 0.8, earth) * 0.7);

      const f = sample(forest, u, v) + wobble * 0.35;
      mix(col, C.forestFloor, smooth(0.3, 0.62, f));

      const r = sample(rock, u, v) + wobble * 0.4;
      mix(col, C.gravel, smooth(0.32, 0.55, r) * 0.8);

      const w = sample(water, u, v) + wobble * 0.3;
      let m = 0;
      if (w > 0.4) {
        // Sandy shore, then the water, which sits below the grass: where the land is on the far side (away
        // from the camera), the earth bank's wall shows above the water line, as in the reference.
        mix(col, C.shore, smooth(0.4, 0.47, w));
        if (w > 0.48) {
          const isFord = sample(ford, u, v) > 0.5;
          col[0] = C.shallow[0];
          col[1] = C.shallow[1];
          col[2] = C.shallow[2];
          if (isFord) mix(col, C.ford, 0.85);
          else mix(col, C.deep, smooth(0.62, 1.05, w + fine * 0.3));
          const far = sample(water, u - BANK_DEPTH, v - BANK_DEPTH) + wobble * 0.3;
          if (far <= 0.48 && !isFord) {
            const depth = smooth(0.48, 0.3, far);
            col[0] = C.bankWall[0];
            col[1] = C.bankWall[1];
            col[2] = C.bankWall[2];
            mix(col, C.bankTop, 1 - depth);
          } else {
            m = isFord ? 0.55 : 1;
          }
        }
      }

      // Light and shade mottling, then fade the border into the flat outer ground.
      const shade = 1 + fine * 0.1 + wobble * 0.06;
      const edge = Math.max(-x, -z, x - W, z - H);
      const fade = smooth(border - 5, border - 0.5, edge);
      col[0] *= shade;
      col[1] *= shade;
      col[2] *= shade;
      mix(col, C.outer, fade);

      img.data[o] = col[0];
      img.data[o + 1] = col[1];
      img.data[o + 2] = col[2];
      img.data[o + 3] = 255;
      mask.data[o] = mask.data[o + 1] = mask.data[o + 2] = 255;
      mask.data[o + 3] = m * 255;
    }
  }
  bctx.putImageData(img, 0, 0);
  mctx.putImageData(mask, 0, 0);

  // Pass 2: scale up and stamp details.
  const canvas = document.createElement('canvas');
  canvas.width = TW * pxPerTile;
  canvas.height = TH * pxPerTile;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(base, 0, 0, canvas.width, canvas.height);
  if (detail > 0) stampDetails(ctx, { grid, noise, border, pxPerTile, detail, sample: (u, v) => sample(water, u, v) });

  return { canvas, waterMask: maskCanvas, hasWater, tiles: { width: TW, height: TH }, border, noise };
}

/** Grass tufts, flowers, pebbles and leaves, stamped into the ground (they cost nothing to draw later). */
function stampDetails(ctx, { grid, noise, border, pxPerTile, detail, sample }) {
  const rnd = createRng(0x7e57).next;
  const { width: W, height: H } = grid;
  const s = pxPerTile / 16; // stamp scale
  const terrainAt = (x, z) => (grid.inBounds(Math.floor(x), Math.floor(z)) ? grid.terrain[Math.floor(z) * W + Math.floor(x)] : -1);
  const count = Math.round((W + border) * (H + border) * 3.2 * detail);
  for (let i = 0; i < count; i++) {
    const x = rnd() * (W + 2 * border - 4) - border + 2;
    const z = rnd() * (H + 2 * border - 4) - border + 2;
    const edge = Math.max(-x, -z, x - W, z - H);
    if (edge > border - 4) continue;
    if (sample(x + border, z + border) > 0.3) continue; // water (and its banks) is animated by the renderer
    const t = terrainAt(x, z);
    const px = (x + border) * pxPerTile;
    const py = (z + border) * pxPerTile;
    const kind = rnd();
    if (t === T.forest || (t === -1 && noise.fbm(x * 0.09 + 300, z * 0.09 + 300) > 0.5)) {
      if (kind < 0.6) leaves(ctx, px, py, s, rnd);
      continue;
    }
    if (t === T.rock) {
      pebbles(ctx, px, py, s, rnd, 3);
      continue;
    }
    const meadow = noise.fbm(x * 0.12 + 40, z * 0.12 + 90, 2);
    if (kind < 0.8) tuft(ctx, px, py, s, rnd);
    else if (kind < 0.8 + 0.08 * smooth(0.5, 0.7, meadow)) flowers(ctx, px, py, s, rnd);
    else if (kind < 0.9) pebbles(ctx, px, py, s, rnd, 1 + Math.floor(rnd() * 2));
  }
}

function tuft(ctx, x, y, s, rnd) {
  const blades = 3 + Math.floor(rnd() * 3);
  const dark = rnd() < 0.6;
  ctx.strokeStyle = dark ? 'rgba(86,92,30,0.75)' : 'rgba(206,196,112,0.65)';
  ctx.lineWidth = Math.max(1, 1.1 * s);
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let b = 0; b < blades; b++) {
    const a = -Math.PI / 2 + (b / (blades - 1) - 0.5) * 1.3 + (rnd() - 0.5) * 0.3;
    const len = (2.5 + rnd() * 2.5) * s;
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
  }
  ctx.stroke();
}

function flowers(ctx, x, y, s, rnd) {
  const colours = ['#f4f0e0', '#f3d34a', '#f0e6b0'];
  const c = colours[Math.floor(rnd() * colours.length)];
  const n = 3 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) {
    const fx = x + (rnd() - 0.5) * 7 * s;
    const fy = y + (rnd() - 0.5) * 5 * s;
    ctx.fillStyle = 'rgba(50,70,30,0.5)';
    ctx.fillRect(fx - 0.5 * s, fy, 1 * s, 1.6 * s);
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(fx, fy, 1.1 * s, 0, Math.PI * 2);
    ctx.fill();
  }
}

function pebbles(ctx, x, y, s, rnd, n) {
  for (let i = 0; i < n; i++) {
    const px = x + (rnd() - 0.5) * 6 * s;
    const py = y + (rnd() - 0.5) * 4 * s;
    const r = (0.9 + rnd() * 1.4) * s;
    const g = 120 + Math.floor(rnd() * 50);
    ctx.fillStyle = 'rgba(40,36,24,0.35)';
    ctx.beginPath();
    ctx.ellipse(px + 0.5 * s, py + 0.6 * s, r, r * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgb(${g + 20},${g + 12},${g - 6})`;
    ctx.beginPath();
    ctx.ellipse(px, py, r, r * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function leaves(ctx, x, y, s, rnd) {
  const colours = ['rgba(58,80,34,0.7)', 'rgba(110,96,44,0.6)', 'rgba(40,58,28,0.7)'];
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = colours[Math.floor(rnd() * colours.length)];
    ctx.beginPath();
    ctx.ellipse(x + (rnd() - 0.5) * 6 * s, y + (rnd() - 0.5) * 6 * s, 1.6 * s, 0.9 * s, rnd() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}
