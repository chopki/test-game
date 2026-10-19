import { test } from '@playwright/test';
import { expect, gold, openGame, tileToScreen } from './helpers.js';

// Realm mode (?mode=realm): heroes hired at guilds, bounty flags, the fog. Full suite only. On the open test map the
// Town Hall covers tiles 18–20; only the land within about 10 tiles of it has been seen at the start.

const openRealm = (page, opts = {}) => openGame(page, { ...opts, query: ['mode=realm', opts.query].filter(Boolean).join('&') });

test('the main menu starts a Realm, with its briefing, the guilds in the wheel and the minimap', async ({ page }) => {
  const errors = await openGame(page, { paused: false, query: 'menu=1' });
  await page.locator('#menu-realm').click();
  await expect.poll(() => page.evaluate(() => window.game.world.mode)).toBe('realm');
  await expect(page.locator('#intro-title')).toHaveText(/Realm/);
  await page.locator('#intro-start').click();
  for (const name of [/Warriors' Hall/, /Rangers' Lodge/, /Rogues' Den/, /Smithy/, /Bounty/]) await expect(page.getByRole('button', { name })).toBeVisible();
  await expect(page.getByRole('button', { name: /Flag Fort/ })).toBeHidden();
  await expect(page.locator('#minimap')).toBeVisible();
  await expect(page.locator('#phase')).toContainText('night falls in');
  expect(errors).toEqual([]);
});

test('a guild is built, a hero hired from its card, and the hero has a card of their own', async ({ page }) => {
  const errors = await openRealm(page);
  const start = await gold(page);
  await page.keyboard.press('7');
  const p = await tileToScreen(page, 13, 14);
  await page.mouse.click(p.x, p.y);
  await expect.poll(() => page.evaluate(() => window.game.world.buildingAt(13, 14)?.type)).toBe('warriorsHall');
  // Building in the fog is refused.
  await page.keyboard.press('8');
  const far = await tileToScreen(page, 4, 4);
  await page.mouse.click(far.x, far.y);
  await expect(page.locator('#toasts')).toContainText('Unexplored');
  await page.keyboard.press('Escape');

  await page.mouse.click(p.x, p.y);
  const hire = page.getByRole('button', { name: /Hire a Man-at-arms/ });
  await expect(hire).toBeVisible();
  await hire.click();
  await expect(page.locator('#info')).toContainText('Men-at-arms: 1/4');
  expect(await gold(page)).toBe(start - 80 - 45);

  // Let them step out, then pick them.
  await page.evaluate(() => window.game.togglePause());
  await page.waitForTimeout(500);
  await page.evaluate(() => window.game.togglePause());
  const hero = await page.evaluate(() => {
    const h = window.game.world.realm.heroes[0];
    return { name: h.name, at: window.game.renderer.toScreen(h.x, 0, h.z) };
  });
  await page.mouse.click(hero.at.x, hero.at.y);
  await expect(page.locator('#info h3')).toHaveText(hero.name);
  await expect(page.locator('#info')).toContainText('Level 1 Man-at-arms');
  expect(errors).toEqual([]);
});

test('an explore bounty is placed with B and topped up from its card', async ({ page }) => {
  const errors = await openRealm(page);
  const start = await gold(page);
  await page.keyboard.press('b');
  await expect(page.getByRole('button', { name: /Bounty/ })).toHaveClass(/active/);
  const p = await tileToScreen(page, 6, 19);
  await page.mouse.click(p.x, p.y);
  await expect.poll(() => page.evaluate(() => window.game.world.realm.bounties.length)).toBe(1);
  expect(await gold(page)).toBe(start - 25);
  await expect(page.locator('#info h3')).toHaveText('Explore flag');
  await expect(page.locator('.realm-tag.flag')).toHaveText('25');
  await page.locator('#realm-fund').click();
  await expect(page.locator('.realm-tag.flag')).toHaveText('50');
  expect(await gold(page)).toBe(start - 50);
  await page.getByRole('button', { name: 'Take down' }).click();
  await expect.poll(() => page.evaluate(() => window.game.world.realm.bounties.length)).toBe(0);
  await expect(page.locator('#info')).toBeHidden();
  expect(errors).toEqual([]);
});
