import { test } from '@playwright/test';
import { buildingAt, countBuildings, expect, gold, graphicsState, openGame, settingButton, tileToScreen } from './helpers.js';

// The Town Hall covers tiles 18–20 on both axes; tiles inside 2..37 are buildable.

test('loads with the HUD and no errors', async ({ page }) => {
  const errors = await openGame(page);
  await expect(page.locator('#gold')).toHaveText('300');
  await expect(page.locator('#wave')).toHaveText('0');
  await expect(page.locator('#buildbar .build-btn')).toHaveCount(4);
  await expect(page.locator('#next-wave')).toContainText('Wave 1');
  expect(errors).toEqual([]);
});

test('hotkey + click places an archer tower and spends gold', async ({ page }) => {
  const errors = await openGame(page);
  await page.keyboard.press('2');
  await expect(page.getByRole('button', { name: /Archer Tower/ })).toHaveClass(/active/);
  const p = await tileToScreen(page, 12, 12);
  await page.mouse.click(p.x, p.y);
  await expect.poll(() => buildingAt(page, 12, 12)).toBe('archerTower');
  expect(await gold(page)).toBe(225);
  expect(errors).toEqual([]);
});

test('dragging in wall mode paints a line of walls', async ({ page }) => {
  await openGame(page);
  await page.keyboard.press('1');
  const a = await tileToScreen(page, 10, 8);
  const b = await tileToScreen(page, 20, 8);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 15 });
  await page.mouse.up();
  expect(await countBuildings(page, 'wall')).toBe(11);
  expect(await gold(page)).toBe(300 - 11 * 10);
});

test('invalid placement explains why', async ({ page }) => {
  await openGame(page);
  await page.keyboard.press('2');
  const p = await tileToScreen(page, 19, 19);
  await page.mouse.click(p.x, p.y);
  await expect(page.locator('#toasts')).toContainText('Space is occupied');
  expect(await countBuildings(page, 'archerTower')).toBe(0);
});

test('a building can be selected and sold', async ({ page }) => {
  await openGame(page);
  await page.keyboard.press('2');
  const p = await tileToScreen(page, 12, 12);
  await page.mouse.click(p.x, p.y);
  await page.keyboard.press('Escape');
  await page.mouse.click(p.x, p.y);
  await expect(page.locator('#info')).toBeVisible();
  await expect(page.locator('#info')).toContainText('Archer Tower');
  await page.locator('#sell-selected').click();
  await expect.poll(() => buildingAt(page, 12, 12)).toBe(null);
  expect(await gold(page)).toBe(225 + 37);
});

test('right-click cancels build mode', async ({ page }) => {
  await openGame(page);
  await page.keyboard.press('3');
  const p = await tileToScreen(page, 12, 12);
  await page.mouse.click(p.x, p.y, { button: 'right' });
  expect(await page.evaluate(() => window.game.build.mode)).toBe(null);
});

test('starting a wave spawns enemies', async ({ page }) => {
  await openGame(page, { paused: false });
  await page.getByRole('button', { name: /Start wave/ }).click();
  await expect(page.locator('#wave')).toHaveText('1');
  await expect.poll(() => page.evaluate(() => window.game.world.enemies.length)).toBeGreaterThan(0);
  await expect(page.locator('#phase')).toContainText('Enemies remaining');
});

test('a GPU context loss pauses the game and it recovers', async ({ page }) => {
  await openGame(page, { paused: false });
  await page.evaluate(() => {
    window.__lose = window.game.renderer.renderer.getContext().getExtension('WEBGL_lose_context');
    window.__lose.loseContext();
  });
  await expect(page.locator('#error')).toBeVisible();
  await expect(page.locator('#error-title')).toHaveText('Graphics were reset by your browser');
  // Desktop starts on High; the crash drops it one step to Medium.
  await expect(page.locator('#error-message')).toContainText('lowered to Medium');
  expect((await graphicsState(page)).preset).toBe('medium');
  const timer = await page.evaluate(() => window.game.world.phaseTimer);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.game.world.phaseTimer)).toBe(timer); // paused while lost
  await page.evaluate(() => window.__lose.restoreContext());
  await expect(page.locator('#error')).toBeHidden();
});

test('runtime errors are shown on screen instead of a blank page', async ({ page }) => {
  await openGame(page);
  await page.evaluate(() => {
    window.game.world.update = () => {
      throw new Error('simulated failure');
    };
    window.game.togglePause();
  });
  await expect(page.locator('#error')).toBeVisible();
  await expect(page.locator('#error-message')).toHaveText('simulated failure');
});

test('graphics presets apply live, persist across reloads, and pause the game while open', async ({ page }) => {
  await openGame(page, { paused: false });
  expect(await graphicsState(page)).toMatchObject({ preset: 'high', shadowsOn: true, shadowSize: 2048 });

  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.locator('#settings')).toBeVisible();
  expect(await page.evaluate(() => window.game.paused)).toBe(true);

  await settingButton(page, 'Preset', 'Low').click();
  expect(await graphicsState(page)).toMatchObject({ preset: 'low', fpsCap: 30, shadowsOn: false, pixelRatio: 0.75 });
  await expect(settingButton(page, 'Preset', 'Low')).toHaveClass(/active/);
  await expect(settingButton(page, 'Shadows', 'Off')).toHaveClass(/active/);

  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('#settings')).toBeHidden();
  expect(await page.evaluate(() => window.game.paused)).toBe(false);

  await page.reload();
  await page.waitForFunction(() => window.game?.world);
  expect(await graphicsState(page)).toMatchObject({ preset: 'low', shadowsOn: false });
});

test('overriding one setting marks the preset Custom; FPS counter and frame cap work', async ({ page }) => {
  await openGame(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await settingButton(page, 'Shadows', 'Low').click();
  await expect(page.locator('.custom-tag')).toBeVisible();
  expect(await graphicsState(page)).toMatchObject({ preset: 'custom', shadowsOn: true, shadowSize: 1024 });

  await settingButton(page, 'Scenery', 'Off').click();
  expect((await graphicsState(page)).sceneryParts).toBe(0);
  await settingButton(page, 'Scenery', 'High').click();
  expect((await graphicsState(page)).sceneryParts).toBeGreaterThan(0);

  await settingButton(page, 'Show FPS', 'On').click();
  await settingButton(page, 'Frame rate cap', '30').click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('#fps')).toBeVisible();
  await expect(page.locator('#fps')).toHaveText(/^\d+ FPS$/);
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.game.fps)).toBeLessThanOrEqual(32);
});

test('changing anti-aliasing offers a reload', async ({ page }) => {
  await openGame(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.locator('#settings-reload-note')).toBeHidden();
  await settingButton(page, 'Anti-aliasing', 'Off').click();
  await expect(page.locator('#settings-reload-note')).toBeVisible();
  await settingButton(page, 'Anti-aliasing', 'On').click();
  await expect(page.locator('#settings-reload-note')).toBeHidden();
});
