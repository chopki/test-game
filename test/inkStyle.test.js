import { describe, expect, it } from 'vitest';
import { INK_STYLE, inkSprite } from '../src/render/inkStyle.js';

/** A w×h sprite: an opaque square of `rgb` in the middle, with flat normals and depth unless overridden. */
function sprite(w, h, { square = [4, 4, 12, 12], rgb = [200, 180, 150], normalAt, depthAt } = {}) {
  const color = new Uint8ClampedArray(w * h * 4);
  const normal = new Uint8ClampedArray(w * h * 4);
  const depth = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const [n0, n1, n2] = normalAt?.(x, y) ?? [0, 0, 1];
      normal.set([(n0 + 1) * 127.5, (n1 + 1) * 127.5, (n2 + 1) * 127.5, 255], o);
      const d = (depthAt?.(x, y) ?? 0.5) * 255;
      depth.set([Math.floor(d), (d % 1) * 255, 0, 255], o);
      const [x0, y0, x1, y1] = square;
      if (x >= x0 && x < x1 && y >= y0 && y < y1) color.set([...rgb, 255], o);
    }
  }
  return { color, normal, depth, w, h, depthRange: 2 };
}
const px = (s, x, y) => [...s.color.slice((y * s.w + x) * 4, (y * s.w + x) * 4 + 4)];

describe('ink style', () => {
  it('draws an opaque ink outline just outside the silhouette', () => {
    const s = sprite(16, 16);
    inkSprite(s);
    expect(px(s, 3, 8)).toEqual([...INK_STYLE.ink, 255]); // 1px outside the left edge
    expect(px(s, 0, 0)[3]).toBe(0); // far corner stays clear
  });

  it('inks creases where the surface turns, but not flat faces', () => {
    const s = sprite(16, 16, { normalAt: (x) => (x < 8 ? [0, 0, 1] : [1, 0, 0]) });
    const flat = px(sprite(16, 16), 5, 8);
    inkSprite(s);
    const crease = px(s, 7, 8);
    expect(crease[0]).toBeLessThan(flat[0] * 0.6); // darkened towards ink
    expect(px(s, 5, 8)[0]).toBeGreaterThan(crease[0] + 40);
  });

  it('inks steps in depth (one part in front of another)', () => {
    const s = sprite(16, 16, { depthAt: (x, y) => (y < 8 ? 0.2 : 0.6) });
    inkSprite(s);
    expect(px(s, 8, 7)[0]).toBeLessThan(120);
  });

  it('keeps colours in range and leaves the shape opaque', () => {
    const s = sprite(16, 16, { rgb: [250, 250, 250] });
    inkSprite(s);
    for (let i = 0; i < s.color.length; i++) expect(s.color[i]).toBeLessThanOrEqual(255);
    expect(px(s, 8, 8)[3]).toBe(255);
  });
});
