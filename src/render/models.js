import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { roofTexture, stoneTexture, timberTexture, woodTexture } from './textures.js';

// Procedural low-poly models in a warm "storybook medieval" style: sandstone, red clay roofs,
// timber and plaster. Every model is assembled from primitives and then merged into one mesh per
// material (see Parts), so detailed buildings still cost only a few draw calls. Parts that animate
// (turrets, flags, the catapult arm, the spire crystal) stay separate and are exposed on userData.

// ------------------------------------------------------------------ materials

const std = (opts) => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...opts });

export const MATERIALS = {
  stone: std({ map: stoneTexture() }),
  stoneDark: std({ map: stoneTexture('#a98a63') }),
  stoneGrey: std({ map: stoneTexture('#a7a399') }),
  roof: std({ map: roofTexture() }),
  wood: std({ map: woodTexture() }),
  woodDark: std({ map: woodTexture('#5f3d23') }),
  timber: std({ map: timberTexture() }),
  opening: std({ color: 0x2b1d14 }),
  iron: std({ color: 0x34343a, metalness: 0.6, roughness: 0.45 }),
  gold: std({ color: 0xd8b545, metalness: 0.5, roughness: 0.4 }),
  bannerRed: std({ color: 0xb3322b, side: THREE.DoubleSide }),
  bannerBlue: std({ color: 0x2f5d9e, side: THREE.DoubleSide }),
  crystal: std({ color: 0xc58cff, emissive: 0x8a3dff, emissiveIntensity: 1.2, roughness: 0.3 }),
  rune: std({ color: 0x9b6bff, emissive: 0x7a3dff, emissiveIntensity: 0.9 }),
  rope: std({ color: 0xb59a6a }),
  // Creatures
  goblinSkin: std({ color: 0x7fae4a }),
  orcSkin: std({ color: 0x6a8a4a }),
  trollSkin: std({ color: 0x7d8a92 }),
  leather: std({ color: 0x7b5233 }),
  cloth: std({ color: 0x9a3b2a }),
  hood: std({ color: 0x5d4a2e }),
  eyes: std({ color: 0xffd23f, emissive: 0xffb000, emissiveIntensity: 0.6 }),
  boulder: std({ color: 0x9a948a }),
  cannonball: std({ color: 0x1d1d1f, metalness: 0.5, roughness: 0.5 }),
};

// ------------------------------------------------------------------ geometry with world-scaled UVs
// Textures tile once per world unit, so UVs are scaled to each primitive's real size.

const geoCache = new Map();
function cached(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}

function scaleUVs(geometry, fn) {
  const uv = geometry.attributes.uv;
  const n = geometry.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const [su, sv] = fn(n.getX(i), n.getY(i), n.getZ(i));
    uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  }
  return geometry;
}

export function box(w, h, d) {
  return cached(`box:${w}:${h}:${d}`, () =>
    scaleUVs(new THREE.BoxGeometry(w, h, d), (nx, ny) => (Math.abs(nx) > 0.5 ? [d, h] : Math.abs(ny) > 0.5 ? [w, d] : [w, h])),
  );
}

function cyl(rt, rb, h, seg = 8) {
  const r = Math.max(rt, rb);
  return cached(`cyl:${rt}:${rb}:${h}:${seg}`, () =>
    scaleUVs(new THREE.CylinderGeometry(rt, rb, h, seg), (nx, ny) =>
      Math.abs(ny) > 0.99 ? [2 * r, 2 * r] : [2 * Math.PI * r, Math.hypot(h, rb - rt)],
    ),
  );
}

function cone(r, h, seg = 8) {
  return cached(`cone:${r}:${h}:${seg}`, () =>
    scaleUVs(new THREE.ConeGeometry(r, h, seg), (nx, ny) => (Math.abs(ny) > 0.99 ? [2 * r, 2 * r] : [2 * Math.PI * r, Math.hypot(r, h)])),
  );
}

const sphere = (r, w = 10, h = 8) => cached(`sphere:${r}:${w}:${h}`, () => new THREE.SphereGeometry(r, w, h));
const ico = (r, detail = 0) => cached(`ico:${r}:${detail}`, () => new THREE.IcosahedronGeometry(r, detail));
const dodeca = (r) => cached(`dodeca:${r}`, () => new THREE.DodecahedronGeometry(r, 0));
const octa = (r) => cached(`octa:${r}`, () => new THREE.OctahedronGeometry(r, 0));
const capsule = (r, l) => cached(`capsule:${r}:${l}`, () => new THREE.CapsuleGeometry(r, l, 3, 8));

/**
 * Gabled roof along x: { slopes, ends } geometries. `length` × `width` footprint, ridge `height` above
 * the eaves. Slopes take the roof material; the triangular gable ends take a wall material.
 */
function gable(length, width, height) {
  return cached(`gable:${length}:${width}:${height}`, () => {
    const L = length / 2;
    const W = width / 2;
    const slope = Math.hypot(W, height);
    const quad = (a, b, c, d, uvs) => ({ pos: [...a, ...b, ...c, ...a, ...c, ...d], uv: [...uvs[0], ...uvs[1], ...uvs[2], ...uvs[0], ...uvs[2], ...uvs[3]] });
    const front = quad([-L, 0, W], [L, 0, W], [L, height, 0], [-L, height, 0], [[0, 0], [length, 0], [length, slope], [0, slope]]);
    const back = quad([L, 0, -W], [-L, 0, -W], [-L, height, 0], [L, height, 0], [[0, 0], [length, 0], [length, slope], [0, slope]]);
    const slopes = new THREE.BufferGeometry();
    slopes.setAttribute('position', new THREE.Float32BufferAttribute([...front.pos, ...back.pos], 3));
    slopes.setAttribute('uv', new THREE.Float32BufferAttribute([...front.uv, ...back.uv], 2));
    slopes.computeVertexNormals();
    const ends = new THREE.BufferGeometry();
    ends.setAttribute('position', new THREE.Float32BufferAttribute([L, 0, W, L, 0, -W, L, height, 0, -L, 0, -W, -L, 0, W, -L, height, 0], 3));
    ends.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, width, 0, W, height, 0, 0, width, 0, W, height], 2));
    ends.computeVertexNormals();
    return { slopes, ends };
  });
}

// ------------------------------------------------------------------ merging

const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpEuler = new THREE.Euler();

/** Collects transformed primitives and merges them into one mesh per material. */
class Parts {
  constructor() {
    this.byMaterial = new Map();
  }

  add(geometry, material, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
    let g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    tmpQuat.setFromEuler(tmpEuler.set(rx, ry, rz));
    g.applyMatrix4(tmpMatrix.compose(new THREE.Vector3(x, y, z), tmpQuat, new THREE.Vector3(sx, sy, sz)));
    if (!this.byMaterial.has(material)) this.byMaterial.set(material, []);
    this.byMaterial.get(material).push(g);
    return this;
  }

  /** Merge into `group` (or a new Group). */
  build(group = new THREE.Group()) {
    for (const [material, geometries] of this.byMaterial) {
      const mesh = new THREE.Mesh(mergeGeometries(geometries), material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    return group;
  }
}

/** Merlons around a w × d rectangle at height y (top of the parapet). */
function merlonsRect(p, material, w, d, y, size = 0.16, spacing = 0.3) {
  const along = (len) => {
    const n = Math.max(2, Math.round(len / spacing));
    return Array.from({ length: n }, (_, i) => -len / 2 + size / 2 + (i * (len - size)) / (n - 1));
  };
  for (const x of along(w)) {
    p.add(box(size, size * 1.3, size), material, { x, y: y + size * 0.65, z: d / 2 - size / 2 });
    p.add(box(size, size * 1.3, size), material, { x, y: y + size * 0.65, z: -d / 2 + size / 2 });
  }
  for (const z of along(d).slice(1, -1)) {
    p.add(box(size, size * 1.3, size), material, { x: w / 2 - size / 2, y: y + size * 0.65, z });
    p.add(box(size, size * 1.3, size), material, { x: -w / 2 + size / 2, y: y + size * 0.65, z });
  }
}

function merlonsRing(p, material, r, y, count, size = 0.16) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    p.add(box(size, size * 1.3, size), material, { x: Math.cos(a) * r, y: y + size * 0.65, z: Math.sin(a) * r, ry: -a });
  }
}

function flag(material, width = 0.5, height = 0.3) {
  const f = new THREE.Mesh(cached(`flag:${width}:${height}`, () => new THREE.PlaneGeometry(width, height).translate(width / 2, 0, 0)), material);
  f.castShadow = true;
  return f;
}

// ------------------------------------------------------------------ buildings

function townHall() {
  const M = MATERIALS;
  const p = new Parts();
  // Plinth and stone ground floor.
  p.add(box(2.9, 0.22, 2.9), M.stoneDark, { y: 0.11 });
  p.add(box(2.3, 1.1, 1.7), M.stone, { y: 0.77, z: 0.1 });
  // Half-timbered upper floor, jettied out a little.
  p.add(box(2.45, 0.85, 1.85), M.timber, { y: 1.75, z: 0.1 });
  p.add(box(2.5, 0.08, 1.9), M.woodDark, { y: 1.33, z: 0.1 });
  const main = gable(2.75, 2.15, 1.15);
  p.add(main.slopes, M.roof, { y: 2.17, z: 0.1 });
  p.add(main.ends, M.timber, { y: 2.17, z: 0.1 });
  // Front cross-gable over the entrance.
  p.add(box(0.95, 0.85, 0.7), M.timber, { y: 1.75, z: 1.15 });
  const front = gable(1.0, 1.05, 0.75);
  p.add(front.slopes, M.roof, { y: 2.17, z: 1.2, ry: Math.PI / 2 });
  p.add(front.ends, M.timber, { y: 2.17, z: 1.2, ry: Math.PI / 2 });
  // Door, windows, chimney.
  p.add(box(0.5, 0.72, 0.06), M.woodDark, { y: 0.58, z: 0.96 });
  p.add(cyl(0.25, 0.25, 0.06, 10), M.woodDark, { y: 0.94, z: 0.96, rx: Math.PI / 2 });
  for (const x of [-0.75, 0.75]) p.add(box(0.26, 0.34, 0.05), M.opening, { x, y: 0.85, z: 0.96 });
  for (const x of [-0.85, -0.35, 0.35, 0.85]) p.add(box(0.2, 0.3, 0.05), M.opening, { x, y: 1.8, z: 1.04 });
  p.add(box(0.28, 0.9, 0.28), M.stoneDark, { x: 0.7, y: 2.85, z: -0.35 });
  // Round corner tower with a pointed roof.
  p.add(cyl(0.45, 0.5, 3.0, 10), M.stone, { x: -1.05, y: 1.5, z: -0.85 });
  p.add(cone(0.62, 1.15, 10), M.roof, { x: -1.05, y: 3.58, z: -0.85 });
  p.add(box(0.12, 0.3, 0.05), M.opening, { x: -1.05, y: 2.4, z: -0.39 });
  // Small watch turret on the front right corner.
  p.add(cyl(0.28, 0.3, 2.0, 8), M.stone, { x: 1.15, y: 1.0, z: 0.95 });
  p.add(cone(0.4, 0.75, 8), M.roof, { x: 1.15, y: 2.38, z: 0.95 });
  // Flagpole.
  p.add(cyl(0.03, 0.03, 1.0, 6), M.woodDark, { x: -1.05, y: 4.6, z: -0.85 });
  const g = p.build();
  const f = flag(M.bannerRed, 0.55, 0.32);
  f.position.set(-1.05, 4.9, -0.85);
  g.add(f);
  g.userData.flag = f;
  return g;
}

/**
 * A wall tile that joins up with its neighbours. `connections` = { n, e, s, w } booleans: true where
 * the neighbouring tile has a wall or another building (so walls meet towers flush).
 */
function wall({ connections = {} } = {}) {
  const M = MATERIALS;
  const p = new Parts();
  const H = 1.0;
  const T = 0.56;
  const dirs = [
    ['e', 1, 0],
    ['w', -1, 0],
    ['s', 0, 1],
    ['n', 0, -1],
  ].filter(([k]) => connections[k]);
  const straight = dirs.length === 2 && dirs[0][1] === -dirs[1][1] && dirs[0][2] === -dirs[1][2];

  for (const [, dx, dz] of dirs) {
    // Wall arm from the centre to the tile edge, with a darker footing and merlons on both faces.
    const alongX = dx !== 0;
    const [w, d] = alongX ? [0.5, T] : [T, 0.5];
    p.add(box(w, H, d), M.stone, { x: dx * 0.25, y: H / 2, z: dz * 0.25 });
    p.add(box(alongX ? 0.5 : T + 0.08, 0.16, alongX ? T + 0.08 : 0.5), M.stoneDark, { x: dx * 0.25, y: 0.08, z: dz * 0.25 });
    for (const t of [0.125, 0.375]) {
      for (const side of [-1, 1]) {
        const off = side * (T / 2 - 0.07);
        p.add(box(0.13, 0.2, 0.13), M.stoneDark, {
          x: alongX ? dx * t : off,
          y: H + 0.1,
          z: alongX ? off : dz * t,
        });
      }
    }
  }

  if (straight) {
    // Mid-run: just fill the centre so the wall is continuous.
    p.add(box(T, H, T), M.stone, { y: H / 2 });
  } else {
    // End, corner or junction: a slightly taller buttress post with corner merlons.
    const size = dirs.length === 0 ? 0.72 : 0.66;
    const h = H + (dirs.length === 0 ? 0.15 : 0.22);
    p.add(box(size, h, size), M.stone, { y: h / 2 });
    p.add(box(size + 0.08, 0.18, size + 0.08), M.stoneDark, { y: 0.09 });
    merlonsRect(p, M.stoneDark, size, size, h, 0.15, 0.25);
  }
  const g = p.build();
  g.userData.connections = connections;
  return g;
}

function archerTower() {
  const M = MATERIALS;
  const p = new Parts();
  p.add(box(1.6, 0.25, 1.6), M.stoneDark, { y: 0.125 });
  // Square shaft with a gentle taper (a 4-sided cylinder turned 45°).
  p.add(cyl(0.82, 0.95, 2.3, 4), M.stone, { y: 1.4, ry: Math.PI / 4 });
  // Corbelled fighting platform with crenellations.
  p.add(box(1.36, 0.14, 1.36), M.stoneDark, { y: 2.55 });
  p.add(box(1.5, 0.3, 1.5), M.stone, { y: 2.77 });
  merlonsRect(p, M.stone, 1.5, 1.5, 2.92, 0.2, 0.36);
  // Arrow slits and a door.
  for (const [x, z, ry] of [[0, 0.6, 0], [0.6, 0, Math.PI / 2], [-0.6, 0, Math.PI / 2], [0, -0.6, 0]]) {
    p.add(box(0.08, 0.36, 0.04), M.opening, { x, y: 1.85, z, ry });
  }
  p.add(box(0.36, 0.55, 0.05), M.woodDark, { y: 0.52, z: 0.66 });
  // Flag pole.
  p.add(cyl(0.025, 0.025, 0.9, 6), M.woodDark, { x: 0.5, y: 3.4, z: -0.5 });
  const g = p.build();
  const f = flag(M.bannerRed, 0.42, 0.26);
  f.position.set(0.5, 3.7, -0.5);
  g.add(f);
  g.userData.flag = f;
  return g;
}

function cannonTower() {
  const M = MATERIALS;
  const p = new Parts();
  p.add(cyl(0.95, 1.0, 0.25, 12), M.stoneDark, { y: 0.125 });
  p.add(cyl(0.82, 0.92, 1.05, 12), M.stone, { y: 0.77 });
  p.add(cyl(0.9, 0.84, 0.16, 12), M.stoneDark, { y: 1.36 });
  merlonsRing(p, M.stone, 0.8, 1.44, 10, 0.2);
  p.add(box(0.34, 0.5, 0.05), M.woodDark, { y: 0.5, z: 0.89 });
  const g = p.build();

  // Turret: wooden carriage with a big iron cannon; rotates to aim (+z is forward).
  const t = new Parts();
  t.add(box(0.62, 0.22, 0.82), M.wood, { y: 0.11 });
  for (const sx of [-0.36, 0.36]) {
    for (const sz of [-0.25, 0.25]) t.add(cyl(0.15, 0.15, 0.08, 10), M.woodDark, { x: sx, y: 0.1, z: sz, rz: Math.PI / 2 });
  }
  t.add(cyl(0.17, 0.23, 1.0, 12), M.iron, { y: 0.42, z: 0.22, rx: Math.PI / 2 - 0.22 });
  t.add(cyl(0.21, 0.21, 0.1, 12), M.iron, { y: 0.52, z: 0.68, rx: Math.PI / 2 - 0.22 });
  t.add(sphere(0.2), M.iron, { y: 0.32, z: -0.28 });
  const turret = t.build();
  turret.position.y = 1.44;
  g.add(turret);
  g.userData.turret = turret;
  return g;
}

function magicSpire() {
  const M = MATERIALS;
  const p = new Parts();
  // Stepped base with glowing runes.
  p.add(box(1.75, 0.25, 1.75), M.stoneDark, { y: 0.125 });
  p.add(box(1.35, 0.3, 1.35), M.stoneGrey, { y: 0.4 });
  for (const [x, z] of [[0, 0.68], [0, -0.68], [0.68, 0], [-0.68, 0]]) p.add(box(0.3, 0.12, 0.04), M.rune, { x, y: 0.4, z, ry: x ? Math.PI / 2 : 0 });
  // Obelisk with a pointed cap.
  p.add(cyl(0.28, 0.48, 1.9, 4), M.stoneGrey, { y: 1.5, ry: Math.PI / 4 });
  p.add(cone(0.36, 0.5, 4), M.roof, { y: 2.7, ry: Math.PI / 4 });
  for (const [x, z] of [[0, 0.3], [0, -0.3], [0.3, 0], [-0.3, 0]]) p.add(box(0.05, 0.9, 0.04), M.rune, { x: x * 1.05, y: 1.5, z: z * 1.05, ry: x ? Math.PI / 2 : 0 });
  // Small crystals at the corners of the base.
  for (const [x, z] of [[0.6, 0.6], [-0.6, 0.6], [0.6, -0.6], [-0.6, -0.6]]) p.add(octa(0.14), M.crystal, { x, y: 0.7, z, sy: 1.6 });
  const g = p.build();
  // Floating crystal, animated by the renderer.
  const crystal = new THREE.Mesh(octa(0.3), M.crystal);
  crystal.scale.y = 1.5;
  crystal.position.y = 3.35;
  g.add(crystal);
  g.userData.crystal = crystal;
  return g;
}

function catapult() {
  const M = MATERIALS;
  const p = new Parts();
  p.add(box(1.7, 0.25, 1.7), M.stoneDark, { y: 0.125 });
  p.add(box(1.5, 0.12, 1.5), M.wood, { y: 0.31 });
  const g = p.build();

  // Turret: the catapult frame (rotates to aim, +z forward) with the throwing arm.
  const t = new Parts();
  for (const sx of [-0.42, 0.42]) {
    t.add(box(0.12, 0.12, 1.3), M.wood, { x: sx, y: 0.1 }); // base rails
    t.add(box(0.1, 0.85, 0.1), M.wood, { x: sx, y: 0.5, z: -0.12, rx: 0.32 });
    t.add(box(0.1, 0.85, 0.1), M.wood, { x: sx, y: 0.5, z: 0.12, rx: -0.32 });
    for (const sz of [-0.5, 0.5]) t.add(cyl(0.14, 0.14, 0.07, 10), M.woodDark, { x: sx + Math.sign(sx) * 0.08, y: 0.06, z: sz, rz: Math.PI / 2 });
  }
  t.add(box(0.96, 0.1, 0.1), M.wood, { y: 0.1, z: 0.55 });
  t.add(box(0.96, 0.1, 0.1), M.wood, { y: 0.1, z: -0.55 });
  t.add(cyl(0.05, 0.05, 0.96, 8), M.iron, { y: 0.88, rz: Math.PI / 2 }); // axle
  t.add(box(0.9, 0.12, 0.12), M.wood, { y: 0.62, z: 0.42 }); // stop bar
  const turret = t.build();
  turret.position.y = 0.37;

  // Throwing arm: pivots at the axle; the bucket end points to -z when loaded.
  const a = new Parts();
  a.add(box(0.1, 0.1, 1.45), M.woodDark, { z: -0.42 });
  a.add(cyl(0.16, 0.12, 0.14, 8), M.wood, { y: 0.06, z: -1.1 }); // bucket
  a.add(box(0.36, 0.3, 0.3), M.stoneGrey, { y: -0.1, z: 0.38 }); // counterweight
  const arm = a.build();
  arm.position.y = 0.88;
  const ammo = new THREE.Mesh(dodeca(0.13), M.boulder);
  ammo.position.set(0, 0.18, -1.1);
  arm.add(ammo);
  turret.add(arm);
  g.add(turret);
  Object.assign(g.userData, { turret, arm, ammo });
  return g;
}

const BUILDING_MODELS = { townHall, wall, archerTower, cannonTower, magicSpire, catapult };

/** `opts` is model-specific (walls take `{ connections }`). */
export function createBuildingModel(type, opts) {
  return BUILDING_MODELS[type](opts);
}

// ------------------------------------------------------------------ enemies
// Each enemy's static parts are merged into a `body` group, which the renderer bobs and lunges.

function finishEnemy(p) {
  const g = new THREE.Group();
  const body = p.build();
  g.add(body);
  g.userData.body = body;
  return g;
}

function goblinHead(p, M, y, scale = 1) {
  p.add(sphere(0.16 * scale), M.goblinSkin, { y, sy: 0.9 });
  for (const s of [-1, 1]) p.add(cone(0.06 * scale, 0.22 * scale, 5), M.goblinSkin, { x: s * 0.17 * scale, y: y + 0.03, rz: -s * 1.25 });
  for (const s of [-1, 1]) p.add(sphere(0.03 * scale, 6, 4), M.eyes, { x: s * 0.06 * scale, y: y + 0.03, z: 0.13 * scale });
  p.add(cone(0.035 * scale, 0.1 * scale, 5), M.goblinSkin, { y: y - 0.02, z: 0.17 * scale, rx: Math.PI / 2 });
}

function grunt() {
  const M = MATERIALS;
  const p = new Parts();
  for (const s of [-1, 1]) p.add(box(0.09, 0.28, 0.09), M.leather, { x: s * 0.08, y: 0.14 });
  p.add(box(0.3, 0.32, 0.2), M.cloth, { y: 0.42 });
  p.add(box(0.32, 0.06, 0.22), M.leather, { y: 0.3 });
  goblinHead(p, M, 0.72);
  for (const s of [-1, 1]) p.add(box(0.07, 0.26, 0.07), M.goblinSkin, { x: s * 0.2, y: 0.42, rz: s * 0.15 });
  p.add(cyl(0.05, 0.07, 0.42, 6), M.woodDark, { x: 0.24, y: 0.45, z: 0.14, rx: 0.9 }); // club
  return finishEnemy(p);
}

function runner() {
  const M = MATERIALS;
  const p = new Parts();
  for (const s of [-1, 1]) p.add(box(0.07, 0.24, 0.07), M.leather, { x: s * 0.07, y: 0.12 });
  p.add(box(0.24, 0.26, 0.17), M.leather, { y: 0.36 });
  goblinHead(p, M, 0.62, 0.85);
  p.add(cone(0.17, 0.26, 6), M.hood, { y: 0.74 });
  p.add(box(0.03, 0.03, 0.28), M.iron, { x: 0.18, y: 0.36, z: 0.14 }); // dagger
  return finishEnemy(p);
}

function orc() {
  const M = MATERIALS;
  const p = new Parts();
  for (const s of [-1, 1]) p.add(box(0.13, 0.36, 0.13), M.leather, { x: s * 0.11, y: 0.18 });
  p.add(box(0.44, 0.42, 0.3), M.orcSkin, { y: 0.56 });
  p.add(box(0.46, 0.3, 0.32), M.iron, { y: 0.6 }); // breastplate
  for (const s of [-1, 1]) p.add(sphere(0.12, 8, 6), M.iron, { x: s * 0.26, y: 0.78, sy: 0.7 }); // pauldrons
  for (const s of [-1, 1]) p.add(box(0.1, 0.36, 0.1), M.orcSkin, { x: s * 0.3, y: 0.52 });
  p.add(sphere(0.17), M.orcSkin, { y: 0.98, z: 0.03 });
  for (const s of [-1, 1]) p.add(cone(0.025, 0.08, 4), M.stoneGrey, { x: s * 0.06, y: 0.93, z: 0.17 }); // tusks
  for (const s of [-1, 1]) p.add(sphere(0.03, 6, 4), M.eyes, { x: s * 0.07, y: 1.02, z: 0.15 });
  // Axe.
  p.add(cyl(0.03, 0.03, 0.7, 6), M.woodDark, { x: 0.36, y: 0.55, z: 0.12 });
  p.add(box(0.03, 0.2, 0.18), M.iron, { x: 0.36, y: 0.82, z: 0.2 });
  return finishEnemy(p);
}

function brute() {
  const M = MATERIALS;
  const p = new Parts();
  for (const s of [-1, 1]) p.add(cyl(0.12, 0.15, 0.45, 8), M.trollSkin, { x: s * 0.17, y: 0.22 });
  p.add(box(0.5, 0.18, 0.4), M.leather, { y: 0.48 }); // loincloth
  p.add(sphere(0.38, 10, 8), M.trollSkin, { y: 0.85, z: 0.05, sy: 1.1 }); // hunched torso
  p.add(sphere(0.17, 8, 6), M.trollSkin, { y: 1.22, z: 0.26 });
  for (const s of [-1, 1]) p.add(sphere(0.035, 6, 4), M.eyes, { x: s * 0.07, y: 1.26, z: 0.4 });
  // Long arms and a stone-studded club.
  for (const s of [-1, 1]) p.add(cyl(0.08, 0.11, 0.7, 8), M.trollSkin, { x: s * 0.42, y: 0.6, z: 0.12, rz: s * 0.2 });
  p.add(cyl(0.07, 0.14, 0.9, 8), M.woodDark, { x: 0.52, y: 0.42, z: 0.38, rx: 1.0 });
  p.add(dodeca(0.13), M.stoneGrey, { x: 0.52, y: 0.15, z: 0.75 });
  return finishEnemy(p);
}

const ENEMY_MODELS = { grunt, runner, orc, brute };

export function createEnemyModel(type, elite = false) {
  const g = ENEMY_MODELS[type]();
  if (elite) {
    g.scale.setScalar(1.3);
    const crown = new Parts().add(cyl(0.12, 0.14, 0.1, 6), MATERIALS.gold).build();
    crown.position.set(0, type === 'brute' ? 1.42 : 1.15, type === 'brute' ? 0.26 : 0);
    g.userData.body.add(crown);
  }
  return g;
}

// ------------------------------------------------------------------ projectiles

export function createProjectileModel(kind) {
  if (kind === 'cannonball') return new Parts().add(sphere(0.15), MATERIALS.cannonball).build();
  if (kind === 'boulder') return new Parts().add(dodeca(0.22), MATERIALS.boulder).build();
  // Arrow points along +z so Object3D.lookAt() aims it at its destination.
  return new Parts()
    .add(box(0.035, 0.035, 0.5), MATERIALS.woodDark)
    .add(cone(0.05, 0.1, 4), MATERIALS.iron, { z: 0.29, rx: Math.PI / 2 })
    .add(box(0.1, 0.02, 0.1), MATERIALS.bannerRed, { z: -0.22 })
    .build();
}

// ------------------------------------------------------------------ scenery

const SCENERY_KINDS = {
  // [geometry, material key or leaf colour, offset {x,y,z}, scale {x,y,z}]
  pine: [
    [cyl(0.1, 0.14, 0.7, 6), 'trunk', [0, 0.35, 0]],
    [cone(0.7, 1.2, 7), 'pine', [0, 1.1, 0]],
    [cone(0.52, 1.0, 7), 'pine', [0, 1.6, 0]],
    [cone(0.32, 0.7, 7), 'pine', [0, 2.05, 0]],
  ],
  oak: [
    [cyl(0.12, 0.17, 0.9, 6), 'trunk', [0, 0.45, 0]],
    [ico(0.62, 1), 'oak', [0, 1.35, 0]],
    [ico(0.42, 1), 'oak', [0.38, 1.15, 0.12]],
    [ico(0.4, 1), 'oak', [-0.3, 1.2, -0.2]],
  ],
  bush: [[ico(0.35, 1), 'oak', [0, 0.22, 0], [1, 0.7, 1]]],
  rock: [
    [dodeca(0.38), 'rock', [0, 0.18, 0], [1, 0.65, 1]],
    [dodeca(0.24), 'rock', [0.38, 0.1, 0.1], [1, 0.7, 1]],
    [dodeca(0.16), 'rock', [-0.25, 0.07, 0.3], [1, 0.8, 1]],
  ],
};

const LEAF_COLORS = {
  pine: [0x2f6b3a, 0x285c32, 0x3a7a3f],
  oak: [0x5a9a3c, 0x4c8a34, 0x6aa845],
  rock: [0xb7a88c, 0xa39882, 0xc2b497],
};

/**
 * Trees, bushes and rocks around the map, drawn with instancing: one draw call per part type no
 * matter how many there are. `spots` is [{ x, z, scale, rot, kind }].
 */
export function createScenery(spots) {
  const group = new THREE.Group();
  const white = std({ color: 0xffffff });
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const offset = new THREE.Vector3();
  const color = new THREE.Color();
  for (const [kind, parts] of Object.entries(SCENERY_KINDS)) {
    const list = spots.filter((s) => s.kind === kind);
    if (list.length === 0) continue;
    for (const [geometry, matKey, off, scl = [1, 1, 1]] of parts) {
      const material = matKey === 'trunk' ? MATERIALS.woodDark : white;
      const inst = new THREE.InstancedMesh(geometry, material, list.length);
      list.forEach((s, i) => {
        q.setFromAxisAngle(up, s.rot);
        offset.set(off[0], off[1], off[2]).multiplyScalar(s.scale).applyQuaternion(q);
        m.compose(
          new THREE.Vector3(s.x + offset.x, offset.y, s.z + offset.z),
          q,
          new THREE.Vector3(scl[0] * s.scale, scl[1] * s.scale, scl[2] * s.scale),
        );
        inst.setMatrixAt(i, m);
        if (matKey !== 'trunk') {
          const palette = LEAF_COLORS[matKey];
          inst.setColorAt(i, color.setHex(palette[(s.variant ?? i) % palette.length]));
        }
      });
      inst.castShadow = true;
      inst.receiveShadow = true;
      group.add(inst);
    }
  }
  return group;
}

// ------------------------------------------------------------------ overlays

const barGeo = cached('bar-bg', () => new THREE.PlaneGeometry(1, 0.12));
const barFgGeo = cached('bar-fg', () => new THREE.PlaneGeometry(1, 0.12).translate(0.5, 0, 0));
const barBgMat = new THREE.MeshBasicMaterial({ color: 0x1a0c0c, depthTest: false, transparent: true, opacity: 0.8 });

/** Billboarded health bar. Call setHealthBar() to update the fill. */
export function createHealthBar(width = 1) {
  const g = new THREE.Group();
  const bg = new THREE.Mesh(barGeo, barBgMat);
  bg.scale.x = width + 0.06;
  bg.scale.y = 1.4;
  // Both parts are transparent so they're drawn in the same pass and renderOrder puts the fill on top.
  const fg = new THREE.Mesh(barFgGeo, new THREE.MeshBasicMaterial({ color: 0x55dd55, depthTest: false, transparent: true }));
  fg.position.x = -width / 2;
  bg.renderOrder = 998;
  fg.renderOrder = 999;
  g.add(bg, fg);
  g.userData = { fg, width };
  return g;
}

const tmpColor = new THREE.Color();
export function setHealthBar(bar, ratio) {
  const { fg, width } = bar.userData;
  const r = Math.max(0, Math.min(1, ratio));
  fg.scale.x = Math.max(0.001, r * width);
  fg.material.color.copy(tmpColor.setHSL(r * 0.33, 0.75, 0.5));
}
