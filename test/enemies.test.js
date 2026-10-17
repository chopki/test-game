import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/sim/config.js';
import { World } from '../src/sim/World.js';

function tick(world, seconds) {
  for (let t = 0; t < seconds; t += 1 / 30) world.update(1 / 30);
}

/** Put a fresh enemy of `type` at (x, z) without waiting for a wave. */
function addEnemy(world, type, x, z) {
  world._spawnEnemy({ type, side: 'north', hpMult: 1, elite: false });
  const e = world.enemies.at(-1);
  Object.assign(e, { x: x + 0.5, z: z + 0.5, tx: x, tz: z });
  return e;
}

describe('squads', () => {
  it("a squad's men step out side by side on the same edge", () => {
    const world = new World({ seed: 3 });
    world.phase = 'wave';
    for (let i = 0; i < 5; i++) world._spawnEnemy({ type: 'swordsman', side: 'north', squad: 0, hpMult: 1, elite: false });
    const xs = world.enemies.map((e) => e.tx).sort((a, b) => a - b);
    expect(world.enemies.every((e) => e.tz === 0)).toBe(true);
    expect(new Set(xs).size).toBe(5);
    expect(xs.at(-1) - xs[0]).toBe(4); // five neighbouring tiles
  });

  it('a whole wave spawns squad by squad', () => {
    const world = new World({ seed: 5 });
    world.startWave();
    const plan = world.waves.current;
    tick(world, 1);
    const first = plan.entries.filter((e) => e.squad === 0).length;
    expect(world.enemies.length).toBe(first);
    expect(new Set(world.enemies.map((e) => e.squad))).toEqual(new Set([0]));
  });
});

describe('ranged enemies', () => {
  it('archers stop out of reach of melee and shoot the nearest tower', () => {
    const world = new World({ seed: 1 });
    world.phase = 'wave';
    const tower = world.place('archerTower', 18, 12).building;
    tower.def = { ...tower.def, attack: { ...tower.def.attack, damage: 0 } }; // it can't fight back
    const archer = addEnemy(world, 'archer', 19, 3);
    let shots = 0;
    world.events.on('projectileFired', ({ projectile }) => projectile.hostile && shots++);
    tick(world, 12);
    expect(shots).toBeGreaterThan(2);
    expect(archer.attackTargetId).toBe(tower.id);
    expect(tower.hp).toBeLessThan(tower.maxHp);
    // It stopped at its range (5 tiles from the tower's edge), not at the tower.
    expect(world._distanceTo(tower, archer.x, archer.z)).toBeGreaterThan(ENEMIES.archer.ranged.range - 1);
    expect(world._distanceTo(tower, archer.x, archer.z)).toBeLessThanOrEqual(ENEMIES.archer.ranged.range);
  });

  it('siege catapults batter the wall in their way from range', () => {
    const world = new World({ seed: 1 });
    world.phase = 'wave';
    world.economy.earn(2000);
    for (let x = 4; x <= 35; x++) world.place('wall', x, 12);
    const engine = addEnemy(world, 'mangonel', 19, 2);
    tick(world, 25);
    expect(world.buildings.get(engine.attackTargetId)?.type).toBe('wall');
    expect([...world.buildings.values()].some((b) => b.type === 'wall' && b.hp < b.maxHp)).toBe(true);
    // It stays back at its range from the wall (z = 12), well out of reach of the wall's defenders.
    expect(engine.z).toBeLessThan(12 - ENEMIES.mangonel.ranged.range + 1);
  });

  it("enemy shots hurt only the building they're aimed at, never other enemies", () => {
    const world = new World({ seed: 1 });
    world.phase = 'wave';
    const tower = world.place('archerTower', 18, 12).building;
    tower.def = { ...tower.def, attack: { ...tower.def.attack, damage: 0 } };
    const archer = addEnemy(world, 'archer', 19, 4);
    const bystander = addEnemy(world, 'knight', 19, 9); // in the line of fire
    bystander.def = { ...bystander.def, speed: 0 };
    tick(world, 12);
    expect(archer.attackTargetId).toBe(tower.id);
    expect(tower.hp).toBeLessThan(tower.maxHp);
    expect(bystander.hp).toBe(bystander.maxHp);
  });
});

describe('siege', () => {
  it('a battering ram breaks a wall far faster than a swordsman', () => {
    const timeToBreak = (type) => {
      const world = new World({ seed: 2 });
      world.phase = 'wave';
      world.economy.earn(2000);
      for (let x = 4; x <= 35; x++) world.place('wall', x, 12);
      const e = addEnemy(world, type, 19, 11);
      let broken = null;
      world.events.on('buildingDestroyed', () => (broken ??= world.time));
      tick(world, 120);
      return { broken, e };
    };
    const ram = timeToBreak('ram');
    const man = timeToBreak('swordsman');
    expect(ram.broken).not.toBeNull();
    expect(man.broken === null || man.broken > ram.broken * 4).toBe(true);
  });

  it('men are slower than they used to be, and siege engines slowest of all', () => {
    const speeds = Object.values(ENEMIES).map((d) => d.speed);
    expect(Math.max(...speeds)).toBeLessThanOrEqual(1.2);
    for (const def of Object.values(ENEMIES).filter((d) => d.siege)) {
      expect(def.speed).toBeLessThan(Math.min(...Object.values(ENEMIES).filter((d) => !d.siege).map((d) => d.speed)));
    }
  });
});
