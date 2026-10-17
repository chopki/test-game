import { MinHeap } from './MinHeap.js';
import { TERRAIN } from './config.js';
import { T } from './terrain.js';

// [dx, dz, step length]
export const DIRECTIONS = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

/**
 * A single shared "distance to goal" map that every enemy follows.
 *
 * Buildings are NOT impassable: entering a building tile costs a penalty
 * (supplied by the world, based on the building's current HP). That single
 * rule produces the core survival behaviour — enemies walk around walls when
 * the detour is short, and smash through them when it's long or when the
 * Town Hall is fully enclosed. An enemy whose next step is a building attacks it.
 *
 * Terrain is different: water, rock and forest can never be entered (or broken), and fords cost extra.
 */
export class FlowField {
  constructor(grid) {
    this.grid = grid;
    const n = grid.width * grid.height;
    this.dist = new Float64Array(n).fill(Infinity);
    this.goal = new Uint8Array(n);
    this.penalty = () => 0;
  }

  compute(goalTiles, penaltyFn) {
    const { grid, dist, goal } = this;
    dist.fill(Infinity);
    goal.fill(0);
    this.penalty = penaltyFn;

    const heap = new MinHeap();
    for (const [x, z] of goalTiles) {
      const i = grid.index(x, z);
      dist[i] = 0;
      goal[i] = 1;
      heap.push(i, 0);
    }

    while (heap.size > 0) {
      const { value: i, priority: d } = heap.pop();
      if (d > dist[i]) continue;
      const cx = i % grid.width;
      const cz = (i / grid.width) | 0;
      // Cost an enemy pays to step INTO (cx, cz) from a neighbour.
      const enter = this.enterCost(cx, cz);
      for (const [dx, dz, step] of DIRECTIONS) {
        const nx = cx + dx;
        const nz = cz + dz;
        if (!grid.inBounds(nx, nz) || grid.isBlocked(nx, nz) || !this.canStep(nx, nz, cx, cz)) continue;
        const ni = grid.index(nx, nz);
        const nd = d + step + enter;
        if (nd < dist[ni]) {
          dist[ni] = nd;
          heap.push(ni, nd);
        }
      }
    }
  }

  enterCost(x, z) {
    const i = this.grid.index(x, z);
    if (this.goal[i]) return 0;
    const wade = this.grid.terrain[i] === T.ford ? TERRAIN.fordCost : this.grid.terrain[i] === T.ramp ? TERRAIN.hills.rampCost : 0;
    return this.grid.cells[i] === null ? wade : wade + this.penalty(x, z);
  }

  // Never onto blocking terrain. Diagonal moves are only allowed through fully open corners, so enemies
  // never squeeze between two diagonal walls (or rocks) or attack buildings diagonally.
  canStep(fromX, fromZ, toX, toZ) {
    const g = this.grid;
    if (g.isBlocked(toX, toZ) || g.isBlocked(fromX, fromZ)) return false;
    if (fromX === toX || fromZ === toZ) return true;
    const clear = (x, z) => g.get(x, z) === null && !g.isBlocked(x, z);
    return clear(fromX, fromZ) && clear(toX, toZ) && clear(fromX, toZ) && clear(toX, fromZ);
  }

  distanceAt(x, z) {
    return this.grid.inBounds(x, z) ? this.dist[this.grid.index(x, z)] : Infinity;
  }

  /** Best neighbouring tile to move into from (x, z), or null if none is reachable. */
  nextStep(x, z) {
    let best = null;
    let bestCost = Infinity;
    for (const [dx, dz, step] of DIRECTIONS) {
      const nx = x + dx;
      const nz = z + dz;
      if (!this.grid.inBounds(nx, nz) || !this.canStep(x, z, nx, nz)) continue;
      const cost = this.dist[this.grid.index(nx, nz)] + step + this.enterCost(nx, nz);
      if (cost < bestCost) {
        bestCost = cost;
        best = { x: nx, z: nz };
      }
    }
    return best;
  }
}
