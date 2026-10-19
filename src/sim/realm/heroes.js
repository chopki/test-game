import { BUILDINGS, REALM } from '../config.js';
import { dist, findPost, reachOf, troopPassable, walkTo } from '../troops.js';
import { damageLair, lairMen } from './lairs.js';
import { nearestUnseen, seenAt } from './fog.js';
import { flagSpot, liveBounties } from './bounties.js';

/**
 * Realm's heroes (REALM.classes): recruited at guilds, then on their own. Pure: no DOM, no three.js. A hero is one of
 * `world.troops` (team 'red', `hero: true`, `realm: 'hero'`), and also in `world.realm.heroes`.
 *
 * How a hero decides (every REALM.think seconds, after Majesty's "thought process"; see docs/research/01-majesty.md):
 *  1. Foes in sight: fight the nearest if its side's strength × self-estimate beats theirs × enemy-estimate, else
 *     keep away (run home if they're close). Badly hurt (below `fleeAt` of its health): run home.
 *  2. Hurt (below REALM.restBelow), or carrying REALM.carryHome gold or more: home, to pay tax and rest.
 *  3. Keep at what it's doing, unless a bounty flag is worth a third more than the one it's on.
 *  4. Otherwise: the best bounty flag worth its while (bountyValue); new gear if it can afford it; else down its
 *     class's `plan`, each activity tried with its chance: defend (a building under attack), hunt (the nearest
 *     foe), raid (a lair it thinks it can take), patrol (round the Town Hall), explore (the nearest fog), home.
 *     Failing all of those, it wanders near its guild.
 * Gold it earns (kills, bounties, loot) goes into its purse; at home it pays its class's `tax` share to the
 * treasury. It buys the smithy's gear with its own gold. A hero that falls is gone for good.
 */

const BARKS = {
  fight: ['Have at you!', 'For the realm!', 'A foul beast approaches!'],
  flee: ["I'm out of here!", 'Too many of them!', 'Call in the reinforcements!'],
  home: ['Home to count my coin.', 'Time for a rest.', 'Back to the guild.'],
  bounty: ['A bounty? On my way!', 'That gold is mine.', 'Problem? I am on my way!'],
  raid: ["Let's burn them out!", 'Their camp falls today.'],
  explore: ["What's over that hill?", "Off to see what's out there.", 'Uncharted land!'],
  shop: ['New steel for me.', 'Time for better gear.'],
  defend: ['To the defence!', 'They dare attack us?'],
};

/** A hero's trait modifiers, all traits added up. */
function traitMods(traits) {
  const m = { selfEst: 1, fleeAt: 0, greed: 0, carry: 1, hp: 0, speed: 0, explore: 1, range: 1 };
  for (const key of traits) {
    const t = REALM.traits.list[key];
    if (t.selfEst) m.selfEst *= t.selfEst;
    if (t.fleeAt) m.fleeAt += t.fleeAt;
    if (t.greed) m.greed += t.greed;
    if (t.carry) m.carry *= t.carry;
    if (t.hp) m.hp += t.hp;
    if (t.speed) m.speed += t.speed;
    if (t.explore) m.explore *= t.explore;
    if (t.range) m.range *= t.range;
  }
  return m;
}

/** A hero's stats now: its class's, grown by its level and gear, and changed by its traits. */
export function heroDef(h) {
  const cls = REALM.classes[h.cls];
  const s = cls.stats;
  const k = 1 + REALM.perLevel * (h.level - 1);
  const gear = REALM.gear[h.gear];
  return {
    ...s,
    name: h.name,
    title: cls.name,
    maxHp: Math.round(s.maxHp * (k + gear.hp + h.mods.hp)),
    damage: s.damage * (k + gear.damage),
    speed: s.speed * (1 + h.mods.speed),
    reward: 0,
  };
}

/** Set a hero's stats again (after a level or new gear), keeping the damage it has taken. */
function restat(h) {
  const def = heroDef(h);
  h.hp += def.maxHp - h.maxHp;
  h.maxHp = def.maxHp;
  h.def = def;
}

/** The living heroes whose home is guild `guildId`. */
export const heroesOf = (world, guildId) => world.realm.heroes.filter((h) => h.alive && h.guildId === guildId);

/** Whether guild `guild` (a building) can take on another hero now: { ok, reason, cost, cls }. */
export function recruitCheck(world, guild) {
  const clsKey = guild?.def.guild;
  const cls = REALM.classes[clsKey];
  if (!cls || world.buildings.get(guild.id) !== guild) return { ok: false, reason: 'Not a guild', cost: null };
  const fail = (reason) => ({ ok: false, reason, cost: cls.cost, cls: clsKey });
  if (world.phase === 'gameover') return fail('The battle is over');
  if (heroesOf(world, guild.id).length >= REALM.guildCap) return fail(`The guild is full (${REALM.guildCap} heroes)`);
  if (!findPost(world, guild).door) return fail('Walled in: leave the guild a way out');
  if (!world.economy.canAfford(cls.cost)) return fail('Not enough gold');
  return { ok: true, reason: null, cost: cls.cost, cls: clsKey };
}

/** Take on a hero at guild `guildId`: { ok, reason, hero }. */
export function recruit(world, guildId) {
  const guild = world.buildings.get(guildId);
  const check = recruitCheck(world, guild);
  if (!check.ok) return check;
  world.economy.spend(check.cost);
  const hero = spawnHero(world, guild, check.cls);
  return { ok: true, reason: null, hero };
}

function spawnHero(world, guild, clsKey) {
  const r = world.realm;
  const cls = REALM.classes[clsKey];
  const keys = Object.keys(REALM.traits.list);
  const traits = [];
  while (traits.length < REALM.traits.perHero) {
    const t = r.rng.pick(keys);
    if (!traits.includes(t)) traits.push(t);
  }
  const { door } = findPost(world, guild);
  const name = r.names[r.nameIndex++ % r.names.length];
  const h = {
    id: world._nextId++,
    hero: true,
    realm: 'hero',
    cls: clsKey,
    type: cls.type,
    team: 'red',
    name,
    traits,
    mods: traitMods(traits),
    level: 1,
    xp: 0,
    gold: 0,
    gear: 0,
    guildId: guild.id,
    x: door.x + 0.5,
    z: door.z + 0.5,
    tx: door.x,
    tz: door.z,
    hp: 0,
    maxHp: 0,
    heading: Math.atan2(door.x + 0.5 - guild.cx, door.z + 0.5 - guild.cz),
    moving: false,
    fighting: false,
    attackTimer: 0,
    target: null,
    path: null,
    pathKey: -1,
    repath: 0,
    slowFactor: 1,
    slowUntil: 0,
    goal: null,
    thinkIn: r.rng.next() * REALM.think,
    inside: 0,
    bark: null,
    kills: 0,
    earned: 0,
    taxPaid: 0,
    since: { x: door.x + 0.5, z: door.z + 0.5, t: world.time },
    alive: true,
  };
  h.def = heroDef(h);
  h.hp = h.maxHp = h.def.maxHp;
  r.heroes.push(h);
  world.troops.push(h);
  world.events.emit('heroRecruited', { hero: h, guild });
  return h;
}

// ---------------------------------------------------------------- strength, foes, allies

/** How strong a fighter is: health × damage a second. */
const power = (u) => (Math.max(0, u.hp) * u.def.damage) / u.def.attackCooldown;

/** Foes of the realm within `r` of (x, z): the enemy army and the outlaws (in the fog too). */
function foesNear(world, x, z, r) {
  const out = [];
  for (const e of world.enemies) if (e.alive && Math.hypot(e.x - x, e.z - z) <= r) out.push(e);
  for (const t of world.troops) if (t.alive && t.team === 'neutral' && Math.hypot(t.x - x, t.z - z) <= r) out.push(t);
  return out;
}

/** The player's fighters (heroes and soldiers, out of doors) within `r` of (x, z). */
function alliesNear(world, x, z, r) {
  return world.troops.filter((t) => t.alive && t.team === 'red' && !(t.inside > 0) && Math.hypot(t.x - x, t.z - z) <= r);
}

const strengthOf = (list) => list.reduce((s, u) => s + power(u), 0);

/**
 * Whether hero `h` dares take on `foes`, with the allies round it and `party` (heroes on the same errand) on its side.
 * `boost` > 1 for a fat bounty; `committed` once it has set out (it takes on worse odds then, rather than turning
 * back as the foes come into view). The same reckoning is used when it takes the errand on and when it gets there.
 */
function dares(world, h, foes, { boost = 1, party = [], committed = false } = {}) {
  if (!foes.length) return true;
  const allies = new Set(alliesNear(world, h.x, h.z, REALM.courage.group));
  for (const p of party) if (p.alive && !(p.inside > 0)) allies.add(p);
  allies.add(h);
  const cls = REALM.classes[h.cls];
  const nerve = committed ? REALM.courage.committed : 1;
  return strengthOf([...allies]) * cls.selfEst * h.mods.selfEst * boost * nerve >= strengthOf(foes) * cls.enemyEst;
}

/** What hero goal `g` is out to attack: a lair (raiding it, or for a bounty on it), a foe with a bounty on it, or null. */
function errandOf(world, g) {
  if (g?.kind === 'raid') return g.lair;
  if (g?.kind === 'bounty' && g.flag.kind === 'attack') return g.flag.lair !== undefined ? world.realm.lairs[g.flag.lair] : g.flag.unit;
  return null;
}

/** The heroes out on errand `target` (see errandOf), besides `h`; within `r` tiles of `h` if given. */
function partyFor(world, h, target, r = Infinity) {
  return world.realm.heroes.filter((o) => o !== h && o.alive && !(o.inside > 0) && errandOf(world, o.goal) === target && dist(o, h) <= r);
}

/** Whether foe `u` is part of errand `target`: the foe itself, or one of the lair's men (its guards, or raiders). */
const partOf = (u, target) => u === target || (target?.lair && u.lairIndex === target.index);

/** An explore flag another hero on it is nearer to (so `h` would likely get there second). */
const outrun = (world, h, f) => [...f.takers].some((id) => id !== h.id && world.realm.heroes.some((o) => o.id === id && o.alive && !(o.inside > 0) && dist(o, f) < dist(h, f)));

// ---------------------------------------------------------------- bounties

/**
 * What flag `f` is worth to hero `h` (0 if it won't take it on), and why not: its gold, weighted by the hero's
 * greed and liking for that kind of flag, less for distance; attack flags only if it dares (a bigger bounty
 * makes heroes braver).
 */
export function bountyValue(world, h, f) {
  const cls = REALM.classes[h.cls];
  const spot = flagSpot(world, f);
  const d = Math.hypot(spot.x - h.x, spot.z - h.z);
  if (d > REALM.bounty.seeAll * h.mods.range) return { value: 0, why: 'too far' };
  const greed = cls.greed + h.mods.greed;
  const like = (cls.likes[f.kind] ?? 1) * (f.kind === 'explore' ? h.mods.explore : 1);
  const value = (f.gold * (0.5 + greed / 12) * like) / (1 + d / 10);
  if (f.kind === 'attack') {
    // Reckoned with the heroes already on it, wherever they are (they'll be there too).
    const target = f.lair !== undefined ? world.realm.lairs[f.lair] : f.unit;
    const foes = f.lair !== undefined ? lairMen(world, target) : [f.unit];
    if (!dares(world, h, foes, { boost: 1 + f.gold / 100, party: partyFor(world, h, target) })) return { value: 0, why: 'too dangerous' };
  } else if (outrun(world, h, f)) {
    return { value: 0, why: 'someone nearer is on it' }; // it'd only get there second
  }
  if (value < REALM.bounty.tempt) return { value: 0, why: 'not worth it' };
  return { value, why: null };
}

/** The flag most worth hero `h`'s while, or null; notes on each flag why the hero turned it down. */
function bestBounty(world, h) {
  let best = null;
  for (const f of liveBounties(world)) {
    const { value, why } = bountyValue(world, h, f);
    f.refusals ??= new Map();
    if (why) f.refusals.set(h.id, why);
    else f.refusals.delete(h.id);
    if (value > 0 && (!best || value > best.value)) best = { flag: f, value };
  }
  return best;
}

// ---------------------------------------------------------------- goals

function setGoal(world, h, goal) {
  const old = h.goal;
  if (old?.kind === 'bounty') old.flag.takers.delete(h.id);
  h.goal = goal;
  h.path = null;
  h.repath = 0;
  h.since = { x: h.x, z: h.z, t: world.time };
  if (goal?.kind === 'bounty') goal.flag.takers.add(h.id);
  if (goal && goal.kind !== old?.kind && BARKS[goal.kind] && world.time - (h.bark?.at ?? -99) > 6) {
    h.bark = { text: world.realm.rng.pick(BARKS[goal.kind]), at: world.time, kind: goal.kind };
    world.events.emit('heroBark', { hero: h, text: h.bark.text });
  }
}

/** The hero's home: its guild if it stands, else the Town Hall. */
function homeOf(world, h) {
  return world.buildings.get(h.guildId) ?? world.townHall;
}

/** Whether hero `h`'s goal still makes sense. */
function goalValid(world, h) {
  const g = h.goal;
  if (!g) return false;
  const r = world.realm;
  switch (g.kind) {
    case 'fight':
      return g.unit.alive && !(g.unit.inside > 0) && dist(g.unit, h) < REALM.sight * 1.6;
    case 'bounty':
      return r.bounties.includes(g.flag) && !(g.flag.kind === 'explore' && outrun(world, h, g.flag));
    case 'raid':
      return !g.lair.razed;
    case 'explore':
      return !seenAt(world, g.x, g.z);
    case 'defend':
      return world.buildings.get(g.building.id) === g.building && world.time - (g.building.lastHit ?? -99) < 6;
    case 'shop':
      return world.buildings.get(g.building.id) === g.building && h.gear < r.gearTier && h.gold >= REALM.gear[h.gear + 1].price;
    default:
      return true; // home, flee, patrol, wander: until they get there
  }
}

const passableAt = (world) => {
  const passable = troopPassable(world);
  return (x, z) => world.grid.inBounds(x, z) && !world.grid.isInSpawnZone(x, z) && passable(x, z);
};

/** A walkable spot `near`–`far` tiles from (x, z), picked at random; or null. */
function spotNear(world, x, z, near, far) {
  const ok = passableAt(world);
  for (let i = 0; i < 12; i++) {
    const a = world.realm.rng.next() * Math.PI * 2;
    const d = near + world.realm.rng.next() * (far - near);
    const tx = Math.floor(x + Math.cos(a) * d);
    const tz = Math.floor(z + Math.sin(a) * d);
    if (ok(tx, tz)) return { x: tx + 0.5, z: tz + 0.5 };
  }
  return null;
}

/** Try one activity from a class's plan; returns the goal it leads to, or null. */
function tryActivity(world, h, act) {
  const r = world.realm;
  const range = h.mods.range;
  switch (act) {
    case 'defend': {
      let best = null;
      for (const b of world.buildings.values()) {
        if (b.team !== 'red' || world.time - (b.lastHit ?? -99) > 3) continue;
        const d = world._distanceTo(b, h.x, h.z);
        if (d < 16 * range && (!best || d < best.d)) best = { b, d };
      }
      return best && { kind: 'defend', building: best.b };
    }
    case 'hunt': {
      let best = null;
      for (const u of foesNear(world, h.x, h.z, 14 * range)) {
        if (u.realm === 'guard' || !seenAt(world, u.x, u.z)) continue; // guards are for raids
        const d = dist(u, h);
        if (!best || d < best.d) best = { u, d };
      }
      return best && dares(world, h, foesNear(world, best.u.x, best.u.z, REALM.courage.group)) ? { kind: 'fight', unit: best.u } : null;
    }
    case 'raid': {
      let best = null;
      for (const lair of r.lairs) {
        if (lair.razed || !lair.discovered) continue;
        const d = Math.hypot(lair.cx - h.x, lair.cz - h.z);
        if (d > 26 * range || (best && d >= best.d)) continue;
        // Only with friends (or alone if it's strong enough), and never against a full camp's worth alone.
        if (dares(world, h, lairMen(world, lair), { party: partyFor(world, h, lair) })) best = { lair, d };
      }
      return best && { kind: 'raid', lair: best.lair };
    }
    case 'patrol': {
      const hall = world.townHall;
      const at = spotNear(world, hall.cx, hall.cz, 5, 10 * Math.min(1, range + 0.2));
      return at && { kind: 'patrol', ...at };
    }
    case 'explore': {
      const at = nearestUnseen(world, h.x, h.z, 34 * range * Math.min(1.4, h.mods.explore));
      return at && { kind: 'explore', ...at };
    }
    case 'home':
      return h.hp < h.maxHp * 0.95 || h.gold > 0 ? { kind: 'home' } : null;
    default:
      return null;
  }
}

/** The nearest smithy that sells better gear than hero `h` has and it can afford, or null. */
function shopFor(world, h) {
  const r = world.realm;
  if (h.gear >= r.gearTier || h.gold < REALM.gear[h.gear + 1].price * h.mods.carry) return null;
  let best = null;
  for (const b of world.buildings.values()) {
    if (b.team !== 'red' || !b.def.shop) continue;
    const d = world._distanceTo(b, h.x, h.z);
    if (!best || d < best.d) best = { b, d };
  }
  return best?.b ?? null;
}

/** Hero `h` decides what to do (see the top of this file). */
function think(world, h) {
  const cls = REALM.classes[h.cls];
  const fleeAt = Math.max(0.05, cls.fleeAt + h.mods.fleeAt);
  const g = h.goal;
  // 1. Foes in sight.
  const foes = foesNear(world, h.x, h.z, REALM.sight).sort((a, b) => dist(a, h) - dist(b, h));
  if (h.hp < h.maxHp * fleeAt) {
    if (g?.kind !== 'flee' && (foes.length || g?.kind !== 'home')) setGoal(world, h, { kind: foes.length ? 'flee' : 'home' });
    return;
  }
  if (foes.length) {
    if (g?.kind === 'fight' && goalValid(world, h)) return;
    if (g?.kind === 'flee') return;
    const near = foes[0];
    const group = foesNear(world, near.x, near.z, REALM.courage.group);
    // On its way to burn a camp or fell a foe: its men coming at it are what it set out for. It reckons the odds as
    // when it took the errand on (the bounty, the others on it), with the nerve of having set out.
    const target = errandOf(world, g);
    if (target && goalValid(world, h) && group.every((u) => partOf(u, target))) {
      const boost = g.kind === 'bounty' ? 1 + g.flag.gold / 100 : 1;
      if (dares(world, h, group, { boost, party: partyFor(world, h, target, REALM.courage.party), committed: true })) return;
      setGoal(world, h, { kind: 'flee' });
      return;
    }
    if (dares(world, h, group)) {
      setGoal(world, h, { kind: 'fight', unit: near });
      return;
    }
    if (dist(near, h) < 4) {
      setGoal(world, h, { kind: 'flee' });
      return;
    }
  }
  // 2. Hurt, or a heavy purse: home (a full purse can wait while there's a camp to burn).
  const burning = g && (g.kind === 'raid' || (g.kind === 'bounty' && g.flag.kind === 'attack')) && goalValid(world, h);
  const heavy = h.gold >= REALM.carryHome * h.mods.carry && !burning;
  if ((h.hp < h.maxHp * REALM.restBelow || heavy) && g?.kind !== 'home' && g?.kind !== 'flee') {
    setGoal(world, h, { kind: 'home' });
    return;
  }
  // 3. Carry on, unless a better bounty beckons.
  const best = bestBounty(world, h);
  if (goalValid(world, h)) {
    if (!best || g.kind === 'home' || g.kind === 'flee' || g.kind === 'fight' || g.kind === 'shop') return;
    const current = g.kind === 'bounty' ? bountyValue(world, h, g.flag).value : 0;
    if (g.kind === 'bounty' && best.flag === g.flag) return;
    if (best.value <= current * 1.3) return;
  }
  // 4. Something new.
  if (best) {
    setGoal(world, h, { kind: 'bounty', flag: best.flag });
    return;
  }
  const smithy = shopFor(world, h);
  if (smithy) {
    setGoal(world, h, { kind: 'shop', building: smithy });
    return;
  }
  for (const [act, chance] of cls.plan) {
    if (world.realm.rng.next() >= chance) continue;
    const goal = tryActivity(world, h, act);
    if (goal) {
      setGoal(world, h, goal);
      return;
    }
  }
  const home = homeOf(world, h);
  const at = spotNear(world, home.cx, home.cz, 2, 4);
  setGoal(world, h, at ? { kind: 'wander', ...at } : null);
}

// ---------------------------------------------------------------- acting

/** Hero `h` strikes `target` (a foe, or a lair). */
function strike(world, h, target) {
  const r = h.def.ranged;
  if (r) {
    const p = {
      id: world._nextId++,
      kind: r.projectile,
      sx: h.x,
      sy: h.def.height * 0.7,
      sz: h.z,
      x: h.x,
      y: h.def.height * 0.7,
      z: h.z,
      tx: target.lair ? target.cx : target.x,
      ty: target.lair ? 0.6 : target.def.height * 0.6,
      tz: target.lair ? target.cz : target.z,
      target: target.lair ? null : target,
      team: 'red',
      from: h,
      damage: h.def.damage,
      splash: 0,
      slow: null,
      arc: r.arc,
      t: 0,
      flightTime: Math.max(0.05, Math.hypot((target.lair ? target.cx : target.x) - h.x, (target.lair ? target.cz : target.z) - h.z) / r.projectileSpeed),
      alive: true,
    };
    world.projectiles.push(p);
    world.events.emit('projectileFired', { projectile: p, troop: h });
    if (target.lair) damageLair(world, target, h.def.damage, h);
    return;
  }
  if (target.lair) damageLair(world, target, h.def.damage, h);
  else world._hurt(target, h.def.damage, 'red', h);
}

/** Fight `u`: strike it when in reach, else close in. False if it can't be reached. */
function engageUnit(world, h, u, dt) {
  const reach = reachOf(h.def);
  if (dist(h, u) <= reach) {
    attack(world, h, u, u.x, u.z, dt);
    return true;
  }
  h.fighting = false;
  return walkTo(world, h, u.x, u.z, dt, h.def.ranged ? Math.floor(reach) : 1, { maxNodes: 6000 }) !== false;
}

/** Attack lair `lair`: its guards first, then the camp itself. False if it can't be reached. */
function engageLair(world, h, lair, dt) {
  const guards = lairMen(world, lair).sort((a, b) => dist(a, h) - dist(b, h));
  if (guards.length) return engageUnit(world, h, guards[0], dt);
  const reach = reachOf(h.def);
  if (world._distanceTo(lair, h.x, h.z) <= reach + 0.25) {
    attack(world, h, lair, lair.cx, lair.cz, dt);
    return true;
  }
  h.fighting = false;
  const [px, pz] = world._nearestPoint(lair, h.x, h.z);
  return walkTo(world, h, px, pz, dt, h.def.ranged ? Math.floor(reach) : 0, { maxNodes: 6000 }) !== false;
}

function attack(world, h, target, x, z, dt) {
  h.heading = Math.atan2(x - h.x, z - h.z);
  if (!h.fighting) h.attackTimer = h.def.attackCooldown * 0.5;
  h.fighting = true;
  h.attackTimer -= dt;
  if (h.attackTimer <= 0) {
    h.attackTimer += h.def.attackCooldown;
    strike(world, h, target);
  }
}

/** Walk to (x, z); the goal's done when there (or there's no way there). */
function travel(world, h, x, z, dt, near = 0) {
  const r = walkTo(world, h, x, z, dt, near, { maxNodes: 8000 });
  if (r === 'there' || r === false || Math.hypot(x - h.x, z - h.z) < 0.4) setGoal(world, h, null);
  return r;
}

/** Home: pay tax on what it carries, then rest indoors till healed. */
function arriveHome(world, h) {
  const cls = REALM.classes[h.cls];
  const tax = Math.floor(h.gold * cls.tax);
  if (tax > 0) {
    h.gold -= tax;
    h.taxPaid += tax;
    world.realm.stats.taxes += tax;
    world.economy.earn(tax, 'tax');
    world.events.emit('heroTaxed', { hero: h, tax });
  }
  h.inside = REALM.rest;
  h.fighting = false;
  setGoal(world, h, { kind: 'rest' });
}

/** At the smithy: buy the next tier of gear (the treasury takes REALM.salesTax of the price). */
function buyGear(world, h) {
  const next = REALM.gear[h.gear + 1];
  if (!next || h.gold < next.price || h.gear >= world.realm.gearTier) return;
  h.gold -= next.price;
  h.gear++;
  const tax = Math.round(next.price * REALM.salesTax);
  world.realm.stats.sales += tax;
  world.economy.earn(tax, 'sales');
  restat(h);
  world.events.emit('heroBought', { hero: h, gear: next, tax });
}

/** Where hero `h` goes in at building `b`: its door (the walkable tile beside it facing out), or beside it. */
function doorOf(world, b) {
  const { door } = findPost(world, b);
  return door ? { x: door.x + 0.5, z: door.z + 0.5 } : { x: b.cx, z: b.z + b.size + 0.5 };
}

/** Each tick for each hero. */
export function updateHero(world, h, dt) {
  h.moving = false;
  if (h.inside > 0) {
    // Resting indoors: heal, then out again once well.
    h.hp = Math.min(h.maxHp, h.hp + h.maxHp * REALM.heal * dt);
    h.inside -= dt;
    const home = world.buildings.get(h.guildId);
    if (!home) h.inside = 0; // its guild fell: out it comes
    if (h.inside <= 0 && h.hp < h.maxHp * 0.95 && home) h.inside = 0.5;
    if (h.inside <= 0) {
      h.inside = 0;
      setGoal(world, h, null);
      h.thinkIn = 0;
    }
    return;
  }
  if ((h.thinkIn -= dt) <= 0) {
    h.thinkIn = REALM.think;
    think(world, h);
  }
  // Stuck for a while on a journey (no way round, or going round in circles): think again.
  if (h.goal && !h.fighting && world.time - h.since.t > 18) {
    if (Math.hypot(h.x - h.since.x, h.z - h.since.z) < 1.5) setGoal(world, h, null);
    else h.since = { x: h.x, z: h.z, t: world.time };
  }
  const g = h.goal;
  if (!g) {
    h.fighting = false;
    return;
  }
  switch (g.kind) {
    case 'fight':
      if (!engageUnit(world, h, g.unit, dt)) setGoal(world, h, null);
      break;
    case 'raid':
      if (!engageLair(world, h, g.lair, dt)) setGoal(world, h, null);
      break;
    case 'bounty': {
      const f = g.flag;
      if (f.kind === 'explore') {
        h.fighting = false;
        travel(world, h, f.x, f.z, dt, 0);
      }
      else if (f.lair !== undefined ? !engageLair(world, h, world.realm.lairs[f.lair], dt) : !engageUnit(world, h, f.unit, dt)) setGoal(world, h, null);
      break;
    }
    case 'home':
    case 'flee': {
      h.fighting = false;
      const door = doorOf(world, homeOf(world, h));
      const r = walkTo(world, h, door.x, door.z, dt, 0, { maxNodes: 8000 });
      if (r === 'there' || Math.hypot(door.x - h.x, door.z - h.z) < 0.5) arriveHome(world, h);
      else if (r === false) setGoal(world, h, null);
      break;
    }
    case 'shop': {
      h.fighting = false;
      const door = doorOf(world, g.building);
      const r = walkTo(world, h, door.x, door.z, dt, 0, { maxNodes: 8000 });
      if (r === 'there' || Math.hypot(door.x - h.x, door.z - h.z) < 0.5) {
        buyGear(world, h);
        setGoal(world, h, null);
      } else if (r === false) setGoal(world, h, null);
      break;
    }
    case 'defend': {
      h.fighting = false;
      const door = doorOf(world, g.building);
      travel(world, h, door.x, door.z, dt, 1);
      break;
    }
    case 'explore':
    case 'patrol':
    case 'wander':
      h.fighting = false;
      travel(world, h, g.x, g.z, dt, 0);
      break;
    default:
      h.fighting = false;
      setGoal(world, h, null);
  }
}

// ---------------------------------------------------------------- outcomes

/** Hero `h` felled `victim`: its gold reward × REALM.killGold to the hero's purse, and XP. */
export function heroKill(world, h, victim) {
  const reward = victim.def.reward * (victim.elite ? 3 : 1);
  const gold = Math.round(reward * REALM.killGold);
  h.gold += gold;
  h.earned += gold;
  h.kills++;
  heroXp(world, h, reward * REALM.xp);
}

export function heroXp(world, h, amount) {
  h.xp += amount;
  while (h.level < REALM.levels.length && h.xp >= REALM.levels[h.level]) {
    h.level++;
    restat(h);
    world.events.emit('heroLevelUp', { hero: h, level: h.level });
  }
}

/** A hero fell: gone for good, with its gold. */
export function heroFell(world, h) {
  if (h.goal?.kind === 'bounty') h.goal.flag.takers.delete(h.id);
  h.goal = null;
  world.realm.fallen.push({ name: h.name, cls: h.cls, level: h.level, guildId: h.guildId, at: world.time });
  world.realm.stats.heroesLost++;
  world.events.emit('realmHeroFell', { hero: h });
}

/** What hero `h` is up to, in words (for the hero card). */
export function intentOf(world, h) {
  if (!h.alive) return 'Fallen';
  if (h.inside > 0) return h.hp < h.maxHp * 0.95 ? 'Resting at the guild' : 'At the guild';
  const g = h.goal;
  if (!g) return 'Thinking';
  const name = (u) => (u.realm ? 'an outlaw' : `a ${u.def.name.toLowerCase()}`);
  switch (g.kind) {
    case 'fight':
      return `Fighting ${name(g.unit)}`;
    case 'flee':
      return 'Fleeing home!';
    case 'home':
      return h.gold > 0 ? `Going home to pay tax (${h.gold} gold)` : 'Going home to rest';
    case 'bounty':
      return g.flag.kind === 'explore' ? `Claiming an explore flag (${g.flag.gold} gold)` : `Claiming a bounty (${g.flag.gold} gold)`;
    case 'raid':
      return `Raiding an ${BUILDINGS[g.lair.type].name.toLowerCase()}`;
    case 'explore':
      return 'Exploring';
    case 'defend':
      return `Defending the ${g.building.def.name}`;
    case 'shop':
      return `Off to buy ${REALM.gear[h.gear + 1]?.name.toLowerCase()} gear`;
    case 'patrol':
      return 'Patrolling';
    default:
      return 'Wandering';
  }
}
