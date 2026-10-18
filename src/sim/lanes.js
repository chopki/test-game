import { T } from './terrain.js';
import { createNoise } from './noise.js';

/**
 * The Conquest map: a long, wide field of meadows and groves with a castle clearing at each end and three lanes
 * between them (west, middle, east), crossed halfway by a stream (fords where the lanes meet it), with rocks and
 * neutral camps in the woods. Pure: no DOM, no three.js.
 *
 * The map is point-symmetric: tile (x, z) matches (W-1-x, H-1-z), so neither side has the easier ground. Everything
 * is carved twice, at a point and its mirror; the west lane's mirror is the east lane.
 *
 * Returns { types, levels (tile levels: the plateaus are 1), halls: { red, blue } (top-left tiles of the 3×3 Town
 * Halls), lanes, camps (the neutral camps' middles, both halves), layout (its name, see LAYOUTS) } where each lane
 * is { name, points } with `points` the waypoints from the red hall to the blue (blue walks them backwards).
 */
/** Groves: how much of the map is wooded (`cover`), the noise's scale (smaller: bigger groves), and the lanes'
 * half-width where they're carved through the woods. */
export const GROVES = { cover: 0.45, scale: 0.11, lane: 2.2 };

/**
 * The map's layouts (one per map, from its seed): where the lanes run (control points of the west lane, red to
 * blue, and the red half of the middle lane, as fractions of the map), the plateaus on them (lane, height up the
 * map, and half-width and half-depth in whole tiles), the neutral camps in the woods (red half; mirrored), the stream's bend,
 * and any clearing in the middle (where lanes meet).
 */
export const LAYOUTS = {
  roads: {
    name: 'The Three Roads',
    west: [[0.27, -15], [0.14, 0.72], [0.13, 0.5], [0.14, 0.28], [0.27, 14]],
    middle: [[0.5, 0.8], [0.5, 0.64]],
    plateaus: [['west', 0.64, 4, 3], ['middle', 0.72, 4, 3]],
    camps: [[0.31, 0.62], [0.7, 0.7]],
    bend: [1.2, 2.6],
    centre: 0,
  },
  crossing: {
    name: 'The Crossing',
    // The west lane swings in to the middle, by the stream, and out to the east on the far side; so does its
    // mirror the other way: all three lanes meet at the crossroads.
    west: [[0.24, -15], [0.13, 0.74], [0.16, 0.6], [0.38, 0.52], [0.62, 0.48], [0.84, 0.4], [0.87, 0.26], [0.76, 15]],
    middle: [[0.5, 0.8], [0.52, 0.64]],
    plateaus: [['west', 0.7, 3, 3], ['middle', 0.74, 4, 3]],
    camps: [[0.3, 0.64], [0.78, 0.62]],
    bend: [0.6, 1.4],
    centre: 6,
  },
  winding: {
    name: 'The Winding Way',
    west: [[0.27, -15], [0.12, 0.76], [0.1, 0.56], [0.12, 0.4], [0.12, 0.22], [0.27, 14]],
    middle: [[0.36, 0.82], [0.64, 0.72], [0.38, 0.6], [0.5, 0.5]],
    plateaus: [['west', 0.62, 3, 3], ['middle', 0.66, 4, 3]],
    camps: [[0.3, 0.7], [0.74, 0.6]],
    bend: [2.4, 3.6],
    centre: 0,
  },
};
const LAYOUT_NAMES = Object.keys(LAYOUTS);

export function generateLaneMap({ width: W, height: H, rng, layout = null }) {
  const plan = LAYOUTS[layout ?? LAYOUT_NAMES[rng.int(0, LAYOUT_NAMES.length - 1)]];
  const types = new Uint8Array(W * H).fill(T.forest);
  const mirror = ([x, z]) => [W - 1 - x, H - 1 - z];
  const inside = (x, z) => x >= 2 && z >= 2 && x < W - 2 && z < H - 2;

  // Groves: open ground broken up by woods (GROVES.cover of it), from a noise field taken on one half of the map
  // and mirrored onto the other. The lanes are carved through them below, but only as narrow gaps: out in the open
  // there's no telling where a lane runs, and there's more than one way round.
  const noise = createNoise(rng);
  const [ox, oz] = [rng.range(0, 100), rng.range(0, 100)];
  const field = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const j = Math.min(i, W * H - 1 - i); // the tile and its mirror read the same point
    field[i] = noise.fbm((j % W) * GROVES.scale + ox, Math.floor(j / W) * GROVES.scale + oz, 3);
  }
  const sorted = Float32Array.from(field).sort();
  const cut = sorted[Math.floor(sorted.length * (1 - GROVES.cover))];
  for (let z = 0; z < H; z++) {
    for (let x = 0; x < W; x++) {
      const i = z * W + x;
      if (inside(x, z) && field[i] < cut) types[i] = T.open;
    }
  }
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
  carve(redCentre[0], redCentre[1], 10);

  const jitter = (v, a) => v + rng.range(-a, a);
  // A control point: fractions of the map (a negative height counts back from the far end, in tiles), jittered.
  const at = ([fx, fz], a = 1) => [jitter(fx * W, a), fz < 0 ? H + fz : fz > 1 ? fz : jitter(fz * H, a * 2)];
  const west = smooth([redCentre, ...plan.west.map((p) => at(p)), blueCentre]);
  const midHalf = smooth([redCentre, ...plan.middle.map((p) => at(p, 2)), [W / 2 - 0.5, H / 2 - 0.5]]);
  for (const path of [west, midHalf]) {
    for (const [i, [x, z]] of path.entries()) carve(x, z, GROVES.lane + 0.4 * Math.sin(i * 0.37 + rng.range(0, 1)));
  }
  if (plan.centre) carve(W / 2 - 0.5, H / 2 - 0.5, plan.centre);

  // Rocks scattered through the woods and, now and then, out in the open (off the lanes).
  for (let i = 0; i < 40; i++) {
    const x = rng.int(2, W - 3);
    const z = rng.int(Math.floor(H / 2), H - 3);
    const t = types[z * W + x];
    if (t === T.forest || (t === T.open && rng.next() < 0.3 && ![...west, ...midHalf].some(([px, pz]) => Math.hypot(px - x, pz - z) < GROVES.lane + 2))) carve(x, z, 0.4, T.rock);
  }

  // Neutral camps: clearings in the woods with a trail out to the nearest lane.
  const camps = [];
  for (const spot of plan.camps) {
    const [cx, cz] = at(spot, 1);
    carve(cx, cz, 2.8);
    let near = null;
    for (const p of [...west, ...midHalf]) if (!near || Math.hypot(p[0] - cx, p[1] - cz) < Math.hypot(near[0] - cx, near[1] - cz)) near = p;
    const len = Math.hypot(near[0] - cx, near[1] - cz);
    for (let d = 0; d <= len; d += 0.5) carve(cx + ((near[0] - cx) * d) / len, cz + ((near[1] - cz) * d) / len, 1.3);
    const [mx, mz] = mirror([Math.round(cx), Math.round(cz)]);
    camps.push({ x: Math.round(cx), z: Math.round(cz) }, { x: mx, z: mz });
  }

  // Hills: low, clear, square-cut plateaus on the west and middle lanes (and their mirrors), with a strip of open
  // ground round them so their cliffs show; the lanes climb over them by ramps where they cross the rim.
  const levels = new Uint8Array(W * H);
  const nearestTo = (path, z) => path.reduce((best, p) => (Math.abs(p[1] - z) < Math.abs(best[1] - z) ? p : best));
  for (const [lane, fz, rx, rz] of plan.plateaus) {
    const [px, pz] = nearestTo(lane === 'west' ? west : midHalf, fz * H);
    const [cx, cz] = [Math.round(px), Math.round(pz)];
    for (const [mx, mz] of [[cx, cz], mirror([cx, cz])]) {
      for (let tz = mz - rz - 1; tz <= mz + rz + 1; tz++) {
        for (let tx = mx - rx - 1; tx <= mx + rx + 1; tx++) {
          if (!inside(tx, tz)) continue;
          const top = Math.abs(tx - mx) <= rx && Math.abs(tz - mz) <= rz;
          if (top) levels[tz * W + tx] = 1;
          if (types[tz * W + tx] === T.forest) types[tz * W + tx] = T.open; // the top, and the strip round it
        }
      }
    }
  }
  const level = (x, z) => (x >= 0 && z >= 0 && x < W && z < H ? levels[z * W + x] : 0);
  const open = (x, z) => x >= 0 && z >= 0 && x < W && z < H && types[z * W + x] === T.open;
  const onLane = new Uint8Array(W * H); // within the lanes' width (ramps go only where a lane crosses the rim)
  for (const [x, z] of [...west, ...midHalf, ...west.map(mirror), ...midHalf.map(mirror)]) {
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (inside(Math.round(x) + dx, Math.round(z) + dz)) onLane[(Math.round(z) + dz) * W + Math.round(x) + dx] = 1;
  }
  const rim = [];
  for (let z = 0; z < H; z++) {
    for (let x = 0; x < W; x++) {
      if (!level(x, z)) continue;
      let edge = false;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (level(x + dx, z + dz) === 0) edge = true;
      if (edge) rim.push([x, z]);
    }
  }
  // Where a lane crosses the rim (open ground on top on one side and below on the other), a ramp; elsewhere cliff.
  // (All decided before any tile changes, so both ends come out the same.)
  const crossing = ([x, z]) =>
    open(x, z) &&
    onLane[z * W + x] &&
    [[0, 1], [1, 0]].some(([dx, dz]) => {
      const up = (sx, sz) => level(sx, sz) && open(sx, sz);
      const down = (sx, sz) => !level(sx, sz) && open(sx, sz);
      return (up(x - dx, z - dz) && down(x + dx, z + dz)) || (up(x + dx, z + dz) && down(x - dx, z - dz));
    });
  const ramps = rim.map(crossing);
  rim.forEach(([x, z], i) => (types[z * W + x] = ramps[i] ? T.ramp : T.cliff));

  // The stream across the middle: fords where it crosses a lane, deep water elsewhere. Odd about the centre, so it
  // mirrors onto itself.
  const bend = rng.range(...plan.bend);
  for (let x = 0; x < W; x++) {
    const u = x - (W - 1) / 2;
    const zc = (H - 1) / 2 + bend * Math.sin((u / W) * Math.PI * 2);
    for (const z of [Math.floor(zc), Math.floor(zc) + 1]) {
      for (const [mx, mz] of [[x, z], mirror([x, z])]) {
        if (!inside(mx, mz)) continue;
        const i = mz * W + mx;
        // Fords where a lane crosses; elsewhere deep water (out in the meadows too), so the crossings matter.
        types[i] = types[i] === T.open && onLane[i] ? T.ford : types[i] === T.open || types[i] === T.rock || types[i] === T.forest ? T.water : types[i];
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
  return { types, levels, halls: { red, blue }, lanes, camps, layout: plan.name };
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
