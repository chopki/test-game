import { HEROES } from './config.js';
import { dist, findPost, reachOf, troopPassable, walkTo } from './troops.js';
import { lanePoints } from './conquest.js';

/**
 * Conquest heroes (see HEROES in config.js). Pure: no DOM, no three.js. A hero is one of `world.troops` (so towers,
 * soldiers and arrows treat it like any soldier) with `hero: true`, and `world.heroes[team]` always holds the
 * side's hero, alive or waiting to come back (`respawnAt`). `world.heroKinds[team]` is which of HEROES.roster each
 * side fields.
 */

const isBuilding = (thing) => thing.size !== undefined;
const alive = (world, thing) => (isBuilding(thing) ? world.buildings.get(thing.id) === thing : thing.alive);
const hallOf = (world, team) => (team === 'blue' ? world.enemyHall : world.townHall);

/** A `kind` of hero's stats at `level`: its base stats, plus HEROES.perLevel of its health and damage a level. */
export function heroDef(kind, team, level) {
  const r = HEROES.roster[kind];
  const k = 1 + HEROES.perLevel * (level - 1);
  const s = r.stats;
  return { ...s, name: r.names[team], title: r.title, maxHp: Math.round(s.maxHp * k), damage: Math.round(s.damage * k), reward: HEROES.bounty };
}

/** Put `team`'s hero (back) at its Town Hall's door, keeping its level and XP. */
export function spawnHero(world, team) {
  const old = world.heroes[team];
  const level = old?.level ?? 1;
  const hall = hallOf(world, team);
  const { door } = findPost(world, hall);
  const at = door ?? { x: hall.x + 1, z: hall.z + hall.size };
  const kind = world.heroKinds[team];
  const def = heroDef(kind, team, level);
  const h = {
    id: world._nextId++,
    hero: true,
    kind,
    type: HEROES.roster[kind].type,
    elite: true, // drawn as its kind of soldier's crowned elite, half as big again
    def,
    team,
    level,
    xp: old?.xp ?? 0,
    x: at.x + 0.5,
    z: at.z + 0.5,
    tx: at.x,
    tz: at.z,
    hp: def.maxHp,
    maxHp: def.maxHp,
    heading: 0,
    moving: false,
    fighting: false,
    attackTimer: 0,
    target: null,
    order: null, // { x, z }: where it's been sent (it holds there), or null (by its hall)
    retarget: 0,
    path: null,
    pathKey: -1,
    repath: 0,
    slowFactor: 1,
    slowUntil: 0,
    ready: old?.ready ?? [0, 0], // when each ability can be used again
    guard: 0,
    guardUntil: 0,
    charged: 0,
    respawnAt: null,
    homeAt: { x: at.x + 0.5, z: at.z + 0.5 }, // where it waits, by its hall's door, with no orders
    alive: true,
  };
  world.heroes[team] = h;
  world.troops.push(h);
  world.events.emit('heroSpawned', { hero: h });
  return h;
}

/**
 * Send `team`'s hero somewhere: `{ x, z }` to go and hold there, `{ target }` (a soldier or building of the other
 * side) to attack it, or null to come home. False if it's down.
 */
export function orderHero(world, team, order) {
  const h = world.heroes[team];
  if (!h?.alive) return false;
  if (order?.target) {
    if (order.target.team === team) return false;
    h.target = order.target;
    h.order = isBuilding(order.target) ? { x: order.target.cx, z: order.target.cz, attack: true } : { x: order.target.x, z: order.target.z, attack: true };
  } else {
    h.order = order ? nearestOpen(world, order.x, order.z) : null;
    h.target = null;
  }
  h.retarget = 0.3;
  world.events.emit('heroOrdered', { hero: h, x: h.order?.x ?? h.homeAt.x, z: h.order?.z ?? h.homeAt.z, target: h.target });
  return true;
}

/** The middle of the walkable tile nearest (x, z) (a hero sent into the woods goes to their edge), or (x, z). */
function nearestOpen(world, x, z) {
  const passable = troopPassable(world);
  const [tx, tz] = [Math.floor(x), Math.floor(z)];
  if (passable(tx, tz)) return { x, z };
  for (let r = 1; r <= 6; r++) {
    let best = null;
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r || !world.grid.inBounds(tx + dx, tz + dz) || !passable(tx + dx, tz + dz)) continue;
        const d = Math.hypot(dx, dz);
        if (!best || d < best.d) best = { x: tx + dx + 0.5, z: tz + dz + 0.5, d };
      }
    }
    if (best) return { x: best.x, z: best.z };
  }
  return { x, z };
}

/** The abilities `team`'s hero has (names in HEROES.abilities), in slot order. */
export const abilitiesOf = (world, team) => HEROES.roster[world.heroKinds[team]].abilities;

const foesOf = (world, team) => world.troops.filter((t) => t.alive && t.team !== team && !(t.delay > 0));

/** The foe (soldier) the hero is fighting, if it's within `range`, else the nearest one within it. */
function foeInReach(world, h, range) {
  if (h.target && !isBuilding(h.target) && h.target.alive && dist(h, h.target) <= range) return h.target;
  let best = null;
  for (const v of foesOf(world, h.team)) if (dist(v, h) <= range && (!best || dist(v, h) < dist(best, h))) best = v;
  return best;
}

/**
 * Use the ability in `slot` (0 or 1) of `team`'s hero (see HEROES.abilities): { ok, reason }. Each rests for its
 * cooldown after use.
 */
export function useAbility(world, team, slot) {
  const h = world.heroes?.[team];
  if (!h?.alive) return { ok: false, reason: 'Your hero is down' };
  const name = abilitiesOf(world, team)[slot];
  const a = HEROES.abilities[name];
  if (!a) return { ok: false, reason: 'No such ability' };
  if (world.time < h.ready[slot]) return { ok: false, reason: `${a.name} is ready in ${Math.ceil(h.ready[slot] - world.time)}s` };
  const allies = (r) => world.troops.filter((t) => t.alive && t.team === team && dist(t, h) <= r);
  const haste = (t, k, s) => {
    t.slowFactor = k;
    t.slowUntil = world.time + s;
  };
  let at = { x: h.x, z: h.z };
  switch (name) {
    case 'warCry':
      for (const t of allies(a.radius)) {
        t.hp = Math.min(t.maxHp, t.hp + t.maxHp * a.heal);
        haste(t, a.haste, a.duration);
      }
      break;
    case 'charge': {
      const foe = foeInReach(world, h, a.range);
      if (!foe) return { ok: false, reason: 'No foe in reach' };
      h.target = foe;
      haste(h, a.haste, a.duration);
      h.charged = a.damage;
      at = { x: foe.x, z: foe.z };
      break;
    }
    case 'volley': {
      const foe = foeInReach(world, h, a.range);
      if (!foe) return { ok: false, reason: 'No foe in reach' };
      at = { x: foe.x, z: foe.z };
      for (const v of foesOf(world, team)) if (dist(v, at) <= a.radius) world._damageTroop(v, a.damage, team);
      break;
    }
    case 'fleetFoot':
      haste(h, a.haste, a.duration);
      break;
    case 'shieldWall':
      for (const t of allies(a.radius)) {
        t.guard = a.guard;
        t.guardUntil = world.time + a.duration;
      }
      break;
    case 'rally':
      h.hp = Math.min(h.maxHp, h.hp + h.maxHp * a.heal);
      break;
    default:
      return { ok: false, reason: 'No such ability' };
  }
  h.ready[slot] = world.time + a.cooldown;
  world.events.emit('heroAbility', { hero: h, ability: name, x: at.x, z: at.z, radius: a.radius ?? 1 });
  return { ok: true, reason: null };
}

/** XP for `team`'s hero when a foe worth `amount` falls at (x, z) near it; levels it up when it's earned enough. */
export function heroXp(world, team, x, z, amount) {
  const h = world.heroes?.[team];
  if (!h?.alive || Math.hypot(h.x - x, h.z - z) > HEROES.xpRange) return;
  h.xp += amount;
  while (h.level < HEROES.levels.length && h.xp >= HEROES.levels[h.level]) {
    h.level++;
    const def = heroDef(h.kind, team, h.level);
    h.hp += def.maxHp - h.maxHp;
    h.maxHp = def.maxHp;
    h.def = def;
    world.events.emit('heroLevelUp', { hero: h, level: h.level });
  }
}

/** A hero has fallen: it comes back at its hall after a while. */
export function heroFell(world, h) {
  h.respawnAt = world.time + HEROES.respawn.base + HEROES.respawn.perLevel * h.level;
  world.events.emit('heroFell', { hero: h, respawnAt: h.respawnAt });
}

/** Each tick: heroes coming back, and the blue hero's orders. */
export function updateHeroes(world, dt) {
  for (const team of ['red', 'blue']) {
    const h = world.heroes[team];
    if (h && !h.alive && h.respawnAt !== null && world.time >= h.respawnAt) spawnHero(world, team);
  }
  if ((world._heroAiTimer = (world._heroAiTimer ?? 0) - dt) <= 0) {
    world._heroAiTimer = 1.5;
    blueHeroThink(world);
  }
}

/** Blue's hero: home to heal when hurt, else with its most advanced soldier on the lane it has most on. */
function blueHeroThink(world) {
  const h = world.heroes.blue;
  if (!h?.alive) return;
  const hall = hallOf(world, 'blue');
  if (h.hp < h.maxHp * HEROES.retreatAt || (h.order === null && h.hp < h.maxHp * 0.9 && Math.hypot(h.x - hall.cx, h.z - hall.cz) < HEROES.atHall.radius)) {
    orderHero(world, 'blue', null);
    return;
  }
  const counts = world.lanes.map(() => 0);
  for (const t of world.troops) if (t.alive && t.team === 'blue' && t.lane !== undefined) counts[t.lane]++;
  const lane = counts.indexOf(Math.max(...counts));
  let lead = null;
  for (const t of world.troops) if (t.alive && t.team === 'blue' && t.lane === lane && (!lead || t.wp > lead.wp)) lead = t;
  // A flag that isn't blue's on its own half first (to take it), else with the lead soldier.
  let flag = null;
  for (const f of world.flags ?? []) {
    if (f.owner === 'blue' || f.z > world.grid.height / 2) continue;
    if (!flag || Math.hypot(f.x - h.x, f.z - h.z) < Math.hypot(flag.x - h.x, flag.z - h.z)) flag = f;
  }
  const at = flag ?? lead ?? lanePoints(world, lane, 'blue')[Math.floor(lanePoints(world, lane, 'blue').length * 0.3)];
  if (!h.target) orderHero(world, 'blue', { x: at.x, z: at.z });
  // Its abilities, when they'd do some good.
  const friends = world.troops.filter((t) => t.alive && t.team === 'blue' && dist(t, h) <= 4.5).length;
  const foesNear = (r, x = h.x, z = h.z) => world.troops.filter((t) => t.alive && t.team !== 'blue' && Math.hypot(t.x - x, t.z - z) <= r).length;
  abilitiesOf(world, 'blue').forEach((name, slot) => {
    const a = HEROES.abilities[name];
    const t = h.target && !isBuilding(h.target) ? h.target : null;
    const want = {
      warCry: h.fighting && (friends >= 4 || h.hp < h.maxHp * 0.5),
      charge: t && dist(h, t) > 1.5 && dist(h, t) <= a.range,
      volley: t && dist(h, t) <= a.range && foesNear(a.radius, t.x, t.z) >= 3,
      fleetFoot: h.order === null && h.hp < h.maxHp * HEROES.retreatAt,
      shieldWall: h.fighting && friends >= 3,
      rally: h.hp < h.maxHp * 0.45,
    }[name];
    if (want) useAbility(world, 'blue', slot);
  });
}

/** The nearest foe (soldier first, then building, not walls) within HEROES.aggro of the hero. */
function nearestFoe(world, h) {
  let best = null;
  let bestD = HEROES.aggro;
  for (const v of world.troops) {
    if (!v.alive || v.team === h.team || v.delay > 0) continue;
    const d = dist(v, h);
    if (d <= bestD) [best, bestD] = [v, d];
  }
  if (best) return best;
  bestD = HEROES.aggro;
  for (const b of world.buildings.values()) {
    if (b.team === h.team || b.type === 'wall') continue;
    const d = world._distanceTo(b, h.x, h.z);
    if (d <= bestD) [best, bestD] = [b, d];
  }
  return best;
}

export function updateHero(world, h, dt) {
  h.moving = false;
  const hall = hallOf(world, h.team);
  if (Math.hypot(h.x - hall.cx, h.z - hall.cz) <= HEROES.atHall.radius) h.hp = Math.min(h.maxHp, h.hp + h.maxHp * HEROES.atHall.heal * dt);
  const home = h.order ?? h.homeAt;
  // Let go of a target that's gone, or led it too far from where it was told to be (unless it was told to attack).
  if (h.target && (!alive(world, h.target) || (!h.order?.attack && !isBuilding(h.target) && Math.hypot(h.target.x - home.x, h.target.z - home.z) > HEROES.leash + HEROES.aggro))) h.target = null;
  if ((h.retarget -= dt) <= 0) {
    h.retarget = 0.4;
    if (!h.target || isBuilding(h.target)) h.target = nearestFoe(world, h) ?? h.target;
  }
  const t = h.target;
  if (t) {
    const d = isBuilding(t) ? world._distanceTo(t, h.x, h.z) : dist(h, t);
    if (d <= reachOf(h.def) + (isBuilding(t) ? 0.25 : 0)) {
      const [px, pz] = isBuilding(t) ? world._nearestPoint(t, h.x, h.z) : [t.x, t.z];
      h.heading = Math.atan2(px - h.x, pz - h.z);
      if (!h.fighting) h.attackTimer = h.def.attackCooldown * 0.5;
      h.fighting = true;
      h.attackTimer -= dt;
      if (h.attackTimer <= 0) {
        h.attackTimer += h.def.attackCooldown / Math.max(1, h.slowFactor);
        world._soldierStrike(h, t);
      }
      return;
    }
    h.fighting = false;
    let [gx, gz] = [t.x, t.z];
    if (isBuilding(t)) {
      const [px, pz] = world._nearestPoint(t, h.x, h.z);
      gx = Math.min(Math.floor(px), t.x + t.size - 1) + 0.5;
      gz = Math.min(Math.floor(pz), t.z + t.size - 1) + 0.5;
    }
    if (!walkTo(world, h, gx, gz, dt, h.def.ranged ? Math.floor(reachOf(h.def)) : 1)) h.target = null;
    return;
  }
  h.fighting = false;
  if (Math.hypot(home.x - h.x, home.z - h.z) > 0.6) walkTo(world, h, home.x, home.z, dt, 1);
}

