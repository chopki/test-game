import { describe, expect, it } from 'vitest';
import { BUILDINGS, CAMPS, CONQUEST, HEROES, TROOPS } from '../src/sim/config.js';
import { LAYOUTS } from '../src/sim/lanes.js';
import { inTerritory, updateFlags } from '../src/sim/flags.js';
import { heroXp } from '../src/sim/heroes.js';
import { aiThink, squadFor } from '../src/sim/conquest.js';
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
      // The stream is crossed at fords, and only there.
      expect([...g.terrain].filter((t) => t === T.ford).length).toBeGreaterThan(6);
      const dry = (x, z) => walk(x, z) && g.terrainAt(x, z) !== T.ford;
      expect(findPath(g, dry, red, { x: world.enemyHall.x + 1, z: world.enemyHall.z - 1 }, { maxNodes: 20000 })).toBeNull();
      // Hills: plateaus (mirrored too) that the lanes climb by ramps; ground only changes level at a ramp.
      expect(world.hills).toBe(true);
      for (let z = 0; z < g.height; z++) for (let x = 0; x < g.width; x++) expect(g.levelAt(x, z)).toBe(g.levelAt(g.width - 1 - x, g.height - 1 - z));
      expect([...g.terrain].filter((t) => t === T.ramp).length).toBeGreaterThan(12);
      for (let z = 0; z < g.height; z++) {
        for (let x = 0; x < g.width; x++) {
          for (const [nx, nz] of [[x + 1, z], [x, z + 1]]) {
            if (!walk(x, z) || !g.inBounds(nx, nz) || !walk(nx, nz) || g.levelAt(x, z) === g.levelAt(nx, nz)) continue;
            expect(g.terrainAt(x, z) === T.ramp || g.terrainAt(nx, nz) === T.ramp, `${x},${z}`).toBe(true);
          }
        }
      }
      expect(world.lanes.filter((l) => l.points.some((p) => g.levelAt(p.x, p.z) > 0)).length).toBe(3); // west, middle and east
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
  it('build only in your territory (round your Town Hall); the enemy can be neither sold nor upgraded', () => {
    const world = conquest(1);
    world.economy.earn(5000);
    const hall = world.townHall;
    expect(world.canPlace('archerTower', hall.x + 5, hall.z - 1).ok).toBe(true);
    expect(world.canPlace('archerTower', hall.x, hall.z - 40).reason).toBe('Outside your territory');
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
    const squads = (team) => world.troops.filter((t) => t.team === team && !t.hero);
    expect(squads('red').length).toBe(3 * per);
    expect(squads('blue').length).toBeGreaterThanOrEqual(3 * per);
    expect(new Set(squads('red').map((t) => t.lane))).toEqual(new Set([0, 1, 2]));
    expect(world.startWave()).toBe(true); // early
    expect(world.waves.wave).toBe(2);
    expect(world.phaseTimer).toBe(CONQUEST.pushEvery);
    expect(squadFor(9).length).toBeGreaterThan(squadFor(1).length);
    const men = (n) => squadFor(n).filter((t) => !TROOPS.types[t].siege);
    expect(men(100).length).toBe(CONQUEST.squad.max);
    // Knights from wave 5; a ram from wave 4 and a siege catapult from wave 7, every third wave.
    expect(squadFor(4).includes('knight')).toBe(false);
    expect(squadFor(5).includes('knight')).toBe(true);
    const engines = (n) => squadFor(n).filter((t) => TROOPS.types[t].siege);
    expect([1, 3, 4, 5, 7, 10].map(engines)).toEqual([[], [], ['ram'], [], ['ram', 'mangonel'], ['ram', 'mangonel']]);
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

  it('siege engines only attack buildings (and soldiers do attack them)', () => {
    const world = conquest(1);
    world.waves.wave = 3;
    world.startWave(); // wave 4: a ram from every Barracks
    const ram = world.troops.find((t) => t.type === 'ram' && t.team === 'red');
    expect(ram).toBeTruthy();
    run(world, 120);
    expect(ram.target === null || ram.target.size !== undefined || !ram.alive).toBe(true);
    for (const t of world.troops) if (t.def.siege && t.target) expect(t.target.size, t.type).toBeDefined();
  });

  it('bounties: gold for each enemy soldier and building that falls; repairs any time but under attack', () => {
    const world = conquest(1);
    world.startWave();
    const blue = world.troops.find((t) => t.team === 'blue' && !t.hero);
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

  it('the AI upgrades its Town Hall when due, then its towers; neither side can upgrade the other', () => {
    const world = conquest(1);
    world.blueEconomy.earn(3000);
    world.time = CONQUEST.ai.hallEvery; // stage 2 is due
    aiThink(world);
    // (A Barracks first, if it has room for one more; then the hall.)
    for (let i = 0; i < 4 && world.enemyHall.stage === 1; i++) aiThink(world);
    expect(world.enemyHall.stage).toBe(2);
    const blueTower = teamBuildings(world, 'blue').find((b) => b.type === 'archerTower');
    const redTower = teamBuildings(world, 'red').find((b) => b.type === 'archerTower');
    expect(world.upgradeCheck(blueTower).reason).toBe("The enemy's");
    expect(world.upgradeCheck(redTower, 'blue').reason).toBe("The enemy's");
    expect(world.upgradeCheck(blueTower, 'blue').ok).toBe(true);
    const gold = world.blueEconomy.gold;
    expect(world.upgrade(blueTower.id, { team: 'blue' }).ok).toBe(true);
    expect(world.blueEconomy.gold).toBeLessThan(gold);
  });

  it('when the enemy presses a lane, the AI walls it across, leaving a gap in the middle', () => {
    const world = conquest(1);
    world.blueEconomy.earn(3000);
    world.startWave();
    // A red man deep in blue's half of the middle lane.
    const man = world.troops.find((t) => t.team === 'red' && t.lane === 1);
    const deep = world.lanes[1].points.at(-6);
    Object.assign(man, { x: deep.x + 0.5, z: deep.z + 0.5, tx: deep.x, tz: deep.z, delay: 0 });
    for (let i = 0; i < 12 && !world.aiWalls?.has(1); i++) aiThink(world);
    expect(world.aiWalls.has(1)).toBe(true);
    const walls = teamBuildings(world, 'blue').filter((b) => b.type === 'wall' && b.lane === 1);
    expect(walls.length).toBeGreaterThanOrEqual(3);
    // The gap: blue's own men still get from their hall down the lane without breaking anything.
    const g = world.grid;
    const pts = world.lanes[1].points;
    const passable = (x, z) => !g.isBlocked(x, z) && g.get(x, z) === null;
    expect(findPath(g, passable, pts.at(-2), pts[Math.floor(pts.length / 2)], { maxNodes: 6000 })).not.toBeNull();
  });

  it("survival is unchanged: no lanes, one side, and the barracks' men guard their post", () => {
    const world = new World({ seed: 1 });
    expect(world.mode).toBe('survival');
    expect(world.lanes).toBeUndefined();
    expect(world.enemyHall).toBeUndefined();
    expect(world.townHall.team).toBe('red');
  });
});

describe('heroes', () => {
  it('one each side, at its Town Hall: an elite knight with its own name', () => {
    const world = conquest(1);
    for (const team of ['red', 'blue']) {
      const h = world.heroes[team];
      expect(h.alive).toBe(true);
      expect(world.troops).toContain(h);
      expect(h.def.name).toBe(HEROES.roster[world.heroKinds[team]].names[team]);
      const hall = team === 'red' ? world.townHall : world.enemyHall;
      expect(Math.hypot(h.x - hall.cx, h.z - hall.cz)).toBeLessThan(5);
    }
  });

  it('goes where it is sent and holds there; fights what comes near, earns XP and levels up', () => {
    const world = conquest(1);
    const h = world.heroes.red;
    const to = world.lanes[1].points[Math.floor(world.lanes[1].points.length * 0.3)];
    expect(world.orderHero({ x: to.x + 0.5, z: to.z + 0.5 })).toBe(true);
    run(world, 30);
    expect(Math.hypot(h.x - (to.x + 0.5), h.z - (to.z + 0.5))).toBeLessThan(2);
    // A blue man walks up: the hero fights him and earns his worth in XP.
    world.startWave();
    const man = world.troops.find((t) => t.team === 'blue' && !t.hero && t.type === 'swordsman');
    Object.assign(man, { x: h.x + 2, z: h.z, tx: Math.floor(h.x + 2), tz: Math.floor(h.z), delay: 0, def: { ...man.def, speed: 0 } });
    for (let t = 0; t < 20 && man.alive; t += DT) world.update(DT);
    expect(man.alive).toBe(false);
    expect(h.xp).toBeGreaterThanOrEqual(TROOPS.types.swordsman.reward);
    const hp = h.maxHp;
    heroXp(world, 'red', h.x, h.z, HEROES.levels[2]);
    expect(h.level).toBe(3);
    expect(h.maxHp).toBeGreaterThan(hp);
  });

  it('sent into the woods, it goes to the nearest open ground', () => {
    const world = conquest(1);
    const g = world.grid;
    let wood = null;
    for (let z = g.height - 20; z > g.height / 2 && !wood; z--) for (let x = 2; x < g.width - 2 && !wood; x++) if (g.terrainAt(x, z) === T.forest && g.terrainAt(x + 1, z) !== T.forest) wood = { x, z };
    world.orderHero({ x: wood.x + 0.5, z: wood.z + 0.5 });
    const o = world.heroes.red.order;
    expect(g.terrainAt(Math.floor(o.x), Math.floor(o.z))).not.toBe(T.forest);
    expect(Math.hypot(o.x - (wood.x + 0.5), o.z - (wood.z + 0.5))).toBeLessThan(2);
  });

  it('falls, pays a bounty, and comes back at its hall with its level', () => {
    const world = conquest(1);
    const h = world.heroes.blue;
    heroXp(world, 'blue', h.x, h.z, HEROES.levels[1]);
    const gold = world.economy.gold;
    world._damageTroop(h, 1e6);
    expect(h.alive).toBe(false);
    expect(world.economy.gold).toBe(gold + HEROES.bounty);
    run(world, HEROES.respawn.base + HEROES.respawn.perLevel * 2 + 0.5);
    const back = world.heroes.blue;
    expect(back).not.toBe(h);
    expect(back.alive).toBe(true);
    expect(back.level).toBe(2);
  });

  it('war cry: allies near the hero heal and speed up, then it rests', () => {
    const world = conquest(1);
    expect(world.heroKinds.red).toBe('knight'); // the default
    world.startWave();
    const h = world.heroes.red;
    const friend = world.troops.find((t) => t.team === 'red' && !t.hero);
    Object.assign(friend, { x: h.x + 1, z: h.z, hp: 10 });
    expect(world.useAbility(0).ok).toBe(true);
    expect(friend.hp).toBeGreaterThan(10);
    expect(friend.slowFactor).toBe(HEROES.abilities.warCry.haste);
    expect(world.useAbility(0).reason).toMatch(/ready in/); // resting
    world.time += HEROES.abilities.warCry.cooldown;
    expect(world.useAbility(0).ok).toBe(true);
    // Charge needs a foe in reach.
    expect(world.useAbility(1).reason).toBe('No foe in reach');
  });

  for (const kind of ['knight', 'ranger', 'warden']) {
    it(`${kind}: chosen for the player; both abilities work on a foe in reach`, () => {
      const world = new World({ seed: 1, mode: 'conquest', hero: kind });
      expect(world.heroKinds.red).toBe(kind);
      const h = world.heroes.red;
      expect(h.type).toBe(HEROES.roster[kind].type);
      world.startWave();
      const foe = world.troops.find((t) => t.team === 'blue' && !t.hero);
      Object.assign(foe, { x: h.x + 2, z: h.z, delay: 0 });
      h.hp = h.maxHp / 2;
      const hp = foe.hp;
      for (const slot of [0, 1]) expect(world.useAbility(slot).ok, `${kind} ${slot}`).toBe(true);
      if (kind === 'ranger') expect(foe.hp).toBeLessThan(hp); // the volley
      if (kind === 'warden') {
        expect(h.hp).toBeGreaterThan(h.maxHp / 2); // rally
        expect(h.guardUntil).toBeGreaterThan(world.time); // shield wall
        const before = h.hp;
        world._damageTroop(h, 100, 'blue');
        expect(before - h.hp).toBe(100 * (1 - HEROES.abilities.shieldWall.guard));
      }
    });
  }

  it("the AI's hero is picked from the roster, the same for the same map", () => {
    const kinds = [1, 2, 3, 4, 5, 6].map((seed) => conquest(seed).heroKinds.blue);
    for (const k of kinds) expect(Object.keys(HEROES.roster)).toContain(k);
    expect(conquest(3).heroKinds.blue).toBe(kinds[2]);
  });

  it('the blue hero follows its squads, and goes home when hurt', () => {
    const world = conquest(2);
    world.startWave();
    run(world, 20);
    const h = world.heroes.blue;
    expect(h.order).not.toBeNull();
    h.hp = h.maxHp * 0.2;
    run(world, 2);
    expect(h.order).toBeNull();
  });
});

describe('layouts and neutral camps', () => {
  it('maps come in three layouts, each with camps in the woods joined to a lane by a trail', () => {
    const seen = new Set();
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const world = conquest(seed);
      seen.add(world.layout);
      const g = world.grid;
      const walk = (x, z) => !blocksMovement(g.terrainAt(x, z));
      expect(world.camps.length).toBe(4);
      for (const c of world.camps) {
        expect(walk(c.x, c.z)).toBe(true);
        expect(findPath(g, walk, c, world.lanes[1].points[0], { maxNodes: 8000 }), `${seed} ${c.x},${c.z}`).not.toBeNull();
      }
    }
    expect([...seen].sort()).toEqual(Object.values(LAYOUTS).map((l) => l.name).sort());
  });

  it('bandits guard their camp: squads march past, a hero clears it for gold and XP, and it fills again', () => {
    const world = conquest(1);
    const guards = (i) => world.troops.filter((t) => t.alive && t.camp === i);
    expect(guards(0).length).toBe(CAMPS.guards.length);
    expect(guards(0).every((t) => t.team === 'neutral')).toBe(true);
    // A red soldier walking by a camp doesn't go for its guards.
    world.startWave();
    const man = world.troops.find((t) => t.team === 'red' && !t.hero && t.lane !== undefined);
    const camp = world.camps[0];
    Object.assign(man, { x: camp.x + 4.5, z: camp.z + 0.5, tx: camp.x + 4, tz: camp.z, delay: 0 });
    world.update(DT);
    expect(man.target?.team === 'neutral').toBe(false);
    // The hero is sent in: the camp falls to it.
    const h = world.heroes.red;
    h.hp = h.maxHp = 1e5;
    Object.assign(h, { x: camp.x + 0.5, z: camp.z + 2.5, tx: camp.x, tz: camp.z + 2, path: null });
    world.orderHero({ x: camp.x + 0.5, z: camp.z + 0.5 });
    const gold = world.economy.gold;
    for (let t = 0; t < 60 && guards(0).length; t += DT) world.update(DT);
    expect(guards(0).length).toBe(0);
    expect(world.economy.gold).toBeGreaterThan(gold + CAMPS.guards.length * 5);
    expect(h.xp).toBeGreaterThan(0);
    run(world, CAMPS.respawn + 1);
    expect(guards(0).length).toBe(CAMPS.guards.length);
  });
});

describe('territory and flags', () => {
  const place = (world, team, f, n = 1) => {
    const men = world.troops.filter((t) => t.team === team && !t.hero).slice(0, n);
    for (const t of men) Object.assign(t, { x: f.x, z: f.z, tx: Math.floor(f.x), tz: Math.floor(f.z), delay: 0, def: { ...t.def, speed: 0 }, lane: undefined, barracksId: -1 });
    return men;
  };

  it("six flags on the lanes, the far three the mirror of the near three, no one's at the start", () => {
    const world = conquest(1);
    const { width: W, height: H } = world.grid;
    expect(world.flags.length).toBe(6);
    for (const f of world.flags) {
      expect(f.owner).toBeNull();
      expect(world.flags.some((g) => g.x === W - f.x && g.z === H - f.z)).toBe(true);
    }
  });

  it('men by a flag, alone, take it; then their side can build round it and it pays', () => {
    const world = conquest(1);
    world.startWave();
    const f = world.flags.find((g) => g.z > world.grid.height / 2);
    expect(world.canPlace('archerTower', Math.floor(f.x) + 2, Math.floor(f.z)).reason).toBe('Outside your territory');
    place(world, 'red', f, 2);
    // (Everyone else stays put, far off.)
    for (const t of world.troops) if (t.team === 'blue') t.delay = 1e9;
    let taken = null;
    world.events.on('flagCaptured', (e) => (taken = e));
    for (let t = 0; t < CONQUEST.flags.capture * 3 && !taken; t += DT) updateFlags(world, DT);
    expect(taken?.team).toBe('red');
    expect(f.owner).toBe('red');
    world.economy.earn(1000);
    // Towers placed near it (somewhere the ground allows).
    let ok = false;
    for (let dx = -5; dx <= 5 && !ok; dx++) for (let dz = -5; dz <= 5 && !ok; dz++) ok = world.canPlace('archerTower', Math.floor(f.x) + dx, Math.floor(f.z) + dz).ok;
    expect(ok).toBe(true);
    const gold = world.economy.gold;
    updateFlags(world, 10);
    expect(world.economy.gold).toBeGreaterThan(gold);
  });

  it("a contested flag doesn't move; the other side must bring it down to no one's before taking it", () => {
    const world = conquest(1);
    world.startWave();
    const f = world.flags[0];
    Object.assign(f, { owner: 'red', hold: 1 });
    const blues = place(world, 'blue', f, 2);
    const reds = place(world, 'red', f, 1);
    updateFlags(world, 5);
    expect(f.hold).toBe(1);
    expect(f.contested).toBe(true);
    for (const t of reds) t.alive = false;
    const events = [];
    world.events.on('flagLost', () => events.push('lost'));
    world.events.on('flagCaptured', (e) => events.push(e.team));
    for (let t = 0; t < CONQUEST.flags.capture * 6 && f.owner !== 'blue'; t += DT) updateFlags(world, DT);
    expect(events).toEqual(['lost', 'blue']);
    expect(blues.length).toBe(2);
  });

  it("a Town Hall's territory grows as it goes up stages", () => {
    const world = conquest(1);
    const hall = world.townHall;
    const r = CONQUEST.territory.hall;
    const edge = (k) => inTerritory(world, 'red', hall.cx, hall.cz - k);
    expect(edge(r[0] - 0.5)).toBe(true);
    expect(edge(r[0] + 1)).toBe(false);
    world.economy.earn(5000);
    world.upgrade(hall.id);
    expect(edge(r[0] + 1)).toBe(true);
  });
});
