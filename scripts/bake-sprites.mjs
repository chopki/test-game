// Pre-bakes the battlefield sprite atlases (each set in SPRITE_SETS: public/sprites/ and public/sprites-hd/) so
// players' devices don't have to. Usage: npm run bake   (re-run whenever the sprite sources change)
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { spriteSourceHash } from './sprite-hash.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
// Kept in step with SPRITE_SETS in src/render/spriteCatalog.js (which the bake page reads).
const SETS = { standard: 'sprites/', hd: 'sprites-hd/' };

const server = await createServer({ root, server: { port: 0 }, logLevel: 'warn' });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const [set, dir] of Object.entries(SETS)) {
    const outDir = `${root}public/${dir}`;
    const page = await browser.newPage();
    // Fail straight away on a page error, rather than waiting for a bake that will never finish.
    const failed = new Promise((_, reject) => page.on('pageerror', (e) => reject(new Error(`bake page error: ${e.message}`))));
    const started = Date.now();
    // The bake runs while the page loads, so don't wait for 'load'.
    await page.goto(`${url}bake.html?set=${set}`, { waitUntil: 'commit' });
    await Promise.race([page.waitForFunction(() => window.__bake, null, { timeout: 2_400_000, polling: 1000 }), failed]);
    const result = await page.evaluate(() => window.__bake);
    await page.close();

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
        `(${(bytes / 1e6).toFixed(1)} MB) in ${((Date.now() - started) / 1000).toFixed(1)}s (source ${sourceHash}).`,
    );
  }
} finally {
  await browser.close();
  await server.close();
}
