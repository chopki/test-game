import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { spriteSourceHash } from '../scripts/sprite-hash.mjs';

describe('pre-baked sprites', () => {
  it('are up to date with the models (run `npm run bake` after changing them)', () => {
    const file = new URL('../public/sprites/atlas.json', import.meta.url);
    expect(existsSync(file), 'public/sprites/atlas.json is missing: run npm run bake').toBe(true);
    const atlas = JSON.parse(readFileSync(file, 'utf8'));
    expect(atlas.sourceHash, 'sprites are stale: run npm run bake').toBe(spriteSourceHash());
  });
});
