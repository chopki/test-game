import { bakeSprites, loadAtlas } from './spriteBaker.js';
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
      const atlas = await loadAtlas(SPRITE_SETS[set].dir);
      const missing = specs.filter((s) => !atlas.frame(s.key));
      if (missing.length === 0) return Object.assign(atlas, { set });
      console.warn(`Pre-baked sprites (${set}) are missing ${missing.length} frames (e.g. ${missing[0].key}); baking instead. Run npm run bake.`);
    } catch (err) {
      console.warn(`No pre-baked sprites (${set}); baking instead.`, err);
    }
  }
  return Object.assign(bakeSprites(specs, SPRITE_SETS.standard.options), { set: 'standard' });
}
