import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/World.js';

/** Put a fresh enemy of `type` at (x, z) without waiting for a wave. */
function addEnemy(world, type, x, z) {
  world._spawnEnemy({ type, side: 'north', hpMult: 1, elite: false });
  const e = world.enemies.at(-1);
  Object.assign(e, { x: x + 0.5, z: z + 0.5, tx: x, tz: z });
  return e;
}

function tick(world, seconds) {
  for (let t = 0; t < seconds; t += 1 / 30) world.update(1 / 30);
}

describe('Magic Spire', () => {
  it('damages and slows every enemy in range at once, but not those outside it', () => {
    const world = new World({ seed: 1 });
    world.phase = 'wave'; // enemies are placed by hand
    world.place('magicSpire', 10, 10); // centre (11, 11), range 3.5
    const a = addEnemy(world, 'brute', 11, 9);
    const b = addEnemy(world, 'brute', 12, 12);
    const far = addEnemy(world, 'brute', 11, 16);
    let pulses = 0;
    world.events.on('towerPulse', () => pulses++);
    tick(world, 0.1);
    expect(pulses).toBe(1);
    expect(a.hp).toBeLessThan(a.maxHp);
    expect(b.hp).toBeLessThan(b.maxHp);
    expect(far.hp).toBe(far.maxHp);
    expect(a.slowFactor).toBe(0.6);
    expect(far.slowFactor).toBe(1);
  });

  it('slowed enemies move slower, and recover when the slow wears off', () => {
    const world = new World({ seed: 1 });
    world.phase = 'wave';
    const e = addEnemy(world, 'grunt', 5, 10);
    world._slowEnemy(e, { factor: 0.5, duration: 1 });
    const x0 = e.x;
    tick(world, 0.5);
    const slowDist = Math.abs(e.x - x0) + Math.abs(e.z - 10.5);
    expect(slowDist).toBeLessThan(e.def.speed * 0.5 * 0.5 + 0.3);
    tick(world, 1);
    expect(e.slowFactor).toBe(1);
  });
});

describe('Catapult', () => {
  it('cannot target enemies inside its minimum range', () => {
    const world = new World({ seed: 1 });
    world.phase = 'wave';
    world.place('catapult', 10, 10); // centre (11, 11), min range 3
    const close = addEnemy(world, 'brute', 12, 12);
    close.def = { ...close.def, speed: 0 }; // keep it still
    let fired = 0;
    world.events.on('projectileFired', () => fired++);
    tick(world, 0.5);
    expect(fired).toBe(0);
    addEnemy(world, 'brute', 11, 17).def = { ...close.def };
    tick(world, 0.2);
    expect(fired).toBe(1);
  });

  it('boulders deal splash damage where they land', () => {
    const world = new World({ seed: 1 });
    world.phase = 'wave';
    world.place('catapult', 10, 10);
    const still = (e) => (e.def = { ...e.def, speed: 0 });
    const a = still(addEnemy(world, 'brute', 11, 18)) && world.enemies.at(-1);
    const b = still(addEnemy(world, 'brute', 12, 18)) && world.enemies.at(-1);
    tick(world, 3);
    expect(a.hp).toBeLessThan(a.maxHp);
    expect(b.hp).toBeLessThan(b.maxHp);
  });
});

describe('waves', () => {
  it('Orc Warriors start appearing from wave 3', () => {
    const world = new World({ seed: 4 });
    const types = new Set();
    for (let n = 0; n < 6; n++) {
      world.startWave();
      for (const e of world.waves.current.entries) types.add(e.type);
      world.waves.queue = [];
      world.enemies = [];
      world.update(0.01);
    }
    expect(types.has('orc')).toBe(true);
  });
});
