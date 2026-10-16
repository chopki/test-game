import { test } from '@playwright/test';
import { buildingAt, cameraTarget, countBuildings, expect, gold, openGame, tileToScreen, touchInput } from './helpers.js';

// Runs with the Pixel 7 profile (touch, portrait 412×915).

const pendingTile = (page) => page.evaluate(() => window.game.build.pending);

test('uses the lighter graphics profile and the HUD fits the screen', async ({ page }) => {
  const errors = await openGame(page);
  const r = await page.evaluate(() => ({
    pixelRatio: window.game.renderer.renderer.getPixelRatio(),
    overflowX: document.documentElement.scrollWidth > window.innerWidth,
    topbarBottom: document.querySelector('.topbar').getBoundingClientRect().bottom,
    buttons: [...document.querySelectorAll('.build-btn')].map((b) => b.getBoundingClientRect().toJSON()),
  }));
  expect(r.pixelRatio).toBe(1);
  expect(r.overflowX).toBe(false);
  expect(r.topbarBottom).toBeLessThan(915 * 0.3);
  const vp = page.viewportSize();
  for (const b of r.buttons) {
    expect(b.left).toBeGreaterThanOrEqual(0);
    expect(b.right).toBeLessThanOrEqual(vp.width);
    expect(b.bottom).toBeLessThanOrEqual(vp.height);
  }
  await expect(page.locator('.touch-only').first()).toBeAttached();
  expect(errors).toEqual([]);
});

test('dragging a tower moves it without moving the map, then ✓ builds it', async ({ page }) => {
  const errors = await openGame(page);
  const touch = await touchInput(page);
  await page.getByRole('button', { name: /Archer Tower/ }).tap();
  const target0 = await cameraTarget(page);

  await touch.drag(await tileToScreen(page, 14, 25), await tileToScreen(page, 15, 23));
  // Still dragging: the preview follows the finger, the map stays put, no ✓/✕ yet.
  expect(await pendingTile(page)).toEqual({ x: 15, z: 23 });
  expect(await cameraTarget(page)).toEqual(target0);
  await expect(page.locator('#confirm')).toBeHidden();
  expect(await countBuildings(page, 'archerTower')).toBe(0);

  await touch.end();
  await expect(page.locator('#confirm')).toBeVisible();
  await page.locator('#confirm-yes').tap();
  await expect.poll(() => buildingAt(page, 15, 23)).toBe('archerTower');
  expect(await gold(page)).toBe(225);
  await expect(page.locator('#confirm')).toBeHidden();
  expect(errors).toEqual([]);
});

test('a pending tower can be dragged again relative to the finger, and ✕ cancels it', async ({ page }) => {
  await openGame(page);
  const touch = await touchInput(page);
  await page.getByRole('button', { name: /Cannon Tower/ }).tap();
  await touch.tap(await tileToScreen(page, 14, 25));
  await expect(page.locator('#confirm')).toBeVisible();
  expect(await pendingTile(page)).toEqual({ x: 14, z: 25 });

  // Grab one tile away from it and drag two tiles east: it keeps its offset from the finger.
  await touch.drag(await tileToScreen(page, 15, 25), await tileToScreen(page, 17, 25));
  await touch.end();
  expect(await pendingTile(page)).toEqual({ x: 16, z: 25 });

  await page.locator('#confirm-no').tap();
  await expect(page.locator('#confirm')).toBeHidden();
  expect(await pendingTile(page)).toBe(null);
  expect(await countBuildings(page, 'cannonTower')).toBe(0);
  expect(await page.evaluate(() => window.game.build.mode)).toBe('cannonTower'); // still in build mode
});

test('✓ is disabled-looking on an invalid spot and explains why', async ({ page }) => {
  await openGame(page);
  const touch = await touchInput(page);
  await page.getByRole('button', { name: /Archer Tower/ }).tap();
  await touch.tap(await tileToScreen(page, 19, 19)); // on the Town Hall
  await expect(page.locator('#confirm-yes')).toHaveClass(/invalid/);
  await page.locator('#confirm-yes').tap();
  await expect(page.locator('#toasts')).toContainText('Space is occupied');
  expect(await countBuildings(page, 'archerTower')).toBe(0);
});

test('holding a tower at the screen edge scrolls the map', async ({ page }) => {
  await openGame(page);
  const touch = await touchInput(page);
  await page.getByRole('button', { name: /Archer Tower/ }).tap();
  const target0 = await cameraTarget(page);
  const top = await page.evaluate(() => document.querySelector('.topbar').getBoundingClientRect().bottom);
  const from = await tileToScreen(page, 19, 26);
  await touch.drag(from, { x: from.x, y: top + 8 }, 12);
  // Map scrolls north (target z decreases) while the finger is held there.
  await expect.poll(async () => (await cameraTarget(page))[2]).toBeLessThan(target0[2] - 2);
  await touch.end();
  const z = (await pendingTile(page)).z;
  expect(z).toBeLessThan(15); // the tower travelled with the scrolling map
});

test('dragging in wall mode paints walls directly', async ({ page }) => {
  await openGame(page);
  const touch = await touchInput(page);
  await page.getByRole('button', { name: /Castle Wall/ }).tap();
  await touch.drag(await tileToScreen(page, 14, 25), await tileToScreen(page, 24, 25), 15);
  await touch.end();
  expect(await countBuildings(page, 'wall')).toBe(11);
  await expect(page.locator('#confirm')).toBeHidden();
});

test('one finger pans the map when not building, and a tap selects', async ({ page }) => {
  await openGame(page);
  const touch = await touchInput(page);
  const target0 = await cameraTarget(page);
  const from = await tileToScreen(page, 19, 26);
  await touch.drag(from, { x: from.x, y: from.y + 150 });
  await touch.end();
  await expect.poll(async () => (await cameraTarget(page))[2]).not.toBe(target0[2]);
  expect(await page.evaluate(() => window.game.world.buildings.size)).toBe(1);

  await touch.tap(await tileToScreen(page, 19, 19));
  await expect(page.locator('#info')).toContainText('Town Hall');
});
