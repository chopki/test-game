import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/World.js';
import { BUILDINGS, ECONOMY } from '../src/sim/config.js';

const DT = 1 / 30;

function runUntil(world, predicate, maxSeconds = 600) {
  for (let t = 0; t < maxSeconds; t += DT) {
    world.update(DT);
    if (predicate()) return true;
  }
  return false;
}

describe('World', () => {
  it('starts with a Town Hall in the middle and starting gold', () => {
    const world = new World({ seed: 1 });
    expect(world.buildings.size).toBe(1);
    expect(world.townHall.type).toBe('townHall');
    expect(world.buildingAt(20, 20)).toBe(world.townHall);
    expect(world.economy.gold).toBe(ECONOMY.startingGold);
  });

  it('validates placement', () => {
    const world = new World({ seed: 1 });
    expect(world.canPlace('wall', 20, 20).ok).toBe(false); // on the hall
    expect(world.canPlace('wall', 0, 10).reason).toMatch(/edge/);
    expect(world.canPlace('townHall', 10, 10).ok).toBe(false);
    expect(world.place('wall', 10, 10).ok).toBe(true);
    expect(world.economy.gold).toBe(ECONOMY.startingGold - BUILDINGS.wall.cost);
    expect(world.canPlace('wall', 10, 10).ok).toBe(false);
  });

  it('refunds part of the cost on sell', () => {
    const world = new World({ seed: 1 });
    const { building } = world.place('archerTower', 10, 10);
    const before = world.economy.gold;
    expect(world.sell(building.id)).toBe(true);
    expect(world.economy.gold).toBe(before + Math.floor(BUILDINGS.archerTower.cost * ECONOMY.sellRefund));
    expect(world.buildingAt(10, 10)).toBeNull();
    expect(world.sell(world.townHall.id)).toBe(false);
  });

  it('auto-starts the first wave after the build phase', () => {
    const world = new World({ seed: 1 });
    expect(runUntil(world, () => world.phase === 'wave', 70)).toBe(true);
    expect(world.waves.wave).toBe(1);
  });

  it('an undefended town eventually falls', () => {
    const world = new World({ seed: 7 });
    let over = null;
    world.events.on('gameOver', (s) => (over = s));
    expect(runUntil(world, () => world.phase === 'gameover', 1200)).toBe(true);
    expect(over).not.toBeNull();
    expect(world.buildings.has(world.townHall.id)).toBe(false);
  });

  it('a defended town clears wave 1 and earns the wave bonus', () => {
    const world = new World({ seed: 3 });
    // Hall occupies 18..20; ring it with archer towers.
    for (const [x, z] of [[15, 15], [22, 15], [15, 22], [22, 22]]) {
      expect(world.place('archerTower', x, z).ok).toBe(true);
    }
    world.startWave();
    let cleared = null;
    world.events.on('waveCleared', (e) => (cleared = e));
    expect(runUntil(world, () => cleared !== null || world.phase === 'gameover', 300)).toBe(true);
    expect(world.phase).toBe('build');
    expect(world.stats.kills).toBeGreaterThan(0);
    expect(cleared.bonus).toBe(ECONOMY.waveBonusBase + ECONOMY.waveBonusPerWave);
  });

  it('enemies break through walls that fully enclose the hall', () => {
    const world = new World({ seed: 5 });
    world.economy.earn(10000);
    // Ring of walls around the hall (hall is 18..20).
    for (let x = 16; x <= 22; x++) {
      for (let z = 16; z <= 22; z++) {
        if (x === 16 || x === 22 || z === 16 || z === 22) expect(world.place('wall', x, z).ok).toBe(true);
      }
    }
    let wallsDestroyed = 0;
    world.events.on('buildingDestroyed', ({ building }) => building.type === 'wall' && wallsDestroyed++);
    world.startWave();
    runUntil(world, () => wallsDestroyed > 0, 300);
    expect(wallsDestroyed).toBeGreaterThan(0);
  });

  it('does not allow building on top of enemies', () => {
    const world = new World({ seed: 9 });
    world.startWave();
    runUntil(world, () => world.enemies.some((e) => !world.grid.isInSpawnZone(e.tx, e.tz)), 60);
    const e = world.enemies.find((en) => !world.grid.isInSpawnZone(en.tx, en.tz));
    expect(world.canPlace('wall', e.tx, e.tz).reason).toMatch(/Enemies/);
  });
});
