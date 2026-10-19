import { test } from '@playwright/test';
import { buildButton, buildShowcase, buildingAt, cameraTarget, countBuildings, expect, gold, openGame, openWheel, settingButton, tileToScreen, touchInput } from './helpers.js';

// Runs with the Pixel 7 profile (touch, portrait 412×915).

const pendingTile = (page) => page.evaluate(() => window.game.build.pending);

test('defaults to the High graphics preset and the HUD fits the screen', { tag: '@smoke' }, async ({ page }) => {
  const errors = await openGame(page);
  await openWheel(page);
  const r = await page.evaluate(() => ({
    pixelRatio: window.game.renderer.renderer.getPixelRatio(),
    preset: window.game.graphics.preset,
    overflowX: document.documentElement.scrollWidth > window.innerWidth,
    topbarBottom: document.querySelector('.corner-tl').getBoundingClientRect().bottom,
    buttons: [...document.querySelectorAll('.build-btn:not([hidden])')].map((b) => b.getBoundingClientRect().toJSON()),
  }));
  expect(r.preset).toBe('high');
  // Phones get the standard sprite set (they can't show more detail than it has).
  expect(await page.evaluate(() => window.game.renderer.atlas.set)).toBe('standard');
  // High renders at the screen's own pixel density (about 2.6× on a Pixel 7).
  expect(r.pixelRatio).toBeCloseTo(await page.evaluate(() => window.devicePixelRatio), 3);
  expect(r.overflowX).toBe(false);
  expect(r.topbarBottom).toBeLessThan(915 * 0.3);
  const vp = page.viewportSize();
  for (const b of r.buttons) {
    expect(b.left).toBeGreaterThanOrEqual(0);
    expect(b.right).toBeLessThanOrEqual(vp.width);
    expect(b.top).toBeGreaterThan(r.topbarBottom);
    expect(b.bottom).toBeLessThanOrEqual(vp.height);
  }
  await expect(page.locator('.touch-only').first()).toBeAttached();
  expect(errors).toEqual([]);
});

test('dragging a tower moves it without moving the map, then ✓ builds it', { tag: '@smoke' }, async ({ page }) => {
  const errors = await openGame(page);
  const touch = await touchInput(page);
  await (await buildButton(page, /Archer Tower/)).tap();
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
  expect(await page.evaluate(() => window.game.build.mode)).toBeNull(); // placing ends placement mode
  expect(errors).toEqual([]);
});

test('a pending tower can be dragged again relative to the finger, and ✕ cancels it', async ({ page }) => {
  await openGame(page);
  const touch = await touchInput(page);
  await (await buildButton(page, /Cannon Tower/)).tap();
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
  await (await buildButton(page, /Archer Tower/)).tap();
  await touch.tap(await tileToScreen(page, 19, 19)); // on the Town Hall
  await expect(page.locator('#confirm-yes')).toHaveClass(/invalid/);
  await page.locator('#confirm-yes').tap();
  await expect(page.locator('#toasts')).toContainText('Space is occupied');
  expect(await countBuildings(page, 'archerTower')).toBe(0);
});

test('holding a tower at the screen edge scrolls the map', async ({ page }) => {
  await openGame(page);
  const touch = await touchInput(page);
  await (await buildButton(page, /Archer Tower/)).tap();
  const target0 = await cameraTarget(page);
  const top = await page.evaluate(() => document.querySelector('.corner-tl').getBoundingClientRect().bottom);
  const from = await tileToScreen(page, 19, 26);
  await touch.drag(from, { x: from.x, y: top + 8 }, 12);
  // Map scrolls north (target z decreases) while the finger is held there.
  await expect.poll(async () => (await cameraTarget(page))[2]).toBeLessThan(target0[2] - 2);
  await touch.end();
  const z = (await pendingTile(page)).z;
  expect(z).toBeLessThan(15); // the tower travelled with the scrolling map
});

test('dragging in wall mode plans a wall line that ✓ builds', { tag: '@smoke' }, async ({ page }) => {
  await openGame(page);
  const touch = await touchInput(page);
  await (await buildButton(page, /Castle Wall/)).tap();
  await touch.drag(await tileToScreen(page, 14, 25), await tileToScreen(page, 24, 25), 15);
  await expect(page.locator('#confirm')).toBeHidden(); // hidden while the finger is down
  await touch.end();
  expect(await countBuildings(page, 'wall')).toBe(0); // nothing built until ✓
  await expect(page.locator('#confirm')).toBeVisible();
  await expect(page.locator('#confirm-label')).toHaveText('11 walls · 110g');
  await page.locator('#confirm-yes').tap();
  await expect.poll(() => countBuildings(page, 'wall')).toBe(11);
  await expect(page.locator('#confirm')).toBeHidden();
});

test('a planned wall end can be dragged onto a tower to snap to it, and ✕ discards the plan', async ({ page }) => {
  await openGame(page);
  const touch = await touchInput(page);
  await page.evaluate(() => window.game.world.place('archerTower', 22, 24)); // covers 22–23, 24–25
  await (await buildButton(page, /Castle Wall/)).tap();
  await touch.drag(await tileToScreen(page, 14, 24), await tileToScreen(page, 17, 24));
  await touch.end();
  expect(await page.evaluate(() => window.game.build.currentWallPlan().to)).toEqual({ x: 17, z: 24 });

  // Grab the end of the line and drag it over the tower: it snaps to the tower's west side.
  await touch.drag(await tileToScreen(page, 17, 24), await tileToScreen(page, 23, 25));
  await touch.end();
  const plan = await page.evaluate(() => window.game.build.currentWallPlan());
  expect(plan.to).toEqual({ x: 21, z: 24 });
  expect(plan.from).toEqual({ x: 14, z: 24 });
  expect(plan.snapped).toBe(true);
  await expect(page.locator('#confirm')).toBeVisible();
  await expect(page.locator('#confirm-label')).toHaveText('8 walls · 80g');

  await page.locator('#confirm-no').tap();
  await expect.poll(() => page.evaluate(() => window.game.build.wallPlan)).toBe(null);
  await expect(page.locator('#confirm')).toBeHidden();
  expect(await countBuildings(page, 'wall')).toBe(0);
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

test('the settings menu fits the phone screen and can be scrolled to Done', async ({ page }) => {
  await openGame(page);
  await page.getByRole('button', { name: 'Settings' }).tap();
  const box = await page.locator('.settings-dialog').boundingBox();
  const vp = page.viewportSize();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
  expect(box.height).toBeLessThanOrEqual(vp.height);
  await page.getByRole('button', { name: 'Done' }).tap();
  await expect(page.locator('#settings')).toBeHidden();
});

test('frame rate: Low caps at 30 fps and uses automatic render scale', { tag: '@smoke' }, async ({ page }) => {
  await openGame(page, { paused: false, map: 'terrain' });
  // The default High preset stays inside the draw-call budget on the terrain map too.
  expect(await page.evaluate(() => window.game.renderer.renderer.info.render.calls)).toBeLessThanOrEqual(25);
  await page.getByRole('button', { name: 'Settings' }).tap();
  await settingButton(page, 'Preset', 'Low').tap();
  await page.getByRole('button', { name: 'Done' }).tap();
  await expect(page.locator('#settings')).toBeHidden();
  const r = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const g = window.game;
        const f0 = g.renderer.renderer.info.render.frame;
        const t0 = performance.now();
        setTimeout(() => {
          const fps = ((g.renderer.renderer.info.render.frame - f0) * 1000) / (performance.now() - t0);
          resolve({ fps, cap: g.graphics.fpsCap, auto: !!g.dynamicResolution, scale: g.renderer.effectiveScale });
        }, 2000);
      }),
  );
  expect(r.cap).toBe(30);
  expect(r.fps).toBeLessThanOrEqual(32);
  expect(r.fps).toBeGreaterThan(0);
  expect(r.auto).toBe(true);
  expect(r.scale).toBeGreaterThanOrEqual(0.5);
  // The painted ground, terrain sprites and water shimmer stay inside the draw-call budget.
  expect(await page.evaluate(() => window.game.renderer.renderer.info.render.calls)).toBeLessThanOrEqual(25);
  // Painting the ground happens once per map; keep it quick on a phone.
  expect(await page.evaluate(() => window.game.renderer.terrainPaintMs)).toBeLessThan(1500);
});

test('showcase: a walled base with every tower and enemy renders without errors (screenshot attached)', async ({ page }, testInfo) => {
  const errors = await openGame(page, { map: 'terrain' });
  await buildShowcase(page, testInfo, 'showcase-phone');
  expect(errors).toEqual([]);
});

test('render scale goes up to the screen: Native and 300% draw at the phone’s own pixel density', async ({ page }) => {
  const errors = await openGame(page);
  const ratio = () => page.evaluate(() => window.game.renderer.renderer.getPixelRatio());
  const screen = await page.evaluate(() => window.devicePixelRatio);
  await page.getByRole('button', { name: 'Settings' }).tap();
  await settingButton(page, 'Render scale', 'Native').tap();
  expect(await ratio()).toBeCloseTo(screen, 3);
  await settingButton(page, 'Render scale', '300%').tap();
  expect(await ratio()).toBeCloseTo(Math.min(3, screen), 3); // never more pixels than the screen has
  await settingButton(page, 'Render scale', '200%').tap();
  expect(await ratio()).toBeCloseTo(Math.min(2, screen), 3);
  expect(errors).toEqual([]);
});

test('the corners: the hall ring and gold, the wave dial, time controls and the build wheel; a selection takes the bottom', async ({ page }) => {
  const errors = await openGame(page);
  await expect(page.locator('#wave-num')).toHaveText('01');
  await expect(page.locator('#phase')).toContainText('Next wave');
  await expect(page.locator('#next-wave')).toContainText('Wave 1');
  // Everything sits on the screen, nothing overlapping its neighbours.
  const box = (sel) => page.locator(sel).boundingBox();
  const width = page.viewportSize().width;
  const boxes = {};
  for (const sel of ['.hall-ring', '.gold-pill', '.wave-text', '.wave-dial', '#settings-btn', '#help-btn', '#start-wave', '#pause', '#speed', '#build-fab']) {
    const b = (boxes[sel] = await box(sel));
    expect(b.x, sel).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width, sel).toBeLessThanOrEqual(width);
  }
  const apart = (a, b) => a.x + a.width <= b.x + 1 || b.x + b.width <= a.x + 1 || a.y + a.height <= b.y + 1 || b.y + b.height <= a.y + 1;
  expect(apart(boxes['.gold-pill'], boxes['.wave-text'])).toBe(true);
  expect(apart(boxes['.wave-text'], boxes['.wave-dial'])).toBe(true);
  // The wheel folds away once a tower is picked; a selected building's card replaces the bottom corners.
  await (await buildButton(page, /Archer Tower/)).tap();
  await expect(page.locator('#build-wheel')).not.toHaveClass(/open/);
  await page.evaluate(() => {
    window.game.build.setMode(null);
    window.game.build.select(window.game.world.townHall.id);
  });
  await expect(page.locator('#info')).toBeVisible();
  await expect(page.locator('#build-fab')).toBeHidden();
  await page.locator('#info-close').tap();
  await expect(page.locator('#info')).toBeHidden();
  await expect(page.locator('#build-fab')).toBeVisible();
  // Tapping the wave dial twice sends the next wave early: the first tap only asks.
  await page.locator('#wave-dial').tap();
  expect(await page.evaluate(() => [window.game.world.phase, window.game.hud._waveConfirmUntil > performance.now()])).toEqual(['build', true]);
  await page.locator('#wave-dial').tap();
  await expect.poll(() => page.evaluate(() => window.game.world.phase)).toBe('wave');
  expect(errors).toEqual([]);
});

test('conquest on a phone: giving the hero orders, a drag still pans and the minimap sends them far', async ({ page }) => {
  test.setTimeout(150000); // the Conquest map takes a while to paint on a phone
  const errors = await openGame(page, { query: 'mode=conquest' });
  const touch = await touchInput(page);
  await page.evaluate(() => window.game.hud.toggleHeroMode());
  expect(await page.evaluate(() => window.game.build.mode)).toBe('hero');
  const before = await cameraTarget(page);
  await touch.drag({ x: 200, y: 600 }, { x: 200, y: 350 });
  await touch.end();
  await expect.poll(() => cameraTarget(page)).not.toEqual(before);
  expect(await page.evaluate(() => window.game.world.heroes.red.order)).toBeNull(); // a drag isn't an order
  // A press on the minimap, near the middle of the map, sends the hero there.
  const box = await page.locator('#minimap').boundingBox();
  await page.locator('#minimap').tap({ position: { x: box.width / 2, y: box.height / 2 } });
  const order = await page.evaluate(() => window.game.world.heroes.red.order);
  const H = await page.evaluate(() => window.game.world.grid.height);
  expect(Math.abs(order.z - H / 2)).toBeLessThan(H * 0.2);
  expect(errors).toEqual([]);
});


test('Realm on a phone: a guild placed with ✓, and one tap on Hire hires one hero', async ({ page }) => {
  const errors = await openGame(page, { query: 'mode=realm' });
  const touch = await touchInput(page);
  await (await buildButton(page, /Rogues' Den/)).tap();
  await touch.tap(await tileToScreen(page, 14, 15));
  await expect(page.locator('#confirm')).toBeVisible();
  await page.locator('#confirm-yes').tap();
  await expect.poll(() => buildingAt(page, 14, 15)).toBe('roguesDen');

  await touch.tap(await tileToScreen(page, 14, 15));
  const hire = page.getByRole('button', { name: /Hire a Rogue/ });
  await expect(hire).toBeVisible();
  await hire.tap();
  await expect(page.locator('#info')).toContainText('Rogues: 1/4');
  // The card is redrawn under the finger: the browser's click after the tap mustn't hire a second.
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => window.game.world.realm.heroes.length)).toBe(1);
  expect(errors).toEqual([]);
});
