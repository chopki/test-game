/**
 * The hand-drawn look, applied to each sprite when it's baked (so it costs nothing in game). Works on raw RGBA
 * pixel arrays, with no three.js or DOM, so it's unit-tested (test/inkStyle.test.js).
 *
 * Inputs are three renders of the same sprite at bake resolution:
 *  - `color`:  the lit model (RGBA, straight alpha);
 *  - `normal`: view-space normals packed as RGB (0..255 → -1..1);
 *  - `depth`:  depth through the object, 0..1, packed as R = floor(d·255), G = fract(d·255)·255.
 *
 * It draws ink lines on the silhouette (outside it, so the sprite grows by `outline` pixels) and on inner
 * edges (creases where the surface turns, and steps where one part stands in front of another), flattens the
 * shading into soft bands, warms the shadows, and adds light diagonal hatching in the dark areas.
 */

export const INK_STYLE = {
  ink: [44, 30, 22], // warm dark brown, like the reference's line work
  outline: 3, // silhouette line width (bake pixels; bakes are supersampled, so this halves on screen)
  crease: 0.72, // normals closer than this (dot product) count as a crease
  creaseInk: 0.75, // opacity of inner lines
  depthStep: 0.06, // a depth jump of this many world units counts as an edge
  bands: 4, // light levels the shading is pulled towards
  bandStrength: 0.4, // 0 = smooth shading, 1 = hard bands
  warmShadows: 0.3,
  hatch: 0.12, // darkening of the hatching lines in the darkest areas
  hatchSpacing: 6, // pixels between hatching lines
};

/**
 * Stylise `color` in place. `w`, `h`: size in pixels. `depthRange`: world units covered by depth 0..1 (to turn
 * `depthStep` into the packed scale).
 */
export function inkSprite({ color, normal, depth, w, h, depthRange, style = INK_STYLE }) {
  const n = w * h;
  const solid = new Uint8Array(n);
  for (let i = 0; i < n; i++) solid[i] = color[i * 4 + 3] >= 128 ? 1 : 0;
  const depthAt = (i) => depth[i * 4] / 255 + depth[i * 4 + 1] / 65025;
  const step = style.depthStep / depthRange;
  const [ir, ig, ib] = style.ink;

  // 1. Inner edges, found on the clean render (before any shading changes).
  const inner = new Float32Array(n);
  const edgeBetween = (i, j) => {
    if (!solid[i] || !solid[j]) return false;
    const a = i * 4;
    const b = j * 4;
    const dot =
      ((normal[a] / 127.5 - 1) * (normal[b] / 127.5 - 1) +
        (normal[a + 1] / 127.5 - 1) * (normal[b + 1] / 127.5 - 1) +
        (normal[a + 2] / 127.5 - 1) * (normal[b + 2] / 127.5 - 1));
    return dot < style.crease || Math.abs(depthAt(i) - depthAt(j)) > step;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!solid[i]) continue;
      // Mark both pixels either side of an edge, so lines are 2 pixels wide (1 on screen).
      if (x + 1 < w && edgeBetween(i, i + 1)) inner[i] = inner[i + 1] = 1;
      if (y + 1 < h && edgeBetween(i, i + w)) inner[i] = inner[i + w] = 1;
    }
  }

  // 2. Shading: soft bands, warm shadows, hatching.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!solid[i]) continue;
      const o = i * 4;
      let r = color[o];
      let g = color[o + 1];
      let b = color[o + 2];
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      if (lum > 0.002) {
        const banded = Math.min(1, (Math.floor(lum * style.bands) + 0.5) / style.bands);
        const k = (lum + (banded - lum) * style.bandStrength) / lum;
        r *= k;
        g *= k;
        b *= k;
      }
      const dark = Math.max(0, Math.min(1, (0.5 - lum) / 0.35));
      const warm = dark * style.warmShadows;
      r += (r * 1.08 + 6 - r) * warm;
      g += (g * 0.96 - g) * warm;
      b += (b * 0.84 - b) * warm;
      if (dark > 0.25 && (x + y) % style.hatchSpacing === 0) {
        const f = 1 - style.hatch * dark;
        r *= f;
        g *= f;
        b *= f;
      }
      // Inner ink lines on top.
      const ink = inner[i] * style.creaseInk;
      color[o] = clamp(r + (ir - r) * ink);
      color[o + 1] = clamp(g + (ig - g) * ink);
      color[o + 2] = clamp(b + (ib - b) * ink);
    }
  }

  // 3. Silhouette outline: every see-through pixel within `outline` pixels of the sprite becomes ink.
  const R = style.outline;
  const out = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (solid[i]) continue;
      search: for (let dy = -R; dy <= R; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -R; dx <= R; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w || dx * dx + dy * dy > R * R + 1) continue;
          if (solid[yy * w + xx]) {
            out[i] = 1;
            break search;
          }
        }
      }
    }
  }
  for (let i = 0; i < n; i++) {
    if (!out[i]) continue;
    const o = i * 4;
    color[o] = ir;
    color[o + 1] = ig;
    color[o + 2] = ib;
    color[o + 3] = 255;
  }
  return color;
}

const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
