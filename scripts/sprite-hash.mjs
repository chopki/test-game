import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Files that decide how the baked sprites look. If any changes, the pre-baked atlas is stale.
export const SPRITE_SOURCES = [
  'src/render/models.js',
  'src/render/stageModels.js',
  'src/render/modelKit.js',
  'src/render/textures.js',
  'src/render/spriteCatalog.js',
  'src/render/spriteBaker.js',
  'src/render/iso.js',
  'src/render/inkStyle.js',
  'src/render/wallDecor.js',
  'src/render/animals.js',
];

const root = fileURLToPath(new URL('..', import.meta.url));

export function spriteSourceHash() {
  const hash = createHash('sha256');
  for (const file of SPRITE_SOURCES) hash.update(file).update(readFileSync(root + file, 'utf8').replace(/\r\n/g, '\n'));
  return hash.digest('hex').slice(0, 16);
}
