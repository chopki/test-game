import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/World.js';
import { BUILDINGS, GRID, TERRAIN } from '../src/sim/config.js';
import { analyzeTerrain, generateTerrain, openTerrain, T } from '../src/sim/terrain.js';
import { createRng } from '../src/sim/rng.js';

const DT = 1 / 30;
const W = GRID.width;
const H = GRID.height;
const size = BUILDINGS.townHall.size;
const hall = { x: Math.floor((W - size) / 2), z: Math.floor((H - size) / 2), size };
const mapInfo = { width: W, height: H, spawnMargin: GRID.spawnMargin, hall };

/** A hand-made map: an open map with `paint(set)` applied. */
function customMap(paint) {
  const types = openTerrain(W, H);
  paint((x, z, t) => (types[z * W + x] = t));
  return types;
}

/** Spawn one enemy from `side` with the given type and step the world until it dies or `seconds` pass. */
function walkEnemy(world, side, seconds, onStep) {
  world.phase = 'wave';
  world._spawnEnemy({ type: 'grunt', side, hpMult: 1, elite: false });
  const e = world.enemies.at(-1);
  for (let t = 0; t < seconds && e.alive && world.phase !== 'gameover'; t += DT) {
    world._updateEnemy(e, DT);
    onStep?.(e);
  }
  return e;
}

describe('terrain rules', () => {
  it('water, rock and forest cannot be built on; fords cannot either', () => {
    const terrain = customMap((set) => {
      set(10, 10, T.water);
      set(11, 10, T.rock);
      set(12, 10, T.forest);
      set(13, 10, T.ford);
    });
    const world = new World({ seed: 1, terrain });
    for (const x of [10, 11, 12, 13]) expect(world.canPlace('wall', x, 10).reason).toBe('Blocked by terrain');
    // A 2×2 tower overlapping one terrain tile is refused too.
    expect(world.canPlace('archerTower', 9, 9).reason).toBe('Blocked by terrain');
    expect(world.canPlace('wall', 14, 10).ok).toBe(true);
  });

  it('a wall plan across terrain marks those tiles blocked', () => {
    const terrain = customMap((set) => set(12, 8, T.rock));
    const world = new World({ seed: 1, terrain });
    const plan = world.planWall({ x: 10, z: 8 }, { x: 14, z: 8 });
    expect(plan.tiles.find((t) => t.x === 12).reason).toBe('Blocked by terrain');
    expect(plan.count).toBe(4);
  });

  it('enemies route around a lake and never step on blocking terrain', () => {
    // A long lake across the north approach, with open ground at both ends.
    const terrain = customMap((set) => {
      for (let x = 6; x <= 33; x++) for (let z = 8; z <= 10; z++) set(x, z, T.water);
    });
    const world = new World({ seed: 4, terrain });
    world.spawnTiles.north = [[20, 0]];
    const visited = new Set();
    const e = walkEnemy(world, 'north', 60, (en) => visited.add(`${en.tx},${en.tz}`));
    expect(world.townHall.hp).toBeLessThan(world.townHall.maxHp); // it got there
    for (const key of visited) {
      const [x, z] = key.split(',').map(Number);
      expect(world.grid.isBlocked(x, z)).toBe(false);
    }
    expect([...visited].some((k) => Number(k.split(',')[0]) < 6 || Number(k.split(',')[0]) > 33)).toBe(true);
    expect(e).toBeTruthy();
  });

  it('enemies wade through a ford, more slowly than on open ground', () => {
    const timeToHall = (fords) => {
      const terrain = customMap((set) => {
        for (let x = 0; x < W; x++) for (let z = 8; z <= 9; z++) set(x, z, fords ? T.ford : T.open);
      });
      const world = new World({ seed: 4, terrain });
      world.spawnTiles.north = [[20, 0]];
      world.phase = 'wave';
      world._spawnEnemy({ type: 'grunt', side: 'north', hpMult: 1, elite: false });
      const e = world.enemies.at(-1);
      let t = 0;
      while (e.attackTargetId === null && t < 60) {
        world._updateEnemy(e, DT);
        t += DT;
      }
      return t;
    };
    expect(timeToHall(true)).toBeGreaterThan(timeToHall(false) + 0.3);
  });

  it('enemies cannot squeeze diagonally between two rocks', () => {
    const terrain = customMap((set) => {
      set(10, 10, T.rock);
      set(11, 11, T.rock);
    });
    const world = new World({ seed: 1, terrain });
    expect(world.flow.canStep(10, 11, 11, 10)).toBe(false);
    expect(world.flow.canStep(11, 10, 10, 11)).toBe(false);
  });

  it('enemies only spawn on walkable edge tiles that reach the hall', () => {
    // Forest along most of the west edge; a lake cut off behind rocks on the north edge.
    const terrain = customMap((set) => {
      for (let z = 0; z < H; z++) if (z < 15 || z > 18) for (let x = 0; x < 3; x++) set(x, z, T.forest);
      for (let x = 5; x < 35; x++) set(x, 0, T.water);
    });
    const world = new World({ seed: 9, terrain });
    world.phase = 'wave';
    for (let i = 0; i < 40; i++) {
      for (const side of ['north', 'west']) {
        const [x, z] = world._spawnTile(side);
        expect(world.grid.isBlocked(x, z)).toBe(false);
      }
    }
    expect(world.spawnTiles.west.every(([, z]) => z >= 15 && z <= 18)).toBe(true);
  });

  it('an open map spawns along the whole edge as before', () => {
    const world = new World({ seed: 1 });
    expect(world.spawnTiles.north.length).toBe(W - 2 * GRID.spawnMargin);
  });
});

describe('terrain generator', () => {
  const generate = (seed) => generateTerrain({ ...mapInfo, rng: createRng(seed) });
  const SEEDS = Array.from({ length: 200 }, (_, i) => i * 7919 + 13);

  it('is deterministic for a seed', () => {
    expect(generate(42)).toEqual(generate(42));
    expect(generate(42)).not.toEqual(generate(43));
  });

  it('meets the map rules on every seed', () => {
    for (const seed of SEEDS) {
      const types = generate(seed);
      const stats = analyzeTerrain(types, mapInfo);
      const where = `seed ${seed}`;
      expect(stats.unreachable, where).toBe(0);
      expect(stats.pinches, where).toBe(0);
      expect(stats.openFraction, where).toBeGreaterThanOrEqual(TERRAIN.minOpenFraction);
      for (const n of Object.values(stats.spawnTiles)) expect(n, where).toBeGreaterThanOrEqual(TERRAIN.minSpawnTilesPerSide);
      // The Town Hall's clearing is open.
      const c = hall.x + size / 2;
      for (let z = 0; z < H; z++) {
        for (let x = 0; x < W; x++) {
          if (Math.hypot(x + 0.5 - c, z + 0.5 - c) <= TERRAIN.clearingRadius) expect(types[z * W + x], where).toBe(T.open);
        }
      }
    }
  });

  it('produces varied maps: forest, rock and water all appear across seeds', () => {
    const totals = [0, 0, 0, 0, 0];
    for (const seed of SEEDS.slice(0, 40)) for (const t of generate(seed)) totals[t]++;
    expect(totals[T.forest]).toBeGreaterThan(0);
    expect(totals[T.rock]).toBeGreaterThan(0);
    expect(totals[T.water]).toBeGreaterThan(0);
    expect(totals[T.ford]).toBeGreaterThan(0);
  });

  it('is fast enough to run at the start of every game', () => {
    const started = performance.now();
    for (const seed of SEEDS.slice(0, 20)) generate(seed);
    expect((performance.now() - started) / 20).toBeLessThan(50);
  });

  it("a generated world's waves can still reach and damage the hall", () => {
    const world = new World({ seed: 5, terrain: 'generate' });
    world.startWave();
    let hit = false;
    for (let t = 0; t < 240 && !hit; t += DT) {
      world.update(DT);
      for (const e of world.enemies) expect(world.grid.isBlocked(e.tx, e.tz)).toBe(false);
      hit = world.townHall.hp < world.townHall.maxHp;
    }
    expect(hit).toBe(true);
  });
});

describe('rivers', () => {
  // A stream runs off the map at both ends, so it reaches two opposite edges of the map.
  const hasStream = (world) => {
    const g = world.grid;
    const wet = (x, z) => [T.water, T.ford].includes(g.terrain[z * g.width + x]);
    const row = (z) => Array.from({ length: g.width }, (_, x) => wet(x, z)).some(Boolean);
    const col = (x) => Array.from({ length: g.height }, (_, z) => wet(x, z)).some(Boolean);
    return (row(0) && row(g.height - 1)) || (col(0) && col(g.width - 1));
  };

  it('most generated maps have a stream', () => {
    let streams = 0;
    for (let seed = 1; seed <= 60; seed++) if (hasStream(new World({ seed, terrain: 'generate' }))) streams++;
    expect(streams / 60).toBeGreaterThan(0.5);
  });

  it('asking for a river always gives one', () => {
    for (let seed = 1; seed <= 40; seed++) expect(hasStream(new World({ seed, terrain: 'generate', river: true })), `seed ${seed}`).toBe(true);
  });
});
