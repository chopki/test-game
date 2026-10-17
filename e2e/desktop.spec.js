import { test } from '@playwright/test';
import { buildingAt, buildShowcase, countBuildings, expect, gold, graphicsState, minCanvasAlpha, nearestTerrainTile, openGame, settingButton, tileToScreen, zoomTo } from './helpers.js';

// The Town Hall covers tiles 18–20 on both axes; tiles inside 2..37 are buildable.

test('loads with the HUD and no errors', { tag: '@smoke' }, async ({ page }) => {
  const errors = await openGame(page, { map: 'terrain' });
  await expect(page.locator('#gold')).toHaveText('300');
  await expect(page.locator('#wave')).toHaveText('0');
  await expect(page.locator('#buildbar .build-btn')).toHaveCount(6);
  await expect(page.locator('#next-wave')).toContainText('Wave 1');
  // Shadows and other ground decals must leave the canvas opaque (else they show the page colour through).
  expect(await minCanvasAlpha(page)).toBe(255);
  // Desktops get the double-resolution sprite set.
  expect(await page.evaluate(() => window.game.renderer.atlas.set)).toBe('hd');
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
  // Same wall shapes, three times as many walls: no extra draw calls.
  expect(await calls()).toBeLessThanOrEqual(withSomeWalls + 2);

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
