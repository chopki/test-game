import { expect } from '@playwright/test';

/** A fixed map for tests that use terrain: it has woods, rock, a stream and fords. */
export const TERRAIN_SEED = 8;

/**
 * Open the game, wait until it's running, and pause the simulation so the wave timer
 * can't fire mid-test. Returns an array that collects page errors; tests assert it's empty.
 * `map: 'open'` (the default) starts without terrain so tests can build anywhere; `map: 'terrain'` loads the
 * generated map for TERRAIN_SEED, as players see it.
 */
export async function openGame(page, { paused = true, map = 'open' } = {}) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(map === 'open' ? `/?map=open&seed=${TERRAIN_SEED}` : `/?seed=${TERRAIN_SEED}`);
  await page.waitForFunction(() => window.game?.world && window.game.renderer.renderer.info.render.frame > 2);
  if (paused) await page.evaluate(() => window.game.togglePause());
  return errors;
}

/** Screen (CSS px) position of the centre of tile (x, z). */
export function tileToScreen(page, x, z) {
  return page.evaluate(([x, z]) => window.game.renderer.toScreen(x + 0.5, 0, z + 0.5), [x, z]);
}

/** The buildable-area tile of a terrain type ('water', 'rock', 'forest', 'ford') nearest the Town Hall. */
export const nearestTerrainTile = (page, name) =>
  page.evaluate((name) => {
    const g = window.game.world.grid;
    const want = ['open', 'water', 'ford', 'rock', 'forest'].indexOf(name);
    let best = null;
    for (let z = g.spawnMargin; z < g.height - g.spawnMargin; z++) {
      for (let x = g.spawnMargin; x < g.width - g.spawnMargin; x++) {
        if (g.terrainAt(x, z) !== want) continue;
        const d = Math.hypot(x - 19.5, z - 19.5);
        if (!best || d < best.d) best = { x, z, d };
      }
    }
    return best;
  }, name);

/**
 * Lowest canvas alpha over a grid of sample points, read straight after a render. Anything under 255 means
 * the page background shows through the game (blended decals must not write alpha).
 */
export const minCanvasAlpha = (page) =>
  page.evaluate(() => {
    const r = window.game.renderer;
    r.renderer.render(r.scene, r.camera);
    const gl = r.renderer.getContext();
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const px = new Uint8Array(4);
    let min = 255;
    for (let y = 0.05; y < 1; y += 0.05) {
      for (let x = 0.05; x < 1; x += 0.05) {
        gl.readPixels(Math.floor(x * w), Math.floor(y * h), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        min = Math.min(min, px[3]);
      }
    }
    return min;
  });

export const gold = (page) => page.evaluate(() => window.game.world.economy.gold);

export const buildingAt = (page, x, z) =>
  page.evaluate(([x, z]) => window.game.world.buildingAt(x, z)?.type ?? null, [x, z]);

export const countBuildings = (page, type) =>
  page.evaluate((type) => [...window.game.world.buildings.values()].filter((b) => b.type === type).length, type);

/** A button in one row of the settings menu, e.g. settingButton(page, 'Scenery', 'Off'). */
export const settingButton = (page, row, name) =>
  page.locator('#settings-body .setting', { has: page.locator('.setting-label', { hasText: row }) }).getByRole('button', { name, exact: true });

export const graphicsState = (page) =>
  page.evaluate(() => {
    const r = window.game.renderer;
    return {
      ...window.game.graphics,
      pixelRatio: r.renderer.getPixelRatio(),
      scenerySprites: r.scenerySpots.length,
      terrainSprites: r.terrainSpots.length,
      cloudShadows: r._clouds.visible,
      terrainPaintMs: r.terrainPaintMs,
    };
  });

export const cameraTarget = (page) => page.evaluate(() => window.game.renderer.controls.target.toArray());

/** Raw touch input via the Chrome DevTools protocol (Playwright has tap() but no touch drag). */
export async function touchInput(page) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  // Wait until the game has processed the finger lifting. Without this, a tap sent straight after
  // can arrive while the previous touch still counts as down, and the browser drops its click.
  const released = () => page.waitForFunction(() => window.game.build._touchIds.size === 0);
  return {
    start: (p) => send('touchStart', [{ x: p.x, y: p.y, id: 1 }]),
    move: (p) => send('touchMove', [{ x: p.x, y: p.y, id: 1 }]),
    async end() {
      await send('touchEnd', []);
      await released();
    },
    async drag(from, to, steps = 10) {
      await send('touchStart', [{ x: from.x, y: from.y, id: 1 }]);
      for (let i = 1; i <= steps; i++) {
        await send('touchMove', [{ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps, id: 1 }]);
      }
    },
    async tap(p) {
      await send('touchStart', [{ x: p.x, y: p.y, id: 1 }]);
      await send('touchEnd', []);
      await released();
    },
  };
}

export { expect };

/**
 * Build a sample base (walled ring, one of each tower, a few enemies outside) and save a screenshot as a test
 * attachment, for reviewing the art. Also checks the battlefield renders it without errors.
 */
export async function buildShowcase(page, testInfo, name) {
  await page.evaluate(() => {
    const w = window.game.world;
    w.economy.earn(100000);
    // Hall is 18–20; a wall ring from 14 to 24 with towers inside.
    for (let i = 14; i <= 24; i++) for (const [x, z] of [[i, 14], [i, 24], [14, i], [24, i]]) w.place('wall', x, z);
    w.place('archerTower', 15, 15);
    w.place('cannonTower', 22, 15);
    w.place('magicSpire', 15, 22);
    w.place('catapult', 22, 22);
    w.place('archerTower', 18, 16);
    // Towers built into the wall ring, west and south (they replace the wall tiles they cover).
    w.place('archerTower', 13, 16);
    w.place('cannonTower', 20, 23);
    // And one dropped on the south-west corner, snapped into it as the player would.
    const corner = w.anchorFor('archerTower', 14, 24);
    w.place('archerTower', corner.x, corner.z);
    w.phase = 'wave';
    ['grunt', 'runner', 'orc', 'brute'].forEach((type, i) => {
      for (let n = 0; n < 3; n++) {
        w._spawnEnemy({ type, side: 'north', hpMult: 1, elite: type === 'brute' && n === 0 });
        const e = w.enemies.at(-1);
        e.x = 15 + i * 2.4 + n * 0.7;
        e.z = 11.5 + n * 0.6;
        e.def = { ...e.def, speed: 0 };
      }
    });
  });
  await page.waitForTimeout(500);
  const shot = await page.screenshot({ path: testInfo.outputPath(`${name}.png`) });
  await testInfo.attach(name, { body: shot, contentType: 'image/png' });
}
