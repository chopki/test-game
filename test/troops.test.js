import { describe, expect, it } from 'vitest';
import { BUILDINGS, TROOPS } from '../src/sim/config.js';
import { findPath } from '../src/sim/pathfind.js';
import { troopPassable } from '../src/sim/troops.js';
import { World } from '../src/sim/World.js';

const DT = 1 / 30;
const run = (world, seconds) => {
  for (let t = 0; t < seconds; t += DT) world.update(DT);
};

/** A world with a Barracks at (18, 10), north of the Town Hall, run until its garrison is trained. */
function withBarracks() {
  const world = new World({ seed: 1 });
  world.economy.earn(5000);
  const barracks = world.place('barracks', 18, 10).building;
  const { garrison, every } = BUILDINGS.barracks.trains;
  run(world, garrison * every + 6);
  return { world, barracks };
}

/** Drop an enemy of `type` at (x, z), standing still. */
function enemyAt(world, type, x, z) {
  world.phase = 'wave';
  world._spawnEnemy({ type, side: 'north', hpMult: 1, elite: false });
  const e = world.enemies.at(-1);
  Object.assign(e, { x: x + 0.5, z: z + 0.5, tx: x, tz: z, target: null });
  e.def = { ...e.def, speed: 0 };
  return e;
}

describe('pathfinding', () => {
  it('finds a way round a wall, and none into a walled-in yard', () => {
    const world = new World({ seed: 1 });
    world.economy.earn(5000);
    for (let z = 5; z <= 15; z++) world.place('wall', 10, z);
    const passable = troopPassable(world);
    const path = findPath(world.grid, passable, { x: 8, z: 10 }, { x: 12, z: 10 });
    expect(path.at(-1)).toEqual({ x: 12, z: 10 });
    expect(path.every((t) => passable(t.x, t.z))).toBe(true);
    expect(path.length).toBeGreaterThan(8); // round the end of the wall
    for (const [x, z] of [[4, 4], [5, 4], [6, 4], [4, 5], [6, 5], [4, 6], [5, 6], [6, 6]]) world.place('wall', x, z);
    expect(findPath(world.grid, passable, { x: 8, z: 10 }, { x: 5, z: 5 })).toBeNull();
    expect(findPath(world.grid, passable, { x: 8, z: 10 }, { x: 5, z: 5 }, { near: 2 })).not.toBeNull();
  });
});

describe('barracks', () => {
  it('trains its roster one man at a time, up to its garrison, and they stand at its post', () => {
    const world = new World({ seed: 1 });
    world.economy.earn(5000);
    const b = world.place('barracks', 18, 10).building;
    const { roster, garrison, every } = BUILDINGS.barracks.trains;
    run(world, every - 0.5);
    expect(world.troops.length).toBe(0);
    run(world, 1);
    expect(world.troops.length).toBe(1);
    run(world, garrison * every + 6);
    expect(world.troops.map((t) => t.type)).toEqual(roster.slice(0, garrison));
    expect(world.troops.every((t) => t.team === 'red')).toBe(true);
    // The post lies out from the Barracks, away from the Town Hall (which is to the south).
    expect(b.post.z).toBeLessThan(b.z);
    for (const t of world.troops) expect(Math.hypot(t.x - (b.post.x + 0.5), t.z - (b.post.z + 0.5))).toBeLessThan(0.6);
  });

  it("trains no one when walled in, and its men go when it's sold", () => {
    const { world, barracks } = withBarracks();
    expect(world.troops.length).toBe(3);
    world.sell(barracks.id);
    expect(world.troops.filter((t) => t.alive).length).toBe(0);

    const walled = new World({ seed: 1 });
    walled.economy.earn(5000);
    const b = walled.place('barracks', 18, 10).building;
    for (let x = 17; x <= 20; x++) for (const z of [9, 12]) walled.place('wall', x, z);
    for (const x of [17, 20]) for (const z of [10, 11]) walled.place('wall', x, z);
    run(walled, 30);
    expect(b.door).toBeNull();
    expect(walled.troops.length).toBe(0);
  });
});

describe('troops in battle', () => {
  it('go out to fight an enemy near their post, kill it and walk back', () => {
    const { world, barracks } = withBarracks();
    const e = enemyAt(world, 'swordsman', barracks.post.x + 3, barracks.post.z - 1);
    let fought = false;
    for (let t = 0; t < 30 && e.alive; t += DT) {
      world.update(DT);
      if (e.troopTarget) fought = true;
    }
    expect(e.alive).toBe(false);
    expect(fought).toBe(true); // it turned to fight back
    run(world, 8);
    const post = { x: barracks.post.x + 0.5, z: barracks.post.z + 0.5 };
    for (const t of world.troops) expect(Math.hypot(t.x - post.x, t.z - post.z)).toBeLessThan(0.6);
  });

  it('leave enemies beyond their guard radius alone', () => {
    const { world, barracks } = withBarracks();
    const far = Math.ceil(TROOPS.guardRadius) + 3;
    const e = enemyAt(world, 'swordsman', barracks.post.x + far, barracks.post.z);
    run(world, 5);
    expect(e.hp).toBe(e.maxHp);
    expect(world.troops.every((t) => !t.target)).toBe(true);
  });

  it('can be killed, and the Barracks trains a replacement', () => {
    const { world, barracks } = withBarracks();
    const knight = enemyAt(world, 'knight', barracks.post.x + 1, barracks.post.z);
    knight.hp = knight.maxHp = 100000;
    let killed = 0;
    world.events.on('troopKilled', ({ dismissed }) => !dismissed && killed++);
    for (let t = 0; t < 90 && killed === 0; t += DT) world.update(DT);
    expect(killed).toBeGreaterThan(0);
    knight.alive = false; // out of the way
    run(world, BUILDINGS.barracks.trains.every * 3 + 6);
    expect(barracks.squad.filter((t) => t?.alive).length).toBe(BUILDINGS.barracks.trains.garrison);
  });

  it('enemy archers with nothing else in range shoot soldiers', () => {
    const { world, barracks } = withBarracks();
    const archer = enemyAt(world, 'archer', barracks.post.x + 1, barracks.post.z - 4);
    const hp = () => world.troops.reduce((s, t) => s + t.hp, 0);
    const before = hp();
    let shotAtTroop = false;
    world.events.on('projectileFired', ({ projectile }) => projectile.troop && (shotAtTroop = true));
    for (let t = 0; t < 4 && archer.alive; t += DT) world.update(DT);
    expect(shotAtTroop).toBe(true);
    expect(hp()).toBeLessThanOrEqual(before);
  });
});
