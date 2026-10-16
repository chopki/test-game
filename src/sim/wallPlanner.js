import { BUILDINGS } from './config.js';

/**
 * Plan a wall line between two tiles, for the drag-to-build wall tool.
 *
 * - The path is a straight line, or an L (along the longer axis first, then the shorter one),
 *   so every tile touches the next orthogonally and the wall has no diagonal gaps.
 * - Snapping: if `to` (or `from`) is on a non-wall building such as a tower or the Town Hall, that
 *   end moves to the tile beside the building that's nearest the other end, so the wall joins it.
 * - Tiles that already hold a wall are kept in the path but skipped (no cost). Other blocked tiles
 *   are marked with a reason. Tiles beyond what the player can afford are marked 'Not enough gold'.
 *
 * Returns { from, to, tiles: [{ x, z, ok, existing, reason }], count, cost, affordable, snapped }.
 */
export function planWall(world, from, to) {
  const snapFrom = snapTarget(world, from, to);
  const snapTo = snapTarget(world, to, snapFrom.tile);
  const start = snapFrom.tile;
  const end = snapTo.tile;

  const wallCost = BUILDINGS.wall.cost;
  let gold = world.economy.gold;
  let count = 0;
  const tiles = lPath(start, end).map(({ x, z }) => {
    const existing = world.buildingAt(x, z)?.type === 'wall';
    if (existing) return { x, z, ok: false, existing: true, reason: null };
    const check = world.canPlace('wall', x, z, { ignoreCost: true });
    if (!check.ok) return { x, z, ok: false, existing: false, reason: check.reason };
    if (gold < wallCost) return { x, z, ok: false, existing: false, reason: 'Not enough gold' };
    gold -= wallCost;
    count++;
    return { x, z, ok: true, existing: false, reason: null };
  });

  const blocked = tiles.filter((t) => !t.ok && !t.existing);
  return {
    from: start,
    to: end,
    tiles,
    count,
    cost: count * wallCost,
    affordable: !blocked.some((t) => t.reason === 'Not enough gold'),
    snapped: snapFrom.snapped || snapTo.snapped,
  };
}

/** If `tile` is on a non-wall building, the free tile beside it nearest `toward`; else `tile` itself. */
function snapTarget(world, tile, toward) {
  const b = world.buildingAt(tile.x, tile.z);
  if (!b || b.type === 'wall') return { tile, snapped: false };
  let best = tile;
  let bestDist = Infinity;
  // Tiles orthogonally adjacent to the footprint (the ring around it, without corners).
  for (let i = 0; i < b.size; i++) {
    for (const [x, z] of [
      [b.x + i, b.z - 1],
      [b.x + i, b.z + b.size],
      [b.x - 1, b.z + i],
      [b.x + b.size, b.z + i],
    ]) {
      if (!world.grid.inBounds(x, z)) continue;
      const d = Math.abs(x - toward.x) + Math.abs(z - toward.z);
      if (d < bestDist) {
        bestDist = d;
        best = { x, z };
      }
    }
  }
  return { tile: best, snapped: true };
}

/** Tiles from a to b: along the longer axis first, then the shorter one (inclusive, no repeats). */
export function lPath(a, b) {
  const tiles = [{ x: a.x, z: a.z }];
  const stepX = Math.sign(b.x - a.x);
  const stepZ = Math.sign(b.z - a.z);
  let { x, z } = a;
  const xFirst = Math.abs(b.x - a.x) >= Math.abs(b.z - a.z);
  for (const axis of xFirst ? ['x', 'z'] : ['z', 'x']) {
    if (axis === 'x') {
      while (x !== b.x) {
        x += stepX;
        tiles.push({ x, z });
      }
    } else {
      while (z !== b.z) {
        z += stepZ;
        tiles.push({ x, z });
      }
    }
  }
  return tiles;
}
