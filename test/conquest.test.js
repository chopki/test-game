import { describe, expect, it } from 'vitest';
import { BUILDINGS, CONQUEST, TROOPS } from '../src/sim/config.js';
import { squadFor } from '../src/sim/conquest.js';
import { blocksMovement, T } from '../src/sim/terrain.js';
import { findPath } from '../src/sim/pathfind.js';
import { World } from '../src/sim/World.js';

const DT = 1 / 30;
const conquest = (seed = 1) => new World({ seed, mode: 'conquest' });
const run = (world, seconds) => {
  for (let t = 0; t < seconds && world.phase !== 'gameover'; t += DT) world.update(DT);
};
const teamBuildings = (world, team) => [...world.buildings.values()].filter((b) => b.team === team);

describe('conquest map', () => {
  for (const seed of [1, 2, 3, 4]) {
    it(`map ${seed}: mirrored end to end, with three lanes that join the two Town Halls`, () => {
      const world = conquest(seed);
      const g = world.grid;
      expect([g.width, g.height]).toEqual([CONQUEST.width, CONQUEST.height]);
      for (let z = 0; z < g.height; z++) {
        for (let x = 0; x < g.width; x++) expect(g.terrainAt(x, z)).toBe(g.terrainAt(g.width - 1 - x, g.height - 1 - z));
      }
      expect(world.lanes.map((l) => l.name)).toEqual(['west', 'middle', 'east']);
      const walk = (x, z) => !blocksMovement(g.terrainAt(x, z));
      const red = { x: world.townHall.x + 1, z: world.townHall.z + 3 };
      for (const lane of world.lanes) {
        // Every waypoint is on open ground (or a ford), and each can be walked to from the last.
        for (const p of lane.points) expect(walk(p.x, p.z), `${lane.name} ${p.x},${p.z}`).toBe(true);
        for (let i = 1; i < lane.points.length; i++) {
          const path = findPath(g, walk, lane.points[i - 1], lane.points[i], { maxNodes: 2000 });
          expect(path, `${lane.name} ${i}`).not.toBeNull();
          // ...along the lane, not round by another.
          expect(path.length).toBeLessThan(Math.hypot(lane.points[i].x - lane.points[i - 1].x, lane.points[i].z - lane.points[i - 1].z) * 2 + 6);
        }
      }
      expect(findPath(g, walk, red, { x: world.enemyHall.x + 1, z: world.enemyHall.z - 1 }, { maxNodes: 6000 })).not.toBeNull();
      // The stream is crossed at fords.
      expect([...g.terrain].filter((t) => t === T.ford).length).toBeGreaterThan(6);
    });
  }

  it('both sides start with the same fort, mirror images of each other', () => {
    const world = conquest(1);
    const { width: W, height: H } = world.grid;
    const red = teamBuildings(world, 'red');
    const blue = teamBuildings(world, 'blue');
    const count = (list, type) => list.filter((b) => b.type === type).length;
    for (const list of [red, blue]) {
      expect(count(list, 'townHall')).toBe(1);
      expect(count(list, 'barracks')).toBe(3);
      expect(count(list, 'archerTower')).toBe(6);
    }
    for (const b of red) expect(blue.some((o) => o.type === b.type && o.x === W - b.x - b.size && o.z === H - b.z - b.size)).toBe(true);
    expect(world.townHall.cz).toBeGreaterThan(H / 2);
    expect(world.enemyHall.team).toBe('blue');
  });
});

describe('conquest rules', () => {
  it('build only near your own buildings; the enemy can be neither sold nor upgraded', () => {
    const world = conquest(1);
    world.economy.earn(5000);
    const hall = world.townHall;
    expect(world.canPlace('archerTower', hall.x + 5, hall.z - 1).ok).toBe(true);
    expect(world.canPlace('archerTower', hall.x, hall.z - 40).reason).toBe('Too far from your buildings');
    const enemy = teamBuildings(world, 'blue').find((b) => b.type === 'archerTower');
    expect(world.canSell(enemy)).toBe(false);
    expect(world.upgradeCheck(enemy).ok).toBe(false);
    expect(world.repairCheck({ ...enemy, hp: 1 }).ok).toBe(false);
  });

  it('waves come on a timer (or early): every Barracks sends a squad down its lane, growing each wave', () => {
    const world = conquest(1);
    expect(world.phase).toBe('build');
    run(world, CONQUEST.firstPush + 0.1);
    expect(world.waves.wave).toBe(1);
    const per = squadFor(1).length;
    expect(world.troops.filter((t) => t.team === 'red').length).toBe(3 * per);
    expect(world.troops.filter((t) => t.team === 'blue').length).toBeGreaterThanOrEqual(3 * per);
    expect(new Set(world.troops.filter((t) => t.team === 'red').map((t) => t.lane))).toEqual(new Set([0, 1, 2]));
    expect(world.startWave()).toBe(true); // early
    expect(world.waves.wave).toBe(2);
    expect(world.phaseTimer).toBe(CONQUEST.pushEvery);
    expect(squadFor(9).length).toBeGreaterThan(squadFor(1).length);
    expect(squadFor(100).length).toBe(CONQUEST.squad.max);
  });

  it("the squads march their lanes and fight in the middle; each side's towers shoot the other's men", () => {
    const world = conquest(2);
    let redShot = 0;
    let blueShot = 0;
    world.events.on('projectileFired', ({ building }) => {
      if (building?.team === 'red') redShot++;
      if (building?.team === 'blue') blueShot++;
    });
    let killed = { red: 0, blue: 0 };
    world.events.on('troopKilled', ({ troop }) => killed[troop.team]++);
    world.startWave();
    run(world, 120);
    expect(killed.red).toBeGreaterThan(0);
    expect(killed.blue).toBeGreaterThan(0);
    // A soldier of each side beside the other's tower draws its fire.
    for (const team of ['red', 'blue']) {
      const tower = teamBuildings(world, team === 'red' ? 'blue' : 'red').find((b) => b.type === 'archerTower');
      const man = world.troops.find((t) => t.team === team && t.alive);
      Object.assign(man, { x: tower.cx + 2, z: tower.cz, tx: Math.floor(tower.cx + 2), tz: Math.floor(tower.cz), path: null });
    }
    run(world, 3);
    expect(redShot).toBeGreaterThan(0);
    expect(blueShot).toBeGreaterThan(0);
  });

  it('soldiers break through enemy walls in their way, and bring down the Town Hall to win', () => {
    const world = conquest(3);
    // Strip blue of its defences and send a strong red squad straight at its hall, through a wall.
    for (const b of teamBuildings(world, 'blue')) if (b !== world.enemyHall) world._removeBuilding(b);
    world.enemyHall.def = { ...world.enemyHall.def, attack: null };
    world.enemyHall.hp = 300;
    const hall = world.enemyHall;
    // A ring of wall round the hall.
    for (let x = hall.x - 2; x <= hall.x + 4; x++) {
      for (let z = hall.z - 2; z <= hall.z + 4; z++) {
        if (x === hall.x - 2 || x === hall.x + 4 || z === hall.z - 2 || z === hall.z + 4) world._addBuilding('wall', x, z, 'blue');
      }
    }
    const barracks = teamBuildings(world, 'red').find((b) => b.type === 'barracks' && b.lane === 1);
    world.waves.wave = 20;
    let destroyedWall = false;
    world.events.on('buildingDestroyed', ({ building }) => building.type === 'wall' && (destroyedWall = true));
    let over = null;
    world.events.on('gameOver', (e) => (over = e));
    world.blueEconomy.spend(world.blueEconomy.gold); // the AI can't rebuild
    world._aiTimer = Infinity;
    for (let i = 0; i < 3; i++) {
      world.startWave();
      run(world, 70);
    }
    expect(barracks).toBeTruthy();
    expect(destroyedWall).toBe(true);
    expect(world.phase).toBe('gameover');
    expect(world.won).toBe(true);
    expect(over.won).toBe(true);
  });

  it('bounties: gold for each enemy soldier and building that falls; repairs any time but under attack', () => {
    const world = conquest(1);
    world.startWave();
    const blue = world.troops.find((t) => t.team === 'blue');
    const gold = world.economy.gold;
    world._damageTroop(blue, 1e6);
    expect(world.economy.gold).toBe(gold + TROOPS.types[blue.type].reward);
    const tower = teamBuildings(world, 'blue').find((b) => b.type === 'archerTower');
    world._damageBuilding(tower, 1e6);
    expect(world.economy.gold).toBe(gold + TROOPS.types[blue.type].reward + CONQUEST.buildingBounty);

    const mine = teamBuildings(world, 'red').find((b) => b.type === 'archerTower');
    world.economy.earn(1000);
    world._damageBuilding(mine, 50, { x: 0, z: 0 });
    expect(world.repairCheck(mine).reason).toBe('Under attack');
    world.time += CONQUEST.repairDelay + 0.1;
    expect(world.repair(mine.id).ok).toBe(true);
  });

  it('the AI spends its gold on buildings by the rules: near its own, on its own ground', () => {
    const world = conquest(1);
    world.blueEconomy.earn(2000);
    const before = teamBuildings(world, 'blue').length;
    run(world, 30);
    const built = teamBuildings(world, 'blue').filter((b) => !b.starter && b !== world.enemyHall);
    expect(teamBuildings(world, 'blue').length).toBeGreaterThan(before);
    for (const b of built) {
      expect(['barracks', 'archerTower']).toContain(b.type);
      expect(b.cz).toBeLessThan(world.grid.height / 2);
    }
    expect(world.blueEconomy.gold).toBeLessThan(2000 + CONQUEST.startingGold - BUILDINGS.archerTower.cost);
  });

  it("survival is unchanged: no lanes, one side, and the barracks' men guard their post", () => {
    const world = new World({ seed: 1 });
    expect(world.mode).toBe('survival');
    expect(world.lanes).toBeUndefined();
    expect(world.enemyHall).toBeUndefined();
    expect(world.townHall.team).toBe('red');
  });
});
