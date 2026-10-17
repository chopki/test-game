import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/World.js';
import { BUILDINGS, GRID, TERRAIN } from '../src/sim/config.js';
import { analyzeTerrain, blocksMovement, generateMap, generateTerrain, openTerrain, T } from '../src/sim/terrain.js';
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
  world._spawnEnemy({ type: 'swordsman', side, hpMult: 1, elite: false });
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
      world._spawnEnemy({ type: 'swordsman', side: 'north', hpMult: 1, elite: false });
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

describe('coast', () => {
  const SEEDS = Array.from({ length: 60 }, (_, i) => i * 104729 + 7);
  const SIDES = ['north', 'south', 'west', 'east'];

  it('coastal maps meet the map rules, with sea along the coast and a beach behind it', () => {
    for (const coast of SIDES) {
      for (const seed of SEEDS.slice(0, 25)) {
        const types = generateTerrain({ ...mapInfo, rng: createRng(seed), coast });
        const stats = analyzeTerrain(types, mapInfo);
        const where = `seed ${seed}, coast ${coast}`;
        expect(stats.unreachable, where).toBe(0);
        expect(stats.pinches, where).toBe(0);
        expect(stats.openFraction, where).toBeGreaterThanOrEqual(TERRAIN.minOpenFraction);
        expect(stats.coast, where).toEqual([coast]);
        expect(stats.spawnTiles[coast], where).toBe(0);
        for (const side of SIDES.filter((s) => s !== coast)) expect(stats.spawnTiles[side], where).toBeGreaterThanOrEqual(TERRAIN.minSpawnTilesPerSide);
        expect(types.includes(T.sand), where).toBe(true);
        const c = hall.x + size / 2;
        for (let z = 0; z < H; z++) {
          for (let x = 0; x < W; x++) {
            if (Math.hypot(x + 0.5 - c, z + 0.5 - c) <= TERRAIN.clearingRadius) expect(types[z * W + x], where).toBe(T.open);
          }
        }
      }
    }
  });

  it('the sea blocks enemies and building; the beach is open ground', () => {
    const world = new World({ seed: 3, terrain: 'generate', sea: true });
    const g = world.grid;
    const at = (t) => g.terrain.findIndex((v) => v === t);
    const sea = at(T.sea);
    const sand = at(T.sand);
    expect(g.isBlocked(sea % W, (sea / W) | 0)).toBe(true);
    expect(g.isBuildable(sea % W, (sea / W) | 0)).toBe(false);
    expect(g.isBlocked(sand % W, (sand / W) | 0)).toBe(false);
  });

  it('no attacks come from the sea', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const world = new World({ seed, terrain: 'generate', sea: true });
      expect(world.coast, `seed ${seed}`).not.toBeNull();
      expect(world.spawnTiles[world.coast]).toHaveLength(0);
      for (let n = 1; n <= 12; n++) {
        world.startWave();
        expect(world.waves.current.sides, `seed ${seed} wave ${n}`).not.toContain(world.coast);
        world.waves.queue = [];
        world.enemies = [];
        world.update(0.01);
      }
    }
  });

  it("sometimes a map has a coast, and a map without one is the same as before", () => {
    let coasts = 0;
    for (let seed = 1; seed <= 80; seed++) {
      const world = new World({ seed, terrain: 'generate', sea: 'sometimes' });
      if (world.coast) coasts++;
      else expect(world.grid.terrain).toEqual(new World({ seed, terrain: 'generate' }).grid.terrain);
    }
    expect(coasts / 80).toBeGreaterThan(TERRAIN.sea.chance - 0.15);
    expect(coasts / 80).toBeLessThan(TERRAIN.sea.chance + 0.15);
  });
});

describe('map sizes', () => {
  for (const [name, size] of Object.entries(GRID.sizes)) {
    it(`${name} maps (${size} tiles) meet the map rules, with and without a coast`, () => {
      const s = BUILDINGS.townHall.size;
      const hallAt = { x: Math.floor((size - s) / 2), z: Math.floor((size - s) / 2), size: s };
      const info = { width: size, height: size, spawnMargin: GRID.spawnMargin, hall: hallAt };
      const started = performance.now();
      for (let seed = 1; seed <= 16; seed++) {
        const coast = seed % 2 ? null : ['north', 'south', 'west', 'east'][seed % 4];
        const types = generateTerrain({ ...info, rng: createRng(seed * 31), coast });
        const stats = analyzeTerrain(types, info);
        const where = `${name}, seed ${seed}, coast ${coast}`;
        expect(stats.unreachable, where).toBe(0);
        expect(stats.pinches, where).toBe(0);
        expect(stats.openFraction, where).toBeGreaterThanOrEqual(TERRAIN.minOpenFraction);
        for (const [side, n] of Object.entries(stats.spawnTiles)) if (side !== coast) expect(n, where).toBeGreaterThanOrEqual(TERRAIN.minSpawnTilesPerSide);
      }
      expect((performance.now() - started) / 16).toBeLessThan(120);
    });
  }

  it('a world of any size centres the Town Hall, and its waves still reach it', () => {
    const world = new World({ seed: 5, terrain: 'generate', size: GRID.sizes.large, fort: true });
    expect(world.grid.width).toBe(GRID.sizes.large);
    expect(Math.abs(world.townHall.cx - GRID.sizes.large / 2)).toBeLessThanOrEqual(0.5); // a 3-tile hall on an even map
    world.startWave();
    let hit = false;
    for (let t = 0; t < 300 && !hit; t += DT) {
      world.update(DT);
      hit = [...world.buildings.values()].some((b) => b.hp < b.maxHp);
    }
    expect(hit).toBe(true);
  });
});

describe('hills', () => {
  const SEEDS = Array.from({ length: 40 }, (_, i) => i * 6007 + 3);
  const hilly = (seed, extra = {}) => generateMap({ ...mapInfo, rng: createRng(seed), hillsRng: createRng(seed ^ 77), ...extra });
  const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

  it('hilly maps meet the map rules; walkable ground of different levels only meets at a ramp', () => {
    let plateaus = 0;
    for (const seed of SEEDS) {
      const { types, levels } = hilly(seed);
      const stats = analyzeTerrain(types, mapInfo);
      const where = `seed ${seed}`;
      expect(stats.unreachable, where).toBe(0);
      expect(stats.pinches, where).toBe(0);
      expect(stats.openFraction, where).toBeGreaterThanOrEqual(TERRAIN.minOpenFraction);
      for (const n of Object.values(stats.spawnTiles)) expect(n, where).toBeGreaterThanOrEqual(TERRAIN.minSpawnTilesPerSide);
      if (levels.some((l) => l > 0)) plateaus++;
      for (let z = 0; z < H; z++) {
        for (let x = 0; x < W; x++) {
          const i = z * W + x;
          if (blocksMovement(types[i]) || types[i] === T.ramp) continue;
          for (const [dx, dz] of N8) {
            const nx = x + dx;
            const nz = z + dz;
            if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
            const j = nz * W + nx;
            if (blocksMovement(types[j]) || types[j] === T.ramp) continue;
            expect(levels[j], `${where} at ${x},${z}`).toBe(levels[i]);
          }
          // Levels change one step at a time, and the hall's clearing and the water stay at the bottom.
          if (types[i] === T.water || types[i] === T.ford) expect(levels[i], where).toBe(0);
        }
      }
      const c = hall.x + size / 2;
      for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) if (Math.hypot(x + 0.5 - c, z + 0.5 - c) <= TERRAIN.clearingRadius) expect(levels[z * W + x], where).toBe(0);
    }
    expect(plateaus / SEEDS.length).toBeGreaterThan(0.6);
  });

  it('ramps lead up onto the plateaus', () => {
    let ramps = 0;
    for (const seed of SEEDS) ramps += [...hilly(seed).types].filter((t) => t === T.ramp).length;
    expect(ramps).toBeGreaterThan(SEEDS.length);
  });

  it('a map without hills is just as it was', () => {
    for (const seed of SEEDS.slice(0, 10)) expect(generateMap({ ...mapInfo, rng: createRng(seed) }).types).toEqual(generateTerrain({ ...mapInfo, rng: createRng(seed) }));
    for (let seed = 1; seed <= 30; seed++) {
      const world = new World({ seed, terrain: 'generate', hills: 'sometimes' });
      if (!world.hills) expect(world.grid.terrain, `seed ${seed}`).toEqual(new World({ seed, terrain: 'generate' }).grid.terrain);
    }
  });

  it('towers gain range on high ground; buildings need level ground; ramps slow enemies', () => {
    const levels = new Uint8Array(W * H);
    const types = customMap((set) => {
      // A level-1 plateau from x 4 to 13, z 4 to 13, with its rim of cliff and a ramp on the south side.
      for (let z = 4; z <= 13; z++) for (let x = 4; x <= 13; x++) levels[z * W + x] = 1;
      for (let i = 4; i <= 13; i++) for (const [x, z] of [[i, 4], [i, 13], [4, i], [13, i]]) set(x, z, T.cliff);
      set(8, 13, T.ramp);
      set(9, 13, T.ramp);
    });
    const world = new World({ seed: 1, terrain: types });
    world.grid.levels = levels;
    expect(world.rangeAt('archerTower', 7, 7)).toBe(BUILDINGS.archerTower.attack.range + TERRAIN.hills.rangePerLevel);
    expect(world.rangeAt('archerTower', 20, 20)).toBe(BUILDINGS.archerTower.attack.range);
    world.economy.earn(1000);
    expect(world.place('archerTower', 7, 7).ok).toBe(true);
    expect(world.rangeOf(world.buildingAt(7, 7))).toBe(BUILDINGS.archerTower.attack.range + 1);
    // A footprint across the plateau's edge can't be built (the rim is cliff, and the levels differ anyway).
    expect(world.canPlace('archerTower', 12, 7).ok).toBe(false);
    expect(world.grid.isBlocked(4, 8)).toBe(true);
    expect(world.grid.isBlocked(8, 13)).toBe(false);
  });

  it('arrows shot up at higher ground come slower; shooting down is not slowed', () => {
    const levels = new Uint8Array(W * H);
    const types = customMap((set) => {
      for (let z = 4; z <= 13; z++) for (let x = 4; x <= 13; x++) levels[z * W + x] = 1;
      for (let i = 4; i <= 13; i++) for (const [x, z] of [[i, 4], [i, 13], [4, i], [13, i]]) set(x, z, T.cliff);
      set(8, 13, T.ramp);
      set(9, 13, T.ramp);
    });
    const shots = (enemyAt, towerAt) => {
      const world = new World({ seed: 1, terrain: types });
      world.grid.levels = levels;
      world.hills = true;
      world.phase = 'wave';
      world.economy.earn(1000);
      const tower = world.place('archerTower', ...towerAt).building;
      tower.def = { ...tower.def, attack: { ...tower.def.attack, damage: 0 } };
      world._spawnEnemy({ type: 'knight', side: 'north', hpMult: 1, elite: false });
      const e = world.enemies.at(-1);
      Object.assign(e, { x: enemyAt[0] + 0.5, z: enemyAt[1] + 0.5, tx: enemyAt[0], tz: enemyAt[1] });
      e.def = { ...e.def, speed: 0 };
      let n = 0;
      world.events.on('projectileFired', ({ projectile }) => !projectile.hostile && n++);
      for (let t = 0; t < 20; t += DT) world.update(DT);
      return n;
    };
    const level = shots([17, 9], [15, 7]); // both on the low ground
    const up = shots([10, 9], [15, 7]); // the enemy up on the plateau
    const down = shots([17, 9], [11, 7]); // the tower up on the plateau
    expect(up / level).toBeCloseTo(1 / (1 + TERRAIN.hills.uphillReload), 1);
    expect(down).toBe(level);
  });

  it('a hilly world can still be played: waves reach the hall', () => {
    const world = new World({ seed: 9, terrain: 'generate', hills: true, size: GRID.sizes.medium });
    expect(world.grid.levels.some((l) => l > 0)).toBe(true);
    world.startWave();
    let hit = false;
    for (let t = 0; t < 300 && !hit; t += DT) {
      world.update(DT);
      for (const e of world.enemies) expect(world.grid.isBlocked(e.tx, e.tz)).toBe(false);
      hit = world.townHall.hp < world.townHall.maxHp;
    }
    expect(hit).toBe(true);
  });
});

describe('ground height', () => {
  it('is flat on each level and slopes down a ramp', async () => {
    const { groundHeight } = await import('../src/sim/terrain.js');
    const levels = new Uint8Array(W * H);
    const types = customMap((set) => {
      for (let z = 4; z <= 13; z++) for (let x = 4; x <= 13; x++) levels[z * W + x] = 1;
      for (let i = 4; i <= 13; i++) for (const [x, z] of [[i, 4], [i, 13], [4, i], [13, i]]) set(x, z, T.cliff);
      set(8, 13, T.ramp);
      set(9, 13, T.ramp);
    });
    const world = new World({ seed: 1, terrain: types });
    world.grid.levels = levels;
    const h = TERRAIN.hills.levelHeight;
    expect(groundHeight(world.grid, 7.5, 7.5)).toBe(h);
    expect(groundHeight(world.grid, 20.5, 20.5)).toBe(0);
    // The ramp at z = 13 runs down to the south (z = 14 is the ground below).
    expect(groundHeight(world.grid, 8.5, 13.0)).toBeCloseTo(h);
    expect(groundHeight(world.grid, 8.5, 13.5)).toBeCloseTo(h / 2);
    expect(groundHeight(world.grid, 8.5, 13.999)).toBeCloseTo(0, 2);
  });
});
