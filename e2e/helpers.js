import { expect } from '@playwright/test';

/**
 * Open the game, wait until it's running, and pause the simulation so the wave timer
 * can't fire mid-test. Returns an array that collects page errors; tests assert it's empty.
 */
export async function openGame(page, { paused = true } = {}) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await page.waitForFunction(() => window.game?.world && window.game.renderer.renderer.info.render.frame > 2);
  if (paused) await page.evaluate(() => window.game.togglePause());
  return errors;
}

/** Screen (CSS px) position of the centre of tile (x, z). */
export function tileToScreen(page, x, z) {
  return page.evaluate(([x, z]) => window.game.renderer.toScreen(x + 0.5, 0, z + 0.5), [x, z]);
}

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
