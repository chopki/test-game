import { describe, expect, it } from 'vitest';
import { BUILDINGS, REALM } from '../src/sim/config.js';
import { seenAt, seenShare } from '../src/sim/realm/fog.js';
import { lairMen } from '../src/sim/realm/lairs.js';
import { splitByShare } from '../src/sim/realm/bounties.js';
import { bountyValue, intentOf } from '../src/sim/realm/heroes.js';
import { forgeCheck, realmThingAt } from '../src/sim/realm/index.js';
import { World } from '../src/sim/World.js';

const DT = 1 / 30;
const realm = (seed = 1, opts = {}) => new World({ seed, mode: 'realm', terrain: 'generate', fort: true, ...opts });
const run = (world, seconds, until = () => false) => {
  for (let t = 0; t < seconds && world.phase !== 'gameover'; t += DT) {
    world.update(DT);
    if (until()) return true;
  }
  return false;
};
const on = (world, name) => {
  const seen = [];
  world.events.on(name, (e) => seen.push(e));
  return seen;
};

/** Place `type` near the Town Hall, leaving a tile free all round it (so no one's boxed in). */
function build(world, type) {
  const h = world.townHall;
  const size = BUILDINGS[type].size;
  const clear = (x, z) => {
    for (let dz = -1; dz <= size; dz++) {
      for (let dx = -1; dx <= size; dx++) if (world.grid.inBounds(x + dx, z + dz) && world.grid.get(x + dx, z + dz) !== null) return false;
    }
    return true;
  };
  for (let r = 3; r < 14; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const [x, z] = [h.x + dx, h.z + dz];
        if (world.canPlace(type, x, z).ok && clear(x, z)) {
          world.place(type, x, z);
          return world.buildings.get(world.grid.get(x, z));
        }
      }
    }
  }
  throw new Error(`no room for ${type}`);
}

/** A guild and `n` heroes from it (topping up the treasury to pay for them). */
function heroes(world, n = 1, type = 'warriorsHall') {
  const guild = build(world, type);
  world.economy.earn(REALM.classes[guild.def.guild].cost * n, 'test');
  return { guild, heroes: Array.from({ length: n }, () => world.recruit(guild.id).hero) };
}

describe('realm setup', () => {
  it('starts in daylight with the Realm purse, lairs out in the wilds and the fog over all but the town', () => {
    const world = realm(1);
    expect(world.mode).toBe('realm');
    expect(world.phase).toBe('build');
    expect(world.phaseTimer).toBe(REALM.firstDay);
    expect(world.economy.gold).toBe(REALM.startingGold);
    const r = world.realm;
    expect(r.lairs.length).toBe(REALM.lairs.count[40]);
    const hall = world.townHall;
    for (const lair of r.lairs) {
      expect(Math.hypot(lair.cx - hall.cx, lair.cz - hall.cz)).toBeGreaterThanOrEqual(REALM.lairs.minHall);
      expect(lairMen(world, lair).length).toBe(REALM.lairs.guards.length);
      for (const m of lairMen(world, lair)) expect(m.team).toBe('neutral');
    }
    expect(seenAt(world, hall.cx, hall.cz)).toBe(true);
    expect(seenShare(world)).toBeGreaterThan(0);
    expect(seenShare(world)).toBeLessThan(0.5);
  });

  it('offers the guilds and the smithy only in a Realm', () => {
    const world = realm(1);
    for (const type of ['warriorsHall', 'rangersLodge', 'roguesDen', 'smithy']) expect(world.offers(type)).toBe(true);
    expect(world.offers('outlawCamp')).toBe(false);
    expect(world.offers('flagFort')).toBe(false);
    const survival = new World({ seed: 1, terrain: 'generate' });
    expect(survival.realm).toBeUndefined();
    expect(survival.offers('warriorsHall')).toBe(false);
    expect(survival.canPlace('warriorsHall', survival.townHall.x + 4, survival.townHall.z).reason).toBe('Realm only');
  });

  it('is the same realm for the same seed', () => {
    const a = realm(7);
    const b = realm(7);
    expect(a.realm.lairs.map((l) => [l.x, l.z])).toEqual(b.realm.lairs.map((l) => [l.x, l.z]));
  });

  it("won't build in the fog, nor on a lair", () => {
    const world = realm(2);
    const g = world.grid;
    let fogged = null;
    const m = g.spawnMargin + 2;
    for (let z = m; z < g.height - m && !fogged; z++) {
      for (let x = m; x < g.width - m && !fogged; x++) if (!seenAt(world, x, z) && g.isBuildable(x, z) && g.get(x, z) === null) fogged = { x, z };
    }
    expect(fogged).not.toBeNull();
    expect(world.canPlace('archerTower', fogged.x, fogged.z).reason).toMatch(/Unexplored/);
    const lair = world.realm.lairs[0];
    world.realm.fog.seen.fill(1);
    expect(world.canPlace('archerTower', lair.x, lair.z).ok).toBe(false);
  });
});

describe('heroes', () => {
  it('are recruited at a guild for gold, up to its cap, and step out of its door', () => {
    const world = realm(1);
    const guild = build(world, 'warriorsHall');
    const before = world.economy.gold;
    const recruited = on(world, 'heroRecruited');
    const { ok, hero } = world.recruit(guild.id);
    expect(ok).toBe(true);
    expect(world.economy.gold).toBe(before - REALM.classes.manAtArms.cost);
    expect(recruited.length).toBe(1);
    expect(hero).toMatchObject({ team: 'red', realm: 'hero', cls: 'manAtArms', level: 1, gold: 0 });
    expect(world.troops).toContain(hero);
    expect(world._distanceTo(guild, hero.x, hero.z)).toBeLessThan(1.5);
    world.economy.earn(1000, 'test');
    for (let i = 1; i < REALM.guildCap; i++) expect(world.recruit(guild.id).ok).toBe(true);
    expect(world.recruit(guild.id).reason).toMatch(/full/);
  });

  it('pay their tax at home and keep the rest', () => {
    const world = realm(1);
    const { heroes: [h] } = heroes(world);
    h.gold = 100;
    const taxed = on(world, 'heroTaxed');
    const before = world.economy.gold;
    expect(run(world, 60, () => taxed.length > 0)).toBe(true);
    const tax = Math.floor(100 * REALM.classes.manAtArms.tax);
    expect(taxed[0].tax).toBe(tax);
    expect(h.gold).toBe(100 - tax);
    expect(world.economy.gold).toBe(before + tax);
    expect(h.inside).toBeGreaterThan(0);
    expect(intentOf(world, h)).toMatch(/guild/);
  });

  it('buy forged gear at the smithy with their own gold (the treasury takes a cut)', () => {
    const world = realm(1);
    expect(forgeCheck(world).reason).toMatch(/Smithy/);
    build(world, 'smithy');
    world.economy.earn(REALM.gear[1].cost, 'test');
    expect(world.forge().ok).toBe(true);
    expect(world.realm.gearTier).toBe(1);
    const { heroes: [h] } = heroes(world);
    h.gold = REALM.gear[1].price * 2; // even a frugal hero will buy
    const hpBefore = h.maxHp;
    const bought = on(world, 'heroBought');
    expect(run(world, 90, () => bought.length > 0)).toBe(true);
    expect(h.gear).toBe(1);
    expect(h.gold).toBe(REALM.gear[1].price);
    expect(h.maxHp).toBeGreaterThan(hpBefore);
    expect(world.realm.stats.sales).toBe(Math.round(REALM.gear[1].price * REALM.salesTax));
  });

  it('take the gold for what they fell (not the treasury)', () => {
    const world = realm(1);
    const { heroes: [h] } = heroes(world);
    const outlaw = lairMen(world, world.realm.lairs[0])[0];
    const before = world.economy.gold;
    world._hurt(outlaw, outlaw.hp + 1, 'red', h);
    expect(outlaw.alive).toBe(false);
    expect(h.gold).toBe(Math.round(outlaw.def.reward * REALM.killGold));
    expect(h.kills).toBe(1);
    expect(world.economy.gold).toBe(before);
  });

  it('are gone for good when they fall', () => {
    const world = realm(1);
    const { heroes: [h] } = heroes(world);
    const fell = on(world, 'realmHeroFell');
    world._damageTroop(h, h.hp + 1);
    world.update(DT);
    expect(fell.length).toBe(1);
    expect(world.realm.heroes).not.toContain(h);
    expect(world.realm.fallen[0]).toMatchObject({ name: h.name, cls: 'manAtArms' });
  });
});

describe('bounties', () => {
  it('split by damage, each taker getting at least a floor share, coins all paid out', () => {
    const out = splitByShare(new Map([[1, 90], [2, 10]]), 100);
    expect(out.reduce((s, o) => s + o.gold, 0)).toBe(100);
    const two = out.find((o) => o.id === 2).gold;
    expect(two).toBeGreaterThanOrEqual(Math.floor((100 * REALM.bounty.floor) / 2 / 1.1));
    expect(out.find((o) => o.id === 1).gold).toBeGreaterThan(two);
    expect(splitByShare(new Map(), 50)).toEqual([]);
  });

  it('an explore flag goes to the first hero to reach it, and the fog lifts on the way', () => {
    const world = realm(3);
    const { heroes: [h] } = heroes(world, 1, 'rangersLodge');
    // A walkable fogged spot some way off.
    const g = world.grid;
    let spot = null;
    for (let d = 12; d < 20 && !spot; d++) {
      for (let a = 0; a < 16 && !spot; a++) {
        const x = Math.floor(world.townHall.cx + Math.cos((a / 16) * Math.PI * 2) * d);
        const z = Math.floor(world.townHall.cz + Math.sin((a / 16) * Math.PI * 2) * d);
        if (g.inBounds(x, z) && !g.isBlocked(x, z) && g.get(x, z) === null && !g.isInSpawnZone(x, z) && !seenAt(world, x, z)) spot = { x: x + 0.5, z: z + 0.5 };
      }
    }
    expect(spot).not.toBeNull();
    world.economy.earn(100, 'test');
    const before = world.economy.gold;
    const { ok, flag } = world.placeBounty({ kind: 'explore', ...spot }, 60);
    expect(ok).toBe(true);
    expect(world.economy.gold).toBe(before - 60);
    expect(bountyValue(world, h, flag).value).toBeGreaterThan(0);
    const removed = on(world, 'bountyRemoved');
    expect(run(world, 120, () => removed.length > 0)).toBe(true);
    expect(removed[0]).toMatchObject({ claimed: true });
    expect(removed[0].payouts).toEqual([{ hero: h, gold: 60 }]);
    expect(seenAt(world, spot.x, spot.z)).toBe(true);
  });

  it('topping up a flag adds to it; heroes say why they turn one down', () => {
    const world = realm(1);
    const { heroes: [h] } = heroes(world);
    world.economy.earn(500, 'test');
    world.realm.fog.seen.fill(1);
    for (const l of world.realm.lairs) l.discovered = true;
    const lair = world.realm.lairs[0];
    const first = world.placeBounty({ kind: 'attack', lair: lair.index }, 10);
    const again = world.placeBounty({ kind: 'attack', lair: lair.index });
    expect(again.flag).toBe(first.flag);
    expect(first.flag.gold).toBe(10 + REALM.bounty.step);
    // A lone level-1 hero against a whole camp: too dangerous.
    lair.level = REALM.lairs.maxLevel;
    for (const m of lairMen(world, lair)) m.hp = m.maxHp = 2000;
    expect(bountyValue(world, h, first.flag).why).toBe('too dangerous');
    expect(world.cancelBounty(first.flag.id)).toBe(true);
    expect(world.realm.bounties).toEqual([]);
  });

  it("can't be put on a lair no one has found", () => {
    const world = realm(1);
    const lair = world.realm.lairs.find((l) => !l.discovered);
    expect(world.placeBounty({ kind: 'attack', lair: lair.index }).reason).toMatch(/found/);
  });
});

describe('lairs', () => {
  it('heroes burn a camp once its guards are down: the loot and its bounty go to them, and a new camp rises later', () => {
    const world = realm(1);
    world.realm.fog.seen.fill(1);
    const lair = world.realm.lairs[0];
    lair.discovered = true;
    const { heroes: party } = heroes(world, 3);
    for (const m of lairMen(world, lair)) world._hurt(m, m.hp + 1, 'red', party[0]);
    expect(lairMen(world, lair)).toEqual([]);
    world.economy.earn(100, 'test');
    world.placeBounty({ kind: 'attack', lair: lair.index }, 90);
    const razed = on(world, 'lairRazed');
    const removed = on(world, 'bountyRemoved');
    const purses = () => party.reduce((s, h) => s + h.gold, 0);
    const before = purses();
    expect(run(world, 200, () => razed.length > 0)).toBe(true);
    expect(lair.razed).toBe(true);
    expect(removed.some((e) => e.claimed && e.flag.lair === lair.index)).toBe(true);
    // Loot and bounty (less any tax they've paid on the way home since) are in the heroes' purses.
    expect(purses() + party.reduce((s, h) => s + h.taxPaid, 0) - before).toBeGreaterThanOrEqual(razed[0].loot + 90 - 1);
    expect(world.realm.stats.lairsRazed).toBe(1);
    const rose = on(world, 'lairRose');
    const standing = world.realm.lairs.filter((l) => !l.razed).length;
    expect(run(world, REALM.lairs.respawn + 5, () => rose.length > 0)).toBe(true);
    expect(world.realm.lairs.filter((l) => !l.razed).length).toBe(standing + 1);
    expect(rose[0].lair.index).toBe(world.realm.lairs.length - 1);
  });

  it('refill their guards a while after they all fall', () => {
    const world = realm(1);
    const lair = world.realm.lairs[0];
    for (const m of lairMen(world, lair)) world._hurt(m, m.hp + 1, 'red');
    expect(lair.refillAt).toBe(world.time + REALM.lairs.refill);
    run(world, REALM.lairs.refill + 1);
    expect(lairMen(world, lair).length).toBeGreaterThanOrEqual(REALM.lairs.guards.length);
  });

  it('grow stronger, and send raiders at the town that Barracks soldiers fight off', () => {
    const world = realm(1);
    const grew = on(world, 'lairGrew');
    world.realm.lairs[0].nextGrow = 0;
    world.update(DT);
    expect(grew.length).toBe(1);
    expect(world.realm.lairs[0].level).toBe(2);

    const barracks = build(world, 'barracks');
    run(world, 20); // the Barracks fills
    const raids = on(world, 'raidSent');
    const lair = world.realm.lairs[0];
    lair.nextRaid = 0;
    world.update(DT);
    expect(raids.length).toBe(1);
    const party = raids[0].party;
    expect(party.length).toBeGreaterThanOrEqual(REALM.lairs.raid.length);
    for (const u of party) expect(u.realm).toBe('raider');
    // Soldiers go for raiders that come near their post.
    for (const u of party) {
      u.x = barracks.post.x + 0.5 + 1;
      u.z = barracks.post.z + 0.5;
      u.tx = Math.floor(u.x);
      u.tz = Math.floor(u.z);
    }
    expect(run(world, 60, () => party.every((u) => !u.alive))).toBe(true);
  });
});

describe('a realm at play', () => {
  it('can be picked on the map: heroes, found lairs, explore flags', () => {
    const world = realm(1);
    const { heroes: [h] } = heroes(world);
    expect(realmThingAt(world, h.x, h.z)).toMatchObject({ kind: 'hero', unit: h });
    const lair = world.realm.lairs[0];
    lair.discovered = true;
    for (const m of lairMen(world, lair)) world._removeTroop(m, 'dismissed');
    expect(realmThingAt(world, lair.cx, lair.cz)).toMatchObject({ kind: 'lair', lair });
  });

  for (const seed of [1, 2]) {
    it(`seed ${seed}: twenty minutes of a simple player, with no one stuck for long and the same each time`, () => {
      const play = () => {
        const world = realm(seed);
        build(world, 'warriorsHall');
        build(world, 'archerTower');
        const plan = ['rangersLodge', 'archerTower', 'smithy', 'archerTower', 'cannonTower', 'roguesDen', 'archerTower', 'cannonTower'];
        let next = 0;
        const stuck = new Map(); // hero id → [x, z, since]
        let longestStill = 0;
        for (let tick = 0; tick < 1200 / DT && world.phase !== 'gameover'; tick++) {
          world.update(DT);
          if (tick % 60) continue;
          for (const g of [...world.buildings.values()].filter((b) => b.def.guild)) {
            if (world.realm.heroes.filter((h) => h.guildId === g.id).length < 2 && world.economy.gold > 120) world.recruit(g.id);
          }
          if (next < plan.length && world.economy.gold >= BUILDINGS[plan[next]].cost + 30) {
            try {
              build(world, plan[next]);
              next++;
            } catch {
              next++;
            }
          }
          for (const h of world.realm.heroes) {
            const s = stuck.get(h.id);
            if (!s || Math.hypot(s[0] - h.x, s[1] - h.z) > 0.5 || h.inside > 0 || h.fighting) stuck.set(h.id, [h.x, h.z, world.time]);
            else longestStill = Math.max(longestStill, world.time - s[2]);
          }
        }
        return { world, longestStill };
      };
      const { world, longestStill } = play();
      const r = world.realm;
      expect(world.waves.wave).toBeGreaterThanOrEqual(3);
      expect(r.stats.taxes).toBeGreaterThan(0);
      expect(r.heroes.length + r.fallen.length).toBeGreaterThanOrEqual(4);
      expect(r.lairs.some((l) => l.discovered)).toBe(true);
      expect(longestStill).toBeLessThan(60);
      for (const h of r.heroes) {
        expect(Number.isFinite(h.x) && Number.isFinite(h.z)).toBe(true);
        expect(h.gold).toBeGreaterThanOrEqual(0);
      }
      const again = play().world;
      expect(again.time).toBe(world.time);
      expect(again.realm.stats).toEqual(r.stats);
      expect(again.economy.gold).toBe(world.economy.gold);
    });
  }
});
