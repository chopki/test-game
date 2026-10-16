import { T } from '../sim/terrain.js';

/**
 * Which way the water flows on each tile, for the flowing-water effect (no three.js; unit-tested in
 * test/waterFlow.test.js).
 *
 * Streams run off the map at both ends: for each connected body of water (and fords) that touches the map edge,
 * the flow runs away from the edge tile nearest the top-left corner, following the stream round its bends (the
 * direction in which the walking distance from that tile increases). Lakes that don't reach the edge are still.
 *
 * Returns a Float32Array of (x, z) unit vectors per tile (index (z * width + x) * 2), zero where still or dry.
 */
export function waterFlow(grid) {
  const { width: W, height: H } = grid;
  const wet = (x, z) => x >= 0 && z >= 0 && x < W && z < H && (grid.terrain[z * W + x] === T.water || grid.terrain[z * W + x] === T.ford);
  const flow = new Float32Array(W * H * 2);
  const seen = new Uint8Array(W * H);
  const N4 = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (let start = 0; start < W * H; start++) {
    if (seen[start] || !wet(start % W, (start / W) | 0)) continue;
    // Collect the body of water.
    const tiles = [start];
    seen[start] = 1;
    for (let k = 0; k < tiles.length; k++) {
      const x = tiles[k] % W;
      const z = (tiles[k] / W) | 0;
      for (const [dx, dz] of N4) {
        const i = (z + dz) * W + x + dx;
        if (wet(x + dx, z + dz) && !seen[i]) {
          seen[i] = 1;
          tiles.push(i);
        }
      }
    }
    const edge = tiles.filter((i) => {
      const x = i % W;
      const z = (i / W) | 0;
      return x === 0 || z === 0 || x === W - 1 || z === H - 1;
    });
    if (!edge.length) continue; // a lake: still
    const source = edge.reduce((a, b) => ((a % W) + ((a / W) | 0) <= (b % W) + ((b / W) | 0) ? a : b));
    // Walking distance from the source through the water.
    const dist = new Map([[source, 0]]);
    const queue = [source];
    for (let k = 0; k < queue.length; k++) {
      const i = queue[k];
      const x = i % W;
      const z = (i / W) | 0;
      for (const [dx, dz] of N4) {
        const j = (z + dz) * W + x + dx;
        if (wet(x + dx, z + dz) && !dist.has(j)) {
          dist.set(j, dist.get(i) + 1);
          queue.push(j);
        }
      }
    }
    // Flow = the direction distance increases, averaged over a 2-tile neighbourhood so bends turn smoothly.
    for (const i of tiles) {
      const x = i % W;
      const z = (i / W) | 0;
      let fx = 0;
      let fz = 0;
      for (let dz = -2; dz <= 2; dz++) {
        for (let dx = -2; dx <= 2; dx++) {
          const j = (z + dz) * W + x + dx;
          if ((dx || dz) && wet(x + dx, z + dz) && dist.has(j)) {
            const grade = (dist.get(j) - dist.get(i)) / Math.hypot(dx, dz);
            fx += (dx / Math.hypot(dx, dz)) * grade;
            fz += (dz / Math.hypot(dx, dz)) * grade;
          }
        }
      }
      const len = Math.hypot(fx, fz);
      if (len > 1e-6) {
        flow[i * 2] = fx / len;
        flow[i * 2 + 1] = fz / len;
      }
    }
  }
  return flow;
}
