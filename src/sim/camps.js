import { CAMPS, TROOPS } from './config.js';
import { dist, reachOf, walkTo } from './troops.js';

/**
 * Conquest's neutral camps (see CAMPS in config.js): bandits guarding clearings in the woods, foes of both sides.
 * Pure: no DOM, no three.js. Guards are `world.troops` of team 'neutral' with a `camp` (its index in
 * `world.camps`); `world.campState[i]` says when a cleared camp fills again.
 */

/** Where each guard of a camp stands, round its middle. */
const SPOTS = [
  [-0.8, -0.4],
  [0.8, -0.4],
  [0, 0.8],
];

export function setupCamps(world) {
  world.campState = world.camps.map(() => ({ respawnAt: null }));
  world.camps.forEach((_, i) => fillCamp(world, i));
}

function fillCamp(world, i) {
  const camp = world.camps[i];
  const k = 1 + CAMPS.growth * (world.time / 60);
  for (const [n, type] of CAMPS.guards.entries()) {
    const base = TROOPS.types[type];
    const def = { ...base, reward: Math.round(base.reward * CAMPS.bounty) };
    const [ox, oz] = SPOTS[n % SPOTS.length];
    const home = { x: camp.x + 0.5 + ox, z: camp.z + 0.5 + oz };
    const maxHp = Math.round(base.maxHp * k);
    world.troops.push({
      id: world._nextId++,
      type,
      def,
      team: 'neutral',
      camp: i,
      home,
      x: home.x,
      z: home.z,
      tx: Math.floor(home.x),
      tz: Math.floor(home.z),
      hp: maxHp,
      maxHp,
      heading: Math.PI,
      moving: false,
      fighting: false,
      attackTimer: 0,
      target: null,
      retarget: n * 0.1,
      path: null,
      pathKey: -1,
      repath: 0,
      alive: true,
    });
  }
  world.campState[i].respawnAt = null;
}

/** Someone struck one of a camp's guards: the whole camp turns on them. */
export function campAlarm(world, camp, attacker) {
  for (const u of world.troops) if (u.alive && u.camp === camp && !u.target) u.target = attacker;
}

/** A guard fell: once the whole camp's down, it fills again after CAMPS.respawn seconds. */
export function campGuardFell(world, t) {
  if (world.troops.some((u) => u.alive && u.camp === t.camp)) return;
  world.campState[t.camp].respawnAt = world.time + CAMPS.respawn;
  world.events.emit('campCleared', { camp: t.camp, by: t.lastHitBy ?? null });
}

/** Cleared camps filling again. */
export function updateCamps(world) {
  world.campState.forEach((state, i) => {
    if (state.respawnAt !== null && world.time >= state.respawnAt) fillCamp(world, i);
  });
}

export function updateCampGuard(world, u, dt) {
  u.moving = false;
  const camp = world.camps[u.camp];
  const centre = { x: camp.x + 0.5, z: camp.z + 0.5 };
  if (u.target && (!u.target.alive || dist(u.target, centre) > CAMPS.leash)) u.target = null;
  if (!u.target && (u.retarget -= dt) <= 0) {
    u.retarget = 0.4;
    // Anyone (not a bandit) at the camp, or whoever struck one of its guards.
    let best = null;
    let bestD = CAMPS.aggro;
    for (const v of world.troops) {
      if (!v.alive || v.team === 'neutral' || v.delay > 0) continue;
      const d = dist(v, centre);
      if (d <= bestD) [best, bestD] = [v, d];
    }
    u.target = best;
  }
  const t = u.target;
  if (t) {
    if (dist(u, t) <= reachOf(u.def)) {
      u.heading = Math.atan2(t.x - u.x, t.z - u.z);
      if (!u.fighting) u.attackTimer = u.def.attackCooldown * 0.5;
      u.fighting = true;
      u.attackTimer -= dt;
      if (u.attackTimer <= 0) {
        u.attackTimer += u.def.attackCooldown;
        world._soldierStrike(u, t);
      }
      return;
    }
    u.fighting = false;
    if (!walkTo(world, u, t.x, t.z, dt, u.def.ranged ? Math.floor(reachOf(u.def)) : 1)) u.target = null;
    return;
  }
  // Back to their place, healing.
  u.fighting = false;
  if (Math.hypot(u.home.x - u.x, u.home.z - u.z) > 0.3) walkTo(world, u, u.home.x, u.home.z, dt, 0);
  else u.hp = Math.min(u.maxHp, u.hp + CAMPS.regen * dt);
}
