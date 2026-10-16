// Pre-bakes the battlefield sprite atlas into public/sprites/ so players' devices don't have to.
// Usage: npm run bake   (re-run whenever models.js, textures.js or the sprite catalogue change)
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { spriteSourceHash } from './sprite-hash.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = `${root}public/sprites/`;

const server = await createServer({ root, server: { port: 0 }, logLevel: 'warn' });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  const started = Date.now();
  // The bake runs while the page loads, so don't wait for 'load'.
  await page.goto(`${url}bake.html`, { waitUntil: 'commit' });
  await page.waitForFunction(() => window.__bake, null, { timeout: 600_000, polling: 1000 });
  const result = await page.evaluate(() => window.__bake);

  mkdirSync(outDir, { recursive: true });
  for (const f of readdirSync(outDir)) rmSync(outDir + f);
  const pages = result.pages.map((dataUrl, i) => {
    const file = `page-${i}.png`;
    writeFileSync(outDir + file, Buffer.from(dataUrl.split(',')[1], 'base64'));
    return file;
  });
  const sourceHash = spriteSourceHash();
  writeFileSync(`${outDir}atlas.json`, JSON.stringify({ sourceHash, pages, frames: result.frames }));
  console.log(`Baked ${Object.keys(result.frames).length} sprites onto ${pages.length} pages in ${((Date.now() - started) / 1000).toFixed(1)}s (source ${sourceHash}).`);
} finally {
  await browser.close();
  await server.close();
}
