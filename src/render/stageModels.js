import * as THREE from 'three';
import {
  BOULDER,
  GREYSTONE,
  MATERIALS,
  ROOF_TILES,
  Parts,
  SANDSTONE,
  SLATE,
  WORN_TRIM,
  WORN_WALL,
  WORNSTONE,
  banner,
  barrel,
  box,
  cone,
  crate,
  cyl,
  deepWindow,
  dodeca,
  door,
  frustum,
  groundDressing,
  merlonsRect,
  merlonsRing,
  octa,
  pennant,
  quoins,
  rbox,
  rng,
  roughBlocks,
  sphere,
  std,
  stoneBlocks,
  torus,
} from './modelKit.js';
import { roughStoneTexture } from './textures.js';
import {
  addCatapultTurret,
  archerTower,
  cannonTower,
  cannonTurret,
  catapult,
  createBuildingModel,
  createStoneTower,
  crystalCluster,
  fence,
  lookouts,
  magicSpire,
  palisadeLog,
  wall,
  wallArm,
  wallJoint,
} from './models.js';

// The upgrade stages' models (UPGRADES in sim/config.js). Stage 1 is each building as built (models.js); then:
//   2  reinforced wood: stone footings, planking, gabions, shields and banners
//   3  worn stone: the stone tower, a round stone battery, a slender mage tower, a stone platform, dry-stone walls
//   4  stone with roofs and battlements: a roofed keep, a square bombard tower, a crowned arcane tower, crenellations
//   5  grey citadel stone with gold: the tallest, heaviest versions, royal banners
// Towers keep their turrets (lookouts, cannon, catapult, crystal) on top, at a height that grows with the stage.

/** Smooth painted grey citadel stone (stage 5), like WORN_WALL. */
const GREY_COLORS = ['#9a9ca6', '#8d8f99', '#a6a8b0', '#82848e', '#93959f'];
const GREY_WALL = std({ map: roughStoneTexture(GREY_COLORS, '#4a4c55'), flatShading: true });
const GREY_TRIM = std({ color: 0x6e707a });
const VIOLET = std({ color: 0x5c3f86 });
/** Turf on dry-stone walls, in the painted ground's olive. */
const TURF = std({ color: 0x8f8c45 });
const TURF_DARK = std({ color: 0x77742f });
const WICKER = std({ color: 0x9a7444 });
const SHIELD_COLORS = [MATERIALS.bannerRed, std({ color: 0x2e5a8a }), std({ color: 0xc9a23e })];

/** Stone blocks and trim for a stage: worn stone up to 4, grey citadel stone at 5. */
const stonesFor = (stage) => (stage >= 5 ? GREYSTONE : WORNSTONE);
const wallFor = (stage) => (stage >= 5 ? GREY_WALL : WORN_WALL);
const trimFor = (stage) => (stage >= 5 ? GREY_TRIM : WORN_TRIM);

/** A round wooden shield hung flat on a face (normal along +z turned by `ry`). */
function shield(p, { x, y, z, ry = 0, r = 0.1, mat }) {
  p.add(cyl(r, r, 0.025, 12), mat, { x, y, z, rx: Math.PI / 2, ry, order: 'YXZ' });
  p.add(sphere(0.028, 6, 5), MATERIALS.iron, { x: x + Math.sin(ry) * 0.016, y, z: z + Math.cos(ry) * 0.016 });
}

/** A pyramid (4 sides) or cone roof of radius `r` and height `h` with its eaves at `y`, and a finial. */
function roof(p, { x = 0, z = 0, y, r, h, sides = 4, mat, finial = MATERIALS.woodDark }) {
  p.add(cone(r, h, sides), mat, { x, y: y + h / 2, z, ry: sides === 4 ? Math.PI / 4 : 0 });
  p.add(sphere(0.04, 6, 5), finial, { x, y: y + h + 0.02, z });
}

/** A round stone turret with a cone roof: a corner tower for the hall and the bastion. */
function roundTurret(p, rnd, { x, z, r = 0.24, h, stage, roofMat }) {
  p.add(cyl(r, r + 0.03, h, 14), wallFor(stage), { x, y: h / 2, z });
  p.add(cyl(r + 0.05, r + 0.05, 0.08, 14), trimFor(stage), { x, y: h + 0.04, z });
  roof(p, { x, z, y: h + 0.08, r: r + 0.08, h: r * 2.2, sides: 12, mat: roofMat, finial: stage >= 5 ? MATERIALS.gold : MATERIALS.woodDark });
  deepWindow(p, rnd, { x, y: h * 0.7, z: z + r + 0.01, nx: 0, nz: 1, s: 0.08, stones: stonesFor(stage) });
}

// ------------------------------------------------------------------ archer tower

/** Stage 2, Guard Tower: the watchtower on a stone plinth, with shields on the cabin and a banner. */
function guardTower(base = archerTower()) {
  const p = new Parts();
  const rnd = rng(231);
  roughBlocks(p, { y: 0, w: 1.5, d: 1.5, h: 0.22, rows: 1, rnd, minBlock: 0.24, maxBlock: 0.4 });
  const y = 1.9;
  shield(p, { x: -0.27, y, z: 0.59, mat: SHIELD_COLORS[0] });
  shield(p, { x: 0.27, y, z: 0.59, mat: SHIELD_COLORS[1] });
  shield(p, { x: 0.59, y, z: -0.25, ry: Math.PI / 2, mat: SHIELD_COLORS[0] });
  banner(p, { x: 0.62, y: 1.66, z: 0.22, ry: Math.PI / 2, w: 0.24, h: 0.5 });
  base.add(p.build());
  return base;
}

/** Stages 3 to 5: the stone tower; a tiled roof on posts from 4; on a plinth, taller, slate and gold at 5. */
function stoneArcherTower(stage) {
  const g = new THREE.Group();
  const tower = createStoneTower({ defenders: false });
  const lift = stage >= 5 ? 0.3 : 0;
  tower.position.y = lift;
  g.add(tower);
  const p = new Parts();
  const rnd = rng(301 + stage);
  if (lift) roughBlocks(p, { y: 0, w: 1.55, d: 1.55, h: lift, rows: 2, rnd, stones: GREYSTONE, minBlock: 0.24, maxBlock: 0.4 });
  const floor = 1.85 + 0.19 + 0.28 + lift; // the parapet's walkway
  if (stage >= 4) {
    // A pyramid roof on four posts set on the corner merlons, high enough to see the lookouts under it.
    const top = floor + 0.92;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.add(box(0.07, top - floor - 0.3, 0.07), MATERIALS.woodDark, { x: sx * 0.41, y: floor + 0.3 + (top - floor - 0.3) / 2, z: sz * 0.41 });
    p.add(box(1.0, 0.06, 1.0), MATERIALS.woodDark, { y: top });
    roof(p, { y: top + 0.03, r: 0.86, h: 0.66, mat: stage >= 5 ? rnd.pick(SLATE) : rnd.pick(ROOF_TILES), finial: stage >= 5 ? MATERIALS.gold : MATERIALS.woodDark });
    banner(p, { x: 0.43, y: 1.9 + lift, z: 0.18, ry: Math.PI / 2, w: 0.24, h: 0.46 });
  }
  if (stage >= 5) {
    banner(p, { x: -0.18, y: 1.9 + lift, z: 0.43, w: 0.22, h: 0.44 });
    p.add(torus(0.58, 0.022, 4), MATERIALS.gold, { y: floor - 0.3, rx: Math.PI / 2, rz: Math.PI / 4 });
  }
  g.add(p.build());
  const turret = lookouts(floor);
  g.add(turret);
  g.userData.turret = turret;
  return g;
}

function stagedArcherTower(stage, inWall) {
  if (stage >= 3) return stoneArcherTower(stage);
  return guardTower(inWall ? createBuildingModel('archerTower', inWall) : archerTower());
}

// ------------------------------------------------------------------ cannon tower

/** Stage 2, Gun Platform: wicker gabions round the back of the plinth, more shot and powder. */
function gunPlatform(base = cannonTower(), y0 = 0, k = 1) {
  const p = new Parts();
  const rnd = rng(233);
  for (const [x, z] of [[-0.62, -0.92], [-0.2, -0.95], [0.22, -0.95], [0.64, -0.9], [-0.95, -0.5], [-0.97, -0.06]]) {
    p.add(cyl(0.15, 0.15, 0.4, 10), WICKER, { x: x * k, y: y0 + 0.2, z: z * k });
    p.add(cyl(0.13, 0.13, 0.03, 10), MATERIALS.dirt, { x: x * k, y: y0 + 0.41, z: z * k });
    for (const yy of [0.1, 0.3]) p.add(torus(0.152, 0.012, 12), MATERIALS.woodDark, { x: x * k, y: y0 + yy, z: z * k, rx: Math.PI / 2 });
  }
  for (const [x, z, y] of [[0.7, 0.62, 0], [0.56, 0.62, 0], [0.63, 0.5, 0], [0.63, 0.58, 0.1]]) p.add(sphere(0.07, 8, 6), MATERIALS.cannonball, { x: x * k, y: y0 + 0.07 + y, z: z * k });
  barrel(p, { x: 0.86 * k, y: y0, z: 0.1 * k, r: 0.1, h: 0.22 });
  base.add(p.build());
  return base;
}

/** Stage 3, Stone Battery: a round stone drum with a ring of merlons. */
function stoneBattery(p, rnd) {
  roughBlocks(p, { y: 0, w: 1.72, d: 1.72, h: 0.14, rows: 1, rnd, minBlock: 0.26, maxBlock: 0.42 });
  p.add(cyl(0.8, 0.86, 0.76, 18), WORN_WALL, { y: 0.14 + 0.38 });
  p.add(cyl(0.86, 0.86, 0.07, 18), WORN_TRIM, { y: 0.93 });
  merlonsRing(p, { y: 0.96, r: 0.76, count: 10, size: 0.2, height: 0.2, rnd, stones: WORNSTONE });
  p.add(cyl(0.68, 0.68, 0.03, 18), MATERIALS.woodDark, { y: 0.97 });
  door(p, { x: 0.18, y: 0.14, z: 0.86, w: 0.3, h: 0.46, stones: WORNSTONE });
  return 0.98;
}

/** Stage 4, Bombard Tower: a square stone tower with battlements, the gun on its roof. */
function bombardTower(p, rnd) {
  roughBlocks(p, { y: 0, w: 1.56, d: 1.56, h: 0.16, rows: 1, rnd, minBlock: 0.26, maxBlock: 0.42 });
  p.add(frustum(1.44, 1.26, 1.14), WORN_WALL, { y: 0.16 + 0.57 });
  quoins(p, rnd, { y0: 0.16, y1: 1.3, w0: 1.44, w1: 1.26 });
  p.add(rbox(1.36, 0.08, 1.36, 0.025), WORN_TRIM, { y: 1.34 });
  merlonsRect(p, { y: 1.38, w: 1.34, d: 1.34, size: 0.22, height: 0.24, spacing: 0.4, rnd, stones: WORNSTONE });
  p.add(box(1.2, 0.04, 1.2), MATERIALS.woodLight, { y: 1.39 });
  door(p, { x: -0.2, y: 0.16, z: 0.71, w: 0.34, h: 0.5, stones: WORNSTONE });
  deepWindow(p, rnd, { x: 0.25, y: 0.95, z: 0.66, nx: 0, nz: 1, s: 0.12 });
  deepWindow(p, rnd, { x: 0.66, y: 0.95, z: -0.1, nx: 1, nz: 0, s: 0.12 });
  banner(p, { x: 0.69, y: 1.26, z: 0.32, ry: Math.PI / 2, w: 0.22, h: 0.44 });
  return 1.41;
}

/** Stage 5, Great Bastion: a broad grey stone bastion with corner turrets and royal banners. */
function greatBastion(p, rnd) {
  stoneBlocks(p, { y: 0, w: 1.86, d: 1.86, h: 0.36, rows: 2, rnd, stones: GREYSTONE, mortar: MATERIALS.mortarDark, minBlock: 0.3, maxBlock: 0.5 });
  p.add(frustum(1.74, 1.56, 0.66), GREY_WALL, { y: 0.36 + 0.33 });
  quoins(p, rnd, { y0: 0.36, y1: 1.02, w0: 1.74, w1: 1.56, stones: GREYSTONE });
  p.add(rbox(1.62, 0.08, 1.62, 0.025), GREY_TRIM, { y: 1.06 });
  merlonsRect(p, { y: 1.1, w: 1.6, d: 1.6, size: 0.24, height: 0.26, spacing: 0.42, rnd, stones: GREYSTONE });
  p.add(box(1.44, 0.04, 1.44), MATERIALS.woodLight, { y: 1.11 });
  for (const [x, z] of [[-0.86, -0.86], [0.86, -0.86]]) roundTurret(p, rnd, { x, z, r: 0.22, h: 1.55, stage: 5, roofMat: rnd.pick(ROOF_TILES) });
  banner(p, { x: -0.3, y: 0.98, z: 0.79, w: 0.24, h: 0.48 });
  banner(p, { x: 0.3, y: 0.98, z: 0.79, w: 0.24, h: 0.48 });
  p.add(box(0.5, 0.05, 0.01), MATERIALS.gold, { y: 0.98, z: 0.8 });
  return 1.13;
}

function stagedCannonTower(stage, inWall) {
  if (stage === 2) return inWall ? gunPlatform(createBuildingModel('cannonTower', inWall), 1.0, 0.6) : gunPlatform();
  const p = new Parts();
  const rnd = rng(330 + stage);
  const top = [stoneBattery, bombardTower, greatBastion][stage - 3](p, rnd);
  groundDressing(p, { w: 1.8, d: 1.8, rnd, count: 8 });
  const g = p.build();
  const turret = cannonTurret(top);
  g.add(turret);
  g.userData.turret = turret;
  return g;
}

// ------------------------------------------------------------------ magic spire

/** The floating crystal (baked separately and bobbed in game) at height `y`. */
function addCrystal(g, y) {
  const c = new Parts({ yOffset: y });
  c.add(octa(0.18), MATERIALS.crystal, { sy: 1.7 });
  for (const a of [0, 2.1, 4.2]) c.add(octa(0.06), MATERIALS.crystal, { x: Math.cos(a) * 0.15, y: -0.12, z: Math.sin(a) * 0.15, sy: 1.8, rz: Math.cos(a) * 0.4, rx: Math.sin(a) * 0.4 });
  const crystal = c.build();
  crystal.position.y = y;
  g.add(crystal);
  g.userData.crystal = crystal;
}

/** Stage 2, Rune Circle: the mound ringed by four rune-cut standing stones. */
function runeCircle(base = magicSpire(), r = 0.86) {
  const p = new Parts();
  const rnd = rng(237);
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const x = sx * r;
    const z = sz * r;
    const h = rnd.range(0.55, 0.7);
    p.add(rbox(0.17, h, 0.13, 0.04), rnd.pick(GREYSTONE), { x, y: h / 2, z, ry: Math.atan2(sx, sz), rz: rnd.range(-0.08, 0.08) });
    p.add(box(0.03, h * 0.5, 0.02), MATERIALS.rune, { x: x + sx * 0.02, y: h * 0.5, z: z + sz * 0.07, ry: Math.atan2(sx, sz) });
    crystalCluster(p, { x: x - sx * 0.14, y: 0, z: z - sz * 0.14, rnd, scale: 0.7 });
  }
  base.add(p.build());
  return base;
}

/** Stages 3 to 5: a slender stone mage tower on the stepped base, crowned with crystals; a gold ring above from 4. */
function mageTower(stage) {
  const p = new Parts();
  const rnd = rng(340 + stage);
  const stones = stage >= 5 ? GREYSTONE : [...GREYSTONE.slice(0, 2), ...SANDSTONE.slice(0, 2)];
  let y = 0;
  for (const [w, h] of [[1.6, 0.22], [1.28, 0.22]]) {
    stoneBlocks(p, { y, w, d: w, h, rows: 1, rnd, stones, mortar: MATERIALS.mortarDark, minBlock: 0.24, maxBlock: 0.4 });
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) crystalCluster(p, { x: (sx * w) / 2 - sx * 0.12, y: y + h - 0.04, z: (sz * w) / 2 - sz * 0.12, rnd });
    y += h;
  }
  const shaft = stage >= 5 ? 1.75 : 1.4;
  p.add(frustum(0.8, 0.58, shaft), stage >= 5 ? GREY_WALL : WORN_WALL, { y: y + shaft / 2 });
  quoins(p, rnd, { y0: y, y1: y + shaft, w0: 0.8, w1: 0.58, size: 0.1, stones: stonesFor(stage) });
  // Glowing rune bands round the shaft, and a window.
  for (const t of [0.3, 0.7]) {
    const w = 0.8 + (0.58 - 0.8) * t + 0.012;
    for (const [x, z, ry] of [[0, w / 2, 0], [w / 2, 0, Math.PI / 2]]) p.add(box(w * 0.7, 0.035, 0.012), MATERIALS.rune, { x, y: y + shaft * t, z, ry });
  }
  deepWindow(p, rnd, { x: 0, y: y + shaft * 0.5, z: 0.36, nx: 0, nz: 1, s: 0.1, stones: stonesFor(stage) });
  y += shaft;
  // The crown: pointed stones round the top, crystals between.
  p.add(rbox(0.72, 0.08, 0.72, 0.025), stage >= 5 ? GREY_TRIM : WORN_TRIM, { y: y + 0.04 });
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    p.add(cone(0.08, 0.34, 4), rnd.pick(stones), { x: sx * 0.3, y: y + 0.25, z: sz * 0.3, ry: Math.PI / 4 });
    crystalCluster(p, { x: sx * 0.16, y: y + 0.06, z: 0, rnd, scale: 0.7 });
  }
  let crystalY = y + 0.5;
  if (stage >= 4) {
    // Four slim pillars carry a gold ring the crystal floats in.
    const ringY = y + (stage >= 5 ? 0.85 : 0.7);
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) p.add(cyl(0.025, 0.035, ringY - y, 6), VIOLET, { x: sx * 0.24, y: y + (ringY - y) / 2, z: sz * 0.24 });
    p.add(torus(0.34, 0.03, 20), MATERIALS.gold, { y: ringY, rx: Math.PI / 2 });
    crystalY = ringY - 0.05;
    banner(p, { x: 0.41, y: y - 0.2, z: 0, ry: Math.PI / 2, w: 0.2, h: 0.42 });
  }
  if (stage >= 5) for (let i = 0; i < 4; i++) p.add(octa(0.06), MATERIALS.crystal, { x: Math.cos(i * 1.57 + 0.6) * 0.46, y: crystalY + 0.12 * (i % 2), z: Math.sin(i * 1.57 + 0.6) * 0.46, sy: 1.8 });
  groundDressing(p, { w: 1.7, d: 1.7, rnd, count: 8 });
  const g = p.build();
  addCrystal(g, crystalY);
  return g;
}

function stagedMagicSpire(stage, inWall) {
  if (stage >= 3) return mageTower(stage);
  return runeCircle(inWall ? createBuildingModel('magicSpire', inWall) : magicSpire(), inWall ? 0.7 : 0.86);
}

// ------------------------------------------------------------------ catapult

/** The platform the catapult works from at each stage; returns its height. */
function catapultPlatform(p, rnd, stage) {
  if (stage === 2) {
    // A timber deck with stakes at the corners.
    p.add(box(1.72, 0.18, 1.72), MATERIALS.woodDark, { y: 0.09 });
    for (let i = 0; i < 7; i++) p.add(box(0.02, 0.01, 1.7), MATERIALS.wood, { x: -0.75 + i * 0.25, y: 0.185 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) palisadeLog(p, rnd, sx * 0.86, sz * 0.86, { h: 0.55, lash: 0 });
    return 0.19;
  }
  const stones = stage >= 5 ? GREYSTONE : WORNSTONE;
  let top;
  if (stage >= 5) {
    stoneBlocks(p, { y: 0, w: 1.86, d: 1.86, h: 0.4, rows: 2, rnd, stones, mortar: MATERIALS.mortarDark, minBlock: 0.3, maxBlock: 0.5 });
    stoneBlocks(p, { y: 0.4, w: 1.7, d: 1.7, h: 0.38, rows: 2, along: 'z', rnd, stones, mortar: MATERIALS.mortarDark, minBlock: 0.3, maxBlock: 0.5 });
    top = 0.78;
  } else {
    roughBlocks(p, { y: 0, w: 1.76, d: 1.76, h: 0.44, rows: 2, rnd, stones, minBlock: 0.26, maxBlock: 0.42 });
    top = 0.44;
  }
  p.add(box(1.64, 0.03, 1.64), MATERIALS.woodDark, { y: top + 0.015 });
  if (stage >= 4) {
    // Merlons round the back and sides (the front stays open for the arm), a counterweight pile and a banner.
    for (const [x, z] of [[-0.74, -0.74], [0, -0.74], [0.74, -0.74], [-0.74, 0], [0.74, 0], [-0.74, 0.74], [0.74, 0.74]]) p.add(rbox(0.22, 0.26, 0.22, 0.04), rnd.pick(stones), { x, y: top + 0.13, z });
    crate(p, { x: -0.55, y: top, z: -0.3, s: 0.22 });
    crate(p, { x: -0.55, y: top + 0.22, z: -0.32, s: 0.18, ry: 0.4 });
    banner(p, { x: 0.89, y: top - 0.05, z: 0.3, ry: Math.PI / 2, w: 0.24, h: 0.4 });
    if (stage >= 5) banner(p, { x: 0.3, y: top - 0.05, z: 0.89, w: 0.24, h: 0.4 });
  }
  for (const [x, z, r] of [[-0.62, -0.5, 0.12], [-0.5, -0.62, 0.1], [-0.64, -0.64, 0.09]]) p.add(dodeca(r), MATERIALS.boulder, { x, y: top + r * 0.8, z });
  return top + 0.03;
}

function stagedCatapult(stage, inWall) {
  if (stage === 2 && inWall) {
    const g = createBuildingModel('catapult', inWall);
    const p = new Parts();
    const rnd = rng(239);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) palisadeLog(p, rnd, sx * 0.62, sz * 0.62, { h: 1.2, lash: 0 });
    g.add(p.build());
    return g;
  }
  const p = new Parts();
  const rnd = rng(350 + stage);
  const top = catapultPlatform(p, rnd, stage);
  groundDressing(p, { w: 1.8, d: 1.8, rnd, count: 8 });
  const g = p.build();
  addCatapultTurret(g, top);
  return g;
}

// ------------------------------------------------------------------ town hall

/** Where the Town Hall's chimney and pennant are at each stage (the renderer draws the smoke and the waving cloth). */
const HALL_KEEP = { x: -0.12, z: -0.2 };
const HALL_TOP = [1.6, 1.95, 2.05, 2.25, 2.6];
const hallW = (stage) => (stage >= 4 ? 1.35 : 1.25);

function stagedTownHall(stage) {
  const M = MATERIALS;
  const p = new Parts();
  const rnd = rng(360 + stage);
  const stones = stage >= 5 ? GREYSTONE : SANDSTONE;
  const E = 1.38;
  p.add(box(2.86, 0.05, 2.86), M.dirt, { y: 0.025 });
  // The yard's edge: a fence, then a low dry-stone wall (3), a crenellated curtain wall (4, 5).
  if (stage === 2) {
    fence(p, { x0: -E, z0: -E, x1: E, z1: -E, rnd });
    fence(p, { x0: -E, z0: -E, x1: -E, z1: E, rnd });
    fence(p, { x0: E, z0: -E, x1: E, z1: E, rnd });
    fence(p, { x0: -E, z0: E, x1: E, z1: E, rnd, gapFrom: 0.38, gapTo: 0.62 });
  } else {
    const h = stage === 3 ? 0.36 : stage === 4 ? 0.55 : 0.7;
    const blocks = stage >= 5 ? GREYSTONE : WORNSTONE;
    const run = (x, z, w, d) => {
      roughBlocks(p, { x, z, w, d, h, rows: stage === 3 ? 2 : 3, rnd, stones: blocks, along: w > d ? 'x' : 'z', minBlock: 0.16, maxBlock: 0.3 });
      if (stage >= 4) {
        const n = Math.round(Math.max(w, d) / 0.3);
        for (let i = 0; i < n; i++) {
          const t = -0.5 + (i + 0.5) / n;
          p.add(rbox(w > d ? 0.13 : w, 0.16, w > d ? d : 0.13, 0.03), rnd.pick(blocks), { x: x + (w > d ? t * w : 0), y: h + 0.08, z: z + (w > d ? 0 : t * d) });
        }
      }
    };
    run(0, -E, 2.86, 0.2);
    run(-E, 0, 0.2, 2.56);
    run(E, 0, 0.2, 2.56);
    run(-0.9, E, 1.06, 0.2); // the front, with the gateway between
    run(0.9, E, 1.06, 0.2);
  }
  // Corner towers: the back two from stage 3, all four from 4.
  if (stage >= 3) {
    const corners = stage >= 4 ? [[-1, -1], [1, -1], [-1, 1], [1, 1]] : [[-1, -1], [1, -1]];
    const h = stage === 3 ? 0.95 : stage === 4 ? 1.2 : 1.45;
    for (const [sx, sz] of corners) roundTurret(p, rnd, { x: sx * 1.28, z: sz * 1.28, r: 0.25, h, stage, roofMat: stage >= 5 ? rnd.pick(SLATE) : rnd.pick(ROOF_TILES) });
  }
  // The keep, taller each stage.
  const { x: kx, z: kz } = HALL_KEEP;
  const W = hallW(stage);
  const top = HALL_TOP[stage - 1];
  stoneBlocks(p, { x: kx, z: kz, y: 0.05, w: W + 0.14, d: W + 0.14, h: 0.16, rows: 1, rnd, stones, minBlock: 0.3, maxBlock: 0.5 });
  const courses = Math.round((top - 0.21) / 0.23);
  for (let i = 0; i < courses; i++) {
    const rowH = (top - 0.21) / courses;
    stoneBlocks(p, { x: kx, z: kz, y: 0.21 + i * rowH, w: W, d: W, h: rowH, rows: 1, along: i % 2 ? 'x' : 'z', rnd, stones });
  }
  p.add(box(W + 0.06, 0.06, W + 0.06), M.capstone, { x: kx, y: 0.98, z: kz });
  stoneBlocks(p, { x: kx, z: kz, y: top + 0.05, w: W + 0.16, d: W + 0.16, h: 0.15, rows: 1, rnd, stones, minBlock: 0.3, maxBlock: 0.5 });
  merlonsRect(p, { x: kx, z: kz, y: top + 0.2, w: W + 0.16, d: W + 0.16, size: 0.21, height: 0.27, spacing: 0.38, rnd, stones });
  p.add(box(W, 0.04, W), M.woodLight, { x: kx, y: top + 0.21, z: kz });
  door(p, { x: kx, y: 0.21, z: kz + W / 2 + 0.01, w: 0.4, h: 0.62, stones });
  for (const yy of [1.3, top - 0.3].filter((v, i) => i === 0 || top > 1.9)) {
    deepWindow(p, rnd, { x: kx + 0.3, y: yy, z: kz + W / 2, nx: 0, nz: 1, s: 0.14, stones });
    deepWindow(p, rnd, { x: kx - 0.3, y: yy, z: kz + W / 2, nx: 0, nz: 1, s: 0.14, stones });
    deepWindow(p, rnd, { x: kx + W / 2, y: yy, z: kz + 0.15, nx: 1, nz: 0, s: 0.14, stones });
  }
  banner(p, { x: kx + W / 2 + 0.02, y: 0.66, z: kz - 0.25, ry: Math.PI / 2, w: 0.26, h: 0.5 });
  if (stage >= 4) banner(p, { x: kx - 0.32, y: top - 0.35, z: kz + W / 2 + 0.02, w: 0.24, h: 0.46 });
  if (stage >= 5) {
    // A roofed watch turret on the keep's back corner, gold-tipped.
    roof(p, { x: kx + 0.35, z: kz - 0.35, y: top + 0.22, r: 0.36, h: 0.7, sides: 12, mat: rnd.pick(SLATE), finial: M.gold });
    p.add(box(W + 0.18, 0.03, 0.01), M.gold, { x: kx, y: top + 0.12, z: kz + W / 2 + 0.09 });
  }
  const fx = hallEffects(stage);
  const ch = fx.chimney;
  stoneBlocks(p, { x: ch.x, z: ch.z, y: top + 0.23, w: 0.22, d: 0.22, h: ch.y - top - 0.29, rows: 2, rnd, stones, minBlock: 0.22, maxBlock: 0.22 });
  p.add(box(0.28, 0.06, 0.28), M.capstone, { x: ch.x, y: ch.y - 0.03, z: ch.z });
  const pen = fx.pennants[0];
  pennant(p, { x: pen.x, y: pen.y + 0.02 - 0.95, z: pen.z, h: 0.95, w: pen.w });
  // A timber-framed hall house in the yard (front right) from stage 2.
  p.add(box(0.72, 0.5, 0.6), M.plaster, { x: 0.82, y: 0.3, z: 0.62 });
  for (const sx of [-1, 1]) p.add(box(0.05, 0.5, 0.05), M.beam, { x: 0.82 + sx * 0.34, y: 0.3, z: 0.92 });
  p.add(box(0.72, 0.05, 0.02), M.beam, { x: 0.82, y: 0.32, z: 0.925 });
  p.add(cone(0.56, 0.36, 4), rnd.pick(ROOF_TILES), { x: 0.82, y: 0.73, z: 0.62, ry: Math.PI / 4, sz: 0.85 });
  barrel(p, { x: 0.3, y: 0.05, z: 1.0 });
  crate(p, { x: -0.95, y: 0.05, z: 0.95, ry: 0.3 });
  groundDressing(p, { w: 2.86, d: 2.86, rnd, count: 10 });
  return p.build();
}

/**
 * The Town Hall's chimney top and pennant pole top at `stage` (model coordinates, as CHIMNEYS and PENNANTS in
 * models.js are for stage 1).
 */
export function hallEffects(stage) {
  const { x: kx, z: kz } = HALL_KEEP;
  const top = HALL_TOP[stage - 1];
  return {
    chimney: { x: 0.3, y: top + 0.75, z: -0.55 },
    pennants: [{ x: kx - 0.4, y: top + 0.21 + 0.95 - 0.02, z: kz - 0.4, w: 0.44 }],
  };
}

// ------------------------------------------------------------------ walls

/** How many versions of each wall shape are baked at each stage (stone stages need fewer). */
export const STAGE_WALL_VARIANTS = [4, 4, 2, 2, 2];

/** Stage 2: planks and iron straps across the near face of a palisade run, on a stone footing. */
function reinforceRun(p, rnd, dx, dz, a, b) {
  const len = b - a;
  const mid = (a + b) / 2;
  const at = (d, side) => ({ x: dx ? dx * d : side, z: dz ? dz * d : side });
  for (const y of [0.3, 0.64]) p.add(box(dx ? len : 0.035, 0.15, dx ? 0.035 : len), MATERIALS.wood, { ...at(mid, 0.1), y });
  for (let d = a + 0.12; d < b; d += 0.24) p.add(box(dx ? 0.03 : 0.04, 0.5, dx ? 0.04 : 0.03), MATERIALS.iron, { ...at(d, 0.12), y: 0.46 });
  roughBlocks(p, { ...at(mid, 0), w: dx ? len : 0.3, d: dx ? 0.3 : len, h: 0.13, rows: 1, rnd, along: dx ? 'x' : 'z', minBlock: 0.14, maxBlock: 0.24 });
}

/** Stages 3 to 5: one stretch of stone wall along (dx, dz) from `a` to `b` tiles from the origin. */
function stoneRun(p, rnd, dx, dz, a, b, stage) {
  const len = b - a;
  const mid = (a + b) / 2;
  const at = (d, side = 0) => ({ x: dx ? dx * d : side, z: dz ? dz * d : side });
  const along = dx ? 'x' : 'z';
  const size = (l, w) => (dx ? { w: l, d: w } : { w, d: l });
  if (stage === 3) {
    // Dry stone: rough courses under a turf cap.
    roughBlocks(p, { ...at(mid), ...size(len, 0.36), h: 0.76, rows: 3, rnd, along, minBlock: 0.14, maxBlock: 0.28 });
    p.add(rbox(dx ? len + 0.01 : 0.38, 0.07, dx ? 0.38 : len + 0.01, 0.03), TURF, { ...at(mid), y: 0.79 });
    for (let i = 0; i < 3; i++) p.add(cone(0.035, 0.12, 4), TURF_DARK, { ...at(a + rnd.next() * len, rnd.range(-0.12, 0.12)), y: 0.86 });
    return;
  }
  const blocks = stonesFor(stage);
  const H = stage === 4 ? 1.02 : 1.3; // the wall walk
  const foot = stage === 4 ? 0.42 : 0.52;
  const thick = stage === 4 ? 0.34 : 0.42;
  roughBlocks(p, { ...at(mid), ...size(len, foot), h: 0.18, rows: 1, rnd, stones: blocks, along, minBlock: 0.16, maxBlock: 0.28 });
  if (stage === 4) p.add(box(dx ? len : thick, H - 0.18, dx ? thick : len), WORN_WALL, { ...at(mid), y: 0.18 + (H - 0.18) / 2 });
  else stoneBlocks(p, { ...at(mid), ...size(len, thick), y: 0.18, h: H - 0.18, rows: 4, rnd, stones: GREYSTONE, mortar: MATERIALS.mortarDark, along, minBlock: 0.18, maxBlock: 0.32 });
  p.add(box(dx ? len : thick + 0.04, 0.05, dx ? thick + 0.04 : len), trimFor(stage), { ...at(mid), y: H + 0.025 });
  // Merlons on a quarter-tile pitch, so they line up from tile to tile.
  const mh = stage === 4 ? 0.2 : 0.26;
  const mw = stage === 4 ? 0.13 : 0.15;
  for (let d = Math.ceil((a - 0.125) / 0.25) * 0.25 + 0.125; d < b - 0.03; d += 0.25) {
    if (d < a + 0.03) continue;
    p.add(rbox(dx ? mw : thick, mh, dx ? thick : mw, 0.03), rnd.pick(blocks), { ...at(d), y: H + 0.05 + mh / 2 });
  }
}

/** The square pier at a wall's centre (stone stages): where runs meet, turn or end; a small tower at stage 5. */
function stonePier(p, rnd, stage, tower) {
  if (stage === 3) {
    roughBlocks(p, { w: 0.4, d: 0.4, h: 0.8, rows: 3, rnd, minBlock: 0.16, maxBlock: 0.3 });
    p.add(rbox(0.42, 0.07, 0.42, 0.03), TURF, { y: 0.83 });
    return;
  }
  const H = stage === 4 ? 1.02 : 1.3;
  if (stage >= 5 && tower) {
    stoneBlocks(p, { w: 0.62, d: 0.62, h: 1.62, rows: 6, rnd, stones: GREYSTONE, mortar: MATERIALS.mortarDark, minBlock: 0.18, maxBlock: 0.3 });
    p.add(box(0.68, 0.05, 0.68), GREY_TRIM, { y: 1.645 });
    merlonsRect(p, { y: 1.67, w: 0.64, d: 0.64, size: 0.16, height: 0.24, spacing: 0.3, rnd, stones: GREYSTONE });
    return;
  }
  const w = stage === 4 ? 0.4 : 0.48;
  stoneBlocks(p, { w, d: w, h: H + 0.04, rows: 4, rnd, stones: stonesFor(stage), mortar: stage >= 5 ? MATERIALS.mortarDark : MATERIALS.mortar, minBlock: 0.14, maxBlock: 0.24 });
  p.add(box(w + 0.04, 0.05, w + 0.04), trimFor(stage), { y: H + 0.065 });
}

const DIRS = [['e', 1, 0], ['w', -1, 0], ['s', 0, 1], ['n', 0, -1]];

/** A wall tile at `stage` (2 to 5) joining up with its neighbours, like wall() in models.js. */
function stagedWall({ connections = {}, variant = 0, stage }) {
  if (stage === 2) {
    const g = wall({ connections, variant });
    const p = new Parts();
    const rnd = rng(variant * 17 + 401);
    const dirs = DIRS.filter(([k]) => connections[k]);
    for (const [, dx, dz] of dirs) reinforceRun(p, rnd, dx, dz, 0, 0.5);
    if (!dirs.length) reinforceRun(p, rnd, 1, 0, -0.36, 0.36);
    g.add(p.build());
    return g;
  }
  const p = new Parts();
  const key = ['n', 'e', 's', 'w'].map((d) => (connections[d] ? 1 : 0)).join('');
  const rnd = rng(parseInt(key, 2) * 11 + variant * 137 + stage * 1009);
  const dirs = DIRS.filter(([k]) => connections[k]);
  const straight = dirs.length === 2 && dirs[0][1] === -dirs[1][1] && dirs[0][2] === -dirs[1][2];
  for (const [, dx, dz] of dirs) stoneRun(p, rnd, dx, dz, 0.12, 0.5, stage);
  if (!dirs.length) stoneRun(p, rnd, 1, 0, -0.36, 0.36, stage);
  else if (straight) stoneRun(p, rnd, dirs[0][1], dirs[0][2], -0.13, 0.13, stage);
  if (!straight) stonePier(p, rnd, stage, true);
  groundDressing(p, { w: 0.6, d: 0.6, rnd, count: 3 });
  const g = p.build();
  g.userData.connections = connections;
  return g;
}

/** Where a wall at `stage` meets a building (see wallJoint in models.js). */
function stagedJoint({ dir = 'e', stage }) {
  if (stage === 2) {
    const g = wallJoint({ dir });
    const p = new Parts();
    const [dx, dz] = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] }[dir];
    reinforceRun(p, rng(403), dx, dz, 0.1, 0.5);
    g.add(p.build());
    return g;
  }
  const p = new Parts();
  const rnd = rng('nesw'.indexOf(dir) * 13 + 411 + stage);
  const [dx, dz] = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] }[dir];
  stoneRun(p, rnd, dx, dz, 0.12, 0.5, stage);
  stonePier(p, rnd, stage, false);
  return p.build();
}

/** One wall arm of a tower built into a wall, at the stage of the wall it joins (see createWallArm in models.js). */
export function createStagedWallArm(dir, from, straight, stage) {
  const p = new Parts();
  const rnd = rng('nesw'.indexOf(dir) * 31 + Math.round(from * 100) + (straight ? 7 : 0) + stage * 53);
  const len = straight ? 1 : 1.5;
  const [dx, dz] = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] }[dir];
  if (stage <= 2) {
    wallArm(p, rnd, dir, from, straight);
    if (stage === 2) reinforceRun(p, rnd, dx, dz, from, len);
  } else {
    stoneRun(p, rnd, dx, dz, from - 0.04, len, stage);
  }
  const inner = p.build();
  const mid = (from + len) / 2;
  inner.position.set(-dx * mid, 0, -dz * mid);
  const g = new THREE.Group();
  g.add(inner);
  return g;
}

// ------------------------------------------------------------------ the entry point

const STAGED = { archerTower: stagedArcherTower, cannonTower: stagedCannonTower, magicSpire: stagedMagicSpire, catapult: stagedCatapult };

/**
 * A building model at `stage`: like createBuildingModel (same `opts`), which it is at stage 1. A tower built into a
 * wall keeps its log bastion at stage 2; from 3 its stone model stands on the wall line by itself.
 */
export function createStagedModel(type, stage = 1, opts) {
  if (stage <= 1) return createBuildingModel(type, opts);
  if (type === 'wall') return stagedWall({ ...opts, stage });
  if (type === 'wallJoint') return stagedJoint({ ...opts, stage });
  if (type === 'townHall') return stagedTownHall(stage);
  const make = STAGED[type];
  if (!make) return createBuildingModel(type, opts);
  const inWall = opts?.inWall ? { inWall: opts.inWall, stubs: opts.stubs } : null;
  return make(stage, inWall);
}
