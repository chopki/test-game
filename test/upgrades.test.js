import { describe, expect, it } from 'vitest';
import { BUILDINGS, ECONOMY, UPGRADES } from '../src/sim/config.js';
import { nextUpgradeCost, stageCount, stageDef } from '../src/sim/upgrades.js';
import { World } from '../src/sim/World.js';

const rich = () => {
  const world = new World({ seed: 1 });
  world.economy.earn(20000);
  return world;
};

describe('stages', () => {
  it('stage 1 is the building as built; later stages lay their changes over the one before', () => {
    const one = stageDef('archerTower', 1);
    expect(one.maxHp).toBe(BUILDINGS.archerTower.maxHp);
    expect(one.attack).toEqual(BUILDINGS.archerTower.attack);
    const s = UPGRADES.stages.archerTower;
    const three = stageDef('archerTower', 3);
    expect(three.attack.damage).toBe(s[2].attack.damage);
    expect(three.attack.range).toBe(s[2].attack.range);
    expect(three.attack.cooldown).toBe(BUILDINGS.archerTower.attack.cooldown); // not changed yet
    expect(stageDef('archerTower', 4).attack.cooldown).toBe(s[3].attack.cooldown);
    expect(stageDef('archerTower', 5).attack.range).toBe(s[4].attack.range);
    expect(three.stageName).toBe(s[2].name);
    expect(three.cost).toBe(BUILDINGS.archerTower.cost);
    expect(stageDef('archerTower', 3)).toBe(three); // cached
  });

  it('every upgradeable building has five stages (the Barracks three) that only ever get stronger', () => {
    for (const [type, stages] of Object.entries(UPGRADES.stages)) {
      const count = type === 'barracks' ? 3 : UPGRADES.maxStage;
      expect(stages.length, type).toBe(count);
      expect(stageCount(type)).toBe(count);
      for (let s = 2; s <= stages.length; s++) {
        const [a, b] = [stageDef(type, s - 1), stageDef(type, s)];
        expect(nextUpgradeCost(type, s - 1), `${type} ${s}`).toBeGreaterThan(0);
        expect(b.maxHp, `${type} ${s}`).toBeGreaterThan(a.maxHp);
        if (a.trains) {
          expect(b.trains.garrison).toBeGreaterThan(a.trains.garrison);
          expect(b.levy.hp).toBeGreaterThan(a.levy.hp);
          const men = (d) => Object.values(d.levy.men).reduce((x, y) => x + y, 0);
          expect(men(b)).toBeGreaterThan(men(a));
        }
        if (a.attack) {
          expect(b.attack.damage).toBeGreaterThan(a.attack.damage);
          expect(b.attack.range).toBeGreaterThanOrEqual(a.attack.range);
          expect(b.attack.cooldown).toBeLessThanOrEqual(a.attack.cooldown);
        }
      }
      expect(nextUpgradeCost(type, stages.length)).toBeNull();
    }
    expect(stageCount('gatehouse')).toBe(1);
  });
});

describe('upgrading', () => {
  it('costs gold, raises the stats and keeps the damage already taken; selling refunds part of it all', () => {
    const world = rich();
    world.upgrade(world.townHall.id);
    const tower = world.place('archerTower', 18, 12).building;
    tower.hp -= 100;
    const gold = world.economy.gold;
    const result = world.upgrade(tower.id);
    expect(result.ok).toBe(true);
    expect(world.economy.gold).toBe(gold - result.cost);
    expect(tower.stage).toBe(2);
    expect(tower.maxHp).toBe(stageDef('archerTower', 2).maxHp);
    expect(tower.maxHp - tower.hp).toBe(100);
    expect(world.rangeOf(tower)).toBe(stageDef('archerTower', 2).attack.range);
    tower.hp = tower.maxHp;
    expect(world.sellValue(tower)).toBe(Math.floor((BUILDINGS.archerTower.cost + result.cost) * ECONOMY.sellRefund));
  });

  it('nothing may stand more than a stage above the Town Hall', () => {
    const world = rich();
    const tower = world.place('cannonTower', 18, 12).building;
    expect(world.upgrade(tower.id).ok).toBe(true); // stage 2: one above the hall's 1
    const blocked = world.upgrade(tower.id);
    expect(blocked.ok).toBe(false);
    expect(blocked.reason).toMatch(/Town Hall at stage 2/);
    expect(world.upgrade(world.townHall.id).ok).toBe(true);
    expect(world.upgrade(tower.id).ok).toBe(true);
    expect(tower.stage).toBe(3);
  });

  it('stops at the last stage, and when the gold runs out', () => {
    const world = rich();
    const wall = world.place('wall', 18, 12).building;
    for (let i = 0; i < 4; i++) world.upgrade(world.townHall.id);
    for (let i = 0; i < 4; i++) expect(world.upgrade(wall.id).ok).toBe(true);
    expect(world.upgrade(wall.id).reason).toBe('Fully upgraded');
    const poor = new World({ seed: 1 });
    const other = poor.place('wall', 18, 12).building;
    poor.economy.spend(poor.economy.gold);
    expect(poor.upgrade(other.id).reason).toBe('Not enough gold');
  });

  it("an upgraded tower's shots hit harder", () => {
    const world = rich();
    world.phase = 'wave';
    const tower = world.place('archerTower', 18, 12).building;
    world.upgrade(tower.id);
    const shots = [];
    world.events.on('projectileFired', ({ projectile, building }) => building === tower && shots.push(projectile.damage));
    world._spawnEnemy({ type: 'knight', side: 'north', hpMult: 1, elite: false });
    Object.assign(world.enemies[0], { x: 19.5, z: 16.5, tx: 19, tz: 16 });
    world.enemies[0].def = { ...world.enemies[0].def, speed: 0 };
    for (let t = 0; t < 2; t += 1 / 30) world.update(1 / 30);
    expect(shots.length).toBeGreaterThan(0);
    expect(shots.every((d) => d === stageDef('archerTower', 2).attack.damage)).toBe(true);
  });
});

describe('wall lines', () => {
  it('upgrade line: every joined wall of the same stage, as far as the gold goes', () => {
    const world = rich();
    for (let x = 10; x <= 20; x++) world.place('wall', x, 10);
    for (let z = 11; z <= 14; z++) world.place('wall', 20, z);
    world.place('wall', 25, 10); // not joined
    const first = world.buildingAt(10, 10);
    expect(world.wallLine(first.id).length).toBe(15);
    expect(world.upgradeLine(first.id)).toBe(15);
    expect(world.buildingAt(20, 14).stage).toBe(2);
    expect(world.buildingAt(25, 10).stage).toBe(1);

    const poor = new World({ seed: 1 });
    poor.economy.earn(200);
    for (let x = 10; x <= 20; x++) poor.place('wall', x, 10);
    const cost = nextUpgradeCost('wall', 1);
    const affordable = Math.floor(poor.economy.gold / cost);
    expect(poor.upgradeLine(poor.buildingAt(10, 10).id)).toBe(Math.min(11, affordable));
  });
});

describe('repairs', () => {
  it('restore full health between waves, for a share of what the building cost, scaled by the damage', () => {
    const world = rich();
    const tower = world.place('archerTower', 18, 12).building;
    tower.hp = tower.maxHp / 2;
    expect(world.repairCost(tower)).toBe(Math.ceil(BUILDINGS.archerTower.cost * ECONOMY.repairCost * 0.5));
    world.phase = 'wave';
    expect(world.repair(tower.id).ok).toBe(false);
    world.phase = 'build';
    const gold = world.economy.gold;
    const result = world.repair(tower.id);
    expect(result.ok).toBe(true);
    expect(tower.hp).toBe(tower.maxHp);
    expect(world.economy.gold).toBe(gold - result.cost);
    expect(world.repair(tower.id).reason).toBe('Not damaged');
    // The Town Hall can be repaired too.
    world.townHall.hp -= 500;
    expect(world.repairCost(world.townHall)).toBeGreaterThan(0);
    expect(world.repair(world.townHall.id).ok).toBe(true);
  });
});
