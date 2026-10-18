import { MinHeap } from './MinHeap.js';
import { DIRECTIONS } from './FlowField.js';

/**
 * A* over the tile grid, for units that each go somewhere of their own (troops; enemies share the flow field).
 * `passable(x, z)` says which tiles can be entered; diagonal steps need both side tiles passable too, so units
 * never squeeze between two diagonal walls. The start tile is always allowed (a unit may stand where a building
 * has just gone up). The search ends at the first tile within `near` (Chebyshev distance) of the goal.
 *
 * `extra(x, z)`, if given, adds to the cost of entering a tile (lane soldiers weigh enemy walls by their health).
 *
 * Returns the tiles to walk, start excluded ([] if already there), or null if the goal can't be reached within
 * `maxNodes` expanded tiles.
 */
export function findPath(grid, passable, from, to, { near = 0, maxNodes = 4000, extra = null } = {}) {
  const W = grid.width;
  const reached = (x, z) => Math.max(Math.abs(x - to.x), Math.abs(z - to.z)) <= near;
  if (reached(from.x, from.z)) return [];
  const h = (x, z) => {
    const dx = Math.abs(x - to.x);
    const dz = Math.abs(z - to.z);
    return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
  };
  const start = grid.index(from.x, from.z);
  const cost = new Map([[start, 0]]);
  const came = new Map();
  const open = new MinHeap();
  open.push(start, h(from.x, from.z));
  let expanded = 0;
  const ok = (x, z) => grid.inBounds(x, z) && passable(x, z);
  while (open.size > 0 && expanded++ < maxNodes) {
    const { value: i } = open.pop();
    const cx = i % W;
    const cz = (i / W) | 0;
    if (reached(cx, cz)) {
      const path = [];
      for (let k = i; k !== start; k = came.get(k)) path.push({ x: k % W, z: (k / W) | 0 });
      return path.reverse();
    }
    const g = cost.get(i);
    for (const [dx, dz, step] of DIRECTIONS) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (!ok(nx, nz)) continue;
      if (dx && dz && !(ok(cx + dx, cz) && ok(cx, cz + dz))) continue;
      const ni = grid.index(nx, nz);
      const ng = g + step + (extra ? extra(nx, nz) : 0);
      if (ng < (cost.get(ni) ?? Infinity)) {
        cost.set(ni, ng);
        came.set(ni, i);
        open.push(ni, ng + h(nx, nz));
      }
    }
  }
  return null;
}
