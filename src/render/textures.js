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

/**
 * Painted rough stonework for smooth walls (after the uploaded tower model): uneven courses of rounded blocks in
 * the `colors`, each with a lit top-left bevel and a shaded bottom-right edge, dark mortar between, speckles and
 * the odd crack. One tile is one unit; it repeats both ways.
 */
export function roughStoneTexture(colors, mortar = '#4a3a2c') {
  return make(`roughStone:${colors.join(',')}`, 256, (ctx, S, rnd) => {
    ctx.fillStyle = mortar;
    ctx.fillRect(0, 0, S, S);
    // Course heights that sum to the tile, so it repeats.
    const rows = [];
    let total = 0;
    while (total < S - 30) {
      const h = 30 + rnd() * 18;
      rows.push(h);
      total += h;
    }
    let y = 0;
    for (const rh0 of rows) {
      const rh = (rh0 * S) / total;
      let x = -rnd() * 40;
      while (x < S) {
        const w = 34 + rnd() * 46;
        const col = colors[Math.floor(rnd() * colors.length)];
        const m = 2.5;
        const crack = rnd() < 0.3;
        const crackX = rnd();
        const draw = (ox) => {
          const bx = x + ox + m;
          const by = y + m;
          const bw = w - 2 * m;
          const bh = rh - 2 * m;
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.roundRect(bx, by, bw, bh, 5);
          ctx.fill();
          ctx.fillStyle = shade(col, 0.06); // lit bevel
          ctx.fillRect(bx + 3, by + 1.5, bw - 6, 3);
          ctx.fillRect(bx + 1.5, by + 3, 3, bh - 6);
          ctx.fillStyle = shade(col, -0.1); // shaded edge
          ctx.fillRect(bx + 3, by + bh - 4, bw - 5, 3);
          ctx.fillRect(bx + bw - 4, by + 3, 3, bh - 5);
          ctx.fillStyle = shade(col, -0.05);
          for (let i = 0; i < 10; i++) ctx.fillRect(bx + 4 + rnd() * (bw - 10), by + 5 + rnd() * (bh - 10), 2, 2);
          if (crack) {
            ctx.strokeStyle = shade(col, -0.2);
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            let cx = bx + crackX * bw;
            let cy = by + 2;
            ctx.moveTo(cx, cy);
            for (let i = 0; i < 3; i++) ctx.lineTo((cx += (rnd() - 0.5) * 12), (cy += bh / 3));
            ctx.stroke();
          }
        };
        draw(0);
        if (x + w > S) draw(-S); // wrap round
        x += w;
      }
      y += rh;
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

/** Fine speckled stone for individual blocks (the mortar is real geometry between blocks). */
export function speckleTexture(base = '#c9a679', amount = 0.1) {
  return make(`speckle:${base}:${amount}`, 64, (ctx, s, rnd) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = shade(base, (rnd() - 0.5) * amount * 2);
      const r = 0.6 + rnd() * 1.8;
      ctx.fillRect(rnd() * s, rnd() * s, r, r);
    }
    // A couple of soft chips and stains.
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = `rgba(60,40,20,${0.05 + rnd() * 0.06})`;
      ctx.beginPath();
      ctx.arc(rnd() * s, rnd() * s, 3 + rnd() * 6, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** Lime plaster with faint trowel marks. */
export function plasterTexture(base = '#ecdfc2') {
  return make(`plaster:${base}`, 64, (ctx, s, rnd) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = shade(base, (rnd() - 0.5) * 0.06);
      ctx.fillRect(rnd() * s, rnd() * s, 6 + rnd() * 12, 2 + rnd() * 3);
    }
  });
}

/**
 * Tileable cloud mask for the drifting cloud shadows: soft overlapping blobs in clumps (white = cloud), drawn
 * with wrap-around so the texture repeats seamlessly. Linear (not sRGB): it's data, not a colour.
 */
export function cloudTexture() {
  if (cache.has('clouds')) return cache.get('clouds');
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  const rnd = seeded(hash('clouds'));
  for (let c = 0; c < 7; c++) {
    const cx = rnd() * size;
    const cy = rnd() * size;
    const puffs = 6 + Math.floor(rnd() * 6);
    for (let i = 0; i < puffs; i++) {
      const x = cx + (rnd() - 0.5) * 70;
      const y = cy + (rnd() - 0.5) * 40;
      const r = 14 + rnd() * 26;
      for (const ox of [-size, 0, size]) {
        for (const oy of [-size, 0, size]) {
          const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
          g.addColorStop(0, 'rgba(255,255,255,0.55)');
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g;
          ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
        }
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  cache.set('clouds', tex);
  return tex;
}
