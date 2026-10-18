import { REALM } from '../config.js';
import { dist } from '../troops.js';

/**
 * Realm's bounty flags (REALM.bounty): the player's way of steering heroes, after Majesty. Pure: no DOM, no three.js.
 * Gold goes into a flag when it's placed or topped up, and isn't given back. Two kinds:
 *  attack   on a lair or a foe: shared, when it falls, by every hero who hurt it (by damage, with at least
 *           REALM.bounty.floor of an equal share each). If no hero hurt it (a tower got it), the gold comes back.
 *  explore  on a spot: the first hero to reach it takes it all.
 * Heroes weigh flags in heroes.js (bountyValue); each flag keeps the heroes who've taken it on (`takers`).
 * A flag is { id, kind, x, z, gold, lair (index) | unit, takers: Set of hero ids }.
 */

/** Where a flag is now (a foe's flag follows it). */
export function flagSpot(world, f) {
  if (f.lair !== undefined) {
    const l = world.realm.lairs[f.lair];
    return { x: l.cx, z: l.cz };
  }
  if (f.unit) return { x: f.unit.x, z: f.unit.z };
  return { x: f.x, z: f.z };
}

/**
 * Place a flag (or top up the one already on that target): `{ kind: 'attack', lair }` (a lair's index),
 * `{ kind: 'attack', unit }` (a foe: an enemy soldier, outlaw or raider), or `{ kind: 'explore', x, z }`.
 * `gold` defaults to REALM.bounty.base. Returns { ok, reason, flag }.
 */
export function placeBounty(world, spec, gold = REALM.bounty.base) {
  const r = world.realm;
  if (world.phase === 'gameover') return { ok: false, reason: 'The battle is over' };
  if (spec.kind === 'attack') {
    if (spec.lair !== undefined) {
      const lair = r.lairs[spec.lair];
      if (!lair || lair.razed) return { ok: false, reason: 'Nothing there to attack' };
      if (!lair.discovered) return { ok: false, reason: 'No one has found that yet' };
    } else if (!spec.unit?.alive || spec.unit.team === 'red') return { ok: false, reason: 'Nothing there to attack' };
  } else if (spec.kind === 'explore') {
    if (!world.grid.inBounds(Math.floor(spec.x), Math.floor(spec.z))) return { ok: false, reason: 'Off the map' };
  } else return { ok: false, reason: 'No such flag' };
  const existing = r.bounties.find((f) => f.kind === spec.kind && (spec.lair !== undefined ? f.lair === spec.lair : spec.unit ? f.unit === spec.unit : Math.hypot(f.x - spec.x, f.z - spec.z) < 1.5));
  if (existing) return fundBounty(world, existing.id, REALM.bounty.step);
  if (!world.economy.spend(gold)) return { ok: false, reason: 'Not enough gold' };
  const flag = { id: world._nextId++, kind: spec.kind, gold, takers: new Set(), placedAt: world.time };
  if (spec.lair !== undefined) flag.lair = spec.lair;
  else if (spec.unit) flag.unit = spec.unit;
  else Object.assign(flag, { x: spec.x, z: spec.z });
  r.bounties.push(flag);
  world.events.emit('bountyPlaced', { flag });
  return { ok: true, reason: null, flag };
}

/** Add `gold` to flag `id`. */
export function fundBounty(world, id, gold = REALM.bounty.step) {
  const flag = world.realm.bounties.find((f) => f.id === id);
  if (!flag) return { ok: false, reason: 'That flag is gone' };
  if (world.phase === 'gameover') return { ok: false, reason: 'The battle is over' };
  if (!world.economy.spend(gold)) return { ok: false, reason: 'Not enough gold' };
  flag.gold += gold;
  world.events.emit('bountyFunded', { flag, gold });
  return { ok: true, reason: null, flag };
}

/** Take flag `id` down. Its gold isn't given back (heroes may already be on their way). */
export function cancelBounty(world, id) {
  const r = world.realm;
  const i = r.bounties.findIndex((f) => f.id === id);
  if (i < 0) return false;
  const [flag] = r.bounties.splice(i, 1);
  world.events.emit('bountyRemoved', { flag, claimed: false });
  return true;
}

/** Split `gold` among heroes by `shares` (hero id → damage), each getting at least `floor` of an equal share. */
export function splitByShare(shares, gold) {
  const entries = [...shares.entries()].filter(([, d]) => d > 0);
  if (!entries.length) return [];
  const total = entries.reduce((s, [, d]) => s + d, 0);
  const floor = REALM.bounty.floor / entries.length;
  const raw = entries.map(([id, d]) => [id, Math.max(d / total, floor)]);
  const sum = raw.reduce((s, [, w]) => s + w, 0);
  // Whole coins, the odd ones to the biggest shares.
  const out = raw.map(([id, w]) => ({ id, gold: Math.floor((gold * w) / sum), w }));
  let left = gold - out.reduce((s, o) => s + o.gold, 0);
  for (const o of [...out].sort((a, b) => b.w - a.w)) {
    if (left <= 0) break;
    o.gold++;
    left--;
  }
  return out.map(({ id, gold }) => ({ id, gold }));
}

/** Pay out flag `flag` by `shares`; refunds the treasury if there's no one to pay. */
function payOut(world, flag, shares) {
  const r = world.realm;
  r.bounties = r.bounties.filter((f) => f !== flag);
  const payouts = [];
  for (const { id, gold } of splitByShare(shares, flag.gold)) {
    const h = r.heroes.find((x) => x.id === id && x.alive);
    if (!h) continue;
    h.gold += gold;
    payouts.push({ hero: h, gold });
  }
  const paid = payouts.reduce((s, p) => s + p.gold, 0);
  if (paid < flag.gold) world.economy.earn(flag.gold - paid, 'refund');
  world.events.emit('bountyRemoved', { flag, claimed: payouts.length > 0, payouts });
  return payouts;
}

/** A foe fell: pay any flag on it to the heroes who hurt it. */
export function unitFell(world, u) {
  const flag = world.realm.bounties.find((f) => f.unit === u);
  if (flag) payOut(world, flag, u.dmgBy ?? new Map());
}

/** A lair burnt down: pay any flag on it to the heroes who fought it. */
export function lairFell(world, lair) {
  const flag = world.realm.bounties.find((f) => f.lair === lair.index);
  if (flag) payOut(world, flag, lair.dmgBy);
}

/** Each tick: explore flags claimed by whoever reaches them first; flags on foes that have left the map dropped. */
export function updateBounties(world) {
  const r = world.realm;
  for (const flag of [...r.bounties]) {
    if (flag.unit && !flag.unit.alive) {
      payOut(world, flag, flag.unit.dmgBy ?? new Map());
      continue;
    }
    if (flag.kind !== 'explore') continue;
    for (const h of r.heroes) {
      if (!h.alive || h.inside > 0 || dist(h, flag) > REALM.bounty.reach) continue;
      payOut(world, flag, new Map([[h.id, 1]]));
      break;
    }
  }
}

/** The flags heroes can see: on found lairs and foes, and explore flags anywhere (even in the fog). */
export function liveBounties(world) {
  return world.realm.bounties.filter((f) => f.kind === 'explore' || f.unit || (f.lair !== undefined && world.realm.lairs[f.lair].discovered));
}
