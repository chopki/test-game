import { TERRAIN, TROOPS } from './config.js';
import { findPath } from './pathfind.js';
import { T } from './terrain.js';

/**
 * The player's troops (see TROOPS in config.js): trained at a Barracks, they stand at its post and go out to fight
 * enemies that come near it. Pure: no DOM, no three.js. World calls these each tick; the state lives on the world
 * (`world.troops`) and on each Barracks (`post`, `door`, `squad`, `trainTimer`).
 */

/** Where each man of a Barracks' squad stands at its post, by roster slot (offsets from the tile's centre). */
const POST_SPOTS = [
  [-0.3, -0.18],
  [0.3, -0.18],
  [0, 0.28],
  [-0.3, 0.38],
  [0.3, 0.38],
];

/** Tiles troops can walk: open ground (not water, rock, forest or cliff), and no building but the gatehouse. */
export function troopPassable(world) {
  const { grid } = world;
  return (x, z) => {
    if (grid.isBlocked(x, z)) return false;
    const id = grid.get(x, z);
    return id === null || world.buildings.get(id)?.type === 'gatehouse';
  };
}

/**
 * A Barracks' post and door: the walkable tile TROOPS.postDistance steps out from it (the furthest from the Town
 * Hall, so its men stand out towards the enemy), and the tile next to it where its men step out on the way there.
 * Null for both if it's walled in.
 */
export function findPost(world, b) {
  const { grid } = world;
  const passable = troopPassable(world);
  const seen = new Map(); // tile index → { x, z, depth, door }
  let frontier = [];
  for (let i = -1; i <= b.size; i++) {
    for (const [x, z] of [
      [b.x + i, b.z - 1],
      [b.x + i, b.z + b.size],
      [b.x - 1, b.z + i],
      [b.x + b.size, b.z + i],
    ]) {
      if (!grid.inBounds(x, z) || !passable(x, z) || grid.isInSpawnZone(x, z)) continue;
      const k = grid.index(x, z);
      if (seen.has(k)) continue;
      const tile = { x, z, depth: 1, door: null };
      tile.door = tile;
      seen.set(k, tile);
      frontier.push(tile);
    }
  }
  for (let depth = 2; depth <= TROOPS.postDistance; depth++) {
    const next = [];
    for (const t of frontier) {
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = t.x + dx;
        const z = t.z + dz;
        if (!grid.inBounds(x, z) || !passable(x, z) || grid.isInSpawnZone(x, z)) continue;
        const k = grid.index(x, z);
        if (seen.has(k)) continue;
        const tile = { x, z, depth, door: t.door };
        seen.set(k, tile);
        next.push(tile);
      }
    }
    if (!next.length) break;
    frontier = next;
  }
  const hall = world.townHall;
  let best = null;
  let bestScore = -Infinity;
  for (const t of frontier) {
    const score = Math.hypot(t.x + 0.5 - hall.cx, t.z + 0.5 - hall.cz);
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best ? { post: { x: best.x, z: best.z }, door: { x: best.door.x, z: best.door.z } } : { post: null, door: null };
}

/** Recompute every Barracks' post (after buildings come or go). */
export function refreshPosts(world) {
  for (const b of world.buildings.values()) {
    if (!b.def.trains) continue;
    Object.assign(b, findPost(world, b));
  }
}

/** Train the next man of a Barracks' roster when its timer comes round, while it has a way out and a gap to fill. */
export function updateBarracks(world, b, dt) {
  const { roster, garrison, every } = b.def.trains;
  b.squad ??= new Array(garrison).fill(null);
  const slot = b.squad.findIndex((t) => !t?.alive);
  if (slot === -1 || !b.door) {
    b.trainTimer = 0;
    return;
  }
  b.trainTimer = (b.trainTimer ?? 0) + dt;
  if (b.trainTimer < every) return;
  b.trainTimer = 0;
  b.squad[slot] = spawnTroop(world, b, roster[slot % roster.length], slot);
}

function spawnTroop(world, b, type, slot) {
  const def = TROOPS.types[type];
  const t = {
    id: world._nextId++,
    type,
    def,
    team: 'red',
    barracksId: b.id,
    slot,
    x: b.door.x + 0.5,
    z: b.door.z + 0.5,
    tx: b.door.x,
    tz: b.door.z,
    hp: def.maxHp,
    maxHp: def.maxHp,
    heading: Math.atan2(b.door.x + 0.5 - b.cx, b.door.z + 0.5 - b.cz),
    moving: false,
    fighting: false,
    attackTimer: 0,
    target: null, // the enemy it's going for
    retarget: 0,
    path: null,
    pathKey: -1,
    repath: 0,
    post: b.post,
    alive: true,
  };
  world.troops.push(t);
  world.events.emit('troopTrained', { troop: t, building: b });
  return t;
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const centre = (tile) => ({ x: tile.x + 0.5, z: tile.z + 0.5 });

/** How far a soldier strikes from: his bow's range, or arm's reach. */
const reachOf = (def) => def.ranged?.range ?? def.reach;

export function updateTroop(world, t, dt) {
  t.moving = false;
  const b = world.buildings.get(t.barracksId);
  if (b?.post) t.post = b.post;
  const post = t.post ? centre(t.post) : { x: t.x, z: t.z };

  if (t.target && (!t.target.alive || dist(t.target, post) > TROOPS.leash)) t.target = null;
  if (!t.target && (t.retarget -= dt) <= 0) {
    t.retarget = 0.4;
    t.target = pickTarget(world, t, post);
  }

  const e = t.target;
  if (e) {
    const d = dist(t, e);
    if (d <= reachOf(t.def)) {
      t.heading = Math.atan2(e.x - t.x, e.z - t.z);
      if (!t.fighting) t.attackTimer = t.def.attackCooldown * 0.5;
      t.fighting = true;
      t.attackTimer -= dt;
      if (t.attackTimer <= 0) {
        t.attackTimer += t.def.attackCooldown;
        strike(world, t, e);
      }
      return;
    }
    t.fighting = false;
    // Melee: walk up to the enemy; archers stop once it's in range (checked above).
    if (!walkTo(world, t, e.x, e.z, dt, t.def.ranged ? 0 : 1)) t.target = null;
    return;
  }

  t.fighting = false;
  if (!t.post) return;
  const [ox, oz] = POST_SPOTS[t.slot % POST_SPOTS.length];
  const arrived = walkTo(world, t, post.x + ox, post.z + oz, dt, 0) === 'there';
  if (arrived) t.hp = Math.min(t.maxHp, t.hp + TROOPS.regen * dt);
}

/**
 * The enemy a soldier goes for: the nearest one within TROOPS.guardRadius of his post that he can strike from
 * where he is or reach on foot (the few nearest are tried). Siege engines count: men can hack at them.
 */
function pickTarget(world, t, post) {
  const reach = reachOf(t.def);
  const near = [];
  for (const e of world.enemies) {
    if (e.alive && dist(e, post) <= TROOPS.guardRadius) near.push(e);
  }
  near.sort((a, b) => dist(a, t) - dist(b, t));
  const passable = troopPassable(world);
  for (const e of near.slice(0, 4)) {
    if (dist(e, t) <= reach) return e;
    const path = findPath(world.grid, passable, { x: t.tx, z: t.tz }, { x: e.tx, z: e.tz }, { near: t.def.ranged ? Math.floor(reach) : 1, maxNodes: 1500 });
    if (path) {
      setPath(world, t, path, e.tx, e.tz);
      return e;
    }
  }
  return null;
}

function setPath(world, t, path, gx, gz) {
  t.path = path;
  t.pathKey = world.grid.index(gx, gz);
  t.repath = 0.6;
}

/**
 * Walk towards (gx, gz): along an A* path while more than `near` tiles away, then straight to the point.
 * Returns 'there' on arrival, true while on the way, or false if there's no way there.
 */
function walkTo(world, t, gx, gz, dt, near) {
  const goal = { x: Math.floor(gx), z: Math.floor(gz) };
  const { grid } = world;
  const key = grid.index(goal.x, goal.z);
  t.repath -= dt;
  if (t.pathKey !== key || t.repath <= 0 || !t.path) {
    const path = findPath(grid, troopPassable(world), { x: t.tx, z: t.tz }, goal, { near, maxNodes: 2500 });
    if (!path) return false;
    setPath(world, t, path, goal.x, goal.z);
  }
  let to;
  if (t.path.length) {
    to = centre(t.path[0]);
  } else {
    to = { x: gx, z: gz };
  }
  const dx = to.x - t.x;
  const dz = to.z - t.z;
  const d = Math.hypot(dx, dz);
  const ground = grid.terrainAt(t.tx, t.tz);
  const slow = ground === T.ford ? TERRAIN.fordSpeed : ground === T.ramp ? TERRAIN.hills.rampSpeed : 1;
  const step = t.def.speed * slow * dt;
  if (d <= step) {
    t.x = to.x;
    t.z = to.z;
    if (t.path.length) t.path.shift();
    else return 'there';
  } else {
    t.x += (dx / d) * step;
    t.z += (dz / d) * step;
    t.heading = Math.atan2(dx, dz);
    t.moving = true;
  }
  t.tx = Math.floor(t.x);
  t.tz = Math.floor(t.z);
  return true;
}

/** A soldier's blow or shot at enemy `e`. A man struck in melee turns to fight back (siege engines can't). */
function strike(world, t, e) {
  const r = t.def.ranged;
  if (!r) {
    world._damageEnemy(e, t.def.damage);
    if (e.alive && !e.def.siege && !e.troopTarget) world._engageTroop(e, t);
    return;
  }
  const p = {
    id: world._nextId++,
    kind: r.projectile,
    sx: t.x,
    sy: t.def.height * 0.7,
    sz: t.z,
    x: t.x,
    y: t.def.height * 0.7,
    z: t.z,
    tx: e.x,
    ty: e.def.height * 0.6,
    tz: e.z,
    target: e,
    damage: t.def.damage,
    splash: 0,
    slow: null,
    arc: r.arc,
    t: 0,
    flightTime: Math.max(0.05, dist(t, e) / r.projectileSpeed),
    alive: true,
  };
  world.projectiles.push(p);
  world.events.emit('projectileFired', { projectile: p, troop: t });
}

