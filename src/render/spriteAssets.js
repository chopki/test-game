import { bakeSprites, loadAtlas } from './spriteBaker.js';
import { BAKE_OPTIONS, spriteSpecs } from './spriteCatalog.js';

/** Where `npm run bake` writes the pre-baked atlas (served from public/). */
export const SPRITE_DIR = 'sprites/';

/**
 * The battlefield sprite atlas. Production builds load the atlas pre-baked by `npm run bake` (instant, and no
 * GPU work on the player's device); the dev server bakes live so model edits show up immediately. If the
 * pre-baked atlas is missing or doesn't have every sprite the catalogue expects, it falls back to baking.
 */
export async function loadSprites({ preferBaked = !import.meta.env?.DEV } = {}) {
  const specs = spriteSpecs();
  if (preferBaked) {
    try {
      const atlas = await loadAtlas(SPRITE_DIR);
      const missing = specs.filter((s) => !atlas.frame(s.key));
      if (missing.length === 0) return atlas;
      console.warn(`Pre-baked sprites are missing ${missing.length} frames (e.g. ${missing[0].key}); baking instead. Run npm run bake.`);
    } catch (err) {
      console.warn('No pre-baked sprites; baking instead.', err);
    }
  }
  return bakeSprites(specs, BAKE_OPTIONS);
}
