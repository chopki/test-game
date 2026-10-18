import { BUILDINGS, REALM, TROOPS } from '../config.js';
import { dist, reachOf, troopPassable, walkTo } from '../troops.js';
import { seenAt } from './fog.js';

/**
 * Realm's lairs (REALM.lairs): outlaw camps out in the wilds. Pure: no DOM, no three.js. Each is guarded by men in
 * grey (`world.troops` of team 'neutral', `realm: 'guard'`) who refill a while after they all fall; it grows stronger
 * over time and now and then sends a raiding party (`realm: 'raider'`) at the nearest building. Heroes clear the
 * guards and burn the camp down (its health, `hp`), for its loot and any bounty on it. Lairs live in
 * `world.realm.lairs`, not on the grid: enemies and soldiers walk through them.
 */

/** Where each guard stands, round the camp's middle. */
const SPOTS = [
  [-1.0, 0.9],
  [1.0, 0.9],
  [0, -1.1],
  [1.2, -0.5],
  [-1.2, -0.5],
];

/**
 * Where a lair could go: open, buildable 2 × 2 ground that soldiers can walk to from the Town Hall, at least
 * REALM.lairs.minHall tiles from it, minApart from standing lairs and 6 from the player's buildings; shuffled on
 * the realm's own random stream.
 */
function lairSites(world) {
  const cfg = REALM.lairs;
  const { grid } = world;
  const hall = world.townHall;
  const reach = reachableFromHall(world);
  const standing = world.realm.lairs.filter((l) => !l.razed);
  const buildings = [...world.buildings.values()].filter((b) => b.team === 'red');
  const candidates = [];
  for (let z = grid.spawnMargin + 1; z < grid.height - grid.spawnMargin - 2; z++) {
    for (let x = grid.spawnMargin + 1; x < grid.width - grid.spawnMargin - 2; x++) {
      const cx = x + 1;
      const cz = z + 1;
      if (Math.hypot(cx - hall.cx, cz - hall.cz) < cfg.minHall) continue;
      if (standing.some((l) => Math.hypot(l.x - x, l.z - z) < cfg.minApart)) continue;
      let ok = true;
      for (let dz = -1; dz <= 2 && ok; dz++) {
        for (let dx = -1; dx <= 2 && ok; dx++) {
          const tx = x + dx;
          const tz = z + dz;
          // The camp itself on buildable ground; a ring round it walkable (its guards stand there).
          const inside = dx >= 0 && dx <= 1 && dz >= 0 && dz <= 1;
          if (inside ? !grid.isBuildable(tx, tz) || grid.get(tx, tz) !== null : grid.isBlocked(tx, tz)) ok = false;
        }
      }
      if (ok && buildings.length && buildings.some((b) => world._distanceTo(b, cx, cz) < 6)) ok = false;
      if (ok && reach[grid.index(x, z + 2)]) candidates.push({ x, z });
    }
  }
  const rng = world.realm.rng;
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  return candidates;
}

/** Lay out the map's first lairs (REALM.lairs.count for its size), minApart from each other. */
export function placeLairs(world) {
  const cfg = REALM.lairs;
  const sizes = Object.keys(cfg.count).map(Number);
  const width = world.grid.width;
  const want = cfg.count[sizes.reduce((a, b) => (Math.abs(b - width) < Math.abs(a - width) ? b : a))];
  const lairs = [];
  for (const c of lairSites(world)) {
    if (lairs.length >= want) break;
    if (lairs.some((l) => Math.hypot(l.x - c.x, l.z - c.z) < cfg.minApart)) continue;
    lairs.push(makeLair(world, lairs.length, c.x, c.z));
  }
  world.realm.lairs = lairs;
  for (const lair of lairs) fillLair(world, lair);
}

/**
 * A burnt camp's outlaws regroup: REALM.lairs.respawn seconds after a lair is razed, a new one rises somewhere
 * else in the wilds, as strong as the realm's time says (a level per growEvery seconds so far, at most maxLevel).
 * Razed lairs stay in `world.realm.lairs` (as ruins), so indices never change.
 */
function riseLair(world) {
  const cfg = REALM.lairs;
  const r = world.realm;
  const site = lairSites(world)[0];
  if (!site) return null;
  const lair = makeLair(world, r.lairs.length, site.x, site.z);
  lair.level = Math.min(cfg.maxLevel, 1 + Math.floor(world.time / cfg.growEvery));
  r.lairs.push(lair);
  fillLair(world, lair);
  lair.discovered = seenAt(world, lair.cx, lair.cz);
  world.events.emit('lairRose', { lair });
  return lair;
}

/** Which tiles soldiers can walk to from the Town Hall's surroundings (a flood fill). */
function reachableFromHall(world) {
  const { grid } = world;
  const passable = troopPassable(world);
  const seen = new Uint8Array(grid.width * grid.height);
  const hall = world.townHall;
  const queue = [];
  for (let i = -1; i <= hall.size; i++) {
    for (const [x, z] of [[hall.x + i, hall.z - 1], [hall.x + i, hall.z + hall.size], [hall.x - 1, hall.z + i], [hall.x + hall.size, hall.z + i]]) {
      if (grid.inBounds(x, z) && passable(x, z) && !seen[grid.index(x, z)]) {
        seen[grid.index(x, z)] = 1;
        queue.push([x, z]);
      }
    }
  }
  while (queue.length) {
    const [x, z] = queue.pop();
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const nz = z + dz;
      if (!grid.inBounds(nx, nz) || seen[grid.index(nx, nz)] || !passable(nx, nz)) continue;
      seen[grid.index(nx, nz)] = 1;
      queue.push([nx, nz]);
    }
  }
  return seen;
}

function makeLair(world, index, x, z) {
  const cfg = REALM.lairs;
  const def = BUILDINGS[cfg.type];
  return {
    id: world._nextId++,
    index,
    lair: true,
    type: cfg.type,
    def,
    x,
    z,
    size: def.size,
    cx: x + def.size / 2,
    cz: z + def.size / 2,
    hp: def.maxHp,
    maxHp: def.maxHp,
    level: 1,
    discovered: false,
    razed: false,
    refillAt: null,
    nextRaid: REALM.firstDay + cfg.raidEvery * world.realm.rng.next(), // none before the first night
    nextGrow: cfg.growEvery,
    dmgBy: new Map(), // hero id → damage dealt to the camp and its men (for its bounty and loot)
  };
}

/** A lair's guards' (or raiders') stats at its level: more health each level, and twice the gold. */
function menDef(lair, type) {
  const base = TROOPS.types[type];
  const k = 1 + REALM.lairs.growth * (lair.level - 1);
  return { ...base, maxHp: Math.round(base.maxHp * k), damage: base.damage * (1 + (k - 1) / 2), reward: base.reward * 2 };
}

function spawnMan(world, lair, type, role, at) {
  const def = menDef(lair, type);
  const u = {
    id: world._nextId++,
    type,
    def,
    team: 'neutral',
    realm: role,
    lairIndex: lair.index,
    home: { x: at.x, z: at.z },
    x: at.x,
    z: at.z,
    tx: Math.floor(at.x),
    tz: Math.floor(at.z),
    hp: def.maxHp,
    maxHp: def.maxHp,
    heading: Math.PI,
    moving: false,
    fighting: false,
    attackTimer: 0,
    target: null,
    retarget: world.realm.rng.next() * 0.4,
    path: null,
    pathKey: -1,
    repath: 0,
    alive: true,
  };
  world.troops.push(u);
  return u;
}

/** Fill a lair's guard posts. */
export function fillLair(world, lair) {
  const guards = REALM.lairs.guards;
  const extra = Math.floor((lair.level - 1) / 2); // a man more every two levels
  for (let n = 0; n < Math.min(SPOTS.length, guards.length + extra); n++) {
    const [ox, oz] = SPOTS[n];
    spawnMan(world, lair, guards[n % guards.length], 'guard', { x: lair.cx + ox, z: lair.cz + oz });
  }
  lair.refillAt = null;
}

/** A lair's men still standing (guards and raiders). */
export const lairMen = (world, lair, role = 'guard') => world.troops.filter((t) => t.alive && t.lairIndex === lair.index && t.realm === role);

/** Each tick: lairs grow, fill again, and send raiders. */
export function updateLairs(world, dt) {
  const cfg = REALM.lairs;
  const r = world.realm;
  // Lairs due to rise (no room for one now: try again in a while).
  r.rising = r.rising.map((at) => (at > world.time || riseLair(world) ? at : world.time + 15)).filter((at) => at > world.time);
  for (const lair of r.lairs) {
    if (lair.razed) continue;
    if ((lair.nextGrow -= dt) <= 0) {
      lair.nextGrow = cfg.growEvery;
      if (lair.level < cfg.maxLevel) {
        lair.level++;
        world.events.emit('lairGrew', { lair });
      }
    }
    if (lair.refillAt !== null && world.time >= lair.refillAt) fillLair(world, lair);
    if ((lair.nextRaid -= dt) <= 0) {
      lair.nextRaid = Math.max(60, cfg.raidEvery - cfg.raidFaster * (lair.level - 1)) * (0.8 + world.realm.rng.next() * 0.4);
      sendRaid(world, lair);
    }
  }
}

/** The nearest standing building of the player's to (x, z) (walls only if `walls`), or null. */
function nearestBuilding(world, x, z, walls = false) {
  let best = null;
  let bestD = Infinity;
  for (const b of world.buildings.values()) {
    if (b.team !== 'red' || (!walls && b.type === 'wall')) continue;
    const d = world._distanceTo(b, x, z);
    if (d < bestD) [best, bestD] = [b, d];
  }
  return best;
}

/** A raiding party sets out from `lair` for the nearest building. */
export function sendRaid(world, lair) {
  const cfg = REALM.lairs;
  const target = nearestBuilding(world, lair.cx, lair.cz);
  if (!target) return;
  const men = [...cfg.raid];
  for (let i = 0; i < Math.floor((lair.level - 1) / cfg.raidPer); i++) men.push(i % 2 ? 'archer' : 'swordsman');
  const party = men.map((type, i) => {
    const u = spawnMan(world, lair, type, 'raider', { x: lair.cx + (i % 2 ? 0.6 : -0.6), z: lair.cz + 1.4 + Math.floor(i / 2) * 0.5 });
    u.targetId = target.id;
    return u;
  });
  world.events.emit('raidSent', { lair, party, target });
}

/** Foes of the outlaws near (x, z): the player's heroes and soldiers (not those indoors). */
function nearestFoe(world, x, z, range) {
  let best = null;
  let bestD = range;
  for (const v of world.troops) {
    if (!v.alive || v.team !== 'red' || v.inside > 0) continue;
    const d = Math.hypot(v.x - x, v.z - z);
    if (d <= bestD) [best, bestD] = [v, d];
  }
  return best;
}

/** Strike (or walk up to) `t`, a soldier or a building. True while busy with it. */
function engage(world, u, t, dt) {
  const building = t.size !== undefined;
  const d = building ? world._distanceTo(t, u.x, u.z) : dist(u, t);
  if (d <= reachOf(u.def) + (building ? 0.25 : 0)) {
    const [px, pz] = building ? world._nearestPoint(t, u.x, u.z) : [t.x, t.z];
    u.heading = Math.atan2(px - u.x, pz - u.z);
    if (!u.fighting) u.attackTimer = u.def.attackCooldown * 0.5;
    u.fighting = true;
    u.attackTimer -= dt;
    if (u.attackTimer <= 0) {
      u.attackTimer += u.def.attackCooldown;
      world._soldierStrike(u, t);
    }
    return true;
  }
  u.fighting = false;
  let [gx, gz] = [t.x, t.z];
  if (building) {
    const [px, pz] = world._nearestPoint(t, u.x, u.z);
    gx = Math.min(Math.floor(px), t.x + t.size - 1) + 0.5;
    gz = Math.min(Math.floor(pz), t.z + t.size - 1) + 0.5;
  }
  return walkTo(world, u, gx, gz, dt, u.def.ranged ? Math.floor(reachOf(u.def)) : 1, { maxNodes: 6000 }) !== false;
}

/** A guard keeps to its camp, fighting anyone who comes within `aggro` of it or strikes one of its men. */
export function updateGuard(world, u, dt) {
  u.moving = false;
  const cfg = REALM.lairs;
  const lair = world.realm.lairs[u.lairIndex];
  const centre = { x: lair.cx, z: lair.cz };
  if (u.target && (!u.target.alive || u.target.inside > 0 || dist(u.target, centre) > cfg.leash)) u.target = null;
  if (!u.target && (u.retarget -= dt) <= 0) {
    u.retarget = 0.4;
    u.target = nearestFoe(world, centre.x, centre.z, cfg.aggro) ?? (u.lastAttacker?.alive && !(u.lastAttacker.inside > 0) ? u.lastAttacker : null);
    // One man struck: the camp turns on whoever did it.
    if (u.target) for (const m of lairMen(world, lair)) if (!m.target) m.target = u.target;
  }
  if (u.target) {
    if (!engage(world, u, u.target, dt)) u.target = null;
    return;
  }
  u.fighting = false;
  if (Math.hypot(u.home.x - u.x, u.home.z - u.z) > 0.3) walkTo(world, u, u.home.x, u.home.z, dt, 0);
  else u.hp = Math.min(u.maxHp, u.hp + 6 * dt);
}

/**
 * A raider makes for its target building (or, if walls are in the way, the nearest building it can reach, walls
 * included) and hacks at it; it turns to fight heroes and soldiers who come near or strike it.
 */
export function updateRaider(world, u, dt) {
  u.moving = false;
  if (u.target && (!u.target.alive || u.target.inside > 0 || dist(u.target, u) > 6)) u.target = null;
  if ((u.retarget -= dt) <= 0) {
    u.retarget = 0.5;
    if (!u.target) u.target = nearestFoe(world, u.x, u.z, 2.2) ?? (u.lastAttacker?.alive && !(u.lastAttacker.inside > 0) && dist(u.lastAttacker, u) < 6 ? u.lastAttacker : null);
  }
  if (u.target) {
    if (!engage(world, u, u.target, dt)) u.target = null;
    return;
  }
  let b = world.buildings.get(u.targetId);
  if (!b || b.team !== 'red') {
    b = nearestBuilding(world, u.x, u.z);
    u.targetId = b?.id ?? null;
  }
  if (!b) return;
  if (!engage(world, u, b, dt)) {
    // Walled out: break through the nearest building in the way.
    const w = nearestBuilding(world, u.x, u.z, true);
    if (w && w !== b) u.targetId = w.id;
  }
}

/** A hero (or anything of the player's) hurts lair `lair` by `amount`; burns it down at 0. */
export function damageLair(world, lair, amount, by = null) {
  if (lair.razed) return;
  lair.hp = Math.max(0, lair.hp - amount);
  lair.lastHit = world.time;
  if (by?.realm === 'hero') lair.dmgBy.set(by.id, (lair.dmgBy.get(by.id) ?? 0) + amount);
  world.events.emit('lairHit', { lair, amount });
  if (lair.hp <= 0) razeLair(world, lair);
}

function razeLair(world, lair) {
  lair.razed = true;
  // Its guards scatter (gone from the map); raiders out in the field carry on.
  for (const m of lairMen(world, lair)) world._removeTroop(m, 'dismissed');
  const loot = REALM.lairs.loot + REALM.lairs.lootPerLevel * (lair.level - 1);
  world.realm.rising.push(world.time + REALM.lairs.respawn);
  world.realm.onLairRazed(lair, loot);
}

/** A lair's guard fell: once they're all down, the camp fills again after REALM.lairs.refill seconds. */
export function guardFell(world, u) {
  const lair = world.realm.lairs[u.lairIndex];
  if (lair.razed || lairMen(world, lair).length) return;
  lair.refillAt = world.time + REALM.lairs.refill;
  world.events.emit('lairCleared', { lair });
}
