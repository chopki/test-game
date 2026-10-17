import { TERRAIN } from './config.js';
import { createNoise } from './noise.js';

/**
 * Terrain: what each tile is made of. Generated once per map from the seed, then fixed for the game.
 *
 * Water, rock and forest block enemies and building. Fords (shallow crossings of a stream) can be waded but
 * not built on. Enemies can't break terrain, so it decides the routes and chokepoints the player fortifies.
 *
 * Some maps have a coast: sea along one edge (it blocks like water, and no enemies come from that side), behind
 * a sandy beach that can be walked and built on.
 *
 * The generator lays down features (a coast, forest clumps, rock outcrops and ridges, a stream with fords or a
 * lake), then repairs the map until it meets the rules in `analyzeTerrain`: every walkable tile reaches the Town
 * Hall, every land side keeps reachable spawn tiles on its edge, passages are at least 2 tiles wide, and enough of
 * the land is open.
 */

export const T = { open: 0, water: 1, ford: 2, rock: 3, forest: 4, sea: 5, sand: 6 };
export const TERRAIN_NAMES = ['open', 'water', 'ford', 'rock', 'forest', 'sea', 'sand'];

export const blocksMovement = (t) => t === T.water || t === T.rock || t === T.forest || t === T.sea;
export const isBuildableTerrain = (t) => t === T.open || t === T.sand;

const SIDES = ['north', 'south', 'west', 'east'];
const N4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** An all-open map. */
export function openTerrain(width, height) {
  return new Uint8Array(width * height);
}

/**
 * Generate terrain for a `width` × `height` map with the Town Hall at `hall` ({ x, z, size }). With `river`, the
 * map always gets a stream. `coast`: the side ('north', 'south', 'west' or 'east') the sea lies along, or null.
 * Returns a Uint8Array of T values (index z * width + x). Deterministic for a given rng state.
 */
export function generateTerrain({ width, height, spawnMargin, hall, rng, params = TERRAIN, river = false, coast = null }) {
  let density = 1;
  let best = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const map = new TerrainMap(width, height, spawnMargin, hall);
    map.coast = coast;
    layFeatures(map, rng, params, density, river);
    repair(map, rng, params);
    const stats = analyzeTerrain(map.types, { width, height, spawnMargin, hall });
    if (!best || stats.openFraction > best.stats.openFraction) best = { types: map.types, stats };
    if (stats.openFraction >= params.minOpenFraction) return map.types;
    density *= 0.8;
  }
  return best.types;
}

class TerrainMap {
  constructor(width, height, spawnMargin, hall) {
    this.width = width;
    this.height = height;
    this.spawnMargin = spawnMargin;
    this.hall = hall;
    this.types = openTerrain(width, height);
    this.coast = null;
  }

  inBounds(x, z) {
    return x >= 0 && z >= 0 && x < this.width && z < this.height;
  }

  get(x, z) {
    return this.types[z * this.width + x];
  }

  set(x, z, t) {
    if (this.inBounds(x, z)) this.types[z * this.width + x] = t;
  }

  blocked(x, z) {
    return this.inBounds(x, z) && blocksMovement(this.get(x, z));
  }

  /** Make a blocking tile walkable: water becomes a ford, sea becomes beach, rock and forest become open ground. */
  clear(x, z) {
    if (!this.blocked(x, z)) return;
    const t = this.get(x, z);
    this.set(x, z, t === T.water ? T.ford : t === T.sea ? T.sand : T.open);
  }

  hallCentre() {
    return { x: this.hall.x + this.hall.size / 2, z: this.hall.z + this.hall.size / 2 };
  }
}

// ---------------------------------------------------------------- features

function layFeatures(map, rng, params, density, river = false) {
  const { width: W, height: H } = map;
  const noise = createNoise(rng);
  const c = map.hallCentre();
  const clearR = params.clearingRadius + map.hall.size / 2;

  // The coast and water first, so forests and rocks can grow up to the shores.
  if (map.coast) coastline(map, rng, noise, params);
  if (river || rng.next() < params.water.streamChance * Math.min(1, density + 0.2)) stream(map, rng, params, clearR);
  else if (rng.next() < params.water.lakeChance * density) lake(map, rng, noise, clearR);

  // Forest: fractal noise above a threshold that drops towards the map edges (dense woods frame the map).
  const f = params.forest;
  const fThreshold = f.threshold + (1 - density) * 0.25;
  for (let z = 0; z < H; z++) {
    for (let x = 0; x < W; x++) {
      if (map.get(x, z) !== T.open) continue;
      const edge = 1 - Math.min(x, z, W - 1 - x, H - 1 - z) / (Math.min(W, H) / 2);
      const n = noise.fbm(x * f.scale, z * f.scale);
      if (n > fThreshold - f.edgeBoost * edge * edge) map.set(x, z, T.forest);
    }
  }

  // Rock outcrops: a second, finer noise field with a high threshold gives scattered boulder clusters.
  const r = params.rock;
  const rThreshold = r.threshold + (1 - density) * 0.15;
  for (let z = 0; z < H; z++) {
    for (let x = 0; x < W; x++) {
      if (map.get(x, z) !== T.open) continue;
      if (noise.fbm(x * r.scale + 61.7, z * r.scale + 23.9, 2) > rThreshold) map.set(x, z, T.rock);
    }
  }
  // Ridges: short meandering lines of rock.
  const ridges = Math.round(rng.int(r.ridges[0], r.ridges[1]) * density);
  for (let i = 0; i < ridges; i++) {
    let x = rng.int(3, W - 4);
    let z = rng.int(3, H - 4);
    let dir = rng.int(0, 3);
    const len = rng.int(r.ridgeLength[0], r.ridgeLength[1]);
    for (let s = 0; s < len; s++) {
      if (map.inBounds(x, z) && map.get(x, z) === T.open) map.set(x, z, T.rock);
      if (rng.next() < 0.3) dir = (dir + (rng.next() < 0.5 ? 1 : 3)) % 4;
      x += N4[dir][0];
      z += N4[dir][1];
    }
  }

  // The Town Hall's clearing is always open.
  for (let z = 0; z < H; z++) {
    for (let x = 0; x < W; x++) {
      if (Math.hypot(x + 0.5 - c.x, z + 0.5 - c.z) <= clearR) map.set(x, z, T.open);
    }
  }
}

/** A stream crossing the map edge to edge (missing the hall's clearing), 2 tiles wide, with fords. */
function stream(map, rng, params, clearR) {
  const vertical = rng.next() < 0.5;
  const len = vertical ? map.height : map.width;
  const across = vertical ? map.width : map.height;
  const centre = vertical ? map.hallCentre().x : map.hallCentre().z;
  const gap = clearR + 3;
  // Which side of the hall it runs; if the hall sits too near that edge for a stream to fit, the other side.
  const range = (low) => (low ? [map.spawnMargin + 4, Math.floor(centre - gap)] : [Math.ceil(centre + gap), across - map.spawnMargin - 6]);
  let lowSide = rng.next() < 0.5;
  if (range(lowSide)[1] < range(lowSide)[0]) lowSide = !lowSide;
  const [lo, hi] = range(lowSide);
  if (hi < lo) return;
  const base = rng.int(lo, hi);
  const amp = rng.range(1.5, 3.5);
  const freq = rng.range(0.12, 0.25);
  const phase = rng.range(0, Math.PI * 2);
  // Keep the meander on its side of the hall.
  const limitLo = lowSide ? 1 : Math.ceil(centre + gap - 1);
  const limitHi = lowSide ? Math.floor(centre - gap) : across - 3;
  const course = [];
  for (let i = 0; i < len; i++) {
    const a = Math.round(base + amp * Math.sin(i * freq + phase) + amp * 0.4 * Math.sin(i * freq * 2.3 + phase * 1.7));
    course.push(Math.max(limitLo, Math.min(limitHi, a)));
  }
  // Where the stream reaches the coast it runs out into the sea.
  const at = (i, a) => {
    const [x, z] = vertical ? [a, i] : [i, a];
    if (map.inBounds(x, z) && map.get(x, z) !== T.sea) map.set(x, z, T.water);
  };
  for (let i = 0; i < len; i++) {
    // Fill between consecutive rows so the stream has no diagonal-only joins.
    const from = Math.min(course[i], course[i - 1] ?? course[i]);
    const to = Math.max(course[i], course[i - 1] ?? course[i]);
    for (let a = from; a <= to + 1; a++) at(i, a);
  }
  // Fords: short stretches where the water is shallow enough to wade.
  const fords = rng.int(params.water.fords[0], params.water.fords[1]);
  const w = params.water.fordWidth;
  for (let f = 0; f < fords; f++) {
    const start = Math.round(((f + 0.5) / fords) * len + rng.range(-len / 8, len / 8)) - 1;
    for (let i = start; i < start + w; i++) {
      for (let a = 0; a < across; a++) {
        const x = vertical ? a : i;
        const z = vertical ? i : a;
        if (map.inBounds(x, z) && map.get(x, z) === T.water) map.set(x, z, T.ford);
      }
    }
  }
}

/**
 * Sea along the coast side: a shoreline that wanders in and out (coves and headlands) a few tiles from the edge,
 * behind a beach of sand.
 */
function coastline(map, rng, noise, params) {
  const { depth, wobble, beach } = params.sea;
  const side = map.coast;
  const along = side === 'north' || side === 'south' ? map.width : map.height;
  const base = rng.range(depth[0], depth[1]);
  const freq = rng.range(0.15, 0.3);
  const phase = rng.range(0, Math.PI * 2);
  for (let i = 0; i < along; i++) {
    const n = noise.fbm(i * 0.18 + 91.3, 7.7, 2) - 0.5;
    const shore = base + wobble * Math.sin(i * freq + phase) + n * wobble * 2.4;
    const sand = shore + beach[0] + (noise.value(i * 0.4 + 13, 2.1) * (beach[1] - beach[0]));
    for (let d = 0; d < sand; d++) {
      const [x, z] = side === 'north' ? [i, d] : side === 'south' ? [i, map.height - 1 - d] : side === 'west' ? [d, i] : [map.width - 1 - d, i];
      map.set(x, z, d < shore ? T.sea : T.sand);
    }
  }
}

/** A round-ish lake away from the hall. */
function lake(map, rng, noise, clearR) {
  const c = map.hallCentre();
  const r = rng.range(2.5, 4.5);
  for (let tries = 0; tries < 20; tries++) {
    const lx = rng.range(map.spawnMargin + r + 1, map.width - map.spawnMargin - r - 1);
    const lz = rng.range(map.spawnMargin + r + 1, map.height - map.spawnMargin - r - 1);
    if (Math.hypot(lx - c.x, lz - c.z) < clearR + r + 2) continue;
    for (let z = Math.floor(lz - r - 2); z <= lz + r + 2; z++) {
      for (let x = Math.floor(lx - r - 2); x <= lx + r + 2; x++) {
        const d = Math.hypot(x + 0.5 - lx, z + 0.5 - lz) + (noise.value(x * 0.5 + 40, z * 0.5) - 0.5) * 2;
        if (d < r && map.inBounds(x, z) && map.get(x, z) === T.open) map.set(x, z, T.water);
      }
    }
    return;
  }
}

// ---------------------------------------------------------------- repair

function repair(map, rng, params) {
  for (let pass = 0; pass < 8; pass++) {
    let changed = openSpawnEdges(map, rng, params);
    changed = fillPockets(map) || changed;
    changed = connect(map) || changed;
    changed = widenPinches(map) || changed;
    if (!changed) return;
  }
  // Filling pockets and widening passages can undo each other; finish with the steps that only ever
  // remove blockers, which always settles.
  for (let pass = 0; pass < 40; pass++) {
    const changed = widenPinches(map);
    if (!connect(map) && !changed) return;
  }
}

/** Make sure every side keeps enough walkable edge tiles for enemies to spawn on. */
function openSpawnEdges(map, rng, params) {
  let changed = false;
  for (const side of SIDES) {
    if (side === map.coast) continue; // no one comes from the sea
    const tiles = edgeTiles(map, side);
    if (tiles.filter(([x, z]) => !map.blocked(x, z)).length >= params.minSpawnTilesPerSide) continue;
    const gapLen = params.minSpawnTilesPerSide + 2;
    const start = rng.int(0, tiles.length - gapLen);
    for (let i = start; i < start + gapLen; i++) map.clear(...tiles[i]);
    changed = true;
  }
  return changed;
}

function edgeTiles(map, side) {
  const { width: W, height: H, spawnMargin: m } = map;
  const out = [];
  if (side === 'north' || side === 'south') for (let x = m; x < W - m; x++) out.push([x, side === 'north' ? 0 : H - 1]);
  else for (let z = m; z < H - m; z++) out.push([side === 'west' ? 0 : W - 1, z]);
  return out;
}

/** Label 4-connected walkable regions. Returns { label: Int32Array (-1 = blocked), sizes: [] }. */
function regions(map) {
  const { width: W, height: H } = map;
  const label = new Int32Array(W * H).fill(-1);
  const sizes = [];
  for (let i = 0; i < W * H; i++) {
    if (label[i] !== -1 || blocksMovement(map.types[i])) continue;
    const id = sizes.length;
    let size = 0;
    const stack = [i];
    label[i] = id;
    while (stack.length) {
      const j = stack.pop();
      size++;
      const x = j % W;
      const z = (j / W) | 0;
      for (const [dx, dz] of N4) {
        const nx = x + dx;
        const nz = z + dz;
        if (!map.inBounds(nx, nz)) continue;
        const k = nz * W + nx;
        if (label[k] === -1 && !blocksMovement(map.types[k])) {
          label[k] = id;
          stack.push(k);
        }
      }
    }
    sizes.push(size);
  }
  return { label, sizes };
}

const hallRegion = (map, label) => label[map.hall.z * map.width + map.hall.x];

/** Fill small walkable pockets cut off from the hall (they'd only be dead ends). */
function fillPockets(map) {
  const { label, sizes } = regions(map);
  const home = hallRegion(map, label);
  let changed = false;
  for (let i = 0; i < label.length; i++) {
    const id = label[i];
    if (id === -1 || id === home || sizes[id] >= 6) continue;
    const x = i % map.width;
    const z = (i / map.width) | 0;
    // Don't fill spawn-edge tiles: those get connected instead.
    if (x === 0 || z === 0 || x === map.width - 1 || z === map.height - 1) continue;
    map.types[i] = surroundingBlocker(map, x, z);
    changed = true;
  }
  return changed;
}

function surroundingBlocker(map, x, z) {
  for (const [dx, dz] of N4) {
    if (map.blocked(x + dx, z + dz)) {
      const t = map.get(x + dx, z + dz);
      return t === T.water ? T.water : t;
    }
  }
  return T.forest;
}

/** Carve a 2-wide way from every walkable region that can't reach the hall (fewest blocking tiles removed). */
function connect(map) {
  const { width: W, height: H } = map;
  let changed = false;
  for (let guard = 0; guard < 40; guard++) {
    const { label } = regions(map);
    const home = hallRegion(map, label);
    const lost = label.findIndex((id) => id !== -1 && id !== home);
    if (lost === -1) return changed;
    // 0-1 BFS from the lost region to the hall's: stepping onto a blocking tile costs 1.
    const lostId = label[lost];
    const dist = new Int32Array(W * H).fill(1 << 30);
    const prev = new Int32Array(W * H).fill(-1);
    const deque = [];
    for (let i = 0; i < W * H; i++) {
      if (label[i] === lostId) {
        dist[i] = 0;
        deque.push(i);
      }
    }
    let end = -1;
    while (deque.length) {
      const j = deque.shift();
      if (label[j] === home) {
        end = j;
        break;
      }
      const x = j % W;
      const z = (j / W) | 0;
      for (const [dx, dz] of N4) {
        const nx = x + dx;
        const nz = z + dz;
        if (!map.inBounds(nx, nz)) continue;
        const k = nz * W + nx;
        if (map.types[k] === T.sea) continue; // no causeways out to sea
        const w = blocksMovement(map.types[k]) ? 1 : 0;
        if (dist[j] + w < dist[k]) {
          dist[k] = dist[j] + w;
          prev[k] = j;
          if (w) deque.push(k);
          else deque.unshift(k);
        }
      }
    }
    if (end === -1) return changed;
    for (let j = end; j !== -1 && label[j] !== lostId; j = prev[j]) {
      const x = j % W;
      const z = (j / W) | 0;
      map.clear(x, z);
      // Second lane, beside the step direction, so the passage is 2 wide.
      const p = prev[j];
      if (p !== -1) {
        const horizontal = p % W !== x;
        if (horizontal) map.clear(x, z + 1 < H ? z + 1 : z - 1);
        else map.clear(x + 1 < W ? x + 1 : x - 1, z);
      }
    }
    changed = true;
  }
  return changed;
}

/** Widen 1-tile passages (walkable tile with blockers on opposite sides, or diagonal-only joins). */
function widenPinches(map) {
  let changed = false;
  for (let z = 0; z < map.height; z++) {
    for (let x = 0; x < map.width; x++) {
      if (map.blocked(x, z)) continue;
      if (map.blocked(x - 1, z) && map.blocked(x + 1, z)) {
        map.clear(...preferClear(map, [x - 1, z], [x + 1, z]));
        changed = true;
      }
      if (map.blocked(x, z - 1) && map.blocked(x, z + 1)) {
        map.clear(...preferClear(map, [x, z - 1], [x, z + 1]));
        changed = true;
      }
      // Diagonal-only joins: enemies can't squeeze between two blocked corners.
      for (const dx of [-1, 1]) {
        const nx = x + dx;
        const nz = z + 1;
        if (!map.inBounds(nx, nz) || map.blocked(nx, nz)) continue;
        if (map.blocked(nx, z) && map.blocked(x, nz)) {
          map.clear(...preferClear(map, [nx, z], [x, nz]));
          changed = true;
        }
      }
    }
  }
  return changed;
}

/** Of two blocking tiles, the better one to remove: rock/forest before water before sea (shores keep their shape). */
function preferClear(map, a, b) {
  const score = ([x, z]) => ({ [T.water]: 1, [T.sea]: 2 })[map.get(x, z)] ?? 0;
  return score(a) <= score(b) ? a : b;
}

// ---------------------------------------------------------------- analysis

/**
 * Check a terrain map against the generator's rules. Used by tests and by the generator itself.
 * Returns { openFraction (of the land), unreachable, spawnTiles: { side: n }, coast: [sides all sea], pinches }.
 */
export function analyzeTerrain(types, { width, height, spawnMargin, hall }) {
  const map = new TerrainMap(width, height, spawnMargin, hall);
  map.types = types;
  const { label } = regions(map);
  const home = hallRegion(map, label);
  let unreachable = 0;
  let open = 0;
  let buildable = 0;
  for (let z = 0; z < height; z++) {
    for (let x = 0; x < width; x++) {
      const i = z * width + x;
      if (label[i] !== -1 && label[i] !== home) unreachable++;
      const inSpawnZone = x < spawnMargin || z < spawnMargin || x >= width - spawnMargin || z >= height - spawnMargin;
      if (inSpawnZone || types[i] === T.sea) continue;
      buildable++;
      if (isBuildableTerrain(types[i])) open++;
    }
  }
  const spawnTiles = {};
  for (const side of SIDES) spawnTiles[side] = edgeTiles(map, side).filter(([x, z]) => label[z * width + x] === home).length;
  const coast = SIDES.filter((side) => edgeTiles(map, side).every(([x, z]) => types[z * width + x] === T.sea));
  let pinches = 0;
  for (let z = 0; z < height; z++) {
    for (let x = 0; x < width; x++) {
      if (map.blocked(x, z)) continue;
      if (map.blocked(x - 1, z) && map.blocked(x + 1, z)) pinches++;
      if (map.blocked(x, z - 1) && map.blocked(x, z + 1)) pinches++;
    }
  }
  return { openFraction: open / buildable, unreachable, spawnTiles, coast, pinches };
}

/** Walkable edge tiles per side that can reach the hall (where enemies spawn). */
export function spawnTilesBySide(types, { width, height, spawnMargin, hall }) {
  const map = new TerrainMap(width, height, spawnMargin, hall);
  map.types = types;
  const { label } = regions(map);
  const home = hallRegion(map, label);
  return Object.fromEntries(SIDES.map((side) => [side, edgeTiles(map, side).filter(([x, z]) => label[z * width + x] === home)]));
}
