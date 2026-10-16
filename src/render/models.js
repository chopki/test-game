import * as THREE from 'three';

// Procedural low-poly models built from primitives, so the game needs no asset
// pipeline yet. Geometries and materials are cached and shared between
// instances; removing a model from the scene never needs to dispose them.

const geoCache = new Map();
function geo(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}

const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, ...opts });

export const MATERIALS = {
  stone: mat(0xa8a49a),
  stoneDark: mat(0x77746c),
  stoneLight: mat(0xc9c4b6),
  wood: mat(0x7a5232),
  roofRed: mat(0xa8322d),
  roofBlue: mat(0x2f5d9e),
  gold: mat(0xd8b545, { metalness: 0.5, roughness: 0.4 }),
  iron: mat(0x2e2e33, { metalness: 0.6, roughness: 0.45 }),
  banner: mat(0x2f5d9e, { side: THREE.DoubleSide }),
  door: mat(0x4a3020),
  skinGreen: mat(0x6f8f4a),
  skinGrey: mat(0x8a8f80),
  grunt: mat(0xb8432f),
  runner: mat(0xd9a43a),
  brute: mat(0x6b3f8f),
  arrow: mat(0x5a3d22),
  cannonball: mat(0x1d1d1f, { metalness: 0.5, roughness: 0.5 }),
  trunk: mat(0x5b3b22),
  leaves: mat(0x2f6b2f),
  leavesDark: mat(0x24562a),
  rock: mat(0x8c8a84),
};

function mesh(geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const box = (w, h, d) => geo(`box:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));
const cyl = (rt, rb, h, seg = 8) => geo(`cyl:${rt}:${rb}:${h}:${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
const cone = (r, h, seg = 8) => geo(`cone:${r}:${h}:${seg}`, () => new THREE.ConeGeometry(r, h, seg));
const sphere = (r, seg = 10) => geo(`sphere:${r}:${seg}`, () => new THREE.SphereGeometry(r, seg, Math.max(6, seg - 2)));
const capsule = (r, l) => geo(`capsule:${r}:${l}`, () => new THREE.CapsuleGeometry(r, l, 4, 8));

// ------------------------------------------------------------------ buildings

function townHall() {
  const g = new THREE.Group();
  const M = MATERIALS;
  g.add(mesh(box(2.7, 1.4, 2.7), M.stone, 0, 0.7, 0));
  g.add(mesh(box(2.1, 1.1, 2.1), M.stoneLight, 0, 1.95, 0));
  const roof = mesh(cone(1.7, 1.3, 4), M.roofBlue, 0, 3.15, 0);
  roof.rotation.y = Math.PI / 4;
  g.add(roof);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      g.add(mesh(cyl(0.32, 0.36, 2.2), M.stone, sx * 1.3, 1.1, sz * 1.3));
      g.add(mesh(cone(0.42, 0.7), M.roofBlue, sx * 1.3, 2.55, sz * 1.3));
    }
  }
  g.add(mesh(box(0.6, 0.85, 0.08), M.door, 0, 0.42, 1.36));
  g.add(mesh(cyl(0.03, 0.03, 1.2, 6), M.wood, 0, 4.2, 0));
  const flag = mesh(geo('flag', () => new THREE.PlaneGeometry(0.6, 0.35)), M.banner, 0.3, 4.6, 0);
  g.add(flag);
  g.userData.flag = flag;
  return g;
}

function wall() {
  const g = new THREE.Group();
  const M = MATERIALS;
  g.add(mesh(box(1, 1.0, 1), M.stone, 0, 0.5, 0));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) g.add(mesh(box(0.28, 0.3, 0.28), M.stoneDark, sx * 0.36, 1.15, sz * 0.36));
  }
  return g;
}

function archerTower() {
  const g = new THREE.Group();
  const M = MATERIALS;
  g.add(mesh(cyl(0.75, 0.9, 2.4), M.stone, 0, 1.2, 0));
  g.add(mesh(cyl(1.0, 1.0, 0.22), M.wood, 0, 2.5, 0));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    g.add(mesh(box(0.1, 0.7, 0.1), M.wood, Math.cos(a) * 0.85, 2.95, Math.sin(a) * 0.85));
  }
  g.add(mesh(cone(1.2, 1.0), M.roofRed, 0, 3.75, 0));
  return g;
}

function cannonTower() {
  const g = new THREE.Group();
  const M = MATERIALS;
  g.add(mesh(box(1.8, 1.2, 1.8), M.stoneDark, 0, 0.6, 0));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.add(mesh(box(0.3, 0.3, 0.3), M.stone, Math.cos(a) * 0.78, 1.35, Math.sin(a) * 0.78));
  }
  const turret = new THREE.Group();
  turret.position.y = 1.35;
  turret.add(mesh(cyl(0.45, 0.5, 0.35, 10), M.wood, 0, 0, 0));
  const barrel = mesh(cyl(0.16, 0.2, 1.2, 10), M.iron, 0, 0.25, 0.4);
  barrel.rotation.x = Math.PI / 2 - 0.25;
  turret.add(barrel);
  g.add(turret);
  g.userData.turret = turret;
  return g;
}

const BUILDING_MODELS = { townHall, wall, archerTower, cannonTower };

export function createBuildingModel(type) {
  return BUILDING_MODELS[type]();
}

// ------------------------------------------------------------------ enemies

function grunt() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.add(mesh(capsule(0.2, 0.35), MATERIALS.grunt, 0, 0.42, 0));
  body.add(mesh(sphere(0.15), MATERIALS.skinGreen, 0, 0.85, 0));
  const club = mesh(box(0.08, 0.45, 0.08), MATERIALS.wood, 0.25, 0.55, 0.1);
  club.rotation.x = 0.6;
  body.add(club);
  g.add(body);
  g.userData.body = body;
  return g;
}

function runner() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.add(mesh(capsule(0.15, 0.28), MATERIALS.runner, 0, 0.35, 0));
  body.add(mesh(sphere(0.12), MATERIALS.skinGreen, 0, 0.7, 0));
  const dagger = mesh(box(0.05, 0.05, 0.3), MATERIALS.iron, 0.18, 0.4, 0.15);
  body.add(dagger);
  g.add(body);
  g.userData.body = body;
  return g;
}

function brute() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.add(mesh(box(0.7, 0.75, 0.5), MATERIALS.brute, 0, 0.7, 0));
  body.add(mesh(sphere(0.22), MATERIALS.skinGrey, 0, 1.28, 0.05));
  for (const s of [-1, 1]) {
    body.add(mesh(box(0.2, 0.6, 0.22), MATERIALS.skinGrey, s * 0.47, 0.65, 0));
    body.add(mesh(box(0.22, 0.4, 0.26), MATERIALS.brute, s * 0.18, 0.2, 0));
  }
  g.add(body);
  g.userData.body = body;
  return g;
}

const ENEMY_MODELS = { grunt, runner, brute };

export function createEnemyModel(type, elite = false) {
  const g = ENEMY_MODELS[type]();
  if (elite) {
    g.scale.setScalar(1.3);
    g.userData.body.add(mesh(cone(0.18, 0.25, 5), MATERIALS.gold, 0, 1.55, 0.05));
  }
  return g;
}

// ------------------------------------------------------------------ projectiles

export function createProjectileModel(kind) {
  if (kind === 'cannonball') return mesh(sphere(0.16), MATERIALS.cannonball);
  const g = new THREE.Group();
  // Arrow points along +z so Object3D.lookAt() aims it at its destination.
  g.add(mesh(box(0.04, 0.04, 0.5), MATERIALS.arrow));
  g.add(mesh(box(0.08, 0.08, 0.08), MATERIALS.iron, 0, 0, 0.25));
  return g;
}

// ------------------------------------------------------------------ scenery

export function createTree(scale = 1) {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.12, 0.16, 0.8, 6), MATERIALS.trunk, 0, 0.4, 0));
  const leaves = Math.random() < 0.5 ? MATERIALS.leaves : MATERIALS.leavesDark;
  g.add(mesh(cone(0.75, 1.4, 7), leaves, 0, 1.3, 0));
  g.add(mesh(cone(0.55, 1.1, 7), leaves, 0, 1.9, 0));
  g.scale.setScalar(scale);
  return g;
}

export function createRock(scale = 1) {
  const m = mesh(geo('rock', () => new THREE.DodecahedronGeometry(0.4, 0)), MATERIALS.rock);
  m.scale.set(scale, scale * 0.6, scale);
  m.rotation.y = Math.random() * Math.PI;
  return m;
}

// ------------------------------------------------------------------ overlays

const barGeo = geo('bar-bg', () => new THREE.PlaneGeometry(1, 0.12));
const barFgGeo = geo('bar-fg', () => new THREE.PlaneGeometry(1, 0.12).translate(0.5, 0, 0));
const barBgMat = new THREE.MeshBasicMaterial({ color: 0x1a0c0c, depthTest: false, transparent: true, opacity: 0.8 });

/** Billboarded health bar. Call setHealthBar() to update the fill. */
export function createHealthBar(width = 1) {
  const g = new THREE.Group();
  const bg = new THREE.Mesh(barGeo, barBgMat);
  bg.scale.x = width + 0.06;
  bg.scale.y = 1.4;
  const fg = new THREE.Mesh(barFgGeo, new THREE.MeshBasicMaterial({ color: 0x55dd55, depthTest: false }));
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
