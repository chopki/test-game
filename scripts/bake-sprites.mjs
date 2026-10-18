// Pre-bakes the battlefield sprite atlases (each set in SPRITE_SETS: public/sprites/ and public/sprites-hd/) so
// players' devices don't have to. Usage: npm run bake   (re-run whenever the sprite sources change)
//
// Incremental: every sprite rendered is kept in a local cache (node_modules/.cache/sprite-bake/, by its
// fingerprint: see spriteFingerprint in src/render/spriteBaker.js), and the next bake renders only the sprites whose
// fingerprint has changed. Changing the baker itself (BAKER_SOURCES) changes every fingerprint. `npm run bake --
// --fresh` empties the cache first. Entries neither set used this time are deleted at the end.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { spriteSourceHash } from './sprite-hash.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
// Kept in step with SPRITE_SETS in src/render/spriteCatalog.js (which the bake page reads).
const SETS = { standard: 'sprites/', hd: 'sprites-hd/' };
// How a sprite is rendered, as opposed to what's in it (which its fingerprint reads off the model).
const BAKER_SOURCES = ['src/render/spriteBaker.js', 'src/render/inkStyle.js', 'src/render/iso.js', 'node_modules/three/package.json'];
const CACHE = `${root}node_modules/.cache/sprite-bake/`;

if (process.argv.includes('--fresh')) rmSync(CACHE, { recursive: true, force: true });
mkdirSync(CACHE, { recursive: true });
const used = new Set();
const bakerHash = createHash('sha256');
for (const file of BAKER_SOURCES) bakerHash.update(readFileSync(root + file));
const baker = bakerHash.digest('hex').slice(0, 16);

const server = await createServer({ root, server: { port: 0 }, logLevel: 'warn' });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const [set, dir] of Object.entries(SETS)) {
    const outDir = `${root}public/${dir}`;
    const page = await browser.newPage();
    // The cache, for the bake page: look up fingerprints (→ { meta, image, shadow } data URLs) and store new ones.
    await page.exposeFunction('bakeCacheGet', (prints) => {
      const found = {};
      for (const print of prints) {
        const file = `${CACHE}${print}.json`;
        if (!existsSync(file)) continue;
        try {
          found[print] = JSON.parse(readFileSync(file, 'utf8'));
        } catch {
          rmSync(file); // half-written (a bake cut off): render it again
        }
      }
      return found;
    });
    await page.exposeFunction('bakeCachePut', (print, meta, image, shadow) => {
      // Written whole or not at all, so a bake cut off part way leaves no broken entries.
      writeFileSync(`${CACHE}${print}.tmp`, JSON.stringify({ meta, image, shadow }));
      renameSync(`${CACHE}${print}.tmp`, `${CACHE}${print}.json`);
    });
    // Fail straight away on a page error, rather than waiting for a bake that will never finish.
    const failed = new Promise((_, reject) => page.on('pageerror', (e) => reject(new Error(`bake page error: ${e.message}`))));
    const started = Date.now();
    // The bake runs while the page loads, so don't wait for 'load'.
    await page.goto(`${url}bake.html?set=${set}&salt=${baker}:${set}`, { waitUntil: 'commit' });
    await Promise.race([page.waitForFunction(() => window.__bake, null, { timeout: 2_400_000, polling: 1000 }), failed]);
    const result = await page.evaluate(() => window.__bake);
    await page.close();
    for (const print of result.prints) used.add(print);

    mkdirSync(outDir, { recursive: true });
    for (const f of readdirSync(outDir)) rmSync(outDir + f);
    let bytes = 0;
    const pages = result.pages.map((dataUrl, i) => {
      const ext = dataUrl.slice(5, dataUrl.indexOf(';')).split('/')[1];
      const file = `page-${i}.${ext}`;
      const data = Buffer.from(dataUrl.split(',')[1], 'base64');
      bytes += data.length;
      writeFileSync(outDir + file, data);
      return file;
    });
    const sourceHash = spriteSourceHash();
    writeFileSync(`${outDir}atlas.json`, JSON.stringify({ sourceHash, pages, frames: result.frames }));
    console.log(
      `${set}: baked ${Object.keys(result.frames).length} sprites onto ${pages.length} pages ` +
        `(${(bytes / 1e6).toFixed(1)} MB) in ${((Date.now() - started) / 1000).toFixed(1)}s (source ${sourceHash}): ` +
        `${result.rendered} rendered, ${result.reused} from the cache` +
        (result.undecodable ? ` (${result.undecodable} cached sprites wouldn't load: ${result.firstError})` : '') + '.',
    );
    console.log(`  (${result.found} of ${result.prints.length} fingerprints were in the cache)`);
  }
  // Drop what neither set needed (old versions of sprites that have since changed).
  for (const f of readdirSync(CACHE)) if (!f.endsWith('.json') || !used.has(f.replace(/\.json$/, ''))) rmSync(CACHE + f);
} finally {
  await browser.close();
  await server.close();
}
