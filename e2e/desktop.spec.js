import { test } from '@playwright/test';
import { buildingAt, buildShowcase, countBuildings, expect, gold, graphicsState, minCanvasAlpha, nearestTerrainTile, openGame, settingButton, tileToScreen, zoomTo } from './helpers.js';

// The Town Hall covers tiles 18–20 on both axes; tiles inside 2..37 are buildable.

test('loads with the HUD and no errors', { tag: '@smoke' }, async ({ page }) => {
  const errors = await openGame(page, { map: 'terrain' });
  await expect(page.locator('#gold')).toHaveText('300');
  await expect(page.locator('#wave')).toHaveText('0');
  await expect(page.locator('#buildbar .build-btn:not([hidden])')).toHaveCount(7); // (the Flag Fort is Conquest's)
  await expect(page.locator('#next-wave')).toContainText('Wave 1');
  // Shadows and other ground decals must leave the canvas opaque (else they show the page colour through).
  expect(await minCanvasAlpha(page)).toBe(255);
  // Desktops get the double-resolution sprite set.
  expect(await page.evaluate(() => window.game.renderer.atlas.set)).toBe('hd');
  await expect(page.locator('#minimap')).toBeHidden(); // Conquest only
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

test('upgrades: the selected tower goes up a stage (button or U), capped by the Town Hall; a wall line all at once', async ({ page }) => {
  const errors = await openGame(page);
  await page.keyboard.press('2');
  const p = await tileToScreen(page, 12, 12);
  await page.mouse.click(p.x, p.y);
  await page.keyboard.press('Escape');
  await page.mouse.click(p.x, p.y);
  const info = page.locator('#info');
  await expect(info).toContainText('Watchtower · stage 1 of 5');
  await page.locator('#upgrade-selected').click();
  await expect(info).toContainText('Guard Tower · stage 2 of 5');
  expect(await gold(page)).toBe(225 - 60);
  // Stage 3 needs the Town Hall at stage 2 first.
  await expect(page.locator('#upgrade-selected')).toBeDisabled();
  await expect(info).toContainText('Needs the Town Hall at stage 2');
  await page.evaluate(() => {
    const w = window.game.world;
    w.economy.earn(1000);
    w.upgrade(w.townHall.id);
  });
  await page.keyboard.press('u');
  await expect(info).toContainText('Stone Tower · stage 3 of 5');
  // Each stage has its own baked look.
  expect(await page.evaluate(() => ['b:archerTower:s2', 'b:archerTower:s3', 'icon:archerTower:s3', 'wall:-e-w:0:s4', 'b:townHall:s5'].every((k) => window.game.renderer.atlas.frame(k)))).toBe(true);

  // A wall line: one press upgrades every joined wall.
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    for (let x = 6; x <= 14; x++) window.game.world.place('wall', x, 20);
  });
  const q = await tileToScreen(page, 9, 20);
  await page.mouse.click(q.x, q.y);
  await expect(page.locator('#upgrade-line')).toContainText('9 walls');
  await page.locator('#upgrade-line').click();
  expect(await page.evaluate(() => [6, 10, 14].map((x) => window.game.world.buildingAt(x, 20).stage))).toEqual([2, 2, 2]);
  expect(errors).toEqual([]);
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
  // Two presses: the first asks, the second sends it.
  await page.getByRole('button', { name: /Start wave/ }).click();
  await expect(page.locator('#phase')).toContainText('Tap again to send wave 1');
  expect(await page.evaluate(() => window.game.world.phase)).toBe('build');
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
  expect(await graphicsState(page)).toMatchObject({ preset: 'high', resolution: 'native', scenery: 'high' });

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
  await settingButton(page, 'Frame rate cap', '120').click();
  expect((await graphicsState(page)).fpsCap).toBe(120);
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

  // A long run mixes the baked variants (stakes, shades, props, grass), and each tile keeps its own.
  await page.evaluate(() => {
    const w = window.game.world;
    w.economy.earn(500);
    for (let x = 6; x <= 17; x++) w.place('wall', x, 25);
  });
  const variants = () =>
    page.evaluate(() => {
      const w = window.game.world;
      return Array.from({ length: 12 }, (_, i) => window.game.renderer.views.buildings.get(w.buildingAt(6 + i, 25).id)?.wallVariant);
    });
  await expect.poll(async () => new Set(await variants()).size).toBeGreaterThanOrEqual(3);
  expect(await variants()).toEqual(await variants());
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
  // Same wall shapes, three times as many walls: no more draw calls than the few atlas pages their ends and
  // variants add (HD walls fill several pages).
  expect(await calls()).toBeLessThanOrEqual(withSomeWalls + 3);

  // 60 enemies of six types (half damaged, so they show health bars).
  await page.evaluate(() => {
    const w = window.game.world;
    w.phase = 'wave';
    ['swordsman', 'pikeman', 'archer', 'knight', 'ram', 'mangonel'].forEach((type) => {
      for (let i = 0; i < 10; i++) {
        w._spawnEnemy({ type, side: 'north', hpMult: 1, elite: false });
        const e = w.enemies.at(-1);
        e.def = { ...e.def, speed: 0 };
        if (i % 2) e.hp = e.maxHp / 2;
      }
    });
  });
  // Enemies are sprites on a few atlas pages of their own (one batch each); health bars and blob shadows add 2 more.
  expect(await calls()).toBeLessThanOrEqual(withSomeWalls + 7);
  // The whole battlefield in a couple of dozen draw calls (more atlas pages since troops and the enemy castle's
  // blue buildings came; sprites are packed by kind to keep it down, see atlasPacking.js).
  expect(await calls()).toBeLessThanOrEqual(28);
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
  // One swordsman walking south from the north edge, straight at a wall line across its path.
  await page.evaluate(() => {
    const w = window.game.world;
    w.economy.earn(1000);
    for (let x = 3; x <= 36; x++) w.place('wall', x, 8);
    w.phase = 'wave';
    w.spawnTiles.north = [[20, 0]];
    w._spawnEnemy({ type: 'swordsman', side: 'north', hpMult: 1, elite: false });
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

test('enemy archers and siege catapults stop at range and shoot at the defences (screenshot attached)', async ({ page }, testInfo) => {
  const errors = await openGame(page, { paused: false });
  await page.evaluate(() => {
    const w = window.game.world;
    w.economy.earn(2000);
    for (let x = 6; x <= 33; x++) w.place('wall', x, 14);
    const tower = w.place('archerTower', 22, 16).building;
    tower.def = { ...tower.def, attack: { ...tower.def.attack, damage: 0 } }; // let them shoot for a while
    w.phase = 'wave';
    w.spawnTiles.north = [[17, 0], [18, 0], [19, 0], [20, 0], [21, 0], [22, 0], [23, 0]];
    for (const type of ['archer', 'archer', 'archer', 'mangonel']) w._spawnEnemy({ type, side: 'north', squad: 0, hpMult: 1, elite: false });
    for (const e of w.enemies) e.z += 4; // start nearer, to save walking time
  });
  await zoomTo(page, 20, 10, 1.6);
  // Hostile shots fly (and are drawn as 3D projectiles), and the shooters stand off at range.
  await expect
    .poll(() => page.evaluate(() => window.game.world.projectiles.filter((p) => p.hostile).length), { timeout: 30_000, intervals: [100] })
    .toBeGreaterThan(0);
  const state = await page.evaluate(() => {
    const w = window.game.world;
    return {
      drawn: window.game.renderer.views.projectiles.size,
      shooting: w.enemies.filter((e) => e.attackTargetId !== null).map((e) => ({ type: e.type, z: e.z })),
    };
  });
  expect(state.drawn).toBeGreaterThan(0);
  expect(state.shooting.length).toBeGreaterThan(0);
  for (const e of state.shooting) expect(e.z).toBeLessThan(13); // short of the wall line at z = 14
  const shot = await page.screenshot({ path: testInfo.outputPath('ranged-enemies.png') });
  await testInfo.attach('ranged-enemies', { body: shot, contentType: 'image/png' });
  expect(errors).toEqual([]);
});

test('a tower can be built into the middle of a wall line, and is drawn as part of the wall', async ({ page }) => {
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
  // It's drawn with its in-wall model (a bastion in the wall line), which carries its own wall stubs.
  await expect.poll(() => page.evaluate(() => window.game.renderer.inWallDrawn)).toBe(1);
  expect(await page.evaluate(() => window.game.renderer.wallJointsDrawn)).toBe(0);
  expect(errors).toEqual([]);
});

test('a tower on a T-junction of walls is drawn with a three-armed in-wall model (screenshot attached)', async ({ page }, testInfo) => {
  const errors = await openGame(page);
  await page.evaluate(() => {
    const w = window.game.world;
    w.economy.earn(1000);
    for (let x = 8; x <= 16; x++) w.place('wall', x, 12); // a west–east run…
    for (let z = 13; z <= 16; z++) w.place('wall', 12, z); // …with a branch south from x = 12
    for (let z = 20; z <= 28; z++) w.place('wall', 24, z); // a north–south run…
    for (let x = 25; x <= 28; x++) w.place('wall', x, 24); // …with a branch east
  });
  await page.keyboard.press('2');
  for (const [x, z] of [[12, 12], [24, 24]]) {
    const p = await tileToScreen(page, x, z);
    await page.mouse.click(p.x, p.y);
    await page.keyboard.press('2');
  }
  await page.keyboard.press('Escape');
  expect(await countBuildings(page, 'archerTower')).toBe(2);
  await expect.poll(() => page.evaluate(() => window.game.renderer.inWallDrawn)).toBe(2);
  expect(await page.evaluate(() => window.game.renderer.wallJointsDrawn)).toBe(0);
  await zoomTo(page, 18, 18, 1.6);
  await testInfo.attach('t-junctions', { body: await page.screenshot({ path: testInfo.outputPath('t-junctions.png') }), contentType: 'image/png' });
  expect(errors).toEqual([]);
});

test('streams flow and cloud shadows drift (zoomed screenshot attached)', async ({ page }, testInfo) => {
  const errors = await openGame(page, { map: 'terrain' });
  const state = await page.evaluate(() => {
    const r = window.game.renderer;
    const flow = r._shimmer.geometry.getAttribute('flow').array;
    return { flowing: flow.some((v) => Math.abs(v) > 0.5), time: r._clouds.material.uniforms.time.value };
  });
  expect(state.flowing).toBe(true); // map 8's stream has flow directions
  await expect.poll(() => page.evaluate(() => window.game.renderer._clouds.material.uniforms.time.value)).toBeGreaterThan(state.time + 0.3);
  expect(await page.evaluate(() => window.game.renderer._shimmer.material.uniforms.time.value)).toBeGreaterThan(state.time);

  // Zoom in on the stream for a look.
  const tile = await nearestTerrainTile(page, 'water');
  await page.evaluate(([x, z]) => {
    const r = window.game.renderer;
    const target = r.toScene(x + 0.5, 0, z + 0.5);
    r.camera.position.add(target.clone().sub(r.controls.target));
    r.controls.target.copy(target);
    r.camera.zoom = 2.4;
    r.camera.updateProjectionMatrix();
  }, [tile.x, tile.z]);
  await page.waitForTimeout(600);
  const shot = await page.screenshot({ path: testInfo.outputPath('water.png') });
  await testInfo.attach('water', { body: shot, contentType: 'image/png' });
  expect(errors).toEqual([]);
});

test('settings: New map starts a fresh game on another map, asking first if one is under way', async ({ page }) => {
  const errors = await openGame(page, { map: 'terrain' });
  const seed = () => page.evaluate(() => window.game.world.seed);
  const first = await seed();
  await page.evaluate(() => window.game.world.place('wall', 20, 12)); // a game under way
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.locator('#settings-body')).toContainText(`Map ${first}`);
  await page.getByRole('button', { name: 'New map' }).click();
  // First press only asks.
  await expect(page.getByRole('button', { name: /Tap again/ })).toBeVisible();
  expect(await seed()).toBe(first);
  await page.getByRole('button', { name: /Tap again/ }).click();
  await expect(page.locator('#settings')).toBeHidden();
  expect(await seed()).not.toBe(first);
  expect(await countBuildings(page, 'wall')).toBe(0);
  expect(await page.evaluate(() => window.game.world.waves.wave)).toBe(0);
  expect(errors).toEqual([]);
});

test('settings: Rivers → Always gives the next new map a stream', async ({ page }) => {
  const errors = await openGame(page, { map: 'terrain' });
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(settingButton(page, 'Rivers', 'Sometimes')).toHaveClass(/active/);
  await settingButton(page, 'Rivers', 'Always').click();
  await expect(settingButton(page, 'Rivers', 'Always')).toHaveClass(/active/);
  // A stream runs off the map at both ends.
  const stream = () =>
    page.evaluate(() => {
      const g = window.game.world.grid;
      const wet = (x, z) => [1, 2].includes(g.terrain[z * g.width + x]);
      const edge = (fn) => Array.from({ length: g.width }, (_, i) => fn(i)).some(Boolean);
      return (edge((x) => wet(x, 0)) && edge((x) => wet(x, g.height - 1))) || (edge((z) => wet(0, z)) && edge((z) => wet(g.width - 1, z)));
    });
  for (let i = 0; i < 3; i++) {
    if (i > 0) await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'New map' }).click();
    await expect(page.locator('#settings')).toBeHidden();
    expect(await stream()).toBe(true);
  }
  expect(errors).toEqual([]);
});

test('a coast: sea along one edge, drawn out to the horizon, and no attacks from it (screenshot attached)', async ({ page }, testInfo) => {
  const errors = await openGame(page, { map: 'terrain', query: 'sea=1' });
  const state = await page.evaluate(() => {
    const { world, renderer } = window.game;
    const g = world.grid;
    const seaTiles = [...g.terrain].filter((t) => t === 5).length;
    const sandTiles = [...g.terrain].filter((t) => t === 6).length;
    return { coast: world.coast, seaTiles, sandTiles, landing: world.spawnTiles[world.coast].length, sides: world.waves.next.sides, ocean: Boolean(renderer._ocean), shimmer: Boolean(renderer._shimmer) };
  });
  expect(['north', 'south', 'west', 'east']).toContain(state.coast);
  expect(state.seaTiles).toBeGreaterThan(100);
  expect(state.sandTiles).toBeGreaterThan(20);
  expect(state.landing).toBe(0);
  expect(state.sides).not.toContain(state.coast);
  expect(state.ocean && state.shimmer).toBe(true);
  const shot = await page.screenshot({ path: testInfo.outputPath('coast.png') });
  await testInfo.attach('coast', { body: shot, contentType: 'image/png' });
  // Settings → Coast: Never gives the next new map no sea.
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(settingButton(page, 'Coast', 'Always')).toHaveClass(/active/);
  await settingButton(page, 'Coast', 'Never').click();
  await expect(settingButton(page, 'Coast', 'Never')).toHaveClass(/active/);
  await page.getByRole('button', { name: 'New map' }).click();
  await expect(page.locator('#settings')).toBeHidden();
  expect(await page.evaluate(() => [window.game.world.coast, Boolean(window.game.renderer._ocean)])).toEqual([null, false]);
  expect(errors).toEqual([]);
});

test('hills: raised plateaus behind cliffs, picked at their height, with longer reach from the top (screenshot attached)', async ({ page }, testInfo) => {
  const errors = await openGame(page, { map: 'terrain', query: 'hills=1' });
  const state = await page.evaluate(() => {
    const { world, renderer } = window.game;
    const g = world.grid;
    // A buildable tile on a plateau, and where its centre is on screen.
    let tile = null;
    for (let z = 0; z < g.height && !tile; z++) for (let x = 0; x < g.width && !tile; x++) if (g.levelAt(x, z) > 0 && world.canPlace('archerTower', x, z).ok) tile = { x, z };
    const p = renderer.toScene(tile.x + 0.5, 0, tile.z + 0.5, new renderer.camera.position.constructor()).project(renderer.camera);
    const rect = renderer.canvas.getBoundingClientRect();
    const screen = { x: rect.left + ((p.x + 1) / 2) * rect.width, y: rect.top + ((1 - p.y) / 2) * rect.height };
    const picked = renderer.pickGround(screen.x, screen.y);
    return {
      hills: world.hills,
      cliffs: [...g.terrain].filter((t) => t === 7).length,
      ramps: [...g.terrain].filter((t) => t === 8).length,
      meshes: Boolean(renderer._raised && renderer._cliffs),
      tile,
      picked: picked && { x: Math.floor(picked.x), z: Math.floor(picked.z) },
      reach: [world.rangeAt('archerTower', tile.x, tile.z), world.rangeAt('archerTower', world.townHall.x + 3, world.townHall.z)],
    };
  });
  expect(state.hills).toBe(true);
  expect(state.cliffs).toBeGreaterThan(20);
  expect(state.ramps).toBeGreaterThan(1);
  expect(state.meshes).toBe(true);
  expect(state.picked).toEqual(state.tile);
  expect(state.reach[0]).toBeGreaterThan(state.reach[1]);
  const shot = await page.screenshot({ path: testInfo.outputPath('hills.png') });
  await testInfo.attach('hills', { body: shot, contentType: 'image/png' });
  // Settings → Hills: Never gives the next new map flat ground.
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(settingButton(page, 'Hills', 'Always')).toHaveClass(/active/);
  await settingButton(page, 'Hills', 'Never').click();
  await page.getByRole('button', { name: 'New map' }).click();
  await expect(page.locator('#settings')).toBeHidden();
  expect(await page.evaluate(() => [window.game.world.hills, Boolean(window.game.renderer._cliffs)])).toEqual([false, false]);
  expect(errors).toEqual([]);
});

test('settings: Map size picks how big the next new map is', async ({ page }) => {
  const errors = await openGame(page, { map: 'terrain', query: 'size=large' });
  const size = () => page.evaluate(() => [window.game.world.grid.width, window.game.world.townHall.x]);
  expect(await size()).toEqual([64, 30]);
  // A building can go out near the far corner of the big map.
  expect(await page.evaluate(() => window.game.world.canPlace('wall', 60, 60).reason ?? 'ok')).not.toBe('Out of bounds');
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(settingButton(page, 'Map size', 'Large')).toHaveClass(/active/);
  await settingButton(page, 'Map size', 'Medium').click();
  await page.getByRole('button', { name: 'New map' }).click();
  await expect(page.locator('#settings')).toBeHidden();
  expect(await size()).toEqual([52, 24]);
  expect(errors).toEqual([]);
});

test('long walls carry the odd decoration (flags, torches, shields…), sparsely and on both wall directions', async ({ page }, testInfo) => {
  const errors = await openGame(page);
  await page.evaluate(() => {
    const w = window.game.world;
    w.economy.earn(5000);
    for (let x = 3; x <= 36; x++) w.place('wall', x, 6); // east–west
    for (let z = 8; z <= 33; z++) w.place('wall', 6, z); // north–south
  });
  const decor = () =>
    page.evaluate(() => {
      const r = window.game.renderer;
      const kinds = [];
      for (const b of window.game.world.buildings.values()) {
        const v = r.views.buildings.get(b.id);
        if (b.type === 'wall' && v?.decor) kinds.push(`${v.decor}@${v.wallKey}`);
      }
      return { kinds, walls: [...window.game.world.buildings.values()].filter((b) => b.type === 'wall').length };
    });
  await expect.poll(async () => (await decor()).kinds.length).toBeGreaterThan(2);
  const { kinds, walls } = await decor();
  expect(kinds.length).toBeLessThan(walls / 4); // sparse
  expect(kinds.some((k) => k.endsWith('-e-w')) && kinds.some((k) => k.endsWith('n-s-'))).toBe(true);
  await testInfo.attach('wall-decor', { body: await page.screenshot({ path: testInfo.outputPath('wall-decor.png') }), contentType: 'image/png' });
  expect(errors).toEqual([]);
});

test('woods mix several kinds of tree, and the trees (not the rocks) sway in the wind', async ({ page }, testInfo) => {
  const errors = await openGame(page, { map: 'terrain' });
  const spots = await page.evaluate(() => window.game.renderer.terrainSpots.map((s) => ({ kind: s.key.split(':')[1], sway: s.sway })));
  const kinds = new Set(spots.map((s) => s.kind));
  expect(kinds.has('oak') && kinds.has('pine')).toBe(true);
  expect(['birch', 'spruce', 'beech', 'snag'].filter((k) => kinds.has(k)).length).toBeGreaterThanOrEqual(3);
  expect(spots.filter((s) => s.kind === 'outcrop').every((s) => s.sway === 0)).toBe(true);
  expect(spots.filter((s) => s.kind !== 'outcrop').every((s) => s.sway > 0)).toBe(true);
  // The sway reaches the GPU, and the wind's clock runs.
  const swaying = () =>
    page.evaluate(() => window.game.renderer.sprites.layers.reduce((n, p) => n + p.fx.array.subarray(0, p.count * 2).filter((v, i) => i % 2 === 0 && v > 0).length, 0));
  await expect.poll(swaying).toBeGreaterThan(50);
  const clock = () => page.evaluate(() => window.game.renderer.sprites._time.value);
  const t0 = await clock();
  await expect.poll(clock).toBeGreaterThan(t0);
  // Effects off stills them.
  await page.evaluate(() => window.game.setGraphics({ ...window.game.graphics, effects: false }));
  await expect.poll(swaying).toBe(0);
  // A close look at a wood, for the report.
  const forest = await nearestTerrainTile(page, 'forest');
  await page.evaluate(() => window.game.setGraphics({ ...window.game.graphics, effects: true }));
  await zoomTo(page, forest.x + 0.5, forest.z + 0.5, 2.5);
  await testInfo.attach('woods', { body: await page.screenshot({ path: testInfo.outputPath('woods.png') }), contentType: 'image/png' });
  expect(errors).toEqual([]);
});

test('a new game starts in a partly built fort: gatehouse and archer tower drawn in the walls', { tag: '@smoke' }, async ({ page }, testInfo) => {
  const errors = await openGame(page, { map: 'terrain', fort: true });
  const fort = () =>
    page.evaluate(() => {
      const w = window.game.world;
      const types = [...w.buildings.values()].map((b) => b.type);
      return {
        gatehouse: types.filter((t) => t === 'gatehouse').length,
        towers: types.filter((t) => t === 'archerTower').length,
        walls: types.filter((t) => t === 'wall').length,
        inWall: window.game.renderer.inWallDrawn,
      };
    });
  await expect.poll(async () => (await fort()).inWall).toBe(2); // the gatehouse and the tower, both on their walls
  const state = await fort();
  expect(state.gatehouse).toBe(1);
  expect(state.towers).toBe(1);
  expect(state.walls).toBeGreaterThan(25);
  await expect(page.locator('#chronicle-list')).toContainText('Close the gaps');
  // The gatehouse can't be sold.
  const gate = await page.evaluate(() => {
    const g = [...window.game.world.buildings.values()].find((b) => b.type === 'gatehouse');
    return { x: g.x, z: g.z };
  });
  await page.keyboard.press('x');
  const p = await tileToScreen(page, gate.x, gate.z);
  await page.mouse.click(p.x, p.y);
  expect(await countBuildings(page, 'gatehouse')).toBe(1);
  await page.keyboard.press('Escape');
  // A close look at the fort, for the report.
  const hall = await page.evaluate(() => ({ x: window.game.world.townHall.cx, z: window.game.world.townHall.cz }));
  await zoomTo(page, hall.x + 1, hall.z + 1, 2);
  await testInfo.attach('fort', { body: await page.screenshot({ path: testInfo.outputPath('fort.png') }), contentType: 'image/png' });
  expect(errors).toEqual([]);
});

test('combat effects: cannon smoke, impact clouds, dust and splinters from blows, debris when a wall falls (screenshot attached)', async ({ page }, testInfo) => {
  const errors = await openGame(page);
  await page.evaluate(() => {
    const w = window.game.world;
    w.economy.earn(2000);
    w.place('cannonTower', 14, 14);
    for (let x = 20; x <= 26; x++) w.place('wall', x, 24);
  });
  await zoomTo(page, 20, 20, 1.6);
  // Fire the events the sim sends in battle (blows and the collapse go through the sim itself).
  const burst = (hitX, fallX) =>
    page.evaluate(({ hitX, fallX }) => {
      const w = window.game.world;
      const r = window.game.renderer;
      r.particles.clear();
      const cannon = [...w.buildings.values()].find((b) => b.type === 'cannonTower');
      w.events.emit('projectileFired', { projectile: { kind: 'cannonball', sx: cannon.cx, sy: cannon.def.height, sz: cannon.cz, tx: 20, tz: 20 }, building: cannon });
      w.events.emit('projectileImpact', { x: 19, y: 0.2, z: 19, kind: 'cannonball', splash: 1.6 });
      w.events.emit('projectileImpact', { x: 23, y: 0.2, z: 19, kind: 'boulder', splash: 1.8 });
      w._damageBuilding(w.buildingAt(hitX, 24), 10, { x: hitX + 0.5, z: 25.5 }); // an enemy's blow
      w._damageBuilding(w.buildingAt(fallX, 24), 9999, { x: fallX + 0.5, z: 25.5 }); // a wall falls
      return r.particles.count;
    }, { hitX, fallX });
  expect(await burst(22, 25)).toBeGreaterThan(60);
  await page.waitForTimeout(250);
  await testInfo.attach('combat-effects', { body: await page.screenshot({ path: testInfo.outputPath('combat-effects.png') }), contentType: 'image/png' });
  // They burn out, and the Effects setting turns them off.
  await expect.poll(() => page.evaluate(() => window.game.renderer.particles.count), { timeout: 10000 }).toBe(0);
  await page.evaluate(() => window.game.setGraphics({ ...window.game.graphics, effects: false }));
  expect(await burst(21, 20)).toBe(0);
  expect(errors).toEqual([]);
});

test('damage states: buildings and walls look more battered as health drops, and smoulder when badly hurt (screenshot attached)', async ({ page }, testInfo) => {
  const errors = await openGame(page);
  // Three of each: sound, damaged (under 2/3) and badly damaged (under 1/3), left to right.
  await page.evaluate(() => {
    const w = window.game.world;
    w.economy.earn(3000);
    for (const [i, x] of [10, 14, 18].entries()) {
      w.place('archerTower', x, 24);
      w.place('cannonTower', x, 27);
      for (let z = 30; z <= 33; z++) w.place('wall', x, z);
      for (let z = 30; z <= 33; z++) w.place('wall', x + 1, z);
      const health = [1, 0.5, 0.2][i];
      for (const b of w.buildings.values()) if (b.type !== 'townHall' && b.x >= x && b.x <= x + 1 && b.z >= 24) b.hp = b.maxHp * health;
    }
  });
  const damage = () =>
    page.evaluate(() => {
      const counts = { 0: 0, 0.5: 0, 1: 0 };
      for (const p of window.game.renderer.sprites.layers) for (let i = 0; i < p.count; i++) counts[p.fx.array[i * 2 + 1]] = (counts[p.fx.array[i * 2 + 1]] ?? 0) + 1;
      return counts;
    });
  await expect.poll(async () => (await damage())[1]).toBeGreaterThan(8);
  expect((await damage())[0.5]).toBeGreaterThan(8);
  // The badly damaged ones smoke (and the towers burn).
  await expect.poll(() => page.evaluate(() => window.game.renderer.particles.count)).toBeGreaterThan(3);
  await zoomTo(page, 15, 29, 2.6);
  await page.waitForTimeout(1200);
  await testInfo.attach('damage-states', { body: await page.screenshot({ path: testInfo.outputPath('damage-states.png') }), contentType: 'image/png' });
  expect(errors).toEqual([]);
});

test('ground marks: footbridges over fords, worn earth round towers, scorch marks where shots land (screenshot attached)', async ({ page }, testInfo) => {
  const errors = await openGame(page, { map: 'terrain' });
  const bridges = await page.evaluate(() => window.game.renderer.terrainSpots.filter((s) => s.key.startsWith('bridge:')).map((s) => s.key));
  expect(bridges.filter((k) => k.endsWith(':mid')).length).toBeGreaterThan(0);
  expect(bridges.some((k) => k.endsWith(':start') || k.endsWith(':end'))).toBe(true);
  // Worn earth under each tower, and a scorch mark where a cannonball lands (until it fades).
  const ford = await nearestTerrainTile(page, 'ford');
  const marks = await page.evaluate(({ x, z }) => {
    const w = window.game.world;
    w.economy.earn(1000);
    const before = window.game.renderer.groundMarks.count;
    let placed = 0;
    for (const [tx, tz] of [[14, 14], [23, 14], [14, 23], [23, 23]]) if (w.place('archerTower', tx, tz).ok) placed++; // in the clearing round the hall
    w.events.emit('projectileImpact', { x: x + 0.5, y: 0.2, z: z + 2.5, kind: 'cannonball', splash: 1.6 });
    return { before, placed };
  }, ford);
  expect(marks.placed).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.game.renderer.groundMarks.count)).toBeGreaterThanOrEqual(marks.before + marks.placed + 1);
  await zoomTo(page, ford.x + 0.5, ford.z + 0.5, 2.4);
  expect(await minCanvasAlpha(page)).toBe(255); // the decals leave the canvas opaque
  await testInfo.attach('ground-marks', { body: await page.screenshot({ path: testInfo.outputPath('ground-marks.png') }), contentType: 'image/png' });
  expect(errors).toEqual([]);
});

test('glow and colour (High only): halos round crystals and fires, a warm grade, both off on Medium (screenshot attached)', async ({ page }, testInfo) => {
  const errors = await openGame(page);
  expect(await page.evaluate(() => window.game.graphics.glow)).toBe(true); // High
  await page.evaluate(() => {
    const w = window.game.world;
    w.economy.earn(2000);
    w.place('magicSpire', 14, 14);
    w.place('archerTower', 17, 14);
    w.buildingAt(17, 14).hp = 20; // badly damaged: it burns
  });
  await expect.poll(() => page.evaluate(() => window.game.renderer.glows.count)).toBeGreaterThanOrEqual(2);
  expect(await page.evaluate(() => getComputedStyle(window.game.renderer.renderer.domElement).filter)).toContain('sepia');
  expect(await minCanvasAlpha(page)).toBe(255); // additive halos leave the canvas opaque
  await zoomTo(page, 16, 15, 2.4);
  await testInfo.attach('glow', { body: await page.screenshot({ path: testInfo.outputPath('glow.png') }), contentType: 'image/png' });
  await page.evaluate(() => window.game.setGraphics({ ...window.game.graphics, preset: 'medium', glow: false }));
  expect(await page.evaluate(() => window.game.renderer.glows.mesh.visible)).toBe(false);
  expect(await page.evaluate(() => window.game.renderer.renderer.domElement.style.filter)).toBe('');
  expect(errors).toEqual([]);
});

test('living buildings: pennants wave, lookouts scan, the Town Hall chimney smokes, crystals sparkle (screenshot attached)', async ({ page }, testInfo) => {
  const errors = await openGame(page, { fort: true });
  await page.evaluate(() => {
    const w = window.game.world;
    w.economy.earn(1000);
    w.place('magicSpire', 23, 15);
  });
  // Which flag frames and lookout directions are being drawn right now.
  const drawn = () =>
    page.evaluate(() => {
      const r = window.game.renderer;
      const keys = new Set();
      for (const v of r.views.buildings.values()) if (v.look !== undefined) keys.add(`look:${Math.round(v.look * 100)}`);
      const frames = [];
      for (const p of r.sprites.layers) {
        for (let i = 0; i < p.count; i++) {
          const [u, v] = [p.rects.getX(i), p.rects.getY(i)];
          for (const [key, f] of r.atlas.frames) if (key.startsWith('flag:') && Math.abs(f.u0 - u) < 1e-6 && Math.abs(f.v0 - v) < 1e-6) frames.push(key);
        }
      }
      return frames.sort().join(',');
    });
  const first = await drawn();
  expect(first).toContain('flag:'); // the Town Hall's and the gatehouse's pennants
  await expect.poll(drawn, { timeout: 5000 }).not.toBe(first); // …and they ripple
  // Chimney smoke and crystal sparkles are particles.
  await expect.poll(() => page.evaluate(() => window.game.renderer.particles.count)).toBeGreaterThan(4);
  const hall = await page.evaluate(() => ({ x: window.game.world.townHall.cx, z: window.game.world.townHall.cz }));
  await zoomTo(page, hall.x, hall.z, 2.8);
  await page.waitForTimeout(1500);
  await testInfo.attach('living-buildings', { body: await page.screenshot({ path: testInfo.outputPath('living-buildings.png') }), contentType: 'image/png' });
  expect(errors).toEqual([]);
});

test('seasons and weather: winter snow, autumn leaves and rain, and the Weather setting turns them off (screenshots attached)', async ({ page }, testInfo) => {
  const errors = await openGame(page, { map: 'terrain', fort: true, query: 'season=winter&weather=snow' });
  expect(await page.evaluate(() => window.game.renderer.weather)).toEqual({ season: 'winter', weather: 'snow' });
  await expect.poll(() => page.evaluate(() => window.game.renderer.precipitation.drawn)).toBeGreaterThan(300); // snowfall
  expect(await page.evaluate(() => window.game.renderer._cover.mesh.visible)).toBe(true); // snow on the ground
  expect(await minCanvasAlpha(page)).toBe(255);
  const hall = await page.evaluate(() => ({ x: window.game.world.townHall.cx, z: window.game.world.townHall.cz }));
  await zoomTo(page, hall.x + 2, hall.z + 1, 1.5);
  await testInfo.attach('winter', { body: await page.screenshot({ path: testInfo.outputPath('winter.png') }), contentType: 'image/png' });
  // Autumn rain (the look eases over a few seconds).
  await page.evaluate(() => window.game.renderer.setWeather('autumn', 'rain'));
  await expect.poll(() => page.evaluate(() => window.game.renderer._look.autumn)).toBeGreaterThan(0.1); // easing in
  await page.evaluate(() => window.game.renderer.setWeather('autumn', 'rain', { instant: true }));
  expect(await page.evaluate(() => window.game.renderer._look)).toMatchObject({ autumn: 1, snowCover: 0, rain: 1 });
  await page.waitForTimeout(1000);
  await testInfo.attach('autumn-rain', { body: await page.screenshot({ path: testInfo.outputPath('autumn-rain.png') }), contentType: 'image/png' });
  // Weather off: back to a clear summer look, nothing falling.
  await page.evaluate(() => window.game.setGraphics({ ...window.game.graphics, weather: false }));
  await expect.poll(() => page.evaluate(() => window.game.renderer.precipitation.drawn), { timeout: 15000 }).toBe(0);
  expect(errors).toEqual([]);
});

test('wildlife: deer and rabbits at the woods edge bolt when startled, birds fly over and scatter, fish jump (screenshot attached)', async ({ page }, testInfo) => {
  const errors = await openGame(page, { map: 'terrain' });
  const wild = () =>
    page.evaluate(() => {
      const w = window.game.renderer.wildlife;
      return { animals: w.visibleAnimals, birds: w.birds.length, scattered: w.birds.filter((b) => b.scatter).length, jumps: w.jumps ?? 0, fled: w.fled ?? 0 };
    });
  await expect.poll(async () => (await wild()).animals, { timeout: 20000 }).toBeGreaterThan(2);
  // Hurry the birds and the fish along.
  await page.evaluate(() => {
    const w = window.game.renderer.wildlife;
    w._birdTimer = 0;
    w._fishTimer = 0;
  });
  await expect.poll(async () => (await wild()).birds).toBeGreaterThan(3);
  await expect.poll(async () => (await wild()).jumps).toBeGreaterThan(0);
  // A close look at one of the animals, then a cannon shot lands by it and next to the birds.
  const animal = await page.evaluate(() => window.game.renderer.wildlife.animals.find((a) => a.state !== 'gone'));
  await zoomTo(page, animal.x, animal.z, 3);
  await testInfo.attach('wildlife', { body: await page.screenshot({ path: testInfo.outputPath('wildlife.png') }), contentType: 'image/png' });
  await page.evaluate(({ x, z }) => {
    const w = window.game.renderer.wildlife;
    w.startle(x, z, 4);
    const b = w.birds[0];
    w.startle(b.x, b.z, 2);
  }, animal);
  const after = await wild();
  expect(after.fled).toBeGreaterThan(0);
  expect(after.scattered).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('main menu: holds the battle at the start; Endless Mode begins it, Continue returns, New Endless Mode loads a new map', async ({ page }) => {
  const errors = await openGame(page, { map: 'terrain', paused: false, query: 'menu=1' });
  const menu = page.locator('#menu');
  await expect(menu).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
  // Held: the build timer doesn't run behind the menu.
  const timer = () => page.evaluate(() => window.game.world.phaseTimer);
  const before = await timer();
  await page.waitForTimeout(600);
  expect(await timer()).toBe(before);

  // The Royal Codex: a card for every tower and every foe.
  await page.getByRole('button', { name: 'The Royal Codex' }).click();
  await expect(page.locator('#codex')).toBeVisible();
  expect(await page.locator('#codex-towers .codex-card').count()).toBe(7);
  expect(await page.locator('#codex-foes .codex-card').count()).toBe(6);
  await page.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'Endless Mode' }).click();
  await expect(menu).toBeHidden();
  // The briefing: what this kind of battle is about. The battle waits until it's read.
  const intro = page.locator('#intro');
  await expect(intro).toBeVisible();
  await expect(page.locator('#intro-title')).toHaveText('Endless Mode: Hold the Hall');
  await expect(intro).toContainText('Town Hall');
  await page.waitForTimeout(300);
  expect(await timer()).toBe(before);
  await page.locator('#intro-again').check(); // not again next time
  await page.getByRole('button', { name: 'To battle!' }).click();
  await expect(intro).toBeHidden();
  await page.waitForTimeout(300);
  expect(await timer()).toBeLessThan(before);
  // Help can bring it back.
  await page.locator('#help-btn').click();
  await page.getByRole('button', { name: "This battle's briefing" }).click();
  await expect(intro).toBeVisible();
  await page.getByRole('button', { name: 'To battle!' }).click();

  // Settings → Main menu, then Continue: the same battle.
  const seed = await page.evaluate(() => window.game.world.seed);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Main menu' }).click();
  await expect(menu).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(menu).toBeHidden();
  expect(await page.evaluate(() => window.game.world.seed)).toBe(seed);

  // New Endless Mode: a new map, behind the loading screen with that map's battle and battleground.
  await page.evaluate(() => {
    window.__loading = [];
    const el = document.getElementById('loading');
    new MutationObserver(() => !el.hidden && window.__loading.push([document.getElementById('loading-wave').textContent, document.getElementById('loading-ground').textContent])).observe(el, { attributes: true });
  });
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Main menu' }).click();
  await page.getByRole('button', { name: 'New Endless Mode' }).click();
  await expect(menu).toBeHidden();
  await expect(page.locator('#intro')).toBeHidden(); // as asked
  expect(await page.evaluate(() => window.game.world.seed)).not.toBe(seed);
  const shown = await page.evaluate(() => window.__loading);
  expect(shown.length).toBeGreaterThan(0);
  expect(shown[0][0]).toMatch(/^Wave 1 — The (Northern|Southern|Eastern|Western)/);
  expect(shown[0][1]).toMatch(/^Battleground outline: The /);
  await expect(page.locator('#loading')).toBeHidden();
  expect(errors).toEqual([]);
});

test('settings: Arrows (ink streak, volley, classic) and Health bars (on hit, while hurt, off)', async ({ page }) => {
  const errors = await openGame(page);
  // A hurt enemy in front of an archer tower that can't harm it.
  await page.evaluate(() => {
    const w = window.game.world;
    w.economy.earn(500);
    const t = w.place('archerTower', 12, 24).building;
    t.def = { ...t.def, attack: { ...t.def.attack, damage: 0.01 } };
    w.phase = 'wave';
    w._spawnEnemy({ type: 'knight', side: 'south', hpMult: 1, elite: false });
    Object.assign(w.enemies[0], { x: 13.5, z: 29.5, tx: 13, tz: 29 });
    w.enemies[0].def = { ...w.enemies[0].def, speed: 0 };
    w.enemies[0].hp -= 50;
  });
  if (await page.evaluate(() => window.game.paused)) await page.evaluate(() => window.game.togglePause());
  const views = () =>
    page.evaluate(() => {
      const r = window.game.renderer;
      return { bars: r.healthBars.count, streaks: [...r.views.projectiles.values()].map((v) => (v.streak ? v.obj.children.length : 0)) };
    });
  const set = (label, option) => page.evaluate(([k, v]) => window.game.setGraphics({ ...window.game.graphics, [k]: v, preset: 'custom' }), [label, option]);
  // Defaults: ink streaks, and a bar for a moment after each hit.
  await expect.poll(async () => (await views()).streaks.some((n) => n === 1)).toBe(true);
  await expect.poll(async () => (await views()).bars).toBeGreaterThan(0);
  await set('arrows', 'volley');
  await expect.poll(async () => (await views()).streaks.some((n) => n === 3)).toBe(true);
  await set('healthBars', 'off');
  await expect.poll(async () => (await views()).bars).toBe(0);
  await set('healthBars', 'hurt');
  await expect.poll(async () => (await views()).bars).toBeGreaterThan(0);
  // The settings menu offers both.
  await page.getByRole('button', { name: 'Settings' }).click();
  await settingButton(page, 'Arrows', 'Classic').click();
  await settingButton(page, 'Health bars', 'Off').click();
  expect(await page.evaluate(() => [window.game.graphics.arrows, window.game.graphics.healthBars])).toEqual(['classic', 'off']);
  expect(errors).toEqual([]);
});

test('barracks: hotkey 6 builds one, it trains men in red who go out to fight enemies near it (screenshot attached)', async ({ page }, testInfo) => {
  const errors = await openGame(page);
  await page.evaluate(() => window.game.world.economy.earn(500));
  await page.keyboard.press('6');
  const p = await tileToScreen(page, 18, 10);
  await page.mouse.click(p.x, p.y);
  await expect.poll(() => buildingAt(page, 18, 10)).toBe('barracks');
  // Its card says how many men it has and when the next is ready.
  await page.mouse.click(p.x, p.y, { button: 'right' }); // out of build mode
  await page.mouse.click(p.x, p.y);
  await expect(page.locator('#info .garrison')).toContainText('0/3 men · next in');
  // Train the garrison at once, then bring an enemy up to the post.
  await page.evaluate(() => {
    const w = window.game.world;
    for (let i = 0; i < 3; i++) {
      for (const b of w.buildings.values()) if (b.def.trains) b.trainTimer = 99;
      w.update(1 / 30);
    }
  });
  await expect(page.locator('#info .garrison')).toContainText('3/3 men · full strength');
  expect(await page.evaluate(() => window.game.world.troops.map((t) => `${t.team} ${t.type}`))).toEqual(['red swordsman', 'red swordsman', 'red archer']);
  await page.evaluate(() => window.game.togglePause());
  await page.evaluate(() => {
    const w = window.game.world;
    const b = w.buildingAt(18, 10);
    w.phase = 'wave';
    w._spawnEnemy({ type: 'swordsman', side: 'north', hpMult: 1, elite: false });
    Object.assign(w.enemies[0], { x: b.post.x + 3.5, z: b.post.z + 0.5, tx: b.post.x + 3, tz: b.post.z, target: null });
    w.enemies[0].def = { ...w.enemies[0].def, speed: 0 };
  });
  await expect.poll(() => page.evaluate(() => window.game.world.troops.some((t) => t.fighting)), { timeout: 20_000 }).toBe(true);
  // Drawn: each soldier has a view, and the red sprites are in the atlas.
  expect(await page.evaluate(() => window.game.renderer.views.troops.size)).toBe(3);
  expect(await page.evaluate(() => Boolean(window.game.renderer.atlas.frame('e:red:swordsman:0:attack:0')))).toBe(true);
  await testInfo.attach('barracks', { body: await page.screenshot(), contentType: 'image/png' });
  await expect.poll(() => page.evaluate(() => window.game.world.enemies.length), { timeout: 30_000 }).toBe(0);
  expect(errors).toEqual([]);
});

test('conquest: castle against castle on the lane map, squads march both ways, blue buildings fly blue, and taking the blue hall wins (screenshot attached)', async ({ page }, testInfo) => {
  const errors = await openGame(page, { query: 'mode=conquest' });
  const info = await page.evaluate(() => {
    const w = window.game.world;
    const teams = {};
    for (const b of w.buildings.values()) teams[b.team] = (teams[b.team] ?? 0) + 1;
    return { mode: w.mode, lanes: w.lanes.length, teams, width: w.grid.width, height: w.grid.height };
  });
  expect(info).toEqual({ mode: 'conquest', lanes: 3, teams: { red: 10, blue: 10 }, width: 72, height: 112 });
  // The camera starts on the player's (south) end.
  const hall = await page.evaluate(() => window.game.world.townHall);
  const p = await tileToScreen(page, hall.x + 1, hall.z + 1);
  const view = page.viewportSize();
  expect(Math.abs(p.x - view.width / 2)).toBeLessThan(view.width / 4);
  expect(Math.abs(p.y - view.height / 2)).toBeLessThan(view.height / 4);
  // The enemy's buildings have their own blue sprites (banners, pennants, lookouts).
  expect(await page.evaluate(() => ['b:townHall:blue', 'b:archerTower:blue', 'b:barracks:blue', 'flag:0:0:blue'].every((k) => window.game.renderer.atlas.frame(k)))).toBe(true);
  // The minimap: shown for Conquest; pressing on the far end of it takes the camera to the blue Town Hall.
  const minimap = page.locator('#minimap');
  await expect(minimap).toBeVisible();
  const target = await page.evaluate(() => {
    const { minimap } = window.game.hud;
    const hall = window.game.world.enemyHall;
    const [x, y] = minimap.project(hall.cx, hall.cz);
    const r = minimap.el.getBoundingClientRect();
    return { x: r.left + x, y: r.top + y };
  });
  await page.mouse.click(target.x, target.y);
  const blue = await page.evaluate(() => window.game.world.enemyHall);
  // (Polled: the camera's matrices catch up on the next frame.)
  await expect
    .poll(async () => {
      const there = await tileToScreen(page, blue.x + 1, blue.z + 1);
      return Math.max(Math.abs(there.x - view.width / 2), Math.abs(there.y - view.height / 2));
    })
    .toBeLessThan(60);
  await page.evaluate(() => {
    const h = window.game.world.townHall;
    window.game.renderer.focusOn(h.cx, h.cz);
  });

  // Building outside your territory (round your Town Hall, and the flags you hold) is refused; in build mode your
  // territory's edge is drawn on the ground.
  expect(await page.evaluate(() => window.game.world.canPlace('archerTower', 20, 30).reason)).toBe('Outside your territory');
  await page.keyboard.press('2');
  await expect.poll(() => page.evaluate(() => window.game.build.territoryRings.filter((r) => r.visible).length)).toBe(1);
  await page.keyboard.press('2');
  // Three flags in the middle of the map, each a pole flying a pale pennant until someone takes it.
  expect(await page.evaluate(() => window.game.world.flags.length)).toBe(3);
  expect(await page.evaluate(() => ['s:flagpole:0', 'flag:0:0:neutral', 'b:flagFort', 'b:flagFort:blue'].filter((k) => !window.game.renderer.atlas.frame(k)))).toEqual([]);
  // The Flag Fort is in the build wheel here (it's Conquest's).
  await expect(page.locator('#buildbar .build-btn:not([hidden])')).toHaveCount(8);

  // Two taps on the wave dial send the first wave early: every Barracks on both sides sends its squad.
  await page.locator('#wave-dial').click();
  await page.locator('#wave-dial').click();
  await expect.poll(() => page.evaluate(() => window.game.world.waves.wave)).toBe(1);
  const squads = await page.evaluate(() => window.game.world.troops.reduce((c, t) => ((c[t.team] = (c[t.team] ?? 0) + 1), c), {}));
  expect(squads.red).toBeGreaterThan(0);
  expect(squads.blue).toBe(squads.red);
  await page.evaluate(() => window.game.togglePause());
  await expect.poll(() => page.evaluate(() => window.game.renderer.views.troops.size)).toBeGreaterThan(0);
  await expect(page.locator('#next-wave')).toContainText('Enemy Town Hall');
  await page.waitForTimeout(1500);
  await testInfo.attach('conquest', { body: await page.screenshot(), contentType: 'image/png' });

  // Heroes: one each side, drawn as crowned elites in their colours. Press G (or the hero cog), then a tile: yours
  // is sent there. Their first ability (button, or Q) then rests.
  await expect(page.locator('#hero-btn')).toBeVisible();
  expect(await page.evaluate(() => ['e:red:knight:0:walk:0', 'e:red:knight:elite:0:walk:0', 'e:red:ram:0:walk:0', 'e:red:mangonel:0:walk:0', 'b:townHall:s2:blue', 'b:archerTower:s3:blue', 'e:red:archer:elite:0:walk:0', 'e:red:pikeman:elite:0:walk:0', 'e:archer:elite:0:walk:0', 'e:neutral:swordsman:0:walk:0', 'e:neutral:archer:0:walk:0'].filter((k) => !window.game.renderer.atlas.frame(k)))).toEqual([]);
  const heroView = await page.evaluate(() => ['red', 'blue'].map((t) => window.game.renderer.views.troops.has(window.game.world.heroes[t].id)));
  expect(heroView).toEqual([true, true]);
  await page.keyboard.press('g');
  expect(await page.evaluate(() => window.game.build.mode)).toBe('hero');
  const spot = await page.evaluate(() => {
    const h = window.game.world.townHall;
    return { x: h.x + 1, z: h.z - 5 };
  });
  const sp = await tileToScreen(page, spot.x, spot.z);
  await page.mouse.click(sp.x, sp.y);
  expect(await page.evaluate(() => window.game.world.heroes.red.order)).toEqual({ x: spot.x + 0.5, z: spot.z + 0.5 });
  await page.locator('#ability-0').click(); // the Knight's war cry
  await expect(page.locator('#ability-0')).toBeDisabled();
  await page.keyboard.press('g'); // done giving orders
  // Hills: the lane map's plateaus have cliffs round them.
  expect(await page.evaluate(() => window.game.world.hills)).toBe(true);

  // An enemy building's card says whose it is, and offers nothing to do.
  await page.evaluate(() => {
    const w = window.game.world;
    const tower = [...w.buildings.values()].find((b) => b.team === 'blue' && b.type === 'archerTower');
    window.game.build.select(tower.id);
  });
  await expect(page.locator('#info h3')).toHaveText('Enemy Archer Tower');
  await expect(page.locator('#sell-selected')).toHaveCount(0);
  await expect(page.locator('#upgrade-selected')).toHaveCount(0);

  // Bring down the blue hall: victory.
  await page.evaluate(() => {
    const w = window.game.world;
    w._damageBuilding(w.enemyHall, 1e6);
  });
  await expect(page.locator('#gameover')).toBeVisible();
  await expect(page.locator('#gameover-title')).toHaveText('Victory! The enemy Town Hall has fallen');
  expect(errors).toEqual([]);
});

test('conquest: the main menu asks for a champion, and the battle begins with them', async ({ page }) => {
  const errors = await openGame(page, { query: 'mode=conquest&menu=1' });
  await page.getByRole('button', { name: /^Conquest/ }).click();
  const pick = page.locator('#hero-pick');
  await expect(pick).toBeVisible();
  await expect(pick.locator('.hero-card')).toHaveCount(3);
  await expect(pick).toContainText('Mira, the Ranger');
  await pick.locator('.hero-card[data-hero="ranger"]').click();
  await expect(page.locator('#menu')).toBeHidden();
  // Conquest's briefing, naming your champion.
  await expect(page.locator('#intro-title')).toHaveText('Conquest: Castle against Castle');
  await expect(page.locator('#intro-heroes')).toContainText('Mira, the Ranger');
  await expect(page.locator('#intro')).toContainText('Flag Fort');
  await page.getByRole('button', { name: 'To battle!' }).click();
  expect(await page.evaluate(() => [window.game.world.mode, window.game.world.heroKinds.red, window.game.world.heroes.red.type])).toEqual(['conquest', 'ranger', 'archer']);
  // Her abilities on the buttons.
  // (The HUD catches up within a few frames; software rendering makes those slow.)
  await expect(page.locator('#ability-0-label')).toHaveText('Volley', { timeout: 20_000 });
  await expect(page.locator('#ability-1-label')).toHaveText('Fleet Foot');
  expect(errors).toEqual([]);
});
