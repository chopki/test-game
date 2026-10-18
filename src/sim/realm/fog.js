import { REALM } from '../config.js';
import { troopPassable } from '../troops.js';

/**
 * Realm's fog of war (see REALM.chunk): which parts of the map the kingdom has seen, kept in square chunks of tiles.
 * Pure: no DOM, no three.js. Heroes and buildings reveal what's round them; lairs are only known once their chunk has
 * been seen, and nothing can be built in a chunk no one has seen. `fog.version` goes up whenever more is revealed (the
 * renderer redraws the fog then).
 */

export function setupFog(world) {
  const c = REALM.chunk;
  const cols = Math.ceil(world.grid.width / c);
  const rows = Math.ceil(world.grid.height / c);
  world.realm.fog = { cols, rows, seen: new Uint8Array(cols * rows), version: 0 };
  const hall = world.townHall;
  reveal(world, hall.cx, hall.cz, REALM.startClear);
}

/** Whether the chunk holding tile (x, z) has been seen. */
export function seenAt(world, x, z) {
  const f = world.realm.fog;
  const c = REALM.chunk;
  const cx = Math.floor(x / c);
  const cz = Math.floor(z / c);
  if (cx < 0 || cz < 0 || cx >= f.cols || cz >= f.rows) return false;
  return f.seen[cz * f.cols + cx] === 1;
}

/** Reveal every chunk that comes within `r` tiles of (x, z). Returns how many were new. */
export function reveal(world, x, z, r) {
  const f = world.realm.fog;
  const c = REALM.chunk;
  let added = 0;
  const z0 = Math.max(0, Math.floor((z - r) / c));
  const z1 = Math.min(f.rows - 1, Math.floor((z + r) / c));
  const x0 = Math.max(0, Math.floor((x - r) / c));
  const x1 = Math.min(f.cols - 1, Math.floor((x + r) / c));
  for (let cz = z0; cz <= z1; cz++) {
    for (let cx = x0; cx <= x1; cx++) {
      const i = cz * f.cols + cx;
      if (f.seen[i]) continue;
      // The nearest point of the chunk to (x, z).
      const nx = Math.min(Math.max(x, cx * c), (cx + 1) * c);
      const nz = Math.min(Math.max(z, cz * c), (cz + 1) * c);
      if (Math.hypot(nx - x, nz - z) > r) continue;
      f.seen[i] = 1;
      added++;
    }
  }
  if (added) {
    f.version++;
    for (const lair of world.realm.lairs) {
      if (!lair.discovered && seenAt(world, lair.cx, lair.cz)) {
        lair.discovered = true;
        world.events.emit('lairFound', { lair });
      }
    }
  }
  return added;
}

/** What the kingdom sees now: round each hero out in the field, and round its buildings. */
export function updateFog(world) {
  for (const h of world.realm.heroes) if (h.alive && !h.inside) reveal(world, h.x, h.z, REALM.sight);
  for (const b of world.buildings.values()) if (b.team === 'red' && b.type !== 'wall') reveal(world, b.cx, b.cz, b.size / 2 + 3);
}

/**
 * The middle of a walkable tile in the nearest chunk not yet seen from (x, z), no further than `maxDist` tiles; or
 * null if everything that near has been seen. Chunks with no walkable tile (all woods or water) are skipped.
 */
export function nearestUnseen(world, x, z, maxDist) {
  const f = world.realm.fog;
  const c = REALM.chunk;
  const passable = troopPassable(world);
  const { grid } = world;
  let best = null;
  for (let cz = 0; cz < f.rows; cz++) {
    for (let cx = 0; cx < f.cols; cx++) {
      if (f.seen[cz * f.cols + cx]) continue;
      const mx = cx * c + c / 2;
      const mz = cz * c + c / 2;
      const d = Math.hypot(mx - x, mz - z);
      if (d > maxDist || (best && d >= best.d)) continue;
      // A walkable tile in it, nearest its middle.
      let tile = null;
      for (let tz = cz * c; tz < (cz + 1) * c && tz < grid.height; tz++) {
        for (let tx = cx * c; tx < (cx + 1) * c && tx < grid.width; tx++) {
          if (grid.isInSpawnZone(tx, tz) || !passable(tx, tz)) continue;
          const td = Math.hypot(tx + 0.5 - mx, tz + 0.5 - mz);
          if (!tile || td < tile.d) tile = { x: tx + 0.5, z: tz + 0.5, d: td };
        }
      }
      if (tile) best = { x: tile.x, z: tile.z, d };
    }
  }
  return best && { x: best.x, z: best.z };
}

/** The share of the map seen so far (0…1). */
export function seenShare(world) {
  const f = world.realm.fog;
  let n = 0;
  for (const s of f.seen) n += s;
  return n / f.seen.length;
}
