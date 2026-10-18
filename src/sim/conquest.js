import { BUILDINGS, CONQUEST, PATHING, TERRAIN, TROOPS, UPGRADES } from './config.js';
import { nextUpgradeCost } from './upgrades.js';
import { nearestLane } from './lanes.js';
import { dist, reachOf, walkTo } from './troops.js';
import { T } from './terrain.js';

/**
 * Conquest: castle against castle (see CONQUEST in config.js and lanes.js for the map). Pure: no DOM, no three.js.
 * World calls these when `world.mode === 'conquest'`: the starting forts, each wave's squads, the soldiers who
 * march the lanes (`world.troops` with a `lane`), and the blue side's AI, which spends its gold through the same
 * World commands the player uses.
 */

export const TEAMS = ['red', 'blue'];
export const otherTeam = (team) => (team === 'red' ? 'blue' : 'red');

/** A lane's waypoints in the order `team` marches them (they're stored red to blue). */
export const lanePoints = (world, lane, team) => (team === 'red' ? world.lanes[lane].points : [...world.lanes[lane].points].reverse());

/** The point `t` (0..1) of the way along `team`'s march of `lane`, by length. */
function alongLane(world, lane, team, t) {
  const pts = lanePoints(world, lane, team);
  const seg = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.z - pts[i].z));
  let left = t * seg.reduce((a, b) => a + b, 0);
  for (let i = 0; i < seg.length; i++) {
    if (left <= seg[i]) {
      const k = seg[i] ? left / seg[i] : 0;
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * k, z: pts[i].z + (pts[i + 1].z - pts[i].z) * k };
    }
    left -= seg[i];
  }
  return pts.at(-1);
}

/**
 * Where a `type` could go for `team` near (px, pz): the free spot nearest it that the rules allow, a little off the
 * lane's middle so the way stays open. Null if there's none within `radius`. `anywhere` skips the rule that new
 * buildings go near your own (for laying out the forts).
 */
export function spotNear(world, type, team, px, pz, { radius = 5, offLane = 1.8, ignoreCost = false, anywhere = false } = {}) {
  const size = BUILDINGS[type].size;
  const spots = [];
  for (let dz = -radius; dz <= radius; dz++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = Math.round(px - size / 2) + dx;
      const z = Math.round(pz - size / 2) + dz;
      spots.push({ x, z, d: Math.hypot(x + size / 2 - px, z + size / 2 - pz) });
    }
  }
  spots.sort((a, b) => a.d - b.d);
  for (const s of spots) {
    if (s.d > radius) break;
    if (nearestLane(world.lanes, s.x + size / 2, s.z + size / 2).dist < offLane) continue;
    if (world.canPlace(type, s.x, s.z, { team, ignoreCost, anywhere }).ok) return s;
  }
  return null;
}

/**
 * Both forts: a Barracks and two Archer Towers on each lane (CONQUEST.fort). Red's are laid out first; blue's are
 * their mirror images, so the two sides start exactly even.
 */
export function buildForts(world) {
  const { width: W, height: H } = world.grid;
  const add = (type, x, z, lane) => {
    for (const [team, bx, bz] of [
      ['red', x, z],
      ['blue', W - x - BUILDINGS[type].size, H - z - BUILDINGS[type].size],
    ]) {
      const b = world._addBuilding(type, bx, bz, team);
      Object.assign(b, { starter: true, spent: 0, lane });
    }
  };
  for (let lane = 0; lane < world.lanes.length; lane++) {
    const at = (t) => alongLane(world, lane, 'red', t);
    const place = (type, t) => {
      const p = at(t);
      // Off the lane's middle if there's room, else nearer it.
      for (const offLane of type === 'barracks' ? [2.4, 1.6, 0.8] : [1.6, 1, 0]) {
        const spot = spotNear(world, type, 'red', p.x + 0.5, p.z + 0.5, { ignoreCost: true, anywhere: true, radius: 7, offLane });
        // Its mirror must be free too (another lane's building may stand there).
        if (spot && mirrorFree(world, type, spot)) {
          add(type, spot.x, spot.z, lane);
          return;
        }
      }
    };
    place('barracks', CONQUEST.fort.barracks);
    for (const t of CONQUEST.fort.towers) place('archerTower', t);
  }
}

function mirrorFree(world, type, { x, z }) {
  const size = BUILDINGS[type].size;
  const mx = world.grid.width - x - size;
  const mz = world.grid.height - z - size;
  return world.grid.isAreaFree(mx, mz, size);
}

/** The men each Barracks sends in wave `n`. */
export function squadFor(n) {
  const { men: kinds, max, siege } = CONQUEST.squad;
  const men = [];
  for (const [type, { base, per, from = 1 }] of Object.entries(kinds)) {
    if (n < from) continue;
    const count = Math.floor(base + per * (n - from));
    for (let i = 0; i < count; i++) men.push(type);
  }
  const engines = siege.filter(({ from, every }) => n >= from && (n - from) % every === 0).map((s) => s.type);
  return [...men.slice(0, max), ...engines];
}

/** A wave: every Barracks on both sides sends its squad down its lane. */
export function sendSquads(world, n) {
  for (const b of world.buildings.values()) {
    if (!b.def.trains || !b.door) continue;
    b.lane ??= nearestLane(world.lanes, b.cx, b.cz).lane;
    for (const [i, type] of squadFor(n).entries()) spawnLaneSoldier(world, b, type, i, n);
  }
}

function spawnLaneSoldier(world, b, type, i, n) {
  const def = TROOPS.types[type];
  const maxHp = Math.round(def.maxHp * (1 + CONQUEST.hpPerWave * (n - 1)));
  const pts = lanePoints(world, b.lane, b.team);
  // Join the lane at the waypoint after the one nearest the Barracks.
  let wp = 0;
  let best = Infinity;
  for (const [k, p] of pts.entries()) {
    const d = Math.hypot(p.x - b.cx, p.z - b.cz);
    if (d < best) [best, wp] = [d, k];
  }
  const u = {
    id: world._nextId++,
    type,
    def,
    team: b.team,
    barracksId: null, // lane soldiers aren't tied to their Barracks
    lane: b.lane,
    wp: Math.min(wp + 1, pts.length - 1),
    slot: i,
    x: b.door.x + 0.5,
    z: b.door.z + 0.5,
    tx: b.door.x,
    tz: b.door.z,
    hp: maxHp,
    maxHp,
    heading: 0,
    moving: false,
    fighting: false,
    attackTimer: 0,
    target: null,
    retarget: i * 0.05,
    path: null,
    pathKey: -1,
    repath: 0,
    offX: world.troopRng.range(-0.25, 0.25),
    offZ: world.troopRng.range(-0.25, 0.25),
    slowFactor: 1,
    slowUntil: 0,
    delay: i * 0.6, // the squad files out of the door one by one
    alive: true,
  };
  world.troops.push(u);
  world.events.emit('troopTrained', { troop: u, building: b });
}

const isBuilding = (thing) => thing.size !== undefined;
const alive = (world, thing) => (isBuilding(thing) ? world.buildings.get(thing.id) === thing : thing.alive);
/** Distance from `u` to `thing`: a unit's position, or a building's nearest edge. */
const reachTo = (world, u, thing) => (isBuilding(thing) ? world._distanceTo(thing, u.x, u.z) : dist(u, thing));

/**
 * Tiles a lane soldier may path through: open ground, any enemy building (to break), his own gatehouse, and, if
 * `squeeze` (his own side has hemmed him in), past his own buildings too.
 */
function lanePassable(world, team, squeeze = false) {
  const { grid } = world;
  return (x, z) => {
    if (grid.isBlocked(x, z)) return false;
    const id = grid.get(x, z);
    if (id === null) return true;
    const b = world.buildings.get(id);
    return squeeze || b.team !== team || b.type === 'gatehouse';
  };
}

/** Squeezing past one of his own buildings costs this much (so it's only done when there's no other way). */
const SQUEEZE_COST = 12;

/** What stepping onto a tile costs beyond the step: wading, breaking an enemy building (by its health), squeezing. */
function laneExtra(world, team) {
  const { grid } = world;
  return (x, z) => {
    const t = grid.terrainAt(x, z);
    let cost = t === T.ford ? TERRAIN.fordCost : t === T.ramp ? TERRAIN.hills.rampCost : 0;
    const id = grid.get(x, z);
    if (id !== null) {
      const b = world.buildings.get(id);
      cost += b.team !== team ? 1 + b.hp * PATHING.breachCostPerHp : b.type === 'gatehouse' ? 0 : SQUEEZE_COST;
    }
    return cost;
  };
}

/** Strict: open ground (and his own gatehouse) only, for walking up to a target. */
function openPassable(world, team) {
  const { grid } = world;
  return (x, z) => {
    if (grid.isBlocked(x, z)) return false;
    const id = grid.get(x, z);
    if (id === null) return true;
    const b = world.buildings.get(id);
    return b.team === team && b.type === 'gatehouse';
  };
}

/**
 * The nearest enemy within CONQUEST.aggro of soldier `u`: a soldier if there is one, else a building (not walls:
 * those he breaks only when they're in his way).
 */
function pickLaneTarget(world, u) {
  let best = null;
  let bestD = CONQUEST.aggro;
  // Siege engines go for buildings only.
  for (const v of u.def.siege ? [] : world.troops) {
    if (!v.alive || v.team === u.team || v.delay > 0) continue;
    const d = dist(u, v);
    if (d <= bestD) [best, bestD] = [v, d];
  }
  if (best) return best;
  bestD = Math.max(CONQUEST.aggro, reachOf(u.def)); // a siege catapult sees buildings as far as it can throw
  for (const b of world.buildings.values()) {
    if (b.team === u.team || b.type === 'wall' || (u.unreachable?.id === b.id && world.time < u.unreachable.until)) continue;
    const d = world._distanceTo(b, u.x, u.z);
    if (d <= bestD) [best, bestD] = [b, d];
  }
  return best;
}

export function updateLaneSoldier(world, u, dt) {
  u.moving = false;
  if (u.delay > 0) {
    u.delay -= dt;
    return;
  }
  if (u.target && (!alive(world, u.target) || (!isBuilding(u.target) && dist(u, u.target) > CONQUEST.chase))) u.target = null;
  if ((u.retarget -= dt) <= 0) {
    u.retarget = 0.4;
    // Soldiers come first: a man hacking at a tower turns on the enemy who comes up to him.
    if (!u.target || isBuilding(u.target)) u.target = pickLaneTarget(world, u) ?? u.target;
  }

  const target = u.target;
  if (target) {
    if (reachTo(world, u, target) <= reachOf(u.def) + (isBuilding(target) ? 0.25 : 0)) {
      const [px, pz] = isBuilding(target) ? world._nearestPoint(target, u.x, u.z) : [target.x, target.z];
      u.heading = Math.atan2(px - u.x, pz - u.z);
      if (!u.fighting) u.attackTimer = u.def.attackCooldown * 0.5;
      u.fighting = true;
      u.attackTimer -= dt;
      if (u.attackTimer <= 0) {
        u.attackTimer += u.def.attackCooldown / Math.max(1, u.slowFactor ?? 1); // a war cry speeds them up
        world._soldierStrike(u, target);
      }
      return;
    }
    u.fighting = false;
    const near = u.def.ranged ? Math.floor(reachOf(u.def)) : 1;
    let [gx, gz] = [target.x, target.z];
    if (isBuilding(target)) {
      // The middle of the footprint tile nearest him (the path ends beside it).
      const [px, pz] = world._nearestPoint(target, u.x, u.z);
      gx = Math.min(Math.floor(px), target.x + target.size - 1) + 0.5;
      gz = Math.min(Math.floor(pz), target.z + target.size - 1) + 0.5;
    }
    if (!walkTo(world, u, gx, gz, dt, near, { passable: openPassable(world, u.team), maxNodes: 900 })) {
      // Walled off: leave that building for a while and march on (breaking the walls in the way).
      if (isBuilding(target)) u.unreachable = { id: target.id, until: world.time + 4 };
      u.target = null;
    }
    return;
  }

  u.fighting = false;
  march(world, u, dt);
}

/** Follow the lane to the next waypoint (the last is the enemy Town Hall), breaking any enemy wall in the way. */
function march(world, u, dt) {
  const pts = lanePoints(world, u.lane, u.team);
  while (u.wp < pts.length - 1 && Math.hypot(pts[u.wp].x + 0.5 - u.x, pts[u.wp].z + 0.5 - u.z) < 2) u.wp++;
  const foeHall = u.team === 'red' ? world.enemyHall : world.townHall;
  let goal = pts[u.wp];
  if (u.wp >= pts.length - 1 && alive(world, foeHall)) goal = { x: foeHall.x + 1, z: foeHall.z + 1 };
  // Stuck behind his own side's buildings? Then he may squeeze past them.
  if (u.noPath && u.repath <= dt) u.squeeze = true;
  const result = walkTo(world, u, goal.x + 0.5, goal.z + 0.5, dt, 1, {
    passable: lanePassable(world, u.team, u.squeeze),
    extra: laneExtra(world, u.team),
    stopAt: (x, z) => world.grid.get(x, z) !== null && world.buildingAt(x, z).team !== u.team,
    maxNodes: 3000,
  });
  if (result?.stop) u.target = world.buildingAt(result.stop.x, result.stop.z);
}

// ---------------------------------------------------------------- the AI (blue)

/**
 * The blue side's turn to think (every CONQUEST.ai.think seconds): it spends its gold through World.place and
 * World.upgrade, as the player does, one thing a turn, in this order: more Barracks (men each wave) on the lane it
 * has fewest on; its Town Hall's next stage (due every CONQUEST.ai.hallEvery seconds a stage, and saved up for
 * unless the enemy is near); once the enemy is pressing a lane, a wall across it with a gap in the middle, which
 * funnels attackers past its towers; Archer Towers on the lane where red soldiers have come nearest its Town Hall
 * (or the lane with fewest towers); and the weakest tower on that lane up a stage.
 */
export function aiThink(world) {
  const team = 'blue';
  const eco = world.economyOf(team);
  const hall = world.enemyHall;
  const lanes = world.lanes.map((_, i) => ({ i, threat: Infinity, barracks: 0, towers: 0 }));
  for (const u of world.troops) {
    if (u.team === team || !u.alive || u.lane === undefined) continue;
    lanes[u.lane].threat = Math.min(lanes[u.lane].threat, Math.hypot(u.x - hall.cx, u.z - hall.cz));
  }
  for (const b of world.buildings.values()) {
    if (b.team !== team || b.lane === undefined) continue;
    if (b.def.trains) lanes[b.lane].barracks++;
    else if (b.def.attack) lanes[b.lane].towers++;
  }
  const reserve = CONQUEST.ai.reserve;
  const threatened = [...lanes].sort((a, b) => a.threat - b.threat)[0];
  // A tower where the enemy is pressing (or on the lane with fewest towers), between its last tower and its hall.
  const wantTower = threatened.threat < world.grid.height * 0.55 ? threatened : [...lanes].sort((a, b) => a.towers - b.towers)[0];
  const thinBarracks = [...lanes].sort((a, b) => a.barracks - b.barracks)[0];
  const maxBarracks = world.lanes.length + Math.floor(world.time / 150);
  const barracksCount = lanes.reduce((s, l) => s + l.barracks, 0);
  if (barracksCount < maxBarracks && eco.gold >= BUILDINGS.barracks.cost + reserve) {
    if (aiBuild(world, 'barracks', thinBarracks.i, 0.08 + world.troopRng.range(0, 0.06))) return;
  }
  // Its Town Hall's next stage when it's due: saved up for, unless the enemy is close.
  const hallCost = nextUpgradeCost('townHall', hall.stage);
  const hallDue = hallCost !== null && world.time >= hall.stage * CONQUEST.ai.hallEvery;
  if (hallDue && eco.gold >= hallCost + reserve && world.upgrade(hall.id, { team }).ok) return;
  if (hallDue && threatened.threat > world.grid.height * 0.25) return;
  const pressed = lanes.find((l) => l.threat < world.grid.height * CONQUEST.ai.wallWhen && !world.aiWalls?.has(l.i));
  if (pressed && eco.gold >= BUILDINGS.wall.cost * 10 + reserve) {
    aiWall(world, pressed.i);
    return;
  }
  if (eco.gold >= BUILDINGS.archerTower.cost + reserve && aiBuild(world, 'archerTower', wantTower.i, world.troopRng.range(0.12, 0.4))) return;
  const towers = [...world.buildings.values()].filter((b) => b.team === team && b.def.attack && b.type !== 'townHall' && b.lane === wantTower.i);
  towers.sort((a, b) => a.stage - b.stage);
  for (const t of towers) {
    const cost = nextUpgradeCost(t.type, t.stage);
    if (cost !== null && eco.gold >= cost + reserve && world.upgrade(t.id, { team }).ok) return;
  }
}

/**
 * A wall across `lane`, inside the blue fort's outer towers, leaving a gap of CONQUEST.ai.wallGap tiles in the
 * middle (blue's own squads go through it; attackers are funnelled through it, or break the wall).
 */
function aiWall(world, lane) {
  (world.aiWalls ??= new Set()).add(lane);
  const pts = lanePoints(world, lane, 'blue');
  const p = alongLane(world, lane, 'blue', CONQUEST.ai.wallAt);
  // The lane's direction there, and across it.
  let k = 0;
  for (let i = 1; i < pts.length; i++) if (Math.hypot(pts[i].x - p.x, pts[i].z - p.z) < Math.hypot(pts[k].x - p.x, pts[k].z - p.z)) k = i;
  const a = pts[Math.max(0, k - 1)];
  const b = pts[Math.min(pts.length - 1, k + 1)];
  const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  const [ax, az] = [-(b.z - a.z) / len, (b.x - a.x) / len];
  const half = CONQUEST.ai.wallGap / 2;
  const placed = new Set();
  for (let o = -8; o <= 8; o += 0.5) {
    if (Math.abs(o) < half) continue;
    const x = Math.round(p.x + ax * o);
    const z = Math.round(p.z + az * o);
    const key = `${x},${z}`;
    if (placed.has(key)) continue;
    placed.add(key);
    const r = world.place('wall', x, z, { team: 'blue' });
    if (r.ok) r.building.lane = lane;
  }
}

function aiBuild(world, type, lane, t) {
  const p = alongLane(world, lane, 'blue', t);
  const spot = spotNear(world, type, 'blue', p.x + 0.5, p.z + 0.5, { radius: 5, offLane: type === 'barracks' ? 2.4 : 1.6 });
  if (!spot) return false;
  const r = world.place(type, spot.x, spot.z, { team: 'blue' });
  if (r.ok) r.building.lane = lane;
  return r.ok;
}
