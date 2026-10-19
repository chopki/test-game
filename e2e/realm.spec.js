import { test } from '@playwright/test';
import { expect, gold, openGame, tileToScreen } from './helpers.js';

// Realm mode (?mode=realm): heroes hired at guilds, bounty flags, the fog. Full suite only. On the open test map the
// Town Hall covers tiles 18–20; only the land within about 10 tiles of it has been seen at the start.

const openRealm = (page, opts = {}) => openGame(page, { ...opts, query: ['mode=realm', opts.query].filter(Boolean).join('&') });

test('the main menu starts a Realm, with its briefing, the guilds in the wheel and the minimap', async ({ page }) => {
  test.setTimeout(120_000); // a new Realm map is laid out and painted, on software WebGL
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
  await expect(page.locator('#chronicle-list')).toContainText('Unexplored'); // (Realm news goes to the chronicle and, on phones, its herald)
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

for (const query of ['', 'size=medium&hills=1&sea=1']) {
  test(`each Realm building can be placed on the generated map and selected, with no errors${query ? ` (${query})` : ''}`, async ({ page }) => {
    test.setTimeout(120_000); // four buildings placed and opened, on software WebGL (the medium map is slower)
    const errors = await openRealm(page, { map: 'terrain', fort: true, query });
    await page.evaluate(() => window.game.world.economy.earn(1000));
    for (const [key, type, name] of [
      ['7', 'warriorsHall', "Warriors' Hall"],
      ['8', 'rangersLodge', "Rangers' Lodge"],
      ['9', 'roguesDen', "Rogues' Den"],
      ['0', 'smithy', 'Smithy'],
    ]) {
      // A clear, seen spot near the Town Hall for it.
      const spot = await page.evaluate((type) => {
        const w = window.game.world;
        const h = w.townHall;
        for (let r = 3; r < 10; r++) {
          for (let dz = -r; dz <= r; dz++) {
            for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dz)) === r && w.canPlace(type, h.x + dx, h.z + dz).ok) return { x: h.x + dx, z: h.z + dz };
          }
        }
        return null;
      }, type);
      expect(spot, type).not.toBeNull();
      await page.keyboard.press(key);
      await expect.poll(() => page.evaluate(() => window.game.build.mode)).toBe(type);
      const p = await page.evaluate(([x, z]) => window.game.renderer.toScreen(x + 0.5, 0, z + 0.5), [spot.x, spot.z]);
      await page.mouse.move(p.x, p.y);
      await page.mouse.click(p.x, p.y);
      await expect.poll(() => page.evaluate(([x, z]) => window.game.world.buildingAt(x, z)?.type, [spot.x, spot.z]), { message: type }).toBe(type);
      await page.mouse.click(p.x, p.y);
      await expect(page.locator('#info h3')).toHaveText(name);
    }
    // A moment of play with them standing (drawn, the smithy's smoke…).
    await page.evaluate(() => window.game.togglePause());
    await page.waitForTimeout(1500);
    expect(errors).toEqual([]);
  });
}

test('a guild can be placed in a gap in a wall line (it is drawn whole beside the wall, not built into it)', async ({ page }) => {
  const errors = await openRealm(page);
  await page.evaluate(() => {
    const w = window.game.world;
    w.economy.earn(1000);
    for (const x of [9, 10, 11, 12, 13, 16, 17, 18]) w.place('wall', x, 14);
  });
  await page.keyboard.press('7');
  const p = await tileToScreen(page, 14, 14);
  await page.mouse.move(p.x, p.y); // the preview over the gap
  await page.mouse.click(p.x, p.y);
  await expect.poll(() => page.evaluate(() => window.game.world.buildingAt(14, 14)?.type)).toBe('warriorsHall');
  await page.waitForTimeout(300);
  expect(errors).toEqual([]);
});

test('the main menu is up before the game has loaded, and a battle picked meanwhile begins once it has', async ({ page }) => {
  test.setTimeout(180_000); // the whole boot, then a new Realm map, on software WebGL
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Hold the sprite pages back, so the menu is seen while they load.
  let release;
  const held = new Promise((resolve) => (release = resolve));
  await page.route(/\/sprites(-hd)?\/page-\d+\./, async (route) => {
    await held;
    await route.continue();
  });
  await page.goto('/?seed=8&map=open&size=small&sea=0&hills=0&fort=0', { waitUntil: 'domcontentloaded' }); // ('load' waits for the held pages)
  await expect(page.locator('#menu')).toBeVisible();
  await expect(page.locator('.menu-status')).toContainText('Preparing the battlefield');
  expect(await page.evaluate(() => Boolean(window.game))).toBe(false);
  await expect(page.locator('#menu-codex')).toBeDisabled();
  await page.locator('#menu-realm').click();
  await expect(page.locator('#menu-realm')).toHaveClass(/waiting/);
  await expect(page.locator('.menu-status')).toHaveText('Getting ready…');

  release();
  await expect.poll(() => page.evaluate(() => window.game?.world.mode), { timeout: 120_000 }).toBe('realm');
  await expect(page.locator('#intro-title')).toHaveText(/Realm/);
  await expect(page.locator('.menu-status')).toHaveCount(0);
  await expect(page.locator('#menu-codex')).toBeEnabled();
  expect(errors).toEqual([]);
});

test('Realm news is sealed by severity in the chronicle, repeats merge, and a tap on an entry looks there', async ({ page }) => {
  const errors = await openRealm(page);
  const camera = () => page.evaluate(() => window.game.renderer.controls.target.toArray().map((v) => Math.round(v)));
  await page.evaluate(() => {
    const w = window.game.world;
    w.economy.earn(500);
    // A raid sets out from the first camp, twice.
    const lair = w.realm.lairs[0];
    lair.nextRaid = 0;
    w.update(1 / 30);
  });
  const entry = page.locator('#chronicle-list li').first();
  await expect(entry).toContainText('Outlaws are out raiding');
  await expect(entry).toHaveClass(/danger/);
  await expect(entry).toHaveClass(/jump/);
  await page.evaluate(() => {
    const w = window.game.world;
    w.realm.lairs[0].nextRaid = 0;
    w.update(1 / 30);
  });
  await expect(entry.locator('.count')).toHaveText('×2');
  await page.evaluate(() => window.game.renderer.focusOn(6, 6)); // look elsewhere first
  const before = await camera();
  await entry.click();
  await expect.poll(camera).not.toEqual(before);
  // A bounty's wax seal shows its gold, and a pip for each hero on it.
  await page.evaluate(() => {
    const w = window.game.world;
    const h = w.townHall;
    let guild = null;
    for (let r = 4; r < 9 && !guild; r++) for (let dx = -r; dx <= r && !guild; dx++) for (let dz = -r; dz <= r && !guild; dz++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) === r && w.canPlace('rangersLodge', h.x + dx, h.z + dz).ok) {
        w.place('rangersLodge', h.x + dx, h.z + dz);
        guild = w.buildingAt(h.x + dx, h.z + dz);
      }
    }
    w.recruit(guild.id);
    for (let t = 0; t < 2; t += 1 / 30) w.update(1 / 30);
    w.placeBounty({ kind: 'explore', x: h.cx + 6.5, z: h.cz + 0.5 }, 60);
    for (let t = 0; t < 2; t += 1 / 30) w.update(1 / 30);
    window.game.renderer.focusOn(h.cx + 3, h.cz);
  });
  const seal = page.locator('.realm-tag.flag');
  await expect(seal).toHaveText('60');
  await expect(seal.locator('.pips i')).toHaveCount(1);
  expect(errors).toEqual([]);
});
