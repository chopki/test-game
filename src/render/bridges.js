import { T } from '../sim/terrain.js';

/**
 * Where footbridges go (no three.js; unit-tested in test/bridges.test.js): one across the middle of each ford,
 * running across the flow. Returns pieces { part: 'mid' | 'start' | 'end', axis: 'x' | 'z', x, z } (tiles):
 * 'mid' on each wet tile of the crossing, 'start' / 'end' on the bank at the low / high end (if it's open ground). Decoration only:
 * fords stay fords for the sim.
 *
 * `flow` is waterFlow(grid) (unit flow vectors per tile).
 */
export function fordBridges(grid, flow) {
  const W = grid.width;
  const at = (x, z) => (grid.inBounds(x, z) ? grid.terrain[z * W + x] : -1);
  const wet = (x, z) => at(x, z) === T.water || at(x, z) === T.ford;
  const seen = new Uint8Array(W * grid.height);
  const pieces = [];
  for (let z0 = 0; z0 < grid.height; z0++) {
    for (let x0 = 0; x0 < W; x0++) {
      if (at(x0, z0) !== T.ford || seen[z0 * W + x0]) continue;
      // One ford: its connected ford tiles.
      const tiles = [];
      const stack = [[x0, z0]];
      seen[z0 * W + x0] = 1;
      while (stack.length) {
        const [x, z] = stack.pop();
        tiles.push([x, z]);
        for (const [nx, nz] of [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]]) {
          if (at(nx, nz) === T.ford && !seen[nz * W + nx]) {
            seen[nz * W + nx] = 1;
            stack.push([nx, nz]);
          }
        }
      }
      let fx = 0;
      let fz = 0;
      for (const [x, z] of tiles) {
        fx += Math.abs(flow[(z * W + x) * 2]);
        fz += Math.abs(flow[(z * W + x) * 2 + 1]);
      }
      // The bridge runs across the flow: water running along z is crossed along x.
      const axis = fz >= fx ? 'x' : 'z';
      // Its line: the ford's middle row (or column) across the flow.
      const along = (t) => (axis === 'x' ? t[1] : t[0]);
      const lines = [...new Set(tiles.map(along))].sort((a, b) => a - b);
      const line = lines[Math.floor((lines.length - 1) / 2)];
      const onLine = tiles.filter((t) => along(t) === line).map((t) => (axis === 'x' ? t[0] : t[1]));
      const tileAt = (a) => (axis === 'x' ? [a, line] : [line, a]);
      let lo = Math.min(...onLine);
      let hi = Math.max(...onLine);
      while (wet(...tileAt(lo - 1))) lo--;
      while (wet(...tileAt(hi + 1))) hi++;
      for (let a = lo; a <= hi; a++) pieces.push({ part: 'mid', axis, x: tileAt(a)[0], z: tileAt(a)[1] });
      for (const [part, a] of [['start', lo - 1], ['end', hi + 1]]) {
        const [x, z] = tileAt(a);
        if (at(x, z) === T.open) pieces.push({ part, axis, x, z }); // not onto woods or rock
      }
    }
  }
  return pieces;
}
