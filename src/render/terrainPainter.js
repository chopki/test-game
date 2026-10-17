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
export const OUTER_GROUND = '#aaa25a';
/** The open sea beyond the painted ground on a coast (the painted sea deepens into it). */
export const OCEAN = '#306c9c';

// Warm straw-olive grass like the reference, with ink for the edges between kinds of ground.
const C = {
  lush: [158, 154, 74],
  dry: [184, 172, 96],
  forestFloor: [118, 116, 54],
  earth: [190, 154, 100],
  gravel: [182, 170, 136],
  ink: [72, 64, 34],
  shore: [164, 140, 90],
  bankWall: [122, 88, 54],
  bankTop: [150, 112, 68],
  shallow: [120, 190, 206],
  deep: [74, 146, 186],
  ocean: hexRgb('#306c9c'), // the open sea, far from the shore (OCEAN)
  sand: [232, 208, 142],
  wetSand: [208, 180, 118],
  sandWall: [196, 164, 106],
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

/**
 * Whether sim position (x, z) outside the map is sea: everything beyond the coast edge, and off the map's other
 * edges wherever the edge tile it continues from is sea (so the coastline runs straight on out). Shared by the
 * painter and the renderer (no trees in the sea).
 */
export function isOffshore(grid, coast, x, z) {
  if (!coast) return false;
  const { width: W, height: H } = grid;
  if (coast === 'north' ? z < 0 : coast === 'south' ? z >= H : coast === 'west' ? x < 0 : x >= W) return true;
  const tx = Math.min(W - 1, Math.max(0, Math.floor(x)));
  const tz = Math.min(H - 1, Math.max(0, Math.floor(z)));
  return (tx !== Math.floor(x) || tz !== Math.floor(z)) && grid.terrain[tz * W + tx] === T.sea;
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
 * scales how many small details are stamped (0 = none). `coast`: the side the sea lies along (it carries on out
 * through the border, deepening into open ocean), or null. Returns { canvas, waterMask, hasWater, tiles, border,
 * noise, sea, seaDist } where `tiles` is the painted size in tiles (map + 2 × border), `waterMask` is a small
 * canvas (white where there's water) for the shimmer effect, and `sea` / `seaDist` give, per painted tile, whether
 * it's sea and how many tiles it is from land.
 */
export function paintTerrain(grid, { pxPerTile = 16, detail = 1, seed = 1, border = PAINT_BORDER, coast = null, tracks = [] } = {}) {
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
  const sea = field();
  const sand = field();
  const ramp = field();
  // Worn tracks (tiles { x, z }): the ways on from the footbridges.
  for (const { x, z } of tracks) ramp[(z + border) * TW + x + border] = 1;
  let hasWater = false;
  // Beyond the coast edge it's all sea.
  const offshore = (x, z) => isOffshore(grid, coast, x, z);
  for (let tz = 0; tz < TH; tz++) {
    for (let tx = 0; tx < TW; tx++) {
      const x = tx - border;
      const z = tz - border;
      const i = tz * TW + tx;
      if (offshore(x, z)) {
        sea[i] = water[i] = 1;
        hasWater = true;
        continue;
      }
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
      if (t === T.sea) sea[i] = water[i] = 1;
      if (t === T.sand) sand[i] = 1;
      if (t === T.cliff) rock[i] = 0.45; // a plateau's rim: patches of stony ground at the cliff top
      if (t === T.ramp) ramp[i] = 1;
      if (t === T.water || t === T.ford || t === T.sea) hasWater = true;
    }
  }
  // How far each sea tile is from land (tiles, 4-neighbour steps), for the deepening colour and the surf.
  const seaDist = field();
  {
    const queue = [];
    for (let i = 0; i < TW * TH; i++) {
      if (sea[i]) seaDist[i] = Infinity;
      else queue.push(i);
    }
    for (let k = 0; k < queue.length; k++) {
      const i = queue[k];
      const tx = i % TW;
      const tz = (i / TW) | 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = tx + dx;
        const nz = tz + dz;
        if (nx < 0 || nz < 0 || nx >= TW || nz >= TH) continue;
        const j = nz * TW + nx;
        if (seaDist[j] > seaDist[i] + 1) {
          seaDist[j] = seaDist[i] + 1;
          queue.push(j);
        }
      }
    }
    for (let i = 0; i < TW * TH; i++) if (!Number.isFinite(seaDist[i])) seaDist[i] = 30;
  }
  const deepSea = field();
  for (let i = 0; i < TW * TH; i++) deepSea[i] = sea[i] ? smooth(1, 8, seaDist[i]) : 0;
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
  // Per-pixel field values (after their wobble), kept to find the edges to ink afterwards.
  const fields = { forest: new Float32Array(bw * bh), rock: new Float32Array(bw * bh), earth: new Float32Array(bw * bh), shore: new Float32Array(bw * bh), sand: new Float32Array(bw * bh) };
  for (let py = 0; py < bh; py++) {
    const v = (py + 0.5) / BASE_PX;
    const z = v - border;
    for (let px = 0; px < bw; px++) {
      const u = (px + 0.5) / BASE_PX;
      const x = u - border;
      const o = (py * bw + px) * 4;

      // Grass: gently varying between lush and dry over large areas (the reference is nearly flat colour).
      const dryness = noise.fbm(x * 0.05, z * 0.05);
      col[0] = C.lush[0];
      col[1] = C.lush[1];
      col[2] = C.lush[2];
      mix(col, C.dry, smooth(0.3, 0.8, dryness) * 0.8);
      const wobble = noise.value(x * 0.85 + 11, z * 0.85 + 5) - 0.5;
      const fine = noise.value(x * 2.3, z * 2.3) - 0.5;

      // Bare earth patches here and there (worn ground, never in lines), with crisp edges.
      const earth = noise.fbm(x * 0.16 + 70, z * 0.16 + 20, 2) + wobble * 0.04;
      mix(col, C.earth, smooth(0.7, 0.73, earth) * 0.85);

      const f = sample(forest, u, v) + wobble * 0.35;
      mix(col, C.forestFloor, smooth(0.42, 0.5, f));

      const r = sample(rock, u, v) + wobble * 0.4;
      mix(col, C.gravel, smooth(0.4, 0.47, r) * 0.85);

      // Ramps up onto the hills, and the tracks on from the footbridges: worn earth.
      const rp = sample(ramp, u, v) + wobble * 0.3;
      mix(col, C.earth, smooth(0.45, 0.55, rp) * 0.9);

      // Beach: pale sand, damper where the sea reaches it.
      const sd = sample(sand, u, v) + wobble * 0.3;
      mix(col, C.sand, smooth(0.42, 0.5, sd));

      const w = sample(water, u, v) + wobble * 0.3;
      const seaHere = sample(sea, u, v) > 0.5;
      let m = 0;
      if (w > 0.4) {
        // Sandy shore, then the water, which sits below the grass: where the land is on the far side (away
        // from the camera), the earth bank's wall shows above the water line, as in the reference.
        const sandy = Math.min(1, sample(sand, u, v) * 2 + (seaHere ? 0.6 : 0));
        mix(col, sandy > 0.3 ? C.wetSand : C.shore, smooth(0.4, 0.47, w));
        if (w > 0.48) {
          const isFord = sample(ford, u, v) > 0.5;
          col[0] = C.shallow[0];
          col[1] = C.shallow[1];
          col[2] = C.shallow[2];
          if (isFord) mix(col, C.ford, 0.85);
          else mix(col, C.deep, smooth(0.62, 1.05, w + fine * 0.3));
          // The sea deepens away from the shore into open ocean.
          if (seaHere) mix(col, C.ocean, sample(deepSea, u, v) * (0.9 + fine * 0.2));
          const far = sample(water, u - BANK_DEPTH, v - BANK_DEPTH) + wobble * 0.3;
          if (far <= 0.48 && !isFord) {
            const depth = smooth(0.48, 0.3, far);
            col[0] = C.bankWall[0];
            col[1] = C.bankWall[1];
            col[2] = C.bankWall[2];
            mix(col, C.sandWall, sandy);
            mix(col, sandy > 0.3 ? C.sand : C.bankTop, 1 - depth);
          } else {
            m = isFord ? 0.55 : 1;
          }
        }
      }

      const pi = py * bw + px;
      fields.forest[pi] = f;
      fields.rock[pi] = r;
      fields.earth[pi] = earth;
      fields.shore[pi] = w;
      fields.sand[pi] = sd;

      // A touch of light and shade, then fade the border into the flat outer ground.
      const shade = 1 + fine * 0.04 + wobble * 0.03;
      const edge = Math.max(-x, -z, x - W, z - H);
      const fade = smooth(border - 5, border - 0.5, edge);
      col[0] *= shade;
      col[1] *= shade;
      col[2] *= shade;
      mix(col, offshore(Math.floor(x), Math.floor(z)) || seaHere ? C.ocean : C.outer, fade);

      img.data[o] = col[0];
      img.data[o + 1] = col[1];
      img.data[o + 2] = col[2];
      img.data[o + 3] = 255;
      mask.data[o] = mask.data[o + 1] = mask.data[o + 2] = 255;
      mask.data[o + 3] = m * 255;
    }
  }
  inkEdges(img.data, fields, bw, bh, border * BASE_PX, W * BASE_PX, H * BASE_PX);
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
  // Grain and the grid are drawn on the land only (the water is animated by the renderer).
  landOverlay(ctx, maskCanvas, (c) => grain(c, canvas.width, canvas.height));
  landOverlay(ctx, maskCanvas, (c) => tileGrid(c, { W, H, border, pxPerTile }));
  if (detail > 0) {
    const near = (u, v) => Math.max(sample(forest, u, v), sample(rock, u, v), sample(water, u, v));
    // No tufts or flowers on the beach either.
    stampDetails(ctx, { grid, noise, border, pxPerTile, detail, sample: (u, v) => Math.max(sample(water, u, v), sample(sand, u, v)), near });
  }

  return { canvas, waterMask: maskCanvas, hasWater, tiles: { width: TW, height: TH }, border, noise, sea, seaDist };
}

/**
 * Ink where one kind of ground meets another (forest floor, gravel, bare earth, the shore): a thin dark line on
 * the pixels where a field crosses its edge threshold, like the line work in the reference.
 */
function inkEdges(data, fields, bw, bh, b, mapW, mapH) {
  const lines = [
    [fields.forest, 0.46, 0.5],
    [fields.rock, 0.435, 0.45],
    [fields.earth, 0.715, 0.4],
    [fields.shore, 0.4, 0.55],
    [fields.sand, 0.46, 0.3],
  ];
  for (let y = 0; y < bh - 1; y++) {
    for (let x = 0; x < bw - 1; x++) {
      // No ink out in the faded border.
      const out = Math.max(b - x, b - y, x - (b + mapW), y - (b + mapH));
      if (out > b * 0.4) continue;
      const i = y * bw + x;
      let ink = 0;
      const wet = fields.shore[i] > 0.5; // under water only the shoreline itself is inked
      for (const [f, t, strength] of lines) {
        if (wet && f !== fields.shore) continue;
        const a = f[i] > t;
        if (a !== f[i + 1] > t || a !== f[i + bw] > t) ink = Math.max(ink, strength);
      }
      if (!ink) continue;
      const o = i * 4;
      data[o] += (C.ink[0] - data[o]) * ink;
      data[o + 1] += (C.ink[1] - data[o + 1]) * ink;
      data[o + 2] += (C.ink[2] - data[o + 2]) * ink;
    }
  }
}

/** Draw `paint` onto a layer, cut the water out of it (`waterMask`), and lay it over the ground. */
function landOverlay(ctx, waterMask, paint) {
  const layer = document.createElement('canvas');
  layer.width = ctx.canvas.width;
  layer.height = ctx.canvas.height;
  const lc = layer.getContext('2d');
  paint(lc);
  lc.globalCompositeOperation = 'destination-out';
  lc.drawImage(waterMask, 0, 0, layer.width, layer.height);
  ctx.drawImage(layer, 0, 0);
}

/** Fine painterly grain: a small tiled speckle pattern, very faint. */
function grain(ctx, w, h) {
  const size = 64;
  const tile = document.createElement('canvas');
  tile.width = tile.height = size;
  const t = tile.getContext('2d');
  const rnd = createRng(0x9a1).next;
  for (let i = 0; i < 700; i++) {
    t.fillStyle = rnd() < 0.5 ? 'rgba(60,54,20,0.5)' : 'rgba(255,250,200,0.45)';
    t.fillRect(Math.floor(rnd() * size), Math.floor(rnd() * size), 1, 1);
  }
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = ctx.createPattern(tile, 'repeat');
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** The faint tile grid over the map, as in the reference. */
function tileGrid(gc, { W, H, border, pxPerTile }) {
  gc.strokeStyle = 'rgba(80,72,30,0.16)';
  gc.lineWidth = Math.max(1, pxPerTile / 24);
  gc.beginPath();
  for (let i = 0; i <= W; i++) {
    const x = (border + i) * pxPerTile;
    gc.moveTo(x, border * pxPerTile);
    gc.lineTo(x, (border + H) * pxPerTile);
  }
  for (let i = 0; i <= H; i++) {
    const y = (border + i) * pxPerTile;
    gc.moveTo(border * pxPerTile, y);
    gc.lineTo((border + W) * pxPerTile, y);
  }
  gc.stroke();
}

/**
 * Grass clumps, pebbles, leaves and the odd flower, stamped into the ground (they cost nothing to draw later).
 * Like the reference, detail is sparse and gathers by woods, rocks and water (`near`) rather than spreading evenly.
 */
function stampDetails(ctx, { grid, noise, border, pxPerTile, detail, sample, near }) {
  const rnd = createRng(0x7e57).next;
  const { width: W, height: H } = grid;
  const s = pxPerTile / 16; // stamp scale
  const terrainAt = (x, z) => (grid.inBounds(Math.floor(x), Math.floor(z)) ? grid.terrain[Math.floor(z) * W + Math.floor(x)] : -1);
  const count = Math.round((W + border) * (H + border) * 1.2 * detail);
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
    // Open grass: mostly bare; clumps gather near features.
    const by = smooth(0.15, 0.45, near(x + border, z + border));
    if (kind < 0.04 + 0.5 * by) clump(ctx, px, py, s, rnd);
    else if (kind < 0.6 && kind > 0.585) flowers(ctx, px, py, s, rnd);
    else if (kind > 0.95) pebbles(ctx, px, py, s, rnd, 1 + Math.floor(rnd() * 2));
  }
}

/** A spiky clump of dark grass with a thin ink outline (2–3 tufts together). */
function clump(ctx, x, y, s, rnd) {
  const tufts = 2 + Math.floor(rnd() * 2);
  for (let t = 0; t < tufts; t++) {
    const cx = x + (rnd() - 0.5) * 7 * s;
    const cy = y + (rnd() - 0.5) * 4 * s;
    const blades = 4 + Math.floor(rnd() * 3);
    const h = (4 + rnd() * 3) * s;
    ctx.beginPath();
    ctx.moveTo(cx - 2.6 * s, cy);
    for (let b = 0; b < blades; b++) {
      const bx = cx - 2.6 * s + ((b + 0.5) / blades) * 5.2 * s;
      ctx.lineTo(bx + (rnd() - 0.5) * 1.6 * s, cy - h * (0.6 + rnd() * 0.4));
      ctx.lineTo(bx + 0.5 * s, cy - h * 0.2);
    }
    ctx.lineTo(cx + 2.6 * s, cy);
    ctx.closePath();
    ctx.fillStyle = rnd() < 0.5 ? '#5e6a24' : '#6c7a2a';
    ctx.fill();
    ctx.strokeStyle = 'rgba(48,42,20,0.8)';
    ctx.lineWidth = Math.max(0.8, 0.7 * s);
    ctx.stroke();
  }
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
