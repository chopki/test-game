import * as THREE from 'three';
import {
  BOULDER,
  GREYSTONE,
  MATERIALS,
  ROOF_TILES,
  Parts,
  SANDSTONE,
  banner,
  barrel,
  box,
  capsule,
  cone,
  crate,
  cyl,
  dodeca,
  foliage,
  door,
  groundDressing,
  merlonsRect,
  octa,
  pennant,
  place,
  rbox,
  rng,
  sphere,
  std,
  stoneBlocks,
  torus,
  windowFrame,
} from './modelKit.js';

// The game's models, built after docs/reference/art-style.jpg: block-laid sandstone, red clay shingles, timber
// and logs, chunky crenellations, blocky olive trees, green goblins and orcs, grey trolls.
//
// These are only rendered when sprites are baked (see spriteBaker.js), so they can be as detailed as needed.
// Parts that move in game (turrets, the catapult arm, the spire crystal) are exposed on userData and baked
// separately in their poses. +z and +x are the faces the iso camera sees, so most detail goes there.

// ------------------------------------------------------------------ buildings

// Every building is drawn at its first upgrade stage ("Stage 1" in the reference's upgrade rows): a small stone
// keep in a fenced yard, a wooden watchtower, a cannon on a low plinth, a crystal-studded mound, a plain wooden
// catapult, and a log palisade. Later stages arrive with upgrades.

/** Low fence of posts and two rails along a side, from (x0, z0) to (x1, z1), skipping the gap [gapFrom, gapTo] (0..1). */
function fence(p, { x0, z0, x1, z1, rnd, gapFrom = 2, gapTo = 2, h = 0.42 }) {
  const M = MATERIALS;
  const len = Math.hypot(x1 - x0, z1 - z0);
  const ry = Math.atan2(x1 - x0, z1 - z0);
  const posts = Math.max(2, Math.round(len / 0.32) + 1);
  const at = (t) => ({ x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t });
  for (let i = 0; i < posts; i++) {
    const t = i / (posts - 1);
    if (t > gapFrom && t < gapTo) continue;
    const ph = h * rnd.range(0.95, 1.1);
    p.add(box(0.07, ph, 0.07), M.woodDark, { ...at(t), y: ph / 2, ry });
  }
  // Rails, split around the gap.
  const spans = gapFrom < 1 ? [[0, gapFrom], [gapTo, 1]] : [[0, 1]];
  for (const [t0, t1] of spans) {
    const mid = at((t0 + t1) / 2);
    const l = len * (t1 - t0);
    for (const y of [h * 0.35, h * 0.8]) p.add(box(0.04, 0.06, l), M.wood, { ...mid, y, ry });
  }
}

function townHall() {
  const M = MATERIALS;
  const p = new Parts();
  const rnd = rng(11);
  // Packed-earth yard inside a low wooden fence (gate gap at the front).
  p.add(box(2.86, 0.05, 2.86), M.dirt, { y: 0.025 });
  const e = 1.38;
  fence(p, { x0: -e, z0: -e, x1: e, z1: -e, rnd });
  fence(p, { x0: -e, z0: -e, x1: -e, z1: e, rnd });
  fence(p, { x0: e, z0: -e, x1: e, z1: e, rnd });
  fence(p, { x0: -e, z0: e, x1: e, z1: e, rnd, gapFrom: 0.38, gapTo: 0.62 });
  // Square stone keep, set back in the yard: a plinth, two storeys of courses, corbels and battlements.
  const kx = -0.12;
  const kz = -0.2;
  const W = 1.5;
  stoneBlocks(p, { x: kx, z: kz, y: 0.05, w: W + 0.16, d: W + 0.16, h: 0.18, rows: 1, rnd, minBlock: 0.3, maxBlock: 0.5 });
  const courses = 9;
  const top = 2.25;
  for (let i = 0; i < courses; i++) {
    const rowH = (top - 0.23) / courses;
    stoneBlocks(p, { x: kx, z: kz, y: 0.23 + i * rowH, w: W, d: W, h: rowH, rows: 1, along: i % 2 ? 'x' : 'z', rnd });
  }
  // A string course between the storeys.
  p.add(box(W + 0.06, 0.06, W + 0.06), M.capstone, { x: kx, y: 1.2, z: kz });
  for (let i = 0; i < 5; i++) {
    const t = -0.5 + (i + 0.5) / 5;
    for (const [x, z] of [
      [t * W, W / 2],
      [W / 2, t * W],
      [t * W, -W / 2],
      [-W / 2, t * W],
    ]) {
      p.add(box(0.13, 0.15, 0.13), rnd.pick(SANDSTONE), { x: kx + x * 1.04, y: top - 0.02, z: kz + z * 1.04 });
    }
  }
  stoneBlocks(p, { x: kx, z: kz, y: top + 0.05, w: W + 0.18, d: W + 0.18, h: 0.16, rows: 1, rnd, minBlock: 0.3, maxBlock: 0.5 });
  merlonsRect(p, { x: kx, z: kz, y: top + 0.21, w: W + 0.18, d: W + 0.18, size: 0.22, height: 0.3, spacing: 0.38, rnd });
  p.add(box(W, 0.04, W), M.woodLight, { x: kx, y: top + 0.22, z: kz });
  // Door, windows and a banner on the faces the camera sees.
  door(p, { x: kx, y: 0.23, z: kz + W / 2 + 0.01, w: 0.42, h: 0.66 });
  for (const x of [-0.42, 0.42]) windowFrame(p, { x: kx + x, y: 1.62, z: kz + W / 2 + 0.01, w: 0.2, h: 0.3, shutters: true });
  windowFrame(p, { x: kx + W / 2 + 0.01, y: 1.62, z: kz, ry: Math.PI / 2, w: 0.2, h: 0.3 });
  windowFrame(p, { x: kx + W / 2 + 0.01, y: 0.8, z: kz + 0.3, ry: Math.PI / 2, w: 0.16, h: 0.24, shutters: false });
  banner(p, { x: kx + W / 2 + 0.02, y: 1.05, z: kz - 0.35, ry: Math.PI / 2, w: 0.26, h: 0.55 });
  pennant(p, { x: kx - 0.5, y: top + 0.22, z: kz - 0.5, h: 0.95, w: 0.44 });
  // A lean-to shed against the fence, and yard clutter.
  p.add(box(0.7, 0.5, 0.5), M.wood, { x: 0.95, y: 0.28, z: -0.95 });
  p.add(box(0.82, 0.05, 0.64), M.woodDark, { x: 0.95, y: 0.56, z: -0.92, rx: 0.25 });
  barrel(p, { x: 0.95, y: 0.05, z: 0.55 });
  barrel(p, { x: 1.12, y: 0.05, z: 0.78, r: 0.11, h: 0.26 });
  crate(p, { x: -0.95, y: 0.05, z: 0.95, ry: 0.3 });
  crate(p, { x: -0.72, y: 0.05, z: 1.05, s: 0.2, ry: 0.9 });
  p.add(box(0.36, 0.22, 0.24), std({ color: 0xc9a54a }), { x: 0.65, y: 0.16, z: 0.95, ry: 0.4 }); // hay bale
  groundDressing(p, { w: 2.86, d: 2.86, rnd, count: 10 });
  return p.build();
}

/** Peeled logs, light brown like the reference's palisade. */
const LOGS = ['#a57444', '#b0804e', '#99683c'].map((c) => foliage(c));

/**
 * A wooden palisade tile that joins up with its neighbours. `connections` = { n, e, s, w } booleans: true where
 * the neighbouring tile has a wall, another building or rock. Logs sit on a 1/7-tile pitch, so runs of tiles
 * line up seamlessly.
 */
function wall({ connections = {} } = {}) {
  const M = MATERIALS;
  const p = new Parts();
  const key = ['n', 'e', 's', 'w'].map((d) => (connections[d] ? 1 : 0)).join('');
  const rnd = rng(parseInt(key, 2) + 101);
  const dirs = [
    ['e', 1, 0],
    ['w', -1, 0],
    ['s', 0, 1],
    ['n', 0, -1],
  ].filter(([k]) => connections[k]);
  const PITCH = 1 / 7;
  const logs = [];
  const log = (x, z, r = 0.075) => logs.push({ x, z, r });
  log(0, 0, dirs.length === 2 && dirs[0][1] === -dirs[1][1] && dirs[0][2] === -dirs[1][2] ? 0.075 : 0.095);
  for (const [, dx, dz] of dirs) {
    for (let i = 1; i <= 3; i++) log(dx * i * PITCH, dz * i * PITCH);
    // Rails on both faces of the run.
    for (const side of [-1, 1]) {
      const off = side * 0.085;
      for (const y of [0.32, 0.82]) {
        p.add(box(dx ? 0.5 : 0.05, 0.07, dx ? 0.05 : 0.5), M.woodDark, { x: dx ? dx * 0.25 : off, y, z: dz ? dz * 0.25 : off });
      }
    }
  }
  if (dirs.length === 0) {
    // A lone stretch: a short run of logs with braces.
    for (const i of [-2, -1, 1, 2]) log(i * PITCH, 0);
    for (const side of [-1, 1]) p.add(box(0.07, 0.07, 0.6), M.woodDark, { x: side * 0.3, y: 0.3, z: 0.18, rx: 0.9 });
    for (const y of [0.32, 0.82]) p.add(box(0.62, 0.07, 0.05), M.woodDark, { y, z: 0.085 });
  }
  for (const { x, z, r } of logs) {
    const h = rnd.range(1.0, 1.22) + (r > 0.08 ? 0.1 : 0);
    const tilt = { rx: rnd.range(-0.04, 0.04), rz: rnd.range(-0.04, 0.04) };
    const mat = rnd.pick(LOGS);
    p.add(cyl(r, r * 1.05, h, 8), mat, { x, y: h / 2, z, ...tilt, ry: rnd.range(0, 3) });
    p.add(cone(r, 0.2, 8), mat, { x, y: h + 0.1, z, ...tilt });
  }
  // Earth banked against the foot of the logs.
  p.add(box(0.3, 0.06, 0.3), M.dirt, { y: 0.03 });
  for (const [, dx, dz] of dirs) p.add(box(dx ? 0.5 : 0.28, 0.06, dx ? 0.28 : 0.5), M.dirt, { x: dx * 0.25, y: 0.03, z: dz * 0.25 });
  groundDressing(p, { w: 0.6, d: 0.6, rnd, count: 3 });
  const g = p.build();
  g.userData.connections = connections;
  return g;
}

/**
 * Where a wall meets a tower or the Town Hall: drawn in the building's edge tile, it carries the palisade on
 * into the building and ends it at a tall, iron-banded post on a stone footing, so the wall looks anchored to
 * the building rather than stopping short. `dir` ('n', 'e', 's' or 'w') points from the building out to the wall.
 */
function wallJoint({ dir = 'e' } = {}) {
  const M = MATERIALS;
  const p = new Parts();
  const rnd = rng('nesw'.indexOf(dir) * 13 + 211);
  const [dx, dz] = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] }[dir];
  const PITCH = 1 / 7;
  // The palisade arm, matching wall tiles (same log pitch, rails and banked earth).
  for (let i = 1; i <= 3; i++) {
    const h = rnd.range(1.0, 1.22);
    const mat = rnd.pick(LOGS);
    const tilt = { rx: rnd.range(-0.04, 0.04), rz: rnd.range(-0.04, 0.04) };
    p.add(cyl(0.075, 0.079, h, 8), mat, { x: dx * i * PITCH, y: h / 2, z: dz * i * PITCH, ...tilt, ry: rnd.range(0, 3) });
    p.add(cone(0.075, 0.2, 8), mat, { x: dx * i * PITCH, y: h + 0.1, z: dz * i * PITCH, ...tilt });
  }
  for (const side of [-1, 1]) {
    const off = side * 0.085;
    for (const y of [0.32, 0.82]) p.add(box(dx ? 0.5 : 0.05, 0.07, dx ? 0.05 : 0.5), M.woodDark, { x: dx ? dx * 0.25 : off, y, z: dz ? dz * 0.25 : off });
  }
  p.add(box(dx ? 0.5 : 0.28, 0.06, dx ? 0.28 : 0.5), M.dirt, { x: dx * 0.25, y: 0.03, z: dz * 0.25 });
  // Anchor post: stone footing and a thick log with iron bands.
  stoneBlocks(p, { w: 0.38, d: 0.38, h: 0.18, rows: 1, rnd, minBlock: 0.18, maxBlock: 0.24 });
  p.add(cyl(0.12, 0.13, 1.42, 10), rnd.pick(LOGS), { y: 0.18 + 0.71 });
  p.add(cone(0.12, 0.24, 10), rnd.pick(LOGS), { y: 0.18 + 1.42 + 0.12 });
  for (const y of [0.45, 1.25]) p.add(torus(0.125, 0.022, 12), M.iron, { y, rx: Math.PI / 2 });
  return p.build();
}

/** A small archer figure (for the archer tower's fighting platform). */
function archer(p, { x, y, z, ry = 0 }) {
  const M = MATERIALS;
  p.add(capsule(0.07, 0.14), M.clothBlue, { x, y: y + 0.15, z });
  p.add(sphere(0.06, 8, 6), std({ color: 0xe2b48a }), { x, y: y + 0.32, z });
  p.add(cone(0.075, 0.09, 8), M.leatherDark, { x, y: y + 0.39, z });
  const bow = place(x, z, ry, 0.08, 0.04);
  p.add(torus(0.12, 0.012, 10), M.woodDark, { x: bow.x, y: y + 0.2, z: bow.z, ry: ry + Math.PI / 2, sx: 0.5 });
}

/** Wooden watchtower: braced log legs on stone footings, a plank cabin and a pyramid shingle roof. */
function archerTower() {
  const M = MATERIALS;
  const p = new Parts();
  const rnd = rng(23);
  const foot = 0.58;
  const head = 0.46;
  const deck = 1.55;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      stoneBlocks(p, { x: sx * foot, z: sz * foot, w: 0.24, d: 0.24, h: 0.14, rows: 1, rnd });
      // Leg leaning in from the footing to the deck corner.
      const lean = Math.atan2(foot - head, deck);
      p.add(box(0.12, deck + 0.1, 0.12), M.wood, { x: sx * (foot + head) / 2, y: 0.14 + deck / 2, z: sz * (foot + head) / 2, rx: -sz * lean, rz: sx * lean });
    }
  }
  // Cross braces on each face, and a mid rail.
  const midW = (foot + head) / 2;
  for (const [ry, fx, fz] of [
    [0, 0, 1],
    [0, 0, -1],
    [Math.PI / 2, 1, 0],
    [Math.PI / 2, -1, 0],
  ]) {
    const at = { x: fx * midW, z: fz * midW };
    for (const s of [-1, 1]) p.add(box(0.06, 1.55, 0.05), M.woodDark, { ...at, y: 0.85, ry, rz: s * 0.62, order: 'YZX' });
    p.add(box(0.06, 0.07, midW * 2), M.woodDark, { ...at, y: 0.85, ry: ry + Math.PI / 2 });
  }
  // Ladder up the front.
  for (const sx of [-0.13, 0.13]) p.add(box(0.04, 1.6, 0.04), M.woodLight, { x: sx, y: 0.85, z: foot + 0.06, rx: -0.12 });
  for (let i = 0; i < 6; i++) p.add(box(0.26, 0.03, 0.03), M.woodLight, { y: 0.25 + i * 0.25, z: foot + 0.06 - (0.25 + i * 0.25 - 0.85) * 0.12 });
  // Deck, plank cabin with lookout gaps, and the roof.
  p.add(box(1.22, 0.1, 1.22), M.woodDark, { y: deck + 0.14 });
  const cab = 1.1;
  const cabH = 0.6;
  const y0 = deck + 0.19;
  for (const [ry, fx, fz] of [
    [0, 0, 1],
    [0, 0, -1],
    [Math.PI / 2, 1, 0],
    [Math.PI / 2, -1, 0],
  ]) {
    // Lower boards, two corner posts, and a lintel: leaves a wide window to shoot from.
    p.add(box(cab, 0.32, 0.06), M.wood, { x: (fx * cab) / 2, y: y0 + 0.16, z: (fz * cab) / 2, ry });
    p.add(box(cab, 0.1, 0.06), M.wood, { x: (fx * cab) / 2, y: y0 + cabH - 0.05, z: (fz * cab) / 2, ry });
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.add(box(0.09, cabH, 0.09), M.woodDark, { x: (sx * cab) / 2, y: y0 + cabH / 2, z: (sz * cab) / 2 });
  archer(p, { x: 0.18, y: y0, z: 0.2, ry: Math.PI / 4 });
  archer(p, { x: -0.22, y: y0, z: -0.15, ry: -Math.PI / 3 });
  p.add(cone(0.98, 0.78, 4), rnd.pick(ROOF_TILES), { y: y0 + cabH + 0.36, ry: Math.PI / 4 });
  p.add(box(0.08, 0.2, 0.08), M.woodDark, { y: y0 + cabH + 0.82 });
  groundDressing(p, { w: 1.72, d: 1.72, rnd, count: 9 });
  return p.build();
}

/** A cannon on a low, squat stone plinth. */
function cannonTower() {
  const M = MATERIALS;
  const p = new Parts();
  const rnd = rng(37);
  stoneBlocks(p, { w: 1.62, d: 1.62, h: 0.26, rows: 1, rnd, minBlock: 0.32, maxBlock: 0.52 });
  stoneBlocks(p, { y: 0.26, w: 1.36, d: 1.36, h: 0.24, rows: 1, along: 'z', rnd, minBlock: 0.3, maxBlock: 0.48 });
  stoneBlocks(p, { y: 0.5, w: 1.14, d: 1.14, h: 0.2, rows: 1, rnd, minBlock: 0.28, maxBlock: 0.44 });
  p.add(box(1.2, 0.06, 1.2), M.capstone, { y: 0.73 });
  p.add(cyl(0.48, 0.48, 0.03, 18), M.woodDark, { y: 0.77 });
  // Cannonballs and a powder keg on the lower step.
  for (const [x, z, y] of [
    [-0.66, 0.42, 0],
    [-0.66, 0.28, 0],
    [-0.66, 0.35, 0.1],
  ]) {
    p.add(sphere(0.07, 8, 6), M.cannonball, { x, y: 0.33 + y, z });
  }
  barrel(p, { x: 0.62, y: 0.26, z: -0.6, r: 0.1, h: 0.22 });
  groundDressing(p, { w: 1.7, d: 1.7, rnd, count: 9 });
  const g = p.build();
  const turret = cannonTurret(0.78);
  g.add(turret);
  g.userData.turret = turret;
  return g;
}

/** A stubby iron cannon on a wooden block carriage, at height `y`; rotates to aim (+z is forward). */
function cannonTurret(y) {
  const M = MATERIALS;
  const t = new Parts({ yOffset: y });
  t.add(box(0.46, 0.2, 0.62), M.wood, { y: 0.1 });
  for (const sx of [-0.2, 0.2]) t.add(box(0.06, 0.3, 0.5), M.woodDark, { x: sx, y: 0.22 });
  for (const sx of [-0.27, 0.27]) for (const sz of [-0.2, 0.2]) t.add(cyl(0.09, 0.09, 0.06, 10), M.woodDark, { x: sx, y: 0.09, z: sz, rz: Math.PI / 2 });
  t.add(cyl(0.12, 0.17, 0.82, 14), M.iron, { y: 0.34, z: 0.14, rx: Math.PI / 2 - 0.15 });
  for (const zz of [0.5, 0.0]) t.add(torus(0.16, 0.03, 14), M.iron, { y: 0.34 + (zz - 0.14) * Math.sin(0.15), z: zz, rx: -0.15 });
  t.add(sphere(0.18, 12, 9), M.iron, { y: 0.3, z: -0.26 });
  const turret = t.build();
  turret.position.y = y;
  return turret;
}

function crystalCluster(p, { x, y, z, scale = 1, rnd }) {
  const M = MATERIALS;
  for (let i = 0; i < 3; i++) {
    p.add(octa(0.09 * scale * rnd.range(0.7, 1.2)), M.crystal, {
      x: x + rnd.range(-0.05, 0.05) * scale,
      y: y + 0.08 * scale,
      z: z + rnd.range(-0.05, 0.05) * scale,
      sy: rnd.range(1.6, 2.4),
      rx: rnd.range(-0.4, 0.4),
      rz: rnd.range(-0.4, 0.4),
    });
  }
}

/** A low, rune-carved stone mound studded with glowing crystals. */
function magicSpire() {
  const M = MATERIALS;
  const p = new Parts();
  const rnd = rng(41);
  const stones = [...GREYSTONE.slice(0, 2), ...SANDSTONE.slice(0, 2)];
  let y = 0;
  for (const [w, h] of [
    [1.6, 0.22],
    [1.28, 0.22],
    [0.96, 0.2],
  ]) {
    stoneBlocks(p, { y, w, d: w, h, rows: 1, rnd, stones, mortar: M.mortarDark, minBlock: 0.24, maxBlock: 0.4 });
    for (const [rx, rz, ry] of [
      [0, w / 2 + 0.01, 0],
      [w / 2 + 0.01, 0, Math.PI / 2],
    ]) {
      for (const k of [-0.25, 0.25]) {
        const at = place(rx, rz, ry, k * w, 0);
        p.add(box(0.1, 0.05, 0.02), M.rune, { x: at.x, y: y + h / 2, z: at.z, ry });
      }
    }
    y += h;
  }
  // The mound rises in smaller rounded stones to a capstone.
  for (const [w, h] of [
    [0.7, 0.18],
    [0.46, 0.16],
  ]) {
    stoneBlocks(p, { y, w, d: w, h, rows: 1, rnd, stones, mortar: M.mortarDark, minBlock: 0.16, maxBlock: 0.26 });
    y += h;
  }
  p.add(rbox(0.32, 0.16, 0.32, 0.07), rnd.pick(GREYSTONE), { y: y + 0.08, ry: Math.PI / 4 });
  // Crystal shards breaking out of the corners of each step.
  for (const [w, yy] of [
    [1.6, 0.22],
    [1.28, 0.44],
  ]) {
    for (const [sx, sz] of [
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ]) {
      crystalCluster(p, { x: (sx * w) / 2 - sx * 0.12, y: yy - 0.04, z: (sz * w) / 2 - sz * 0.12, rnd, scale: w > 1.5 ? 1.1 : 0.9 });
    }
  }
  groundDressing(p, { w: 1.7, d: 1.7, rnd, count: 8 });
  const g = p.build();
  // Central crystal, baked separately and bobbed in game.
  const c = new Parts({ yOffset: 1.3 });
  c.add(octa(0.18), M.crystal, { sy: 1.7 });
  for (const a of [0, 2.1, 4.2]) c.add(octa(0.06), M.crystal, { x: Math.cos(a) * 0.15, y: -0.12, z: Math.sin(a) * 0.15, sy: 1.8, rz: Math.cos(a) * 0.4, rx: Math.sin(a) * 0.4 });
  const crystal = c.build();
  crystal.position.y = 1.3;
  g.add(crystal);
  g.userData.crystal = crystal;
  return g;
}

/** A plain wooden catapult on four chunky wheels. */
function catapult() {
  const M = MATERIALS;
  const p = new Parts();
  const rnd = rng(53);
  for (const [x, z, r] of [
    [-0.62, -0.5, 0.13],
    [-0.5, -0.64, 0.11],
    [-0.66, -0.66, 0.1],
    [-0.58, -0.56, 0.09],
  ]) {
    p.add(dodeca(r), M.boulder, { x, y: r * 0.8 + (r < 0.1 ? 0.1 : 0), z });
  }
  p.add(box(1.5, 0.03, 1.5), M.dirt, { y: 0.015 });
  groundDressing(p, { w: 1.7, d: 1.7, rnd, count: 8 });
  const g = p.build();
  addCatapultTurret(g, 0);
  return g;
}

/** The catapult itself (frame on wheels, rotating to aim with +z forward, carrying the throwing arm) at `y`. */
function addCatapultTurret(g, y) {
  const M = MATERIALS;
  const t = new Parts({ yOffset: y });
  for (const sx of [-0.36, 0.36]) {
    t.add(box(0.14, 0.14, 1.3), M.wood, { x: sx, y: 0.28 });
    // A-frame uprights to the axle.
    t.add(box(0.11, 0.66, 0.11), M.wood, { x: sx, y: 0.56, z: -0.16, rx: 0.4 });
    t.add(box(0.11, 0.66, 0.11), M.wood, { x: sx, y: 0.56, z: 0.16, rx: -0.4 });
    for (const sz of [-0.45, 0.45]) {
      const wx = sx + Math.sign(sx) * 0.12;
      t.add(cyl(0.2, 0.2, 0.1, 14), M.woodDark, { x: wx, y: 0.2, z: sz, rz: Math.PI / 2 });
      t.add(cyl(0.07, 0.07, 0.12, 8), M.iron, { x: wx + Math.sign(sx) * 0.01, y: 0.2, z: sz, rz: Math.PI / 2 });
    }
  }
  for (const sz of [-0.58, 0.58]) t.add(box(0.86, 0.12, 0.12), M.wood, { y: 0.3, z: sz });
  t.add(cyl(0.05, 0.05, 0.86, 8), M.iron, { y: 0.84, rz: Math.PI / 2 });
  t.add(box(0.8, 0.12, 0.12), M.woodDark, { y: 0.72, z: 0.4 }); // stop beam the arm hits
  t.add(torus(0.07, 0.025, 10), M.rope, { x: 0.18, y: 0.84, ry: Math.PI / 2 });
  t.add(torus(0.07, 0.025, 10), M.rope, { x: -0.18, y: 0.84, ry: Math.PI / 2 });
  const turret = t.build();
  turret.position.y = y;

  // Throwing arm: pivots at the axle; the spoon end points to -z when loaded.
  const a = new Parts({ yOffset: y + 0.84 });
  a.add(box(0.11, 0.11, 1.2), M.woodDark, { z: -0.42 });
  a.add(cyl(0.16, 0.1, 0.12, 12), M.wood, { y: 0.05, z: -1.0 });
  a.add(torus(0.15, 0.02, 12), M.iron, { y: 0.1, z: -1.0, rx: Math.PI / 2 });
  const arm = a.build();
  arm.position.y = 0.84;
  const ammo = new Parts({ yOffset: y + 1.0 }).add(dodeca(0.12), M.boulder).build();
  ammo.position.set(0, 0.18, -1.0);
  arm.add(ammo);
  turret.add(arm);
  g.add(turret);
  Object.assign(g.userData, { turret, arm, ammo });
}

// ------------------------------------------------------------------ towers built into walls
// A tower built into a wall is drawn on the wall line (see wallSeat.js) with a model of its own: the palisade
// widens into a square log bastion around it, and wall stubs run out to where the neighbouring wall tiles begin.
// `shape` names the arms: 'we' / 'ns' for a straight run, or a corner such as 'ws' (arms west and south).
// Straight-run arms reach 1 tile from the tower's centre; corner arms 1.5 (the tower sits on the corner tile).

export const IN_WALL_SHAPES = ['we', 'ns', 'wn', 'ws', 'en', 'es'];
const ARM = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };

function palisadeLog(p, rnd, x, z, { r = 0.075, h = rnd.range(1.0, 1.22) } = {}) {
  const mat = rnd.pick(LOGS);
  const tilt = { rx: rnd.range(-0.04, 0.04), rz: rnd.range(-0.04, 0.04) };
  p.add(cyl(r, r * 1.05, h, 8), mat, { x, y: h / 2, z, ...tilt, ry: rnd.range(0, 3) });
  p.add(cone(r, 0.2, 8), mat, { x, y: h + 0.1, z, ...tilt });
}

/**
 * A square log bastion of half-width `r`: logs on every side, thick iron-banded corner posts and rails. With
 * `deck`, it's filled with earth and planked over at that height (a rampart for a gun to stand on).
 */
function bastion(p, rnd, { r, h = 1.15, deck = 0 }) {
  const M = MATERIALS;
  const n = Math.max(2, Math.round((2 * r) / (1 / 7)));
  for (let i = 0; i < n; i++) {
    const t = -r + ((i + 0.5) * 2 * r) / n;
    for (const [x, z] of [
      [t, r],
      [t, -r],
      [r, t],
      [-r, t],
    ]) {
      palisadeLog(p, rnd, x, z, { h: h * rnd.range(0.92, 1.05) });
    }
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      p.add(cyl(0.11, 0.12, h + 0.25, 10), rnd.pick(LOGS), { x: sx * r, y: (h + 0.25) / 2, z: sz * r });
      p.add(cone(0.11, 0.22, 10), rnd.pick(LOGS), { x: sx * r, y: h + 0.36, z: sz * r });
      for (const y of [0.35, h - 0.1]) p.add(torus(0.115, 0.02, 12), M.iron, { x: sx * r, y, z: sz * r, rx: Math.PI / 2 });
    }
  }
  for (const y of [0.32, 0.82].filter((y) => y < h - 0.1)) {
    for (const s of [-1, 1]) {
      p.add(box(2 * r, 0.07, 0.05), M.woodDark, { y, z: s * (r + 0.085) });
      p.add(box(0.05, 0.07, 2 * r), M.woodDark, { x: s * (r + 0.085), y });
    }
  }
  if (deck) {
    p.add(box(2 * r - 0.1, deck - 0.02, 2 * r - 0.1), M.dirt, { y: (deck - 0.02) / 2 });
    p.add(box(2 * r + 0.06, 0.06, 2 * r + 0.06), M.woodDark, { y: deck });
    for (let i = 0; i < 6; i++) p.add(box(0.02, 0.01, 2 * r), M.wood, { x: -r + ((i + 0.5) * 2 * r) / 6, y: deck + 0.035 });
  }
  p.add(box(2 * r + 0.3, 0.05, 2 * r + 0.3), M.dirt, { y: 0.025 });
}

/** Palisade stubs from the bastion (half-width `from`) out along each arm of `shape`, on the wall's log grid. */
function wallStubs(p, rnd, shape, from) {
  const M = MATERIALS;
  const straight = shape === 'we' || shape === 'ns';
  const len = straight ? 1 : 1.5;
  // Wall tiles put logs at (tile + (j + 0.5) / 7); measured from the tower's drawn centre, that grid is offset
  // by 0 for a straight run (centre on a tile edge) and 0.5 for a corner (centre on a tile centre).
  const shift = straight ? 0 : 0.5;
  for (const dir of shape) {
    const [dx, dz] = ARM[dir];
    for (let j = 0; j < 14; j++) {
      const d = (j + 0.5) / 7 - shift;
      if (d > from + 0.03 && d < len) palisadeLog(p, rnd, dx * d, dz * d);
    }
    const mid = (from + len) / 2;
    const l = len - from;
    for (const side of [-1, 1]) {
      const off = side * 0.085;
      for (const y of [0.32, 0.82]) p.add(box(dx ? l : 0.05, 0.07, dx ? 0.05 : l), M.woodDark, { x: dx ? dx * mid : off, y, z: dz ? dz * mid : off });
    }
    p.add(box(dx ? l : 0.28, 0.06, dx ? 0.28 : l), M.dirt, { x: dx * mid, y: 0.03, z: dz * mid });
  }
}

function inWallParts(shape, r, opts) {
  const p = new Parts();
  const rnd = rng(IN_WALL_SHAPES.indexOf(shape) * 17 + Math.round(r * 100));
  bastion(p, rnd, { r, ...opts });
  wallStubs(p, rnd, shape, r);
  return p.build();
}

const IN_WALL_MODELS = {
  // The watchtower's legs rise out of the bastion; its cabin looks out over the wall.
  archerTower: (shape) => {
    const g = archerTower();
    g.add(inWallParts(shape, 0.72, { h: 1.15 }));
    return g;
  },
  // The cannon stands on a raised log-and-earth rampart in the wall.
  cannonTower: (shape) => {
    const g = new THREE.Group();
    g.add(inWallParts(shape, 0.74, { h: 1.0, deck: 0.98 }));
    const balls = new Parts({ yOffset: 1.0 });
    for (const [x, z, y] of [
      [-0.5, 0.45, 0],
      [-0.5, 0.31, 0],
      [-0.5, 0.38, 0.1],
    ]) {
      balls.add(sphere(0.07, 8, 6), MATERIALS.cannonball, { x, y: 0.07 + y, z });
    }
    const b = balls.build();
    b.position.y = 1.01;
    g.add(b);
    const turret = cannonTurret(1.02);
    g.add(turret);
    g.userData.turret = turret;
    return g;
  },
  // The crystal mound sits inside a low bastion ring.
  magicSpire: (shape) => {
    const g = magicSpire();
    g.add(inWallParts(shape, 0.88, { h: 0.72 }));
    return g;
  },
  // The catapult works from a rampart platform in the wall.
  catapult: (shape) => {
    const g = new THREE.Group();
    g.add(inWallParts(shape, 0.8, { h: 0.86, deck: 0.86 }));
    const pile = new Parts({ yOffset: 0.9 });
    for (const [x, z, r] of [
      [-0.55, -0.5, 0.11],
      [-0.45, -0.6, 0.09],
    ]) {
      pile.add(dodeca(r), MATERIALS.boulder, { x, y: r * 0.8, z });
    }
    const pb = pile.build();
    pb.position.y = 0.89;
    g.add(pb);
    addCatapultTurret(g, 0.89);
    return g;
  },
};

const BUILDING_MODELS = { townHall, wall, wallJoint, archerTower, cannonTower, magicSpire, catapult };

/**
 * `opts` is model-specific: walls take `{ connections }`, wall joints `{ dir }`, and towers `{ inWall: shape }`
 * for the version built into a wall (see IN_WALL_SHAPES).
 */
export function createBuildingModel(type, opts) {
  if (opts?.inWall) return IN_WALL_MODELS[type](opts.inWall);
  return BUILDING_MODELS[type](opts);
}

// ------------------------------------------------------------------ enemies
// Enemies are rigs, so the baker can pose them for walk, attack and death frames (see poseEnemy):
//
//   root          (feet on the ground, faces +z; the catalogue turns it to each heading)
//   └ figure      (tips over when dying)
//     ├ legs[0..1] pivot at the hips
//     └ body       pivot at the hips: torso and head
//       └ arms[0..1] pivot at the shoulders; arms[1] (right) holds the weapon
//
// Each part is built in its own Parts, in coordinates relative to its pivot.

/** Frames baked per animation. */
export const ENEMY_ANIMS = { walk: 6, attack: 4, death: 4 };

function rig({ hipY, legX, buildLeg, buildBody, shoulder, buildArm, crown }) {
  const root = new THREE.Group();
  const figure = new THREE.Group();
  root.add(figure);
  const legs = [-1, 1].map((s) => {
    const p = new Parts({ yOffset: hipY });
    buildLeg(p, s);
    const leg = p.build();
    leg.position.set(s * legX, hipY, 0);
    figure.add(leg);
    return leg;
  });
  const bp = new Parts({ yOffset: hipY });
  buildBody(bp);
  const body = bp.build();
  body.position.y = hipY;
  figure.add(body);
  const arms = [-1, 1].map((s) => {
    const p = new Parts({ yOffset: hipY + shoulder.y });
    buildArm(p, s);
    const arm = p.build();
    arm.position.set(s * shoulder.x, shoulder.y, shoulder.z);
    body.add(arm);
    return arm;
  });
  root.userData.rig = { figure, legs, body, arms, hipY, crown };
  root.userData.body = body;
  return root;
}

function goblinHead(p, { y, z = 0.02, s = 1 }) {
  const M = MATERIALS;
  p.add(sphere(0.15 * s, 12, 9), M.goblinSkin, { y, z, sy: 0.92 });
  for (const side of [-1, 1]) {
    p.add(cone(0.05 * s, 0.26 * s, 6), M.goblinSkin, { x: side * 0.18 * s, y: y + 0.04 * s, z: z - 0.02, rz: -side * 1.3, rx: -0.2 });
    p.add(sphere(0.028 * s, 6, 5), M.eyes, { x: side * 0.055 * s, y: y + 0.025 * s, z: z + 0.125 * s });
  }
  p.add(cone(0.035 * s, 0.12 * s, 6), M.goblinSkinDark, { y: y - 0.02 * s, z: z + 0.17 * s, rx: Math.PI / 2 - 0.3 });
  p.add(box(0.12 * s, 0.025 * s, 0.03 * s), M.leatherDark, { y: y - 0.07 * s, z: z + 0.12 * s });
}

function grunt() {
  const M = MATERIALS;
  return rig({
    hipY: 0.24,
    legX: 0.08,
    buildLeg: (p) => {
      p.add(capsule(0.045, 0.18), M.goblinSkinDark, { y: -0.11 });
      p.add(box(0.08, 0.05, 0.12), M.leatherDark, { y: -0.215, z: 0.02 });
    },
    buildBody: (p) => {
      p.add(box(0.26, 0.12, 0.18), M.cloth, { y: 0.04 }); // loincloth
      p.add(capsule(0.13, 0.14), M.leather, { y: 0.21, z: 0.02, rx: 0.25 }); // hunched torso in a vest
      p.add(box(0.28, 0.04, 0.2), M.leatherDark, { y: 0.12, z: 0.02 }); // belt
      goblinHead(p, { y: 0.48, z: 0.08 });
    },
    shoulder: { x: 0.17, y: 0.3, z: 0.04 },
    buildArm: (p, s) => {
      p.add(capsule(0.04, 0.2), M.goblinSkin, { x: s * 0.02, y: -0.12, z: 0.03, rz: s * 0.15, rx: -0.3 });
      if (s < 0) return;
      // Spiked club.
      p.add(cyl(0.035, 0.065, 0.42, 8), M.woodDark, { x: 0.06, y: -0.06, z: 0.16, rx: 0.9 });
      for (let i = 0; i < 4; i++) p.add(cone(0.02, 0.06, 4), M.bone, { x: 0.06 + (i % 2 ? 0.05 : -0.05), y: 0.06, z: 0.32, rx: 0.9 + i });
    },
    crown: { y: 0.66, z: 0.08 },
  });
}

function runner() {
  const M = MATERIALS;
  return rig({
    hipY: 0.24,
    legX: 0.065,
    buildLeg: (p) => p.add(capsule(0.035, 0.18), M.goblinSkinDark, { y: -0.12 }),
    buildBody: (p) => {
      p.add(capsule(0.1, 0.12), M.hood, { y: 0.14, z: 0.03, rx: 0.4 });
      goblinHead(p, { y: 0.36, z: 0.1, s: 0.85 });
      p.add(cone(0.15, 0.26, 8), M.hood, { y: 0.46, z: 0.06, rx: -0.3 }); // hood
      p.add(cone(0.16, 0.36, 8), M.hood, { y: 0.08, z: -0.08, rx: -0.5 }); // cape
    },
    shoulder: { x: 0.12, y: 0.24, z: 0.06 },
    buildArm: (p, s) => {
      p.add(capsule(0.03, 0.14), M.goblinSkinDark, { y: -0.1, z: 0.02 });
      if (s < 0) return;
      p.add(box(0.025, 0.025, 0.26), M.iron, { x: 0.02, y: -0.17, z: 0.14 }); // dagger
      p.add(box(0.06, 0.03, 0.03), M.gold, { x: 0.02, y: -0.17, z: 0.02 });
    },
    crown: { y: 0.56, z: 0.1 },
  });
}

function orc() {
  const M = MATERIALS;
  return rig({
    hipY: 0.3,
    legX: 0.11,
    buildLeg: (p) => {
      p.add(capsule(0.07, 0.22), M.leatherDark, { y: -0.13 });
      p.add(box(0.12, 0.07, 0.17), M.iron, { y: -0.265, z: 0.03 });
    },
    buildBody: (p) => {
      p.add(box(0.36, 0.16, 0.24), M.leather, { y: 0.08 });
      p.add(capsule(0.19, 0.16), M.orcSkin, { y: 0.32, z: 0.02, rx: 0.15 });
      p.add(box(0.4, 0.3, 0.3), M.iron, { y: 0.36, z: 0.03, rx: 0.15 }); // breastplate
      for (const s of [-1, 1]) {
        p.add(sphere(0.13, 10, 7), M.iron, { x: s * 0.27, y: 0.54, sy: 0.7 }); // pauldrons
        p.add(cone(0.035, 0.12, 5), M.bone, { x: s * 0.3, y: 0.65, rz: -s * 0.5 });
      }
      p.add(sphere(0.15, 12, 9), M.orcSkin, { y: 0.7, z: 0.06 });
      p.add(box(0.2, 0.06, 0.12), M.orcSkin, { y: 0.62, z: 0.15 }); // jaw
      for (const s of [-1, 1]) {
        p.add(cone(0.022, 0.08, 5), M.bone, { x: s * 0.06, y: 0.67, z: 0.2 });
        p.add(sphere(0.028, 6, 5), M.eyes, { x: s * 0.06, y: 0.74, z: 0.18 });
      }
      p.add(box(0.2, 0.05, 0.05), M.leatherDark, { y: 0.78, z: 0.16 }); // brow
    },
    shoulder: { x: 0.32, y: 0.5, z: 0.05 },
    buildArm: (p, s) => {
      p.add(capsule(0.065, 0.24), M.orcSkin, { y: -0.2, z: 0.03, rx: -0.3 });
      if (s < 0) return;
      // Two-handed axe.
      p.add(cyl(0.025, 0.025, 0.8, 6), M.woodDark, { x: 0.04, y: -0.2, z: 0.13, rx: 0.15 });
      p.add(box(0.03, 0.24, 0.2), M.iron, { x: 0.04, y: 0.12, z: 0.25, rx: 0.15 });
    },
    crown: { y: 0.86, z: 0.06 },
  });
}

function brute() {
  const M = MATERIALS;
  return rig({
    hipY: 0.42,
    legX: 0.2,
    buildLeg: (p) => {
      p.add(cyl(0.12, 0.16, 0.42, 10), M.trollSkinDark, { y: -0.21 });
      p.add(sphere(0.13, 10, 7), M.trollSkinDark, { y: -0.38, z: 0.06, sy: 0.5 });
    },
    buildBody: (p) => {
      p.add(box(0.56, 0.2, 0.42), M.leather, { y: 0.04 }); // loincloth
      p.add(sphere(0.42, 14, 10), M.trollSkin, { y: 0.44, z: 0.04, sy: 1.05, sz: 0.9 }); // hunched torso
      p.add(sphere(0.3, 12, 9), M.trollSkinDark, { y: 0.66, z: -0.12, sx: 1.1 }); // back hump
      p.add(sphere(0.17, 12, 9), M.trollSkin, { y: 0.76, z: 0.3 }); // head, jutting forward
      p.add(box(0.22, 0.07, 0.12), M.trollSkinDark, { y: 0.68, z: 0.42 }); // jaw
      for (const s of [-1, 1]) {
        p.add(sphere(0.032, 6, 5), M.eyes, { x: s * 0.065, y: 0.8, z: 0.45 });
        p.add(cone(0.025, 0.07, 5), M.bone, { x: s * 0.07, y: 0.73, z: 0.47, rx: -0.4 });
      }
    },
    shoulder: { x: 0.42, y: 0.56, z: 0.1 },
    buildArm: (p, s) => {
      // Long arms ending in big fists.
      p.add(cyl(0.08, 0.12, 0.72, 10), M.trollSkin, { x: s * 0.04, y: -0.36, z: 0.04, rz: s * 0.18 });
      p.add(sphere(0.13, 10, 7), M.trollSkinDark, { x: s * 0.1, y: -0.74, z: 0.08 });
      if (s < 0) return;
      // Tree-trunk club.
      p.add(cyl(0.07, 0.15, 0.95, 10), M.woodDark, { x: 0.13, y: -0.6, z: 0.35, rx: 1.05 });
      p.add(dodeca(0.13), MATERIALS.boulder, { x: 0.13, y: -0.84, z: 0.72 });
    },
    crown: { y: 0.94, z: 0.3 },
  });
}

const ENEMY_MODELS = { grunt, runner, orc, brute };

export function createEnemyModel(type, elite = false) {
  const g = ENEMY_MODELS[type]();
  if (elite) {
    g.scale.setScalar(1.3);
    const crown = new Parts({ shade: false });
    crown.add(cyl(0.12, 0.14, 0.08, 8), MATERIALS.gold);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      crown.add(cone(0.03, 0.08, 4), MATERIALS.gold, { x: Math.cos(a) * 0.12, y: 0.07, z: Math.sin(a) * 0.12 });
    }
    const c = crown.build();
    const { y, z } = g.userData.rig.crown;
    c.position.set(0, y, z);
    g.userData.body.add(c);
  }
  return g;
}

const ease = (t) => t * t * (3 - 2 * t);

/**
 * Pose an enemy rig for frame `frame` of `anim` ('walk', 'attack' or 'death'; see ENEMY_ANIMS).
 *  - walk: a full stride over the frames (legs and arms swing, the body bobs);
 *  - attack: ready → wind up → raised → strike (the blow lands on the last frame, as the hit does in the sim);
 *  - death: topples over (backwards and sideways), arms flung up.
 */
export function poseEnemy(model, anim, frame) {
  const { figure, legs, body, arms, hipY } = model.userData.rig;
  const n = ENEMY_ANIMS[anim];
  figure.rotation.set(0, 0, 0);
  body.rotation.set(0, 0, 0);
  body.position.y = hipY;
  for (const part of [...legs, ...arms]) part.rotation.set(0, 0, 0);
  if (anim === 'walk') {
    const a = (frame / n) * Math.PI * 2;
    const swing = Math.sin(a);
    legs[0].rotation.x = swing * 0.6;
    legs[1].rotation.x = -swing * 0.6;
    arms[0].rotation.x = -swing * 0.5;
    arms[1].rotation.x = swing * 0.3;
    body.position.y = hipY + Math.abs(Math.cos(a)) * hipY * 0.12;
    body.rotation.x = 0.08;
  } else if (anim === 'attack') {
    const raise = [-0.5, -1.6, -2.4, 0.55][frame];
    arms[1].rotation.x = raise;
    arms[0].rotation.x = frame === 3 ? -0.2 : -0.6;
    body.rotation.x = [0.05, -0.08, -0.15, 0.3][frame];
    legs[0].rotation.x = -0.25;
    legs[1].rotation.x = 0.2;
  } else {
    // Topple diagonally (backwards and to one side), so the fall reads from any heading in the iso view.
    const t = ease((frame + 1) / n);
    figure.rotation.set(-1.05 * t, 0, 1.05 * t);
    arms[0].rotation.x = -1.6 * t;
    arms[1].rotation.x = -1.2 * t;
    legs[0].rotation.x = 0.35 * t;
    legs[1].rotation.x = -0.15 * t;
  }
  return model;
}

// ------------------------------------------------------------------ projectiles (drawn live)

export function createProjectileModel(kind) {
  const p = new Parts({ shade: false });
  if (kind === 'cannonball') return p.add(sphere(0.15), MATERIALS.cannonball).build();
  if (kind === 'boulder') return p.add(dodeca(0.22), MATERIALS.boulder).build();
  // Arrow points along +z so Object3D.lookAt() aims it at its destination.
  return p
    .add(box(0.035, 0.035, 0.5), MATERIALS.woodDark)
    .add(cone(0.05, 0.1, 4), MATERIALS.iron, { z: 0.29, rx: Math.PI / 2 })
    .add(box(0.1, 0.02, 0.1), MATERIALS.bannerRed, { z: -0.22 })
    .build();
}

// ------------------------------------------------------------------ scenery

// Scenery after the reference's "Environmental" sheet: chunky, blocky olive trees and big pale sandstone
// boulders with flat faces.
const LEAF_COLORS = {
  oak: [
    ['#76882e', '#8c9c3a', '#5e6e24'],
    ['#6c8230', '#82963c', '#566a26'],
    ['#808c30', '#96a03e', '#666e26'],
  ],
  pine: [
    ['#6e8632', '#86a03e'],
    ['#627a2e', '#7a9439'],
    ['#78903a', '#90a848'],
  ],
};
const TRUNK = std({ color: 0x6b3f22 });

function oak(p, rnd, v) {
  const [mid, light, dark] = LEAF_COLORS.oak[v];
  p.add(box(0.2, 0.95, 0.2), TRUNK, { y: 0.47, ry: rnd.range(0, 1) });
  p.add(box(0.1, 0.3, 0.1), TRUNK, { x: 0.1, y: 0.75, rz: -0.6 });
  // A blocky canopy: a big rounded block, a smaller one on top, and lumps on the sides.
  const ry = rnd.range(0, Math.PI / 2);
  p.add(rbox(0.95, 0.72, 0.92, 0.14), foliage(mid), { y: 1.3, ry });
  p.add(rbox(0.62, 0.48, 0.6, 0.12), foliage(light), { x: rnd.range(-0.08, 0.08), y: 1.78, z: rnd.range(-0.08, 0.08), ry: ry + 0.3 });
  const lumps = 2 + Math.floor(rnd.next() * 2);
  for (let i = 0; i < lumps; i++) {
    const a = ry + (i / lumps) * Math.PI * 2 + rnd.range(-0.3, 0.3);
    p.add(rbox(0.46, 0.42, 0.44, 0.1), foliage(i % 2 ? dark : mid), { x: Math.cos(a) * 0.42, y: rnd.range(1.08, 1.4), z: Math.sin(a) * 0.42, ry: a });
  }
}

function pine(p, rnd, v) {
  const [dark, light] = LEAF_COLORS.pine[v];
  p.add(box(0.16, 0.6, 0.16), TRUNK, { y: 0.3 });
  // Stepped tiers, square-ish like the reference (6-sided cones read as faceted from the iso view).
  const tiers = 4;
  const ry = rnd.range(0, 1);
  for (let i = 0; i < tiers; i++) {
    const r = 0.6 - i * 0.12;
    p.add(cone(r, 0.66, 6), foliage(i % 2 ? light : dark), { y: 0.62 + i * 0.38, ry: ry + i * 0.5 });
  }
}

function bush(p, rnd, v) {
  const [mid, light, dark] = LEAF_COLORS.oak[v];
  p.add(rbox(0.5, 0.36, 0.46, 0.1), foliage(mid), { y: 0.18, ry: rnd.range(0, 1) });
  p.add(rbox(0.34, 0.3, 0.32, 0.09), foliage(dark), { x: 0.26, y: 0.14, z: 0.1, ry: 0.4 });
  p.add(rbox(0.3, 0.26, 0.3, 0.08), foliage(light), { x: -0.16, y: 0.3, z: 0.12, ry: 0.8 });
  if (v === 1) for (let i = 0; i < 5; i++) p.add(sphere(0.035, 6, 4), MATERIALS.bannerRed, { x: rnd.range(-0.25, 0.25), y: rnd.range(0.3, 0.4), z: rnd.range(0, 0.3) });
}

/** A loose boulder or two (decoration). */
function rock(p, rnd) {
  const s = rnd.range(0.9, 1.15);
  p.add(rbox(0.6 * s, 0.42 * s, 0.5 * s, 0.1), rnd.pick(BOULDER), { y: 0.21 * s, ry: rnd.range(0, 3) });
  p.add(rbox(0.34, 0.28, 0.32, 0.08), rnd.pick(BOULDER), { x: rnd.range(0.3, 0.4), y: 0.14, z: rnd.range(0.05, 0.2), ry: rnd.range(0, 3) });
  if (rnd.next() < 0.6) p.add(rbox(0.36, 0.28, 0.32, 0.08), rnd.pick(BOULDER), { x: rnd.range(-0.1, 0.1), y: 0.42 * s + 0.12, z: rnd.range(-0.06, 0.06), ry: rnd.range(0, 3) });
  for (let i = 0; i < 3; i++) p.add(cone(0.04, 0.16, 4), MATERIALS.grass, { x: rnd.range(-0.4, 0.4), y: 0.07, z: rnd.range(0.2, 0.4), rz: rnd.range(-0.4, 0.4) });
}

/** A rock outcrop that fills a whole tile (terrain that blocks movement): big flat-faced blocks, stacked. */
function outcrop(p, rnd, v) {
  const ry = rnd.range(0, Math.PI / 2);
  const at = (lx, lz) => place(0, 0, ry, lx, lz);
  // Base blocks covering the tile.
  const base = [
    [-0.2, -0.16, 0.62, 0.6, 0.56],
    [0.24, 0.12, 0.54, 0.5, 0.6],
    [-0.14, 0.28, 0.48, 0.42, 0.42],
  ];
  if (v !== 0) base.push([0.26, -0.28, 0.42, 0.38, 0.38]);
  for (const [lx, lz, w, h, d] of base) {
    const k = rnd.range(0.9, 1.1);
    p.add(rbox(w * k, h * k, d * k, 0.09), rnd.pick(BOULDER), { ...at(lx, lz), y: (h * k) / 2, ry: ry + rnd.range(-0.25, 0.25) });
  }
  // Stacked blocks on top, so it stands taller than a wall.
  const top = rnd.range(0.5, 0.6);
  p.add(rbox(top, top * 0.85, top * 0.9, 0.09), rnd.pick(BOULDER), { ...at(-0.06, -0.02), y: 0.55 + top * 0.42, ry: ry + rnd.range(-0.3, 0.3) });
  if (v === 2) p.add(rbox(0.34, 0.3, 0.32, 0.07), rnd.pick(BOULDER), { ...at(-0.05, 0), y: 0.55 + top * 0.85 + 0.15, ry: ry + 0.6 });
  // Pebbles and grass round the foot.
  for (let i = 0; i < 4; i++) {
    const a = rnd.range(0, Math.PI * 2);
    p.add(rbox(0.14, 0.11, 0.13, 0.04), rnd.pick(BOULDER), { x: Math.cos(a) * 0.5, y: 0.055, z: Math.sin(a) * 0.5, ry: a });
  }
  for (let i = 0; i < 5; i++) p.add(cone(0.04, 0.18, 4), MATERIALS.grass, { x: rnd.range(-0.5, 0.5), y: 0.08, z: rnd.range(0.2, 0.5), rz: rnd.range(-0.4, 0.4) });
}

const SCENERY_BUILDERS = { oak, pine, bush, rock, outcrop };
export const SCENERY_TYPES = Object.keys(SCENERY_BUILDERS);
export const SCENERY_VARIANTS = 3;

/** One tree, bush or rock (for baking into a sprite). `variant` picks its shape and colour. */
export function createSceneryObject(kind, variant = 0) {
  const p = new Parts();
  SCENERY_BUILDERS[kind](p, rng(kind.length * 31 + variant * 7 + 3), variant);
  return p.build();
}
