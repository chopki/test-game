import { T } from './terrain.js';

/**
 * The Conquest map: a long field of woods with a castle clearing at each end and three lanes between them (west,
 * middle, east), crossed halfway by a stream (fords where the lanes meet it), with a few clearings and rocks in the
 * woods. Pure: no DOM, no three.js.
 *
 * The map is point-symmetric: tile (x, z) matches (W-1-x, H-1-z), so neither side has the easier ground. Everything
 * is carved twice, at a point and its mirror; the west lane's mirror is the east lane.
 *
 * Returns { types, halls: { red, blue } (top-left tiles of the 3×3 Town Halls), lanes } where each lane is
 * { name, points } with `points` the waypoints from the red hall to the blue (blue walks them backwards).
 */
export function generateLaneMap({ width: W, height: H, rng }) {
  const types = new Uint8Array(W * H).fill(T.forest);
  const mirror = ([x, z]) => [W - 1 - x, H - 1 - z];
  const inside = (x, z) => x >= 2 && z >= 2 && x < W - 2 && z < H - 2;
  const set = (x, z, t) => {
    if (!inside(x, z)) return;
    types[z * W + x] = t;
  };
  /** Clear a disc of radius `r` round (cx, cz), and its mirror. */
  const carve = (cx, cz, r, t = T.open) => {
    for (const [mx, mz] of [[cx, cz], mirror([cx, cz])]) {
      for (let z = Math.floor(mz - r); z <= Math.ceil(mz + r); z++) {
        for (let x = Math.floor(mx - r); x <= Math.ceil(mx + r); x++) {
          if ((x - mx) ** 2 + (z - mz) ** 2 <= r * r) set(x, z, t);
        }
      }
    }
  };

  // Town Halls: red at the south end, blue (its mirror) at the north.
  const hallX = Math.floor(W / 2) - 1;
  const hallZ = H - 12;
  const red = { x: hallX, z: hallZ };
  const blue = { x: W - hallX - 3, z: H - hallZ - 3 };
  const redCentre = [red.x + 1, red.z + 1];
  const blueCentre = [blue.x + 1, blue.z + 1];
  carve(redCentre[0], redCentre[1], 8.5);

  const jitter = (v, a) => v + rng.range(-a, a);
  // The west lane, red to blue: out of the base to the west, up the side, and in to the blue base.
  const west = smooth([
    redCentre,
    [jitter(W * 0.27, 1), H - 15],
    [jitter(W * 0.14, 1), jitter(H * 0.72, 3)],
    [jitter(W * 0.13, 1.5), H * 0.5],
    [jitter(W * 0.14, 1), jitter(H * 0.28, 3)],
    [jitter(W * 0.27, 1), 14],
    blueCentre,
  ]);
  // The middle lane's red half, wandering a little; its mirror is the blue half.
  const midHalf = smooth([redCentre, [jitter(W * 0.5, 2), H * 0.8], [jitter(W * 0.5, 3), H * 0.64], [W / 2 - 0.5, H / 2 - 0.5]]);
  for (const path of [west, midHalf]) {
    for (const [i, [x, z]] of path.entries()) carve(x, z, 3 + 0.5 * Math.sin(i * 0.37 + rng.range(0, 1)));
  }

  // Clearings in the woods between the lanes, some with a rock or two.
  for (let i = 0; i < 4; i++) {
    const cx = jitter(W * (i % 2 ? 0.7 : 0.31), 1.5);
    const cz = jitter(H * (0.6 + i * 0.08), 2);
    carve(cx, cz, rng.range(2, 3.2));
    if (rng.next() < 0.6) carve(Math.round(cx), Math.round(cz), 0.5, T.rock);
  }
  // Rocks scattered through the woods.
  for (let i = 0; i < 26; i++) {
    const x = rng.int(2, W - 3);
    const z = rng.int(Math.floor(H / 2), H - 3);
    if (types[z * W + x] === T.forest) carve(x, z, 0.4, T.rock);
  }

  // The stream across the middle: water in the woods, fords where it crosses a lane. Odd about the centre, so it
  // mirrors onto itself.
  const bend = rng.range(1.2, 2.6);
  for (let x = 0; x < W; x++) {
    const u = x - (W - 1) / 2;
    const zc = (H - 1) / 2 + bend * Math.sin((u / W) * Math.PI * 2);
    for (const z of [Math.floor(zc), Math.floor(zc) + 1]) {
      for (const [mx, mz] of [[x, z], mirror([x, z])]) {
        if (!inside(mx, mz)) continue;
        const i = mz * W + mx;
        types[i] = types[i] === T.open ? T.ford : types[i] === T.rock ? T.water : types[i] === T.forest ? T.water : types[i];
      }
    }
  }

  // Waypoints every few tiles, red to blue. The east lane is the west's mirror, walked the other way.
  const thin = (pts, step = 6) => pts.filter((_, i) => i % step === 0 || i === pts.length - 1).map(([x, z]) => ({ x: Math.round(x), z: Math.round(z) }));
  const westPts = thin(west);
  const midPts = thin(midHalf);
  const lanes = [
    { name: 'west', points: westPts },
    { name: 'middle', points: [...midPts, ...midPts.slice(0, -1).reverse().map((p) => mirrorPoint(p, W, H))] },
    { name: 'east', points: westPts.map((p) => mirrorPoint(p, W, H)).reverse() },
  ];
  return { types, halls: { red, blue }, lanes };
}

const mirrorPoint = ({ x, z }, W, H) => ({ x: W - 1 - x, z: H - 1 - z });

/** A Catmull-Rom curve through `pts`, sampled about every half tile. */
function smooth(pts) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * 2));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts.at(-1));
  return out;
}

/** The lane nearest (x, z): its index in `lanes` and the distance to its nearest waypoint. */
export function nearestLane(lanes, x, z) {
  let best = { lane: 0, dist: Infinity };
  for (const [i, lane] of lanes.entries()) {
    for (const p of lane.points) {
      const d = Math.hypot(p.x + 0.5 - x, p.z + 0.5 - z);
      if (d < best.dist) best = { lane: i, dist: d };
    }
  }
  return best;
}
