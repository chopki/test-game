import { BUILDINGS, REALM } from '../config.js';
import { createRng } from '../rng.js';
import { reveal, seenAt, setupFog, updateFog } from './fog.js';
import { guardFell, placeLairs, updateGuard, updateLairs, updateRaider } from './lairs.js';
import { cancelBounty, fundBounty, lairFell, placeBounty, splitByShare, unitFell, updateBounties } from './bounties.js';
import { heroFell, heroKill, recruit, updateHero } from './heroes.js';

/**
 * Realm mode (`World({ mode: 'realm' })`): a kingdom in the wilds, after Majesty (docs/research/). Survival's town,
 * walls, towers and night waves, plus heroes who act on their own (heroes.js), lairs in the wilds (lairs.js), bounty
 * flags to steer the heroes (bounties.js) and the fog of war (fog.js). Pure: no DOM, no three.js.
 *
 * Everything Realm keeps is in `world.realm`; World calls in here at a handful of points (setupRealm, updateRealm,
 * updateRealmUnit, realmHit, realmKill, canPlaceInRealm), so the mode can be lifted out into a game of its own.
 *
 * Events: heroRecruited, heroBark, heroTaxed, heroBought, heroLevelUp, realmHeroFell, lairFound, lairGrew, lairHit,
 * lairCleared, lairRazed, lairRose, raidSent, bountyPlaced, bountyFunded, bountyRemoved, gearForged.
 */
export function setupRealm(world) {
  const rng = createRng(world.seed ^ 0x2ea1a);
  const names = [...REALM.names];
  for (let i = names.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [names[i], names[j]] = [names[j], names[i]];
  }
  world.realm = {
    rng,
    heroes: [],
    lairs: [],
    rising: [], // when the next lairs rise (after one is razed)
    bounties: [],
    fallen: [],
    names,
    nameIndex: 0,
    gearTier: 0, // the best gear the smithies have forged (an index into REALM.gear)
    buildable: new Set(REALM.buildable), // what can be built (see World.offers)
    stats: { taxes: 0, sales: 0, lairsRazed: 0, heroesLost: 0 },
    fogTimer: 0,
    onLairRazed: (lair, loot) => lairRazed(world, lair, loot),
  };
  setupFog(world);
  placeLairs(world);
  for (const lair of world.realm.lairs) lair.discovered = seenAt(world, lair.cx, lair.cz);
}

/** Each tick, before the soldiers move. */
export function updateRealm(world, dt) {
  const r = world.realm;
  updateLairs(world, dt);
  updateBounties(world);
  if ((r.fogTimer -= dt) <= 0) {
    r.fogTimer = 0.5;
    updateFog(world);
  }
  r.heroes = r.heroes.filter((h) => h.alive);
}

/** A Realm unit's turn (heroes, lair guards, raiders): true if it was one. */
export function updateRealmUnit(world, t, dt) {
  if (t.realm === 'hero') updateHero(world, t, dt);
  else if (t.realm === 'guard') updateGuard(world, t, dt);
  else if (t.realm === 'raider') updateRaider(world, t, dt);
  else return false;
  return true;
}

/** `target` was hurt by `amount` from `source` (a hero, a soldier, a tower's shot…): note what heroes did. */
export function realmHit(world, target, amount, source) {
  if (source) target.lastAttacker = source;
  if (source?.realm !== 'hero') return;
  target.dmgBy ??= new Map();
  target.dmgBy.set(source.id, (target.dmgBy.get(source.id) ?? 0) + amount);
  if (target.realm === 'guard') {
    const lair = world.realm.lairs[target.lairIndex];
    lair.dmgBy.set(source.id, (lair.dmgBy.get(source.id) ?? 0) + amount);
  }
}

/**
 * `victim` fell (an enemy soldier, an outlaw, or one of the player's own): heroes get the gold for what they fell
 * (otherwise the treasury does, as in Survival), and bounties, lairs and the hero rolls are kept up.
 * Returns true if a hero took the reward (so the treasury doesn't).
 */
export function realmKill(world, victim, source) {
  if (victim.realm === 'hero') heroFell(world, victim);
  if (victim.realm === 'guard') guardFell(world, victim);
  if (victim.team !== 'red') unitFell(world, victim);
  if (victim.team === 'red') return false;
  if (source?.realm === 'hero' && source.alive) {
    heroKill(world, source, victim);
    return true;
  }
  if (victim.team === 'neutral') world.economy.earn(victim.def.reward, 'kill');
  return false;
}

/** A lair burnt down: its loot to the heroes who fought it (and are still near), and any bounty on it. */
function lairRazed(world, lair, loot) {
  const r = world.realm;
  r.stats.lairsRazed++;
  const near = new Map([...lair.dmgBy].filter(([id]) => r.heroes.some((h) => h.id === id && h.alive && Math.hypot(h.x - lair.cx, h.z - lair.cz) < 8)));
  const payouts = [];
  for (const { id, gold } of splitByShare(near, loot)) {
    const h = r.heroes.find((x) => x.id === id);
    h.gold += gold;
    h.earned += gold;
    payouts.push({ hero: h, gold });
  }
  lairFell(world, lair);
  reveal(world, lair.cx, lair.cz, 4);
  world.events.emit('lairRazed', { lair, loot, payouts });
}

/** Whether `type` may be built at (x, z) in a Realm: not in the fog, nor on a lair. { ok, reason } or null if fine. */
export function canPlaceInRealm(world, type, x, z) {
  const size = BUILDINGS[type].size;
  for (let dz = 0; dz < size; dz++) {
    for (let dx = 0; dx < size; dx++) {
      if (!seenAt(world, x + dx, z + dz)) return { ok: false, reason: 'Unexplored: send someone to look first' };
    }
  }
  for (const lair of world.realm.lairs) {
    if (lair.razed) continue;
    if (x < lair.x + lair.size && x + size > lair.x && z < lair.z + lair.size && z + size > lair.z) return { ok: false, reason: 'An outlaw camp is there' };
  }
  return null;
}

/** Forge the smithies' next tier of gear (heroes can buy it from then on): { ok, reason, cost, gear }. */
export function forgeCheck(world) {
  const next = REALM.gear[world.realm.gearTier + 1];
  if (!next) return { ok: false, reason: 'The best gear is forged', cost: null };
  if (![...world.buildings.values()].some((b) => b.def.shop && b.team === 'red')) return { ok: false, reason: 'Needs a Smithy', cost: next.cost, gear: next };
  if (!world.economy.canAfford(next.cost)) return { ok: false, reason: 'Not enough gold', cost: next.cost, gear: next };
  return { ok: true, reason: null, cost: next.cost, gear: next };
}

export function forge(world) {
  const check = forgeCheck(world);
  if (!check.ok) return check;
  world.economy.spend(check.cost);
  world.realm.gearTier++;
  world.events.emit('gearForged', { gear: check.gear, tier: world.realm.gearTier });
  return check;
}

/** The unit of the realm's foes, lair or flag at or by (x, z), for picking on the map. */
export function realmThingAt(world, x, z) {
  const r = world.realm;
  let best = null;
  let bestD = 0.9;
  for (const t of world.troops) {
    if (!t.alive || t.inside > 0 || (t.team === 'neutral' && !seenAt(world, t.x, t.z))) continue;
    const d = Math.hypot(t.x - x, t.z - z);
    if (d < bestD) [best, bestD] = [{ kind: t.realm === 'hero' ? 'hero' : 'unit', unit: t }, d];
  }
  for (const e of world.enemies) {
    const d = Math.hypot(e.x - x, e.z - z);
    if (e.alive && d < bestD) [best, bestD] = [{ kind: 'unit', unit: e }, d];
  }
  if (best) return best;
  for (const f of r.bounties) {
    if (f.kind === 'explore' && Math.hypot(f.x - x, f.z - z) < 0.9) return { kind: 'flag', flag: f };
  }
  for (const lair of r.lairs) {
    if (!lair.discovered || lair.razed) continue;
    if (x >= lair.x - 0.3 && x < lair.x + lair.size + 0.3 && z >= lair.z - 0.3 && z < lair.z + lair.size + 0.3) return { kind: 'lair', lair };
  }
  return null;
}

export { cancelBounty, fundBounty, placeBounty, recruit };
