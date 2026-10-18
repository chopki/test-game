import { HEROES } from './config.js';
import { dist, findPost, troopPassable, walkTo } from './troops.js';
import { lanePoints } from './conquest.js';

/**
 * Conquest heroes (see HEROES in config.js). Pure: no DOM, no three.js. A hero is one of `world.troops` (so towers,
 * soldiers and arrows treat it like any soldier) with `hero: true`, and `world.heroes[team]` always holds the
 * side's hero, alive or waiting to come back (`respawnAt`).
 */

const isBuilding = (thing) => thing.size !== undefined;
const alive = (world, thing) => (isBuilding(thing) ? world.buildings.get(thing.id) === thing : thing.alive);
const hallOf = (world, team) => (team === 'blue' ? world.enemyHall : world.townHall);

/** A hero's stats at `level`: its base stats, plus HEROES.perLevel of its health and damage a level. */
export function heroDef(team, level) {
  const k = 1 + HEROES.perLevel * (level - 1);
  const s = HEROES.stats;
  return { ...s, name: HEROES.names[team], maxHp: Math.round(s.maxHp * k), damage: Math.round(s.damage * k), reward: HEROES.bounty };
}

/** Put `team`'s hero (back) at its Town Hall's door, keeping its level and XP. */
export function spawnHero(world, team) {
  const old = world.heroes[team];
  const level = old?.level ?? 1;
  const hall = hallOf(world, team);
  const { door } = findPost(world, hall);
  const at = door ?? { x: hall.x + 1, z: hall.z + hall.size };
  const def = heroDef(team, level);
  const h = {
    id: world._nextId++,
    hero: true,
    type: 'knight',
    elite: true, // drawn as a warlord: the crowned knight, half as big again
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
    warCryReady: old?.warCryReady ?? 0,
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

/** The war cry: allies near `team`'s hero heal and speed up (HEROES.warCry). False if it's down or resting. */
export function warCry(world, team) {
  const h = world.heroes[team];
  const w = HEROES.warCry;
  if (!h?.alive || world.time < h.warCryReady) return false;
  h.warCryReady = world.time + w.cooldown;
  const allies = world.troops.filter((t) => t.alive && t.team === team && dist(t, h) <= w.radius);
  for (const t of allies) {
    t.hp = Math.min(t.maxHp, t.hp + t.maxHp * w.heal);
    t.slowFactor = w.haste;
    t.slowUntil = world.time + w.duration;
  }
  world.events.emit('warCry', { hero: h, x: h.x, z: h.z, radius: w.radius, allies: allies.length });
  return true;
}

/** XP for `team`'s hero when a foe worth `amount` falls at (x, z) near it; levels it up when it's earned enough. */
export function heroXp(world, team, x, z, amount) {
  const h = world.heroes?.[team];
  if (!h?.alive || Math.hypot(h.x - x, h.z - z) > HEROES.xpRange) return;
  h.xp += amount;
  while (h.level < HEROES.levels.length && h.xp >= HEROES.levels[h.level]) {
    h.level++;
    const def = heroDef(team, h.level);
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
  const at = lead ?? lanePoints(world, lane, 'blue')[Math.floor(lanePoints(world, lane, 'blue').length * 0.3)];
  if (!h.target) orderHero(world, 'blue', { x: at.x, z: at.z });
  // A war cry when it's in a fight among friends, or hurt.
  const friends = world.troops.filter((t) => t.alive && t.team === 'blue' && dist(t, h) <= HEROES.warCry.radius).length;
  if (h.fighting && (friends >= 4 || h.hp < h.maxHp * 0.5)) warCry(world, 'blue');
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
    if (d <= h.def.reach + (isBuilding(t) ? 0.25 : 0)) {
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
    if (!walkTo(world, h, gx, gz, dt, 1)) h.target = null;
    return;
  }
  h.fighting = false;
  if (Math.hypot(home.x - h.x, home.z - h.z) > 0.6) walkTo(world, h, home.x, home.z, dt, 1);
}

