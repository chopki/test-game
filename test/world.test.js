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
    const hits = [];
    world.events.on('buildingDestroyed', ({ building }) => building.type === 'wall' && wallsDestroyed++);
    world.events.on('buildingHit', (hit) => hits.push(hit));
    world.startWave();
    runUntil(world, () => wallsDestroyed > 0, 300);
    expect(wallsDestroyed).toBeGreaterThan(0);
    // Each blow is reported with where it came from (for the renderer's dust and splinters), next to the wall.
    expect(hits.length).toBeGreaterThan(0);
    const { building, x, z } = hits[0];
    expect(Math.hypot(x - building.cx, z - building.cz)).toBeLessThan(2);
  });

  it('does not allow building on top of enemies', () => {
    const world = new World({ seed: 9 });
    world.startWave();
    runUntil(world, () => world.enemies.some((e) => !world.grid.isInSpawnZone(e.tx, e.tz)), 60);
    const e = world.enemies.find((en) => !world.grid.isInSpawnZone(en.tx, en.tz));
    expect(world.canPlace('wall', e.tx, e.tz).reason).toMatch(/Enemies/);
  });
});

describe('building towers into walls', () => {
  const wallLine = (world, z, x0, x1) => {
    for (let x = x0; x <= x1; x++) expect(world.place('wall', x, z).ok).toBe(true);
  };

  it('a tower can be built over the middle of a wall line, replacing the walls it covers', () => {
    const world = new World({ seed: 1 });
    world.economy.earn(1000);
    wallLine(world, 10, 6, 14);
    const before = world.economy.gold;
    const check = world.canPlace('archerTower', 9, 9); // covers (9..10, 9..10): two wall tiles
    expect(check.ok).toBe(true);
    expect(check.replaces).toHaveLength(2);
    const refund = 2 * world.sellValue(world.buildingAt(9, 10));
    expect(world.place('archerTower', 9, 9).ok).toBe(true);
    expect(world.buildingAt(9, 10).type).toBe('archerTower');
    expect(world.buildingAt(10, 10).type).toBe('archerTower');
    // The rest of the line stays, on both sides.
    expect(world.buildingAt(8, 10).type).toBe('wall');
    expect(world.buildingAt(11, 10).type).toBe('wall');
    expect([...world.buildings.values()].filter((b) => b.type === 'wall')).toHaveLength(7);
    expect(world.economy.gold).toBe(before + refund - BUILDINGS.archerTower.cost);
  });

  it('the walls being replaced count towards the cost', () => {
    const world = new World({ seed: 1 });
    wallLine(world, 10, 9, 10);
    world.economy.spend(world.economy.gold - (BUILDINGS.archerTower.cost - 1));
    expect(world.canPlace('archerTower', 9, 9).ok).toBe(true); // 1 gold short, but the walls refund more
    world.economy.spend(world.economy.gold);
    expect(world.canPlace('archerTower', 9, 9).reason).toBe('Not enough gold');
  });

  it('cannot replace other towers, the Town Hall, or build walls over walls', () => {
    const world = new World({ seed: 1 });
    world.economy.earn(1000);
    wallLine(world, 10, 6, 14);
    world.place('archerTower', 12, 11);
    expect(world.canPlace('cannonTower', 12, 10).reason).toBe('Space is occupied'); // wall + tower
    expect(world.canPlace('archerTower', 17, 17).reason).toBe('Space is occupied'); // hall
    expect(world.canPlace('wall', 8, 10).reason).toBe('Space is occupied');
  });
});

describe('towers snap into walls', () => {
  const walls = (world, tiles) => {
    world.economy.earn(2000);
    for (const [x, z] of tiles) expect(world.place('wall', x, z).ok).toBe(true);
  };
  const footprint = (a, size = 2) => {
    const out = [];
    for (let dz = 0; dz < size; dz++) for (let dx = 0; dx < size; dx++) out.push(`${a.x + dx},${a.z + dz}`);
    return out;
  };

  it('on a straight run, the tower sits across the line with the wall carrying on from both sides', () => {
    const world = new World({ seed: 1 });
    walls(world, [6, 7, 8, 9, 10, 11, 12].map((x) => [x, 8])); // north of the hall (hall is 18–20)
    for (const hoverX of [8, 9, 10]) {
      const a = world.anchorFor('archerTower', hoverX, 8);
      const tiles = footprint(a);
      expect(tiles).toContain(`${hoverX},8`); // covers the hovered wall tile
      // Two wall tiles of the line inside, wall continuing on both sides.
      expect(tiles.filter((t) => t.endsWith(',8'))).toHaveLength(2);
      expect(world.buildingAt(a.x - 1, 8)?.type).toBe('wall');
      expect(world.buildingAt(a.x + 2, 8)?.type).toBe('wall');
      expect(a.z).toBe(8); // the second row is on the hall's side of the wall
    }
  });

  it('at a corner, the tower takes the corner so both arms join it', () => {
    const world = new World({ seed: 1 });
    // An L: along z = 8 from x 6–12, then down x = 12 to z 14 (corner at 12, 8).
    walls(world, [...[6, 7, 8, 9, 10, 11, 12].map((x) => [x, 8]), ...[9, 10, 11, 12, 13, 14].map((z) => [12, z])]);
    const a = world.anchorFor('cannonTower', 12, 8);
    expect(footprint(a)).toContain('12,8');
    expect(world.buildingAt(a.x - 1, 8)?.type).toBe('wall'); // west arm joins
    expect(world.buildingAt(12, a.z + 2)?.type).toBe('wall'); // south arm joins
    expect(world.place('cannonTower', a.x, a.z).ok).toBe(true);
  });

  it('only snaps when hovering a wall', () => {
    const world = new World({ seed: 1 });
    walls(world, [[8, 8], [9, 8], [10, 8]]);
    expect(world.anchorFor('archerTower', 9, 10)).toEqual({ x: 9, z: 10 });
  });
});
