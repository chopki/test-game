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

export const cameraTarget = (page) => page.evaluate(() => window.game.renderer.controls.target.toArray());

/** Raw touch input via the Chrome DevTools protocol (Playwright has tap() but no touch drag). */
export async function touchInput(page) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  return {
    start: (p) => send('touchStart', [{ x: p.x, y: p.y, id: 1 }]),
    move: (p) => send('touchMove', [{ x: p.x, y: p.y, id: 1 }]),
    end: () => send('touchEnd', []),
    async drag(from, to, steps = 10) {
      await send('touchStart', [{ x: from.x, y: from.y, id: 1 }]);
      for (let i = 1; i <= steps; i++) {
        await send('touchMove', [{ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps, id: 1 }]);
      }
    },
    async tap(p) {
      await send('touchStart', [{ x: p.x, y: p.y, id: 1 }]);
      await send('touchEnd', []);
    },
  };
}

export { expect };
