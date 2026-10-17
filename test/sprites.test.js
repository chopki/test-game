import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { spriteSourceHash } from '../scripts/sprite-hash.mjs';
import { TERRAIN } from '../src/sim/config.js';

describe('pre-baked sprites', () => {
  for (const dir of ['sprites', 'sprites-hd']) {
    it(`public/${dir} is up to date with the models (run \`npm run bake\` after changing them)`, () => {
      const file = new URL(`../public/${dir}/atlas.json`, import.meta.url);
      expect(existsSync(file), `public/${dir}/atlas.json is missing: run npm run bake`).toBe(true);
      const atlas = JSON.parse(readFileSync(file, 'utf8'));
      expect(atlas.sourceHash, 'sprites are stale: run npm run bake').toBe(spriteSourceHash());
      for (const page of atlas.pages) expect(existsSync(new URL(`../public/${dir}/${page}`, import.meta.url)), page).toBe(true);
    });
  }

  it('the baked cliff faces are a hill level high (change CLIFF_HEIGHT in models.js with it, then bake)', () => {
    const models = readFileSync(new URL('../src/render/models.js', import.meta.url), 'utf8');
    expect(Number(models.match(/export const CLIFF_HEIGHT = ([\d.]+);/)[1])).toBe(TERRAIN.hills.levelHeight);
  });
});
