import * as THREE from 'three';
import { bakeSprites, SpriteAtlas } from './spriteBaker.js';
import { SPRITE_SETS, spriteSpecs } from './spriteCatalog.js';

/**
 * Which sprite set suits this device: 'hd' on desktops (zooming in would stretch the standard sprites), 'standard'
 * on touch screens (they can't show more detail than it has). `?sprites=standard|hd` in the URL overrides it.
 */
export function pickSpriteSet() {
  const asked = new URLSearchParams(location.search).get('sprites');
  if (asked in SPRITE_SETS) return asked;
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  return touch ? 'standard' : 'hd';
}

/**
 * The battlefield sprite atlas. Production builds load the set pre-baked by `npm run bake` (instant, and no GPU
 * work on the player's device); the dev server bakes the standard set live so model edits show up immediately.
 * If the pre-baked set is missing or doesn't have every sprite the catalogue expects, it falls back to baking.
 */
export async function loadSprites({ set = pickSpriteSet(), preferBaked = !import.meta.env?.DEV } = {}) {
  const specs = spriteSpecs();
  if (preferBaked) {
    try {
      const atlas = await loadPrebaked(SPRITE_SETS[set].dir);
      const missing = specs.filter((s) => !atlas.frame(s.key));
      if (missing.length === 0) return Object.assign(atlas, { set });
      console.warn(`Pre-baked sprites (${set}) are missing ${missing.length} frames (e.g. ${missing[0].key}); baking instead. Run npm run bake.`);
    } catch (err) {
      console.warn(`No pre-baked sprites (${set}); baking instead.`, err);
    }
  }
  return Object.assign(bakeSprites(specs, SPRITE_SETS.standard.options), { set: 'standard' });
}

/**
 * Load an atlas saved by scripts/bake-sprites.mjs from `baseUrl` (atlas.json + page images), a page at a time: the
 * HD set has a couple of dozen 2048² pages, and decoding them all at once can fail for lack of memory. If a page's
 * decode() is refused anyway, it waits for the image to load the ordinary way instead.
 */
async function loadPrebaked(baseUrl) {
  const res = await fetch(`${baseUrl}atlas.json`);
  if (!res.ok) throw new Error(`atlas.json: HTTP ${res.status}`);
  const data = await res.json();
  const atlas = new SpriteAtlas();
  atlas.frames = new Map(Object.entries(data.frames));
  for (const file of data.pages) {
    const img = new Image();
    const loaded = new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error(`${file}: could not load`));
    });
    img.src = `${baseUrl}${file}`;
    await img.decode().catch(() => loaded);
    const texture = new THREE.Texture(img);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    atlas.pages.push({ source: img, texture });
  }
  atlas.sourceHash = data.sourceHash;
  return atlas;
}
