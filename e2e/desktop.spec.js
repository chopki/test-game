import { test } from '@playwright/test';
import { buildingAt, buildShowcase, countBuildings, expect, gold, graphicsState, minCanvasAlpha, nearestTerrainTile, openGame, settingButton, tileToScreen } from './helpers.js';

// The Town Hall covers tiles 18–20 on both axes; tiles inside 2..37 are buildable.

test('loads with the HUD and no errors', { tag: '@smoke' }, async ({ page }) => {
  const errors = await openGame(page, { map: 'terrain' });
  await expect(page.locator('#gold')).toHaveText('300');
  await expect(page.locator('#wave')).toHaveText('0');
  await expect(page.locator('#buildbar .build-btn')).toHaveCount(6);
  await expect(page.locator('#next-wave')).toContainText('Wave 1');
  // Shadows and other ground decals must leave the canvas opaque (else they show the page colour through).
  expect(await minCanvasAlpha(page)).toBe(255);
  expect(errors).toEqual([]);
});

test('hotkey + click places an archer tower and spends gold', { tag: '@smoke' }, async ({ page }) => {
  const errors = await openGame(page);
  await page.keyboard.press('2');
  await expect(page.getByRole('button', { name: /Archer Tower/ })).toHaveClass(/active/);
  const p = await tileToScreen(page, 12, 12);
  await page.mouse.click(p.x, p.y);
  await expect.poll(() => buildingAt(page, 12, 12)).toBe('archerTower');
  expect(await gold(page)).toBe(225);
  // Placing a tower ends placement mode.
  await expect(page.getByRole('button', { name: /Archer Tower/ })).not.toHaveClass(/active/);
  expect(await page.evaluate(() => window.game.build.mode)).toBeNull();
  expect(errors).toEqual([]);
});

async function mouseDrag(page, from, to, { release = true } = {}) {
  const a = await tileToScreen(page, from[0], from[1]);
  const b = await tileToScreen(page, to[0], to[1]);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 10 });
  if (release) await page.mouse.up();
}

test('dragging in wall mode previews a wall line with its cost, built on release', { tag: '@smoke' }, async ({ page }) => {
  await openGame(page);
  await page.keyboard.press('1');
  await mouseDrag(page, [10, 8], [20, 8], { release: false });
  expect(await countBuildings(page, 'wall')).toBe(0); // only a preview while dragging
  await expect(page.locator('#build-tag')).toHaveText('11 walls · 110g');
  await page.mouse.up();
  await expect(page.locator('#build-tag')).toBeHidden();
  expect(await countBuildings(page, 'wall')).toBe(11);
  expect(await gold(page)).toBe(300 - 11 * 10);
});

test('a diagonal wall drag builds an L-shaped wall', async ({ page }) => {
  await openGame(page);
  await page.keyboard.press('1');
  await mouseDrag(page, [8, 8], [13, 11]);
  expect(await countBuildings(page, 'wall')).toBe(9); // 6 along x, then 3 more along z
  expect(await buildingAt(page, 13, 8)).toBe('wall'); // the corner
  expect(await buildingAt(page, 13, 11)).toBe('wall');
});

test('dragging a wall onto a tower snaps it to the tower side', async ({ page }) => {
  await openGame(page);
  await page.keyboard.press('2');
  const t = await tileToScreen(page, 12, 12);
  await page.mouse.click(t.x, t.y); // archer tower covers 12–13
  await page.keyboard.press('1');
  await mouseDrag(page, [6, 12], [13, 13]); // release over the middle of the tower
  expect(await buildingAt(page, 11, 12)).toBe('wall'); // touches the tower's west side
  expect(await buildingAt(page, 12, 12)).toBe('archerTower');
  expect(await countBuildings(page, 'wall')).toBe(6); // 6..11
});

test('right-click during a wall drag cancels it', async ({ page }) => {
  await openGame(page);
  await page.keyboard.press('1');
  await mouseDrag(page, [10, 8], [16, 8], { release: false });
  await page.mouse.down({ button: 'right' });
  await page.mouse.up({ button: 'right' });
  await page.mouse.up();
  expect(await countBuildings(page, 'wall')).toBe(0);
});

test('terrain blocks building: a tower on rock, water or forest is refused with a reason', { tag: '@smoke' }, async ({ page }) => {
  const errors = await openGame(page, { map: 'terrain' });
  const state = await graphicsState(page);
  expect(state.terrainSprites).toBeGreaterThan(50); // trees and outcrops standing on blocking tiles
  for (const name of ['forest', 'rock', 'water']) {
    const tile = await nearestTerrainTile(page, name);
    expect(tile, name).not.toBeNull();
    await page.keyboard.press('2');
    const p = await tileToScreen(page, tile.x, tile.z);
    await page.mouse.click(p.x, p.y);
    await expect(page.locator('#toasts')).toContainText('Blocked by terrain');
    expect(await countBuildings(page, 'archerTower')).toBe(0);
    await page.keyboard.press('Escape');
  }
  expect(errors).toEqual([]);
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

test('starting a wave spawns enemies', { tag: '@smoke' }, async ({ page }) => {
  await openGame(page, { paused: false });
  await page.getByRole('button', { name: /Start wave/ }).click();
  await expect(page.locator('#wave')).toHaveText('1');
  await expect.poll(() => page.evaluate(() => window.game.world.enemies.length)).toBeGreaterThan(0);
  await expect(page.locator('#phase')).toContainText('enemies left');
  await expect(page.locator('#chronicle-list')).toContainText('Wave 1 incoming');
});

test('a GPU context loss pauses the game and it recovers', { tag: '@smoke' }, async ({ page }) => {
  await openGame(page, { paused: false });
  // Switch up to High first, so there's a preset to step down from.
  await page.getByRole('button', { name: 'Settings' }).click();
  await settingButton(page, 'Preset', 'High').click();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.evaluate(() => {
    window.__lose = window.game.renderer.renderer.getContext().getExtension('WEBGL_lose_context');
    window.__lose.loseContext();
  });
  await expect(page.locator('#error')).toBeVisible();
  await expect(page.locator('#error-title')).toHaveText('Graphics were reset by your browser');
  // The crash drops High one step to Medium.
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

test('graphics start on High, presets apply live, and the game pauses while the menu is open', async ({ page }) => {
  await openGame(page, { paused: false });
  expect(await graphicsState(page)).toMatchObject({ preset: 'high', resolution: 1.5, scenery: 'high' });

  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.locator('#settings')).toBeVisible();
  expect(await page.evaluate(() => window.game.paused)).toBe(true);
  await expect(settingButton(page, 'Preset', 'High')).toHaveClass(/active/);

  await settingButton(page, 'Preset', 'Low').click();
  expect(await graphicsState(page)).toMatchObject({ preset: 'low', fpsCap: 30, resolution: 'auto' });
  await expect(settingButton(page, 'Preset', 'Low')).toHaveClass(/active/);
  await expect(settingButton(page, 'Scenery', 'Low')).toHaveClass(/active/);
  await expect(settingButton(page, 'Render scale', 'Auto')).toHaveClass(/active/);
  // A fixed render scale is applied directly.
  await settingButton(page, 'Render scale', '50%').click();
  expect(await graphicsState(page)).toMatchObject({ preset: 'custom', pixelRatio: 0.5 });
  await settingButton(page, 'Render scale', 'Auto').click();

  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('#settings')).toBeHidden();
  expect(await page.evaluate(() => window.game.paused)).toBe(false);

});

test('settings are not remembered: a fresh load always starts on High', async ({ page }) => {
  await openGame(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await settingButton(page, 'Preset', 'Low').click();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.reload();
  await page.waitForFunction(() => window.game?.world);
  expect((await graphicsState(page)).preset).toBe('high');
});

test('overriding one setting marks the preset Custom; FPS counter and frame cap work', { tag: '@smoke' }, async ({ page }) => {
  await openGame(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  expect((await graphicsState(page)).cloudShadows).toBe(true);
  await settingButton(page, 'Effects', 'Off').click();
  await expect(page.locator('.custom-tag')).toBeVisible();
  expect(await graphicsState(page)).toMatchObject({ preset: 'custom', effects: false, cloudShadows: false });

  await settingButton(page, 'Scenery', 'Off').click();
  expect((await graphicsState(page)).scenerySprites).toBe(0);
  await settingButton(page, 'Scenery', 'High').click();
  expect((await graphicsState(page)).scenerySprites).toBeGreaterThan(0);

  await settingButton(page, 'Show FPS', 'On').click();
  await settingButton(page, 'Frame rate cap', '30').click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('#fps')).toBeVisible();
  await expect(page.locator('#fps')).toHaveText(/^\d+ FPS · \d+%$/);
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.game.fps)).toBeLessThanOrEqual(32);
});

test('changing anti-aliasing offers a reload that keeps the chosen settings', async ({ page }) => {
  await openGame(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.locator('#settings-reload-note')).toBeHidden(); // starts on High, which has anti-aliasing
  await settingButton(page, 'Anti-aliasing', 'Off').click();
  await expect(page.locator('#settings-reload-note')).toBeVisible();
  await settingButton(page, 'Anti-aliasing', 'On').click();
  await expect(page.locator('#settings-reload-note')).toBeHidden();

  await settingButton(page, 'Preset', 'Low').click(); // Low has no anti-aliasing
  await expect(page.locator('#settings-reload-note')).toBeVisible();
  await page.getByRole('button', { name: 'Reload now' }).click();
  await page.waitForFunction(() => window.game?.world);
  expect(await page.evaluate(() => window.game.graphics.preset)).toBe('low');
  expect(await page.evaluate(() => window.game.renderer.renderer.getContextAttributes().antialias)).toBe(false);
  // That carry-over was one-off: the next load is back to High.
  await page.reload();
  await page.waitForFunction(() => window.game?.world);
  expect(await page.evaluate(() => window.game.graphics.preset)).toBe('high');
});

test('the Magic Spire and Catapult can be built with hotkeys 4 and 5', async ({ page }) => {
  const errors = await openGame(page);
  await page.evaluate(() => window.game.world.economy.earn(200)); // 500 gold
  await page.keyboard.press('4');
  let p = await tileToScreen(page, 10, 10);
  await page.mouse.click(p.x, p.y);
  await page.keyboard.press('5');
  p = await tileToScreen(page, 26, 10);
  await page.mouse.click(p.x, p.y);
  await expect.poll(() => buildingAt(page, 10, 10)).toBe('magicSpire');
  expect(await buildingAt(page, 26, 10)).toBe('catapult');
  expect(await gold(page)).toBe(500 - 125 - 180);
  expect(errors).toEqual([]);
});

test('walls reshape to join their neighbours and towers', async ({ page }) => {
  await openGame(page);
  const wallKey = (x, z) =>
    page.evaluate(([x, z]) => {
      // null until the renderer has drawn a frame with this wall (expect.poll then retries).
      const b = window.game.world.buildingAt(x, z);
      return window.game.renderer.views.buildings.get(b?.id)?.wallKey ?? null;
    }, [x, z]);
  await page.evaluate(() => {
    const w = window.game.world;
    w.place('archerTower', 12, 10); // covers 12–13
    for (const x of [9, 10, 11]) w.place('wall', x, 10);
  });
  // Keys list n/e/s/w neighbours, '-' where empty.
  await expect.poll(() => wallKey(9, 10)).toBe('-e--');
  await expect.poll(() => wallKey(10, 10)).toBe('-e-w');
  await expect.poll(() => wallKey(11, 10)).toBe('-e-w'); // joined onto the tower
  await page.evaluate(() => window.game.world.place('wall', 9, 11));
  await expect.poll(() => wallKey(9, 10)).toBe('-es-'); // now a corner
});

test('draw calls stay flat as walls and enemies are added (instancing)', { tag: '@smoke' }, async ({ page }) => {
  await openGame(page);
  // Lowest draw-call count over a few frames, to ignore any one-off frame.
  const calls = () =>
    page.evaluate(
      () =>
        new Promise((resolve) => {
          const seen = [];
          const tick = () => {
            seen.push(window.game.renderer.renderer.info.render.calls);
            if (seen.length < 6) requestAnimationFrame(tick);
            else resolve(Math.min(...seen.slice(2)));
          };
          requestAnimationFrame(tick);
        }),
    );
  const addWalls = (z) =>
    page.evaluate((z) => {
      const w = window.game.world;
      w.economy.earn(1000);
      for (let x = 4; x <= 35; x++) w.place('wall', x, z);
    }, z);
  await addWalls(6);
  const withSomeWalls = await calls();
  await addWalls(9);
  await addWalls(30);
  expect(await page.evaluate(() => [...window.game.world.buildings.values()].filter((b) => b.type === 'wall').length)).toBe(96);
  // Same wall shapes, three times as many walls: no extra draw calls.
  expect(await calls()).toBeLessThanOrEqual(withSomeWalls + 2);

  // 40 enemies of four types (half damaged, so they show health bars).
  await page.evaluate(() => {
    const w = window.game.world;
    w.phase = 'wave';
    ['grunt', 'runner', 'orc', 'brute'].forEach((type) => {
      for (let i = 0; i < 10; i++) {
        w._spawnEnemy({ type, side: 'north', hpMult: 1, elite: false });
        const e = w.enemies.at(-1);
        e.def = { ...e.def, speed: 0 };
        if (i % 2) e.hp = e.maxHp / 2;
      }
    });
  });
  // Enemies are sprites on the same atlas pages as walls; health bars and blob shadows add 3 batches.
  expect(await calls()).toBeLessThanOrEqual(withSomeWalls + 6);
  expect(await calls()).toBeLessThanOrEqual(25); // the whole battlefield in a couple of dozen draw calls
});

test('showcase: a walled base with every tower and enemy renders without errors (screenshot attached)', async ({ page }, testInfo) => {
  const errors = await openGame(page, { map: 'terrain' });
  await buildShowcase(page, testInfo, 'showcase-desktop');
  expect(errors).toEqual([]);
});

test('enemies are animated: walk frames cycle, blocked enemies attack, and the dead topple before vanishing', async ({ page }) => {
  const errors = await openGame(page, { paused: false });
  // Software WebGL manages only a few fps on High, too few to watch animation; Low runs at its 30 fps cap.
  await page.getByRole('button', { name: 'Settings' }).click();
  await settingButton(page, 'Preset', 'Low').click();
  await page.getByRole('button', { name: 'Done' }).click();
  const view = () =>
    page.evaluate(() => {
      const e = window.game.world.enemies[0];
      const v = e && window.game.renderer.views.enemies.get(e.id);
      return v ? { anim: v.anim, frame: v.frame } : null;
    });
  // One goblin walking south from the north edge, straight at a wall line across its path.
  await page.evaluate(() => {
    const w = window.game.world;
    w.economy.earn(1000);
    for (let x = 3; x <= 36; x++) w.place('wall', x, 8);
    w.phase = 'wave';
    w.spawnTiles.north = [[20, 0]];
    w._spawnEnemy({ type: 'grunt', side: 'north', hpMult: 1, elite: false });
  });
  // Walk frames advance as it moves (polled, as the first frames after a preset change can be slow).
  const frames = new Set();
  await expect
    .poll(
      async () => {
        const v = await view();
        if (v?.anim === 'walk') frames.add(v.frame);
        return frames.size;
      },
      { timeout: 15_000, intervals: [60] },
    )
    .toBeGreaterThan(2);
  await expect.poll(async () => (await view())?.anim, { timeout: 20_000 }).toBe('attack');

  await page.evaluate(() => window.game.world._damageEnemy(window.game.world.enemies[0], 9999));
  expect(await page.evaluate(() => window.game.renderer.corpses.length)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.game.renderer.corpses.length), { timeout: 5_000 }).toBe(0);
  expect(errors).toEqual([]);
});

test('a tower can be built into the middle of a wall line, and the wall is joined onto it', async ({ page }) => {
  const errors = await openGame(page);
  await page.evaluate(() => {
    const w = window.game.world;
    w.economy.earn(500);
    for (let x = 8; x <= 16; x++) w.place('wall', x, 12);
  });
  // Hover-and-click an archer tower over the middle of the line.
  await page.keyboard.press('2');
  const p = await tileToScreen(page, 12, 12);
  await page.mouse.click(p.x, p.y);
  expect(await buildingAt(page, 12, 12)).toBe('archerTower');
  expect(await buildingAt(page, 11, 12)).toBe('wall');
  expect(await buildingAt(page, 14, 12)).toBe('wall');
  expect(await countBuildings(page, 'wall')).toBe(7);
  // Joint pieces tie the wall into the tower on both sides.
  await expect.poll(() => page.evaluate(() => window.game.renderer.wallJointsDrawn)).toBe(2);
  expect(errors).toEqual([]);
});
