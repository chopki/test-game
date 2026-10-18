import * as THREE from 'three';

/**
 * Packing baked sprites onto atlas pages. Each atlas page the battlefield shows costs a draw call (or two, with the
 * shadows), so sprites seen together go together: the scenery, the fortifications, the buildings, the soldiers,
 * and last the UI portraits, which the battlefield never shows. Kept apart from the rendering in spriteBaker.js
 * so changing the packing doesn't change any sprite's fingerprint (the bake's cache).
 */

/** Kinds of sprite, by key prefix, in packing order. */
const GROUPS = [
  ['s', 'cliff', 'bridge', 'a'],
  ['wall', 'join', 'arm', 'decor'],
  ['b', 'bw', 't', 'crystal', 'flag'],
  ['e'],
  ['e:red'], // the player's troops (red), after the enemy army, as there are fewer of them about
  ['icon'],
];
const GROUP_OF = new Map(GROUPS.flatMap((prefixes, i) => prefixes.map((p) => [p, i])));
const groupOf = (key) => GROUP_OF.get(key.startsWith('e:red:') ? 'e:red' : key.split(':')[0]) ?? GROUPS.length;

const PAGE_SIZE = 2048;
const PADDING = 3;

class Page {
  constructor() {
    this.x = PADDING;
    this.y = PADDING;
    this.rowHeight = 0;
  }

  /** Shelf packing: returns { x, y } or null if it doesn't fit on this page. */
  place(w, h) {
    if (this.x + w + PADDING > PAGE_SIZE) {
      this.x = PADDING;
      this.y += this.rowHeight + PADDING;
      this.rowHeight = 0;
    }
    if (this.y + h + PADDING > PAGE_SIZE || w + 2 * PADDING > PAGE_SIZE) return null;
    const spot = { x: this.x, y: this.y };
    this.x += w + PADDING;
    this.rowHeight = Math.max(this.rowHeight, h);
    return spot;
  }

  get usedHeight() {
    return this.y + this.rowHeight + PADDING;
  }
}

function canvasOf(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/**
 * Pack rendered sprites (and their shadows) onto `atlas`'s pages: by kind (GROUPS), and within each kind tallest
 * first (shelf packing wastes little that way); the last page is trimmed to what it uses.
 */
export function packAtlas(atlas, rendered) {
  const rects = [];
  for (const item of rendered) {
    rects.push({ item, image: item.image, shadow: false });
    if (item.shadowImage) rects.push({ item, image: item.shadowImage, shadow: true });
  }
  rects.sort((a, b) => groupOf(a.item.key) - groupOf(b.item.key) || b.image.height - a.image.height || b.image.width - a.image.width);
  const pages = [new Page()];
  for (const r of rects) {
    r.spot = pages.at(-1).place(r.image.width, r.image.height);
    if (!r.spot) {
      pages.push(new Page());
      r.spot = pages.at(-1).place(r.image.width, r.image.height);
    }
    r.page = pages.length - 1;
  }
  const canvases = pages.map((p, i) => canvasOf(PAGE_SIZE, i === pages.length - 1 ? Math.ceil(p.usedHeight / 4) * 4 : PAGE_SIZE));
  for (const r of rects) {
    const c = canvases[r.page];
    c.getContext('2d').drawImage(r.image, r.spot.x, r.spot.y);
    const { item } = r;
    const frame = frameFor(r.page, r.spot, r.image.width, r.image.height, item.w, item.h, item.anchorX, item.anchorY, c.width, c.height);
    // An object and its shadow are packed separately, in either order; link them up whichever comes second.
    if (r.shadow) {
      item.shadowFrame = frame;
      const objectFrame = atlas.frames.get(item.key);
      if (objectFrame) objectFrame.shadow = frame;
    } else {
      if (item.shadowFrame) frame.shadow = item.shadowFrame;
      atlas.frames.set(item.key, frame);
    }
  }
  atlas.pages = canvases.map((c) => ({ source: c, texture: pageTexture(new THREE.CanvasTexture(c)) }));
}

export function pageTexture(texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function frameFor(pageIndex, spot, outW, outH, w, h, anchorX, anchorY, pageW = PAGE_SIZE, pageH = PAGE_SIZE) {
  return {
    page: pageIndex,
    // UV rectangle (v measured from the bottom, as WebGL textures are flipped).
    u0: spot.x / pageW,
    v0: 1 - (spot.y + outH) / pageH,
    u1: (spot.x + outW) / pageW,
    v1: 1 - spot.y / pageH,
    pixels: { x: spot.x, y: spot.y, w: outW, h: outH },
    w,
    h,
    anchorX,
    anchorY,
  };
}

