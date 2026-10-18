import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { plasterTexture, roofTexture, roughStoneTexture, speckleTexture, woodTexture } from './textures.js';

// The modelling kit used by models.js: materials, geometry helpers, the Parts merger, and builders for the
// recurring pieces of the art style (stone courses, shingle roofs, timber framing, windows, wheels...).
//
// Models are only ever rendered when sprites are baked (see spriteBaker.js), so detail costs nothing at play
// time: walls are built block by block, roofs row by row.

// ------------------------------------------------------------------ materials

export const std = (opts) => new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0, ...opts });
const speckled = (base, amount = 0.1) => std({ map: speckleTexture(base, amount) });

export const MATERIALS = {
  mortar: std({ color: 0x5e4c3a }),
  mortarDark: std({ color: 0x3e3e48 }),
  capstone: speckled('#e2cfa6', 0.08),
  plaster: std({ map: plasterTexture() }),
  beam: std({ map: woodTexture('#4e321e') }),
  wood: std({ map: woodTexture('#8a5a34') }),
  woodLight: std({ map: woodTexture('#a8743f') }),
  woodDark: std({ map: woodTexture('#5f3d23') }),
  opening: std({ color: 0x241810 }),
  glass: std({ color: 0x2a3440, roughness: 0.4 }),
  iron: std({ color: 0x3a3a42, metalness: 0.55, roughness: 0.45 }),
  gold: std({ color: 0xe0b84a, metalness: 0.6, roughness: 0.35 }),
  bannerRed: std({ color: 0xb02a22, side: THREE.DoubleSide }),
  bannerTrim: std({ color: 0xe0b84a, side: THREE.DoubleSide }),
  crystal: std({ color: 0xd0a0ff, emissive: 0x8f3dff, emissiveIntensity: 1.35, roughness: 0.25 }),
  rune: std({ color: 0xb48cff, emissive: 0x8a4dff, emissiveIntensity: 1.1 }),
  rope: std({ color: 0xc4a874 }),
  dirt: speckled('#8a6f48', 0.12),
  grass: std({ color: 0x6e9a3e }),
  grassDark: std({ color: 0x55802f }),
  // The enemy army: steel, mail and blue-and-cream livery (the player's colours are red and gold).
  skin: std({ color: 0xe2b48a }),
  hair: std({ color: 0x5a3b22 }),
  steel: std({ color: 0xaeb3bc, metalness: 0.6, roughness: 0.38 }),
  mail: std({ color: 0x7c8089, metalness: 0.45, roughness: 0.6 }),
  livery: std({ color: 0x35508e }),
  liveryTrim: std({ color: 0xe9dfc2 }),
  gambeson: std({ color: 0xb79c6c }),
  hide: std({ color: 0x8a6440 }),
  leather: std({ color: 0x7b5233 }),
  leatherDark: std({ color: 0x4e3320 }),
  cloth: std({ color: 0xa13a28 }),
  clothBlue: std({ color: 0x3a4e7a }),
  // What a building's own people wear (the lookouts): the side's colour, swapped by withTeam.
  teamCloth: std({ color: 0x8e3426 }),
  bannerBlue: std({ color: 0x35508e, side: THREE.DoubleSide }),
  hood: std({ color: 0x5d4a2e }),
  bone: std({ color: 0xe6dcc0 }),
  boulder: speckled('#a59c8c', 0.12),
  cannonball: std({ color: 0x1d1d1f, metalness: 0.5, roughness: 0.5 }),
};

/** Stone palettes: each block picks one, which gives the hand-laid look. */
const SANDSTONE_COLORS = ['#d2b688', '#c5a878', '#dbc398', '#bb9e6e', '#cdb07e'];
export const SANDSTONE = SANDSTONE_COLORS.map((c) => speckled(c));
export const GREYSTONE = ['#8d8f99', '#7f818c', '#9a9ca6', '#74767f'].map((c) => speckled(c, 0.08));
export const ROOF_TILES = ['#b8452e', '#a83c28', '#c25236'].map((c) => std({ map: roofTexture(c) }));
export const SLATE = ['#5a5e72', '#4e5266', '#666a7e'].map((c) => std({ map: roofTexture(c) }));
/** Pale sandstone for boulders and outcrops (the reference's big blocky rocks). */
export const BOULDER = ['#dcc7a0', '#cfb98e', '#e4d3ad', '#c6ae84'].map((c) => speckled(c, 0.14));
/** Speckled foliage (cached per colour). */
const foliageCache = new Map();
export function foliage(color) {
  if (!foliageCache.has(color)) foliageCache.set(color, speckled(color, 0.16));
  return foliageCache.get(color);
}

// ------------------------------------------------------------------ randomness

/** Small seeded PRNG so every bake of a model is identical. */
export function rng(seed = 1) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, range: (a, b) => a + next() * (b - a), pick: (arr) => arr[Math.floor(next() * arr.length)] };
}

// ------------------------------------------------------------------ geometry with world-scaled UVs
// Textures tile once per world unit, so UVs are scaled to each primitive's real size.

const geoCache = new Map();
export function cached(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}

const r2 = (v) => Math.round(v * 100) / 100;

function scaleUVs(geometry, fn) {
  const uv = geometry.attributes.uv;
  const n = geometry.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const [su, sv] = fn(n.getX(i), n.getY(i), n.getZ(i));
    uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  }
  return geometry;
}

/**
 * A box with its edges lightly worn round (nothing in the art style is razor-sharp; the bevels also catch the
 * light and the ink lines). Very thin boxes (cloth, trim) stay sharp.
 */
export function box(w, h, d) {
  [w, h, d] = [r2(w), r2(h), r2(d)];
  const bevel = Math.min(0.018, Math.min(w, h, d) * 0.22);
  return cached(`box:${w}:${h}:${d}`, () =>
    scaleUVs(bevel < 0.006 ? new THREE.BoxGeometry(w, h, d) : new RoundedBoxGeometry(w, h, d, 1, bevel), (nx, ny) =>
      Math.abs(nx) > 0.5 ? [d, h] : Math.abs(ny) > 0.5 ? [w, d] : [w, h],
    ),
  );
}

export function cyl(rt, rb, h, seg = 10) {
  const r = Math.max(rt, rb);
  return cached(`cyl:${rt}:${rb}:${h}:${seg}`, () =>
    scaleUVs(new THREE.CylinderGeometry(rt, rb, h, seg), (nx, ny) =>
      Math.abs(ny) > 0.99 ? [2 * r, 2 * r] : [2 * Math.PI * r, Math.hypot(h, rb - rt)],
    ),
  );
}

export function cone(r, h, seg = 10) {
  return cached(`cone:${r}:${h}:${seg}`, () =>
    scaleUVs(new THREE.ConeGeometry(r, h, seg), (nx, ny) => (Math.abs(ny) > 0.99 ? [2 * r, 2 * r] : [2 * Math.PI * r, Math.hypot(r, h)])),
  );
}

/** A box with rounded edges (chunky foliage and boulders). */
export const rbox = (w, h, d, radius = 0.08, seg = 2) =>
  cached(`rbox:${r2(w)}:${r2(h)}:${r2(d)}:${radius}:${seg}`, () => new RoundedBoxGeometry(r2(w), r2(h), r2(d), seg, Math.min(radius, Math.min(w, h, d) / 2 - 0.001)));
export const sphere = (r, w = 12, h = 9) => cached(`sphere:${r}:${w}:${h}`, () => new THREE.SphereGeometry(r, w, h));
export const ico = (r, detail = 1) => cached(`ico:${r}:${detail}`, () => new THREE.IcosahedronGeometry(r, detail));
export const dodeca = (r) => cached(`dodeca:${r}`, () => new THREE.DodecahedronGeometry(r, 0));
export const octa = (r) => cached(`octa:${r}`, () => new THREE.OctahedronGeometry(r, 0));
export const capsule = (r, l) => cached(`capsule:${r}:${l}`, () => new THREE.CapsuleGeometry(r, l, 4, 10));
export const torus = (r, t, seg = 16) => cached(`torus:${r}:${t}:${seg}`, () => new THREE.TorusGeometry(r, t, 6, seg));

/** Triangle prism along x (a gable end pair): base `width` on z, apex `height` up. */
export function gableEnds(length, width, height) {
  return cached(`gableEnds:${length}:${width}:${height}`, () => {
    const L = length / 2;
    const W = width / 2;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([L, 0, W, L, 0, -W, L, height, 0, -L, 0, -W, -L, 0, W, -L, height, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, width, 0, W, height, 0, 0, width, 0, W, height], 2));
    g.computeVertexNormals();
    return g;
  });
}

// ------------------------------------------------------------------ merging

const shadedVariants = new Map();
/** The same material with vertex colours on (for the baked height shading below). */
function shaded(material) {
  if (!shadedVariants.has(material)) {
    const m = material.clone();
    m.vertexColors = true;
    shadedVariants.set(material, m);
  }
  return shadedVariants.get(material);
}

const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpEuler = new THREE.Euler();

/**
 * Collects transformed primitives and merges them into one mesh per material.
 *
 * Baked shading: each vertex gets a colour that darkens towards the ground (a cheap ambient-occlusion stand-in),
 * so models look grounded. `yOffset` is how high the finished group will sit above the ground, so parts
 * mounted higher up (turrets, arms) shade correctly.
 */
export class Parts {
  constructor({ yOffset = 0, shade = true } = {}) {
    this.byMaterial = new Map();
    this.yOffset = yOffset;
    this.shade = shade;
  }

  /** Add `geometry` with `material`. Rotation order defaults to 'YXZ': tilt (rx) first, then turn (ry). */
  add(geometry, material, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, order = 'YXZ' } = {}) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    tmpQuat.setFromEuler(tmpEuler.set(rx, ry, rz, order));
    g.applyMatrix4(tmpMatrix.compose(new THREE.Vector3(x, y, z), tmpQuat, new THREE.Vector3(sx, sy, sz)));
    if (this.shade) {
      const pos = g.attributes.position;
      const colors = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const k = 0.6 + 0.4 * THREE.MathUtils.smoothstep(pos.getY(i) + this.yOffset, 0, 1.2);
        colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = k;
      }
      g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    }
    if (!this.byMaterial.has(material)) this.byMaterial.set(material, []);
    this.byMaterial.get(material).push(g);
    return this;
  }

  /** Merge into `group` (or a new Group). */
  build(group = new THREE.Group()) {
    for (const [material, geometries] of this.byMaterial) {
      const mesh = new THREE.Mesh(mergeGeometries(geometries), this.shade ? shaded(material) : material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    return group;
  }
}

// ------------------------------------------------------------------ builders

/** Rotate a local (x, z) offset by `ry` around the origin, then add (ox, oz). */
export function place(ox, oz, ry, lx, lz) {
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  return { x: ox + lx * c + lz * s, z: oz - lx * s + lz * c };
}

/**
 * A rectangular volume built from courses of stone blocks with real mortar gaps (a dark core shows through).
 * Blocks run along `along` ('x' or 'z') and span the full depth, so both faces and the top show stones.
 */
export function stoneBlocks(p, { x = 0, y = 0, z = 0, w, h, d, along = 'x', rows = Math.max(1, Math.round(h / 0.24)), rnd, stones = SANDSTONE, mortar = MATERIALS.mortar, gap = 0.028, jitter = 0.014, minBlock = 0.24, maxBlock = 0.46 }) {
  const len = along === 'x' ? w : d;
  const depth = along === 'x' ? d : w;
  p.add(box(w - 2 * gap, h - gap, d - 2 * gap), mortar, { x, y: y + (h - gap) / 2, z });
  // Courses of uneven height, as laid by hand.
  const weights = Array.from({ length: rows }, () => (rows > 1 ? rnd.range(0.82, 1.18) : 1));
  const sum = weights.reduce((a, b) => a + b, 0);
  let base = y;
  for (let r = 0; r < rows; r++) {
    const rowH = (h * weights[r]) / sum;
    const yy = base + rowH / 2;
    base += rowH;
    let pos = -len / 2;
    let first = true;
    while (pos < len / 2 - 1e-6) {
      let bl = first && r % 2 ? rnd.range(minBlock * 0.5, minBlock) : rnd.range(minBlock, maxBlock);
      first = false;
      if (pos + bl > len / 2 - minBlock * 0.5) bl = len / 2 - pos;
      const c = pos + bl / 2;
      pos += bl;
      const out = rnd.range(-jitter, jitter);
      const mat = rnd.pick(stones);
      const bh = rowH - gap * rnd.range(0.8, 1.2);
      const bd = depth + out * 2;
      // Worn blocks: rounded edges, each sitting very slightly askew.
      const worn = Math.min(0.035, bh * 0.2);
      const tilt = { rz: rnd.range(-0.012, 0.012), rx: rnd.range(-0.012, 0.012) };
      if (along === 'x') p.add(rbox(bl - gap, bh, bd, worn, 1), mat, { x: x + c, y: yy, z, ...tilt });
      else p.add(rbox(bd, bh, bl - gap, worn, 1), mat, { x, y: yy, z: z + c, ...tilt });
    }
  }
}

/** A round wall (tower drum) built from courses of stone blocks. `taper` shrinks the radius towards the top. */
export function stoneRing(p, { x = 0, y = 0, z = 0, r, h, rows = Math.max(1, Math.round(h / 0.24)), rnd, stones = SANDSTONE, mortar = MATERIALS.mortar, thickness = 0.22, taper = 0, gap = 0.028, blockLen = 0.4 }) {
  const rowH = h / rows;
  p.add(cyl(r - taper - thickness * 0.4, r - thickness * 0.4, h - gap, 16), mortar, { x, y: y + (h - gap) / 2, z });
  for (let row = 0; row < rows; row++) {
    const rr = r - (taper * (row + 0.5)) / rows;
    const n = Math.max(6, Math.round((2 * Math.PI * rr) / blockLen));
    const arc = (2 * Math.PI * rr) / n;
    const offset = row % 2 ? 0.5 : 0;
    const yy = y + rowH * (row + 0.5);
    for (let i = 0; i < n; i++) {
      const a = ((i + offset) / n) * Math.PI * 2;
      const rad = rr - thickness / 2 + rnd.range(-0.01, 0.01);
      p.add(box(arc - gap, rowH - gap * rnd.range(0.8, 1.2), thickness), rnd.pick(stones), {
        x: x + Math.cos(a) * rad,
        y: yy,
        z: z + Math.sin(a) * rad,
        ry: -a - Math.PI / 2,
      });
    }
  }
}

/** Crenellated parapet top for a rectangle (merlons with cap stones). */
export function merlonsRect(p, { x = 0, y, z = 0, w, d, size = 0.2, height = 0.26, spacing = 0.36, rnd, stones = SANDSTONE }) {
  const along = (len) => {
    const n = Math.max(2, Math.round(len / spacing));
    return Array.from({ length: n }, (_, i) => -len / 2 + size / 2 + (i * (len - size)) / (n - 1));
  };
  const merlon = (mx, mz) => {
    // Worn merlons: rounded, each a touch different in height and set.
    const hh = height + rnd.range(-0.02, 0.02);
    p.add(rbox(size, hh, size, 0.035, 2), rnd.pick(stones), { x: x + mx, y: y + hh / 2, z: z + mz, ry: rnd.range(-0.04, 0.04) });
    p.add(rbox(size + 0.04, 0.05, size + 0.04, 0.02, 1), MATERIALS.capstone, { x: x + mx, y: y + hh + 0.025, z: z + mz });
  };
  for (const mx of along(w)) {
    merlon(mx, d / 2 - size / 2);
    merlon(mx, -d / 2 + size / 2);
  }
  for (const mz of along(d).slice(1, -1)) {
    merlon(w / 2 - size / 2, mz);
    merlon(-w / 2 + size / 2, mz);
  }
}

export function merlonsRing(p, { x = 0, y, z = 0, r, count, size = 0.2, height = 0.26, rnd, stones = SANDSTONE }) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const at = { x: x + Math.cos(a) * r, z: z + Math.sin(a) * r, ry: -a - Math.PI / 2 };
    const hh = height + rnd.range(-0.02, 0.02);
    p.add(rbox(size, hh, size * 0.9, 0.035, 2), rnd.pick(stones), { ...at, y: y + hh / 2 });
    p.add(rbox(size + 0.04, 0.05, size * 0.9 + 0.04, 0.02, 1), MATERIALS.capstone, { ...at, y: y + hh + 0.025 });
  }
}

/**
 * A pitched roof built from overlapping rows of clay tiles, with gable ends and a ridge cap. Runs along local x
 * (`length`), spans `width` on z, apex `height` above `y`. `ry` turns the whole roof.
 */
export function shingleGable(p, { x = 0, y, z = 0, length, width, height, ry = 0, rnd, tiles = ROOF_TILES, endMaterial = MATERIALS.plaster, overhang = 0.12, timberEnds = true }) {
  const half = width / 2 + overhang * 0.6;
  const rise = height * (half / (width / 2));
  const slope = Math.hypot(half, rise);
  const a = Math.atan2(height, width / 2);
  const rows = Math.max(3, Math.ceil(slope / 0.17));
  const L = length + overhang * 2;
  for (const side of [1, -1]) {
    for (let i = 0; i < rows; i++) {
      const t = (i + 0.5) / rows;
      const lz = side * half * (1 - t);
      const ly = height - rise * (1 - t) + 0.035 + i * 0.004;
      const at = place(x, z, ry, 0, lz);
      p.add(box(L, 0.05, (slope / rows) * 1.4), rnd.pick(tiles), { x: at.x, y: y + ly, z: at.z, rx: side > 0 ? a : Math.PI - a, ry });
    }
  }
  // Ridge cap and gable ends.
  const ridge = place(x, z, ry, 0, 0);
  p.add(box(L + 0.02, 0.1, 0.1), tiles[0], { x: ridge.x, y: y + height + 0.05, z: ridge.z, rx: Math.PI / 4, ry });
  p.add(gableEnds(length, width, height), endMaterial, { x, y, z, ry });
  if (timberEnds) {
    const beamLen = Math.hypot(width / 2, height);
    for (const end of [1, -1]) {
      for (const side of [1, -1]) {
        const at = place(x, z, ry, end * (length / 2 + 0.02), (side * width) / 4);
        p.add(box(0.06, beamLen, 0.07), MATERIALS.beam, { x: at.x, y: y + height / 2, z: at.z, rx: -side * (Math.PI / 2 - a), ry });
      }
      const mid = place(x, z, ry, end * (length / 2 + 0.02), 0);
      p.add(box(0.06, height * 0.9, 0.07), MATERIALS.beam, { x: mid.x, y: y + height * 0.45, z: mid.z, ry });
    }
  }
}

/** A conical roof built from stepped rings of tiles, with a finial. */
export function shingleCone(p, { x = 0, y, z = 0, r, h, rows = 6, rnd, tiles = ROOF_TILES, seg = 14, finial = true }) {
  for (let i = 0; i < rows; i++) {
    const t0 = i / rows;
    const t1 = (i + 1) / rows;
    const hh = (h / rows) * 1.18;
    p.add(cyl(r * (1 - t1) + 0.01, r * (1 - t0) + 0.05, hh, seg), rnd.pick(tiles), { x, y: y + h * t0 + hh / 2 - 0.02, z });
  }
  if (finial) {
    p.add(sphere(0.06, 8, 6), MATERIALS.gold, { x, y: y + h + 0.05, z });
    p.add(cyl(0.015, 0.015, 0.3, 6), MATERIALS.iron, { x, y: y + h + 0.2, z });
  }
}

/** Timber framing on a plaster face. The face lies at local z = 0 facing +z, centred at (x, y) in its plane. */
export function timberFace(p, { x = 0, y, z = 0, w, h, ry = 0, beam = 0.07, spacing = 0.5, braces = true }) {
  const at = (lx, ly, rz = 0, len = 0, horizontal = false) => {
    const pos = place(x, z, ry, lx, 0.02);
    const g = horizontal ? box(len, beam, 0.05) : box(beam, len, 0.05);
    p.add(g, MATERIALS.beam, { x: pos.x, y: y + ly, z: pos.z, ry, rz });
  };
  at(0, h / 2 - beam / 2, 0, w, true);
  at(0, -h / 2 + beam / 2, 0, w, true);
  const posts = Math.max(1, Math.round(w / spacing));
  for (let i = 0; i <= posts; i++) at(-w / 2 + (i * w) / posts, 0, 0, h);
  if (braces && posts >= 2) {
    const bw = w / posts;
    const diag = Math.hypot(bw, h);
    const ang = Math.atan2(bw, h);
    at(-w / 2 + bw / 2, 0, -ang, diag);
    at(w / 2 - bw / 2, 0, ang, diag);
  }
}

/** A window: dark opening, wooden frame with a cross mullion, open shutters and a stone sill. */
export function windowFrame(p, { x = 0, y, z = 0, ry = 0, w = 0.24, h = 0.3, shutters = true }) {
  const at = (lx, lz) => place(x, z, ry, lx, lz);
  let q = at(0, 0.01);
  p.add(box(w, h, 0.03), MATERIALS.glass, { x: q.x, y, z: q.z, ry });
  for (const [lx, ly, bw, bh] of [
    [0, h / 2, w + 0.06, 0.04],
    [0, -h / 2, w + 0.06, 0.04],
    [-w / 2, 0, 0.04, h],
    [w / 2, 0, 0.04, h],
    [0, 0, 0.025, h],
    [0, 0, w, 0.025],
  ]) {
    q = at(lx, 0.03);
    p.add(box(bw, bh, 0.03), MATERIALS.woodDark, { x: q.x, y: y + ly, z: q.z, ry });
  }
  q = at(0, 0.05);
  p.add(box(w + 0.1, 0.04, 0.08), MATERIALS.capstone, { x: q.x, y: y - h / 2 - 0.03, z: q.z, ry });
  if (shutters) {
    for (const side of [-1, 1]) {
      q = at(side * (w / 2 + w * 0.28), 0.06);
      p.add(box(w * 0.5, h, 0.025), MATERIALS.wood, { x: q.x, y, z: q.z, ry: ry + side * 0.35 });
    }
  }
}

/** An arched plank door with iron bands, framed by jamb stones and an arch of voussoirs. Faces +z (local). */
export function door(p, { x = 0, y = 0, z = 0, ry = 0, w = 0.42, h = 0.62, stones = SANDSTONE }) {
  const at = (lx, lz) => place(x, z, ry, lx, lz);
  const r = w / 2;
  const jamb = h - r;
  let q = at(0, 0.0);
  p.add(box(w + 0.04, h - 0.02, 0.04), MATERIALS.opening, { x: q.x, y: y + (h - 0.02) / 2, z: q.z, ry });
  q = at(0, 0.012);
  p.add(box(w - 0.02, jamb, 0.03), MATERIALS.wood, { x: q.x, y: y + jamb / 2, z: q.z, ry });
  p.add(halfDisc(r - 0.01), MATERIALS.wood, { x: q.x, y: y + jamb, z: q.z, ry });
  for (let i = 0; i < 3; i++) {
    q = at(-w / 4 + (i * w) / 4, 0.03);
    p.add(box(0.014, jamb + r * 0.75, 0.01), MATERIALS.woodDark, { x: q.x, y: y + (jamb + r * 0.75) / 2, z: q.z, ry });
  }
  for (const ly of [jamb * 0.3, jamb * 0.85]) {
    q = at(0, 0.034);
    p.add(box(w * 0.9, 0.028, 0.012), MATERIALS.iron, { x: q.x, y: y + ly, z: q.z, ry });
  }
  q = at(w * 0.3, 0.04);
  p.add(sphere(0.022, 6, 5), MATERIALS.iron, { x: q.x, y: y + jamb * 0.55, z: q.z }); // ring handle
  archStones(p, { x, y, z, ry, w, jamb, stones });
}

/** Jamb stones up both sides of an opening `w` wide and an arch of voussoirs over it (local +z face). */
export function archStones(p, { x = 0, y = 0, z = 0, ry = 0, w, jamb, stones = SANDSTONE, rnd = rng(Math.round(w * 100 + jamb * 1000)) }) {
  const at = (lx, lz) => place(x, z, ry, lx, lz);
  const r = w / 2;
  const s = Math.max(0.07, w * 0.24); // stone size
  for (const sx of [-1, 1]) {
    let yy = 0;
    while (yy < jamb - 0.03) {
      const hh = Math.min(jamb - yy, rnd.range(0.11, 0.15));
      const q = at(sx * (r + s / 2), 0.02);
      p.add(rbox(s, hh - 0.015, s, 0.02, 1), rnd.pick(stones), { x: q.x, y: y + yy + hh / 2, z: q.z, ry });
      yy += hh;
    }
  }
  const n = Math.max(5, Math.round((Math.PI * (r + s / 2)) / (s * 1.05)) | 1);
  for (let i = 0; i < n; i++) {
    const a = Math.PI - (i / (n - 1)) * Math.PI;
    const R = r + s / 2;
    const q = at(Math.cos(a) * R, 0.02);
    p.add(rbox(s, s * 0.85, s, 0.02, 1), i === (n - 1) / 2 ? MATERIALS.capstone : rnd.pick(stones), { x: q.x, y: y + jamb + Math.sin(a) * R, z: q.z, ry, rz: a - Math.PI / 2 });
  }
}

const halfDisc = (r) => cached(`halfDisc:${r}`, () => new THREE.CylinderGeometry(r, r, 0.04, 14, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2)); // the upper half, facing +z

/** A spoked cart wheel, axle along local x. */
export function wheel(p, { x = 0, y, z = 0, r = 0.17, ry = 0, spokes = 6 }) {
  p.add(torus(r, 0.03, 16), MATERIALS.woodDark, { x, y, z, ry: ry + Math.PI / 2 });
  p.add(cyl(0.045, 0.045, 0.09, 8), MATERIALS.iron, { x, y, z, rz: Math.PI / 2, ry });
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI;
    p.add(box(0.025, r * 2, 0.025), MATERIALS.wood, { x, y, z, rx: a, ry });
  }
}

export function barrel(p, { x = 0, y = 0, z = 0, r = 0.13, h = 0.3 }) {
  p.add(cyl(r * 0.9, r * 0.9, h, 12), MATERIALS.wood, { x, y: y + h / 2, z });
  p.add(cyl(r, r, h * 0.55, 12), MATERIALS.woodLight, { x, y: y + h / 2, z });
  for (const t of [0.15, 0.85]) p.add(cyl(r * 0.95, r * 0.95, 0.03, 12), MATERIALS.iron, { x, y: y + h * t, z });
}

export function crate(p, { x = 0, y = 0, z = 0, s = 0.26, ry = 0 }) {
  p.add(box(s, s, s), MATERIALS.woodLight, { x, y: y + s / 2, z, ry });
  for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const q = place(x, z, ry, (lx * s) / 2, (lz * s) / 2);
    p.add(box(0.04, s + 0.01, 0.04), MATERIALS.woodDark, { x: q.x, y: y + s / 2, z: q.z, ry });
  }
}

/** A hanging red banner with gold trim, facing +z (local). */
export function banner(p, { x = 0, y, z = 0, ry = 0, w = 0.28, h = 0.55 }) {
  const plane = cached(`banner:${w}:${h}`, () => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(w / 2, -h);
    s.lineTo(0, -h + 0.1);
    s.lineTo(-w / 2, -h);
    s.closePath();
    return new THREE.ShapeGeometry(s);
  });
  const q = place(x, z, ry, 0, 0.03);
  p.add(plane, MATERIALS.bannerRed, { x: q.x, y, z: q.z, ry });
  const t = place(x, z, ry, 0, 0.035);
  p.add(box(w * 0.5, 0.05, 0.005), MATERIALS.bannerTrim, { x: t.x, y: y - h * 0.4, z: t.z, ry });
  p.add(cyl(0.015, 0.015, w + 0.08, 6), MATERIALS.woodDark, { x: q.x, y, z: q.z, rz: Math.PI / 2, ry });
}

/**
 * Whether pennant() includes the cloth. The sprite catalogue turns it off while baking battlefield sprites, whose
 * pennants are drawn as separate waving sprites (see wavingPennant); UI portraits keep it.
 */
export const bakeFlags = { pennantCloth: true };

/** Run `make` with pennant cloths left out (for baked sprites whose flags wave separately). */
export function withoutPennantCloth(make) {
  bakeFlags.pennantCloth = false;
  try {
    return make();
  } finally {
    bakeFlags.pennantCloth = true;
  }
}

/**
 * Build `make()` in `team`'s colours: the player's ('red', as the materials stand) or the enemy castle's ('blue':
 * banners, pennants and the lookouts' clothes in blue). Roofs, stone and timber are the same for both.
 */
export function withTeam(team, make) {
  if (team !== 'blue') return make();
  const saved = { bannerRed: MATERIALS.bannerRed, teamCloth: MATERIALS.teamCloth };
  MATERIALS.bannerRed = MATERIALS.bannerBlue;
  MATERIALS.teamCloth = MATERIALS.clothBlue;
  try {
    return make();
  } finally {
    Object.assign(MATERIALS, saved);
  }
}

/** A pennant on a pole (top at y + h). The cloth hangs from y + h - 0.02 and flies along local +x (turned by ry). */
export function pennant(p, { x = 0, y = 0, z = 0, h = 0.9, w = 0.42, ry = 0 }) {
  p.add(cyl(0.022, 0.026, h, 6), MATERIALS.woodDark, { x, y: y + h / 2, z });
  p.add(sphere(0.035, 6, 5), MATERIALS.gold, { x, y: y + h + 0.02, z });
  if (!bakeFlags.pennantCloth) return;
  const plane = cached(`pennant:${w}`, () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(w, -0.08);
    s.lineTo(0, -0.24);
    s.closePath();
    return new THREE.ShapeGeometry(s);
  });
  p.add(plane, MATERIALS.bannerRed, { x, y: y + h - 0.02, z, ry });
}

/** The size pennant cloths are baked at (wavingPennant); other sizes are drawn scaled. */
export const PENNANT_W = 0.44;

/**
 * A pennant's cloth alone, rippling in the wind: `phase` (0..1) moves the ripple along it. Hangs from the origin
 * and flies along +x (turned by `ry`). For baking the frames of a waving flag.
 */
export function wavingPennant(phase, ry = 0) {
  const w = PENNANT_W;
  const n = 10;
  const pos = [];
  const at = (t, edge) => {
    // edge 0 = top, 1 = bottom; the pennant narrows from 0.24 deep at the pole to a point.
    const x = t * w;
    const yTop = -0.08 * t;
    const y = yTop + (edge ? -(0.24 - 0.16 * t) * (1 - t) : 0);
    const z = 0.07 * t * Math.sin((t * 1.3 - phase) * Math.PI * 2) + 0.03 * t * edge;
    return [x, y, z];
  };
  for (let i = 0; i < n; i++) {
    const [a, b] = [i / n, (i + 1) / n];
    const [t0, b0, t1, b1] = [at(a, 0), at(a, 1), at(b, 0), at(b, 1)];
    pos.push(...t0, ...b0, ...t1, ...t1, ...b0, ...b1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, MATERIALS.bannerRed);
  mesh.rotation.y = ry;
  const g = new THREE.Group();
  g.add(mesh);
  return g;
}

/** A few grass tufts and pebbles around a footprint's edge, to sit buildings into the ground. */
export function groundDressing(p, { w, d, rnd, count = 10 }) {
  for (let i = 0; i < count; i++) {
    const side = Math.floor(rnd.next() * 4);
    const t = rnd.range(-0.5, 0.5);
    const out = rnd.range(0.02, 0.14);
    const x = side < 2 ? t * w : (side === 2 ? 1 : -1) * (w / 2 + out);
    const z = side >= 2 ? t * d : (side === 0 ? 1 : -1) * (d / 2 + out);
    if (rnd.next() < 0.7) {
      for (let b = 0; b < 3; b++) {
        p.add(cone(0.035, rnd.range(0.12, 0.22), 4), rnd.next() < 0.5 ? MATERIALS.grass : MATERIALS.grassDark, {
          x: x + rnd.range(-0.05, 0.05),
          y: 0.06,
          z: z + rnd.range(-0.05, 0.05),
          rx: rnd.range(-0.4, 0.4),
          rz: rnd.range(-0.4, 0.4),
        });
      }
    } else {
      p.add(dodeca(rnd.range(0.04, 0.08)), rnd.pick(SANDSTONE), { x, y: 0.03, z, sy: 0.6 });
    }
  }
}

// ------------------------------------------------------------------ worn stone
// Weathered brown-grey stonework, after the uploaded stone tower model: smooth walls wrapped in painted rough
// stonework (roughStoneTexture), with real rough blocks where the outline shows (corners, ledges, parapets), so
// silhouettes stay irregular.

const WORN_COLORS = ['#b08f72', '#a4856a', '#bb9a7c', '#9a7b61', '#ab8b6f', '#c2a283', '#a88a70'];
/** Rough blocks in the weathered stone colours. */
export const WORNSTONE = WORN_COLORS.slice(0, 6).map((c) => speckled(c, 0.16));
/** Darker stone for ledges, sills and keystones. */
export const WORN_TRIM = speckled('#8c705a', 0.14);
const WORN_MORTAR = std({ color: 0x4a3a2c });
/** Smooth walls of painted rough stone (flat shaded, so a tapering wall keeps crisp faces). */
export const WORN_WALL = std({ map: roughStoneTexture(WORN_COLORS), flatShading: true });
/** The same painted rough stonework in the Town Hall's sandstone. */
export const SANDSTONE_WALL = std({ map: roughStoneTexture(SANDSTONE_COLORS, '#6e5a42'), flatShading: true });

/**
 * A course-built block of worn stone: rounded blocks of uneven length (and course height) round a dark mortar
 * core, each a little proud or sunk. Like stoneBlocks, but rough.
 */
export function roughBlocks(p, { x = 0, y = 0, z = 0, w, d, h, rows = 1, rnd, along = 'x', minBlock = 0.16, maxBlock = 0.34, gap = 0.026, stones = WORNSTONE, mortar = WORN_MORTAR }) {
  p.add(box(w - 3 * gap, h - gap, d - 3 * gap), mortar, { x, y: y + h / 2, z });
  const weights = Array.from({ length: rows }, () => rnd.range(0.8, 1.2));
  const sum = weights.reduce((a, b) => a + b, 0);
  let yy = y;
  for (let r = 0; r < rows; r++) {
    const rh = (h * weights[r]) / sum;
    const dir = (r + (along === 'x' ? 0 : 1)) % 2 ? 'z' : 'x';
    const len = dir === 'x' ? w : d;
    const depth = dir === 'x' ? d : w;
    let pos = -len / 2;
    let first = true;
    while (pos < len / 2 - 1e-6) {
      let bl = first && r % 2 ? rnd.range(minBlock * 0.5, minBlock) : rnd.range(minBlock, maxBlock);
      first = false;
      if (pos + bl > len / 2 - minBlock * 0.5) bl = len / 2 - pos;
      const c = pos + bl / 2;
      pos += bl;
      const out = rnd.range(-0.012, 0.016);
      const bh = rh - gap * rnd.range(0.8, 1.3);
      const g = rbox(dir === 'x' ? bl - gap : depth + out * 2, bh, dir === 'x' ? depth + out * 2 : bl - gap, 0.03);
      p.add(g, rnd.pick(stones), { x: dir === 'x' ? x + c : x, y: yy + rh / 2, z: dir === 'x' ? z : z + c, rz: rnd.range(-0.02, 0.02) });
    }
    yy += rh;
  }
}

/** A square frustum, `w0` across at the bottom and `w1` at the top, with world-scaled UVs on its sides. */
export function frustum(w0, w1, h) {
  return cached(`frustum:${w0}:${w1}:${h}`, () => {
    const g = new THREE.CylinderGeometry(w1 / Math.SQRT2, w0 / Math.SQRT2, h, 4, 1).rotateY(Math.PI / 4);
    const pos = g.attributes.position;
    const uv = g.attributes.uv;
    const perim = 2 * (w0 + w1);
    for (let i = 0; i < pos.count; i++) uv.setXY(i, uv.getX(i) * perim, pos.getY(i) + h / 2);
    return g;
  });
}

/** Rough corner stones (quoins), alternately long and short, up the four edges of a block `w0` → `w1` across. */
export function quoins(p, rnd, { x = 0, z = 0, y0, y1, w0, w1, size = 0.13, stones = WORNSTONE }) {
  let y = y0;
  let i = 0;
  while (y < y1 - 0.06) {
    const h = Math.min(y1 - y, rnd.range(0.12, 0.18));
    const t = (y + h / 2 - y0) / (y1 - y0);
    const half = (w0 + (w1 - w0) * t) / 2;
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const long = (i + (sx * sz > 0 ? 0 : 1)) % 2 === 0;
      const lx = long ? size * 1.6 : size;
      const lz = long ? size : size * 1.6;
      p.add(rbox(lx, h - 0.02, lz, 0.03), rnd.pick(stones), { x: x + sx * (half - lx / 2 + 0.015), y: y + h / 2, z: z + sz * (half - lz / 2 + 0.015) });
    }
    y += h;
    i++;
  }
}

/** A deep-set square window with a frame of rough stones, on the face whose outward normal is (nx, nz). */
export function deepWindow(p, rnd, { x, y, z, nx, nz, s = 0.15, stones = WORNSTONE }) {
  const ry = Math.atan2(nx, nz);
  const along = (t) => ({ x: x + Math.cos(ry) * t, z: z - Math.sin(ry) * t });
  p.add(box(s, s * 1.15, 0.05), MATERIALS.opening, { x: x + nx * 0.005, y, z: z + nz * 0.005, ry });
  for (const [t, dy, w, h] of [[0, (s * 1.15) / 2 + 0.035, s + 0.14, 0.07], [0, -(s * 1.15) / 2 - 0.03, s + 0.16, 0.06], [-(s / 2 + 0.035), 0, 0.07, s * 1.15], [s / 2 + 0.035, 0, 0.07, s * 1.15]]) {
    const q = along(t);
    p.add(rbox(w, h, 0.06, 0.02), rnd.pick(stones), { x: q.x + nx * 0.02, y: y + dy, z: q.z + nz * 0.02, ry });
  }
}

/**
 * An arched plank door in a ring of voussoirs on a +z face that may slope (a battered wall): `faceZ(y)` gives the
 * face's z at height y, and every part is tilted to lie on it. The door stands on `y0`.
 */
export function slopedDoor(p, rnd, { x = 0, y0 = 0, faceZ, w = 0.32, jamb = 0.3, stones = WORNSTONE, keystone = WORN_TRIM }) {
  const M = MATERIALS;
  const r = w / 2;
  const tilt = Math.atan2(faceZ(y0) - faceZ(y0 + 0.1), 0.1); // lean of the face where the door stands
  const at = (y, out = 0) => ({ x, y: y0 + y, z: faceZ(y0 + y) + out, rx: -tilt });
  const top = jamb + r;
  p.add(box(w + 0.04, top - 0.02, 0.04), M.opening, at(top / 2));
  p.add(box(w - 0.02, jamb, 0.03), M.wood, at(jamb / 2, 0.012));
  p.add(halfDisc(r - 0.01), M.wood, at(jamb, 0.012));
  for (let i = 0; i < 3; i++) p.add(box(0.014, jamb + r * 0.75, 0.01), M.woodDark, { ...at((jamb + r * 0.75) / 2, 0.03), x: x - w / 4 + (i * w) / 4 });
  for (const y of [jamb * 0.3, jamb * 0.85]) p.add(box(w * 0.9, 0.028, 0.012), M.iron, at(y, 0.034));
  p.add(sphere(0.022, 6, 5), M.iron, { ...at(jamb * 0.55, 0.04), x: x + w * 0.3 });
  for (const sx of [-1, 1]) {
    let y = 0;
    for (let k = 0, left = jamb; left > 0.04; k++) {
      const h = left < 0.2 ? left : 0.13 - (k % 2) * 0.01;
      left -= h;
      p.add(rbox(0.1, h - 0.015, 0.09, 0.02), rnd.pick(stones), { ...at(y + h / 2, 0.02), x: x + sx * (r + 0.05) });
      y += h;
    }
  }
  const n = Math.max(7, Math.round((Math.PI * (r + 0.05)) / 0.095) | 1);
  for (let i = 0; i < n; i++) {
    const a = Math.PI - (i / (n - 1)) * Math.PI;
    const R = r + 0.05;
    p.add(rbox(0.09, 0.08, 0.09, 0.02), i === (n - 1) / 2 ? keystone : rnd.pick(stones), { ...at(jamb + Math.sin(a) * R, 0.02), x: x + Math.cos(a) * R, rz: a - Math.PI / 2 });
  }
}

/**
 * A buttress wedge against a +x wall: its back at x = `inner`, standing `out0` proud at the ground and `out1` at the
 * top (height h), `d` thick along z; UVs for the painted stonework.
 */
export function wedge(inner, out0, out1, h, d) {
  return cached(`wedge:${inner}:${out0}:${out1}:${h}:${d}`, () => {
    const g = new THREE.BoxGeometry(1, h, d).toNonIndexed();
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const top = pos.getY(i) > 0;
      pos.setX(i, pos.getX(i) < 0 ? inner : inner + (top ? out1 : out0));
      pos.setY(i, pos.getY(i) + h / 2);
    }
    g.computeVertexNormals();
    const nor = g.attributes.normal;
    const uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const [nx, ny] = [Math.abs(nor.getX(i)), Math.abs(nor.getY(i))];
      const [px, py, pz] = [pos.getX(i), pos.getY(i), pos.getZ(i)];
      uv.setXY(i, ...(nx > 0.5 ? [pz, py + px * 0.3] : ny > 0.5 ? [px, pz] : [px, py]));
    }
    return g;
  });
}
