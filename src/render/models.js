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
  PENNANT_W,
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

/** Chimney tops (smoke rises from them in game), in the model's own coordinates. */
export const CHIMNEYS = { townHall: { x: 0.36, y: 3.0, z: -0.62 } };

/**
 * Where each building's pennants fly (the waving cloth is a sprite of its own; see wavingPennant in modelKit.js):
 * the attachment point at the top of the pole, the cloth's length, and `turn` 1 if it's turned a quarter (as the
 * gatehouse is in a north–south wall). Model coordinates, matching the pennant() calls in the models.
 */
export const PENNANTS = {
  townHall: [{ x: -0.62, y: 2.47 + 0.95 - 0.02, z: -0.7, w: PENNANT_W }],
  gatehouse: [{ x: -0.95, y: 1.64 + 0.85 - 0.02, z: -0.1, w: 0.4 }],
};

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
  // A chimney stack on the roof (it smokes in game; see CHIMNEYS).
  const ch = CHIMNEYS.townHall;
  stoneBlocks(p, { x: ch.x, z: ch.z, y: top + 0.24, w: 0.24, d: 0.24, h: ch.y - top - 0.3, rows: 3, rnd, minBlock: 0.24, maxBlock: 0.24 });
  p.add(box(0.3, 0.06, 0.3), M.capstone, { x: ch.x, y: ch.y - 0.03, z: ch.z });
  // Door, windows and a banner on the faces the camera sees.
  door(p, { x: kx, y: 0.23, z: kz + W / 2 + 0.01, w: 0.42, h: 0.66 });
  for (const x of [-0.42, 0.42]) windowFrame(p, { x: kx + x, y: 1.62, z: kz + W / 2 + 0.01, w: 0.2, h: 0.3, shutters: true });
  windowFrame(p, { x: kx + W / 2 + 0.01, y: 1.62, z: kz, ry: Math.PI / 2, w: 0.2, h: 0.3 });
  windowFrame(p, { x: kx + W / 2 + 0.01, y: 0.8, z: kz + 0.3, ry: Math.PI / 2, w: 0.16, h: 0.24, shutters: false });
  banner(p, { x: kx + W / 2 + 0.02, y: 1.05, z: kz - 0.35, ry: Math.PI / 2, w: 0.26, h: 0.55 });
  pennant(p, { x: kx - 0.5, y: top + 0.22, z: kz - 0.5, h: 0.95, w: PENNANT_W });
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
/** Peeled logs, light tan like the reference's palisade (lightest to darkest). */
const LOGS = ['#cba46e', '#c69b66', '#bb8d58', '#ad8050', '#a0754a'].map((c) => foliage(c));
/** Each wall variant leans towards its own few shades, so neighbouring tiles differ a little in tone. */
const LOG_SETS = [
  [LOGS[1], LOGS[2], LOGS[3]],
  [LOGS[0], LOGS[1], LOGS[2]],
  [LOGS[2], LOGS[3], LOGS[4]],
  [LOGS[0], LOGS[2], LOGS[4]],
];
/** How many versions of each wall shape are baked (tiles pick one by position). */
export const WALL_VARIANTS = LOG_SETS.length;
const RAIL = std({ color: 0x9a6c3e });

/**
 * The rest of a palisade run along (dx, dz), from `a` to `b` tiles out from the origin: one rail on the far face
 * (partly hidden by the logs, as in the reference), slanted props behind the wall, and a grassy foot.
 */
function palisadeRun(p, rnd, dx, dz, a, b) {
  const M = MATERIALS;
  const mid = (a + b) / 2;
  const len = b - a;
  const at = (d, side) => ({ x: dx ? dx * d : side, z: dz ? dz * d : side });
  // The far face is the -x / -z side, away from the camera.
  p.add(box(dx ? len : 0.05, 0.08, dx ? 0.05 : len), RAIL, { ...at(mid, -0.085), y: 0.68 });
  // Props here and there (not every half tile), each set and leaning a little differently.
  for (let d = a + 0.25; d < b; d += 0.5) {
    if (rnd.next() < 0.35) continue;
    const lean = rnd.range(0.32, 0.5);
    const d2 = Math.min(b - 0.05, Math.max(a + 0.05, d + rnd.range(-0.12, 0.12)));
    p.add(box(0.055, 0.86, 0.055), RAIL, { ...at(d2, -0.2 - lean * 0.17), y: 0.39, rx: dx ? lean : 0, rz: dx ? 0 : -lean });
  }
  p.add(box(dx ? len : 0.24, 0.04, dx ? 0.24 : len), M.dirt, { ...at(mid, 0), y: 0.02 });
  // Grass at the foot: none on some stretches, a thick fringe on others.
  for (let i = 0, n = Math.round(len * rnd.pick([0, 3, 7, 12])); i < n; i++) {
    const d = a + rnd.next() * len;
    p.add(cone(0.035, rnd.range(0.12, 0.22), 4), rnd.next() < 0.5 ? M.grass : M.grassDark, {
      ...at(d, rnd.range(-0.15, 0.15)),
      y: 0.07,
      rz: rnd.range(-0.4, 0.4),
      rx: rnd.range(-0.3, 0.3),
    });
  }
}

/**
 * A wooden palisade tile that joins up with its neighbours. `connections` = { n, e, s, w } booleans: true where
 * the neighbouring tile has a wall, another building or rock. Logs sit on a 1/7-tile pitch, so runs of tiles
 * line up seamlessly. `variant` (0 to WALL_VARIANTS - 1) changes stake heights, lean and shades, props and grass,
 * so long runs don't repeat.
 */
function wall({ connections = {}, variant = 0 } = {}) {
  const M = MATERIALS;
  const p = new Parts();
  const key = ['n', 'e', 's', 'w'].map((d) => (connections[d] ? 1 : 0)).join('');
  const rnd = rng(parseInt(key, 2) * 7 + variant * 131 + 101);
  const shades = LOG_SETS[variant % LOG_SETS.length];
  const log = (x, z, opts) => palisadeLog(p, rnd, x, z, { shades, ...opts });
  const dirs = [
    ['e', 1, 0],
    ['w', -1, 0],
    ['s', 0, 1],
    ['n', 0, -1],
  ].filter(([k]) => connections[k]);
  const PITCH = 1 / 7;
  const straight = dirs.length === 2 && dirs[0][1] === -dirs[1][1] && dirs[0][2] === -dirs[1][2];
  // Centre log: a thicker post where the wall turns, ends or branches.
  if (straight) log(0, 0);
  else log(0, 0, { r: 0.095, h: rnd.range(1.25, 1.4) });
  for (const [, dx, dz] of dirs) {
    for (let i = 1; i <= 3; i++) log(dx * i * PITCH, dz * i * PITCH);
    palisadeRun(p, rnd, dx, dz, 0, 0.5);
  }
  if (dirs.length === 0) {
    // A lone stretch of logs.
    for (const i of [-2, -1, 1, 2]) log(i * PITCH, 0);
    palisadeRun(p, rnd, 1, 0, -0.36, 0.36);
  }
  p.add(box(0.26, 0.04, 0.26), M.dirt, { y: 0.02 });
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
  // The palisade arm, matching wall tiles (same log pitch, rail, props and grassy foot).
  for (let i = 1; i <= 3; i++) palisadeLog(p, rnd, dx * i * PITCH, dz * i * PITCH);
  palisadeRun(p, rnd, dx, dz, 0, 0.5);
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
  p.add(cone(0.98, 0.78, 4), rnd.pick(ROOF_TILES), { y: y0 + cabH + 0.36, ry: Math.PI / 4 });
  p.add(box(0.08, 0.2, 0.08), M.woodDark, { y: y0 + cabH + 0.82 });
  groundDressing(p, { w: 1.72, d: 1.72, rnd, count: 9 });
  const g = p.build();
  // The lookouts turn to face what they shoot at (and scan the horizon when idle): a turret of their own.
  const turret = lookouts(y0);
  g.add(turret);
  g.userData.turret = turret;
  return g;
}

/**
 * The watchtower's two lookouts, facing +z: only what shows above the cabin's boards (heads, hats and bows), so
 * the turret sprite drawn over the tower never shows a body through the boards.
 */
function lookouts(y) {
  const M = MATERIALS;
  const t = new Parts({ yOffset: y });
  for (const [x, z] of [
    [-0.2, 0.06],
    [0.2, -0.1],
  ]) {
    t.add(capsule(0.07, 0.06), M.clothBlue, { x, y: 0.3, z }); // shoulders
    t.add(sphere(0.06, 8, 6), std({ color: 0xe2b48a }), { x, y: 0.42, z });
    t.add(cone(0.075, 0.09, 8), M.leatherDark, { x, y: 0.49, z });
    t.add(torus(0.1, 0.012, 10), M.woodDark, { x: x + 0.08, y: 0.36, z: z + 0.06, ry: Math.PI / 2, sx: 0.5 });
  }
  const turret = t.build();
  turret.position.y = y;
  return turret;
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
// `shape` names the arms: 'we' / 'ns' for a straight run, a corner such as 'ws' (arms west and south), or a
// T-junction such as 'wen' (a west–east run with a branch north). Straight-run arms reach 1 tile from the tower's
// centre; corner and T-junction arms 1.5 (the tower sits on the corner or junction tile).

export const IN_WALL_SHAPES = ['we', 'ns', 'wn', 'ws', 'en', 'es', 'wen', 'wes', 'nsw', 'nse'];
const ARM = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };

/** One sharpened palisade log; heights, points and lean vary so the top line is ragged, as in the reference. */
function palisadeLog(p, rnd, x, z, { r = 0.075, h = rnd.range(0.95, 1.28), shades = LOGS } = {}) {
  const mat = rnd.pick(shades);
  const tilt = { rx: rnd.range(-0.06, 0.06), rz: rnd.range(-0.06, 0.06) };
  const point = rnd.range(0.15, 0.3);
  p.add(cyl(r, r * 1.05, h, 8), mat, { x, y: h / 2, z, ...tilt, ry: rnd.range(0, 3) });
  p.add(cone(r, point, 8), mat, { x, y: h + point / 2, z, ...tilt });
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

/**
 * One palisade arm from a bastion of half-width `from` out along `dir` ('n', 'e', 's' or 'w'), on the wall's log
 * grid. `straight`: an arm of a straight run (reaches 1 tile from the tower's drawn centre, which sits on a tile
 * edge) rather than of a corner or T-junction (1.5 tiles, the centre on a tile centre).
 */
function wallArm(p, rnd, dir, from, straight) {
  const len = straight ? 1 : 1.5;
  // Wall tiles put logs at (tile + (j + 0.5) / 7); measured from the tower's drawn centre, that grid is offset
  // by 0 for a straight run and 0.5 for a corner or T-junction.
  const shift = straight ? 0 : 0.5;
  const [dx, dz] = ARM[dir];
  for (let j = 0; j < 14; j++) {
    const d = (j + 0.5) / 7 - shift;
    if (d > from + 0.03 && d < len) palisadeLog(p, rnd, dx * d, dz * d);
  }
  palisadeRun(p, rnd, dx, dz, from, len);
}

const isStraight = (shape) => shape === 'we' || shape === 'ns';

/** Palisade stubs from the bastion (half-width `from`) out along each arm of `shape`. */
function wallStubs(p, rnd, shape, from) {
  for (const dir of shape) wallArm(p, rnd, dir, from, isStraight(shape));
}

/** Half-width of each in-wall model's bastion: where its wall arms start. */
export const IN_WALL_RADIUS = { archerTower: 0.72, cannonTower: 0.74, magicSpire: 0.88, catapult: 0.8, gatehouse: 0.8 };

/** Where an arm's middle sits, from the tower's drawn centre ([x, z] in tiles). */
export function wallArmOffset(dir, from, straight) {
  const mid = (from + (straight ? 1 : 1.5)) / 2;
  return [ARM[dir][0] * mid, ARM[dir][1] * mid];
}

/**
 * One wall arm on its own (for baking: the renderer draws a tower's bastion and its arms as separate sprites, so
 * every shape shares one bastion sprite and each arm sorts in depth by itself). Centred on the arm's middle.
 */
export function createWallArm(dir, from, straight) {
  const p = new Parts();
  wallArm(p, rng('nesw'.indexOf(dir) * 31 + Math.round(from * 100) + (straight ? 7 : 0)), dir, from, straight);
  const inner = p.build();
  const [ox, oz] = wallArmOffset(dir, from, straight);
  inner.position.set(-ox, 0, -oz);
  const g = new THREE.Group();
  g.add(inner);
  return g;
}

/** A bastion of half-width `r`, with the stubs of `shape` unless `stubs` is false. */
function inWallParts(shape, r, opts, stubs = true) {
  const p = new Parts();
  bastion(p, rng(Math.round(r * 100)), { r, ...opts });
  if (stubs) wallStubs(p, rng(IN_WALL_SHAPES.indexOf(shape) * 17 + Math.round(r * 100)), shape, r);
  return p.build();
}

const IN_WALL_MODELS = {
  // The watchtower's legs rise out of the bastion; its cabin looks out over the wall.
  archerTower: (shape, stubs) => {
    const g = archerTower();
    g.add(inWallParts(shape, IN_WALL_RADIUS.archerTower, { h: 1.15 }, stubs));
    return g;
  },
  // The cannon stands on a raised log-and-earth rampart in the wall.
  cannonTower: (shape, stubs) => {
    const g = new THREE.Group();
    g.add(inWallParts(shape, IN_WALL_RADIUS.cannonTower, { h: 1.0, deck: 0.98 }, stubs));
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
  magicSpire: (shape, stubs) => {
    const g = magicSpire();
    g.add(inWallParts(shape, IN_WALL_RADIUS.magicSpire, { h: 0.72 }, stubs));
    return g;
  },
  // The catapult works from a rampart platform in the wall.
  catapult: (shape, stubs) => {
    const g = new THREE.Group();
    g.add(inWallParts(shape, IN_WALL_RADIUS.catapult, { h: 0.86, deck: 0.86 }, stubs));
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

// ------------------------------------------------------------------ gatehouse
// The fort's gate, in the palisade's logs: two square log towers set wide apart, open-topped behind plank
// battlements (a guard on one, a pennant on the other), joined by a railed walkway over a wide gateway, with the
// gates swung back and a banner hung under the walkway. The way through runs along z (across a west–east wall);
// in a north–south wall the whole thing is turned so it runs along x.

/** Square log tower: sharpened logs on every side of a square of half-width `r`, iron-banded corner posts. */
function logTower(p, rnd, { x = 0, z = 0, r, h }) {
  const n = Math.max(2, Math.round((2 * r) / (1 / 7)));
  for (let i = 0; i < n; i++) {
    const t = -r + ((i + 0.5) * 2 * r) / n;
    for (const [lx, lz] of [[t, r], [t, -r], [r, t], [-r, t]]) palisadeLog(p, rnd, x + lx, z + lz, { h: h * rnd.range(0.95, 1.03) });
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      p.add(cyl(0.1, 0.11, h + 0.15, 10), rnd.pick(LOGS), { x: x + sx * r, y: (h + 0.15) / 2, z: z + sz * r });
      for (const y of [0.3, h - 0.15]) p.add(torus(0.105, 0.02, 12), MATERIALS.iron, { x: x + sx * r, y, z: z + sz * r, rx: Math.PI / 2 });
    }
  }
}

/** Plank battlements (alternately tall and short boards) round a `w` x `d` deck at height `y`. */
function boardParapet(p, { x = 0, y, z = 0, w, d, h = 0.3 }) {
  for (const [ry, fx, fz, len] of [[0, 0, 1, w], [0, 0, -1, w], [Math.PI / 2, 1, 0, d], [Math.PI / 2, -1, 0, d]]) {
    const n = Math.max(2, Math.round(len / 0.24));
    for (let i = 0; i < n; i++) {
      const at = place(x + (fx * w) / 2, z + (fz * d) / 2, ry, -len / 2 + ((i + 0.5) * len) / n, 0);
      const bh = h * (i % 2 ? 0.7 : 1);
      p.add(box(len / n - 0.06, bh, 0.06), MATERIALS.wood, { x: at.x, y: y + bh / 2, z: at.z, ry });
    }
  }
}

/** A plank gate leaf hinged at x = `hinge` (gate line at depth z), reaching towards the middle, swung `open` radians inwards (towards -z). */
function gateLeaf(p, { hinge, z, w, h, open = 0, y = 0.04 }) {
  const M = MATERIALS;
  const dir = -Math.sign(hinge);
  const ry = dir * open;
  const along = (t, out = 0) => ({ x: hinge + dir * t * Math.cos(open), z: z - t * Math.sin(open) + out });
  const n = Math.max(3, Math.round(w / 0.1));
  for (let i = 0; i < n; i++) p.add(box(w / n - 0.012, h, 0.06), i % 3 === 1 ? M.woodDark : M.wood, { ...along(((i + 0.5) * w) / n), y: y + h / 2, ry });
  for (const yy of [0.22, h * 0.55, h - 0.14]) p.add(box(w - 0.02, 0.05, 0.02), M.iron, { ...along(w / 2, 0.035), y: y + yy, ry });
}

function gatehouseBody() {
  const M = MATERIALS;
  const p = new Parts();
  const rnd = rng(77);
  const tx = 0.84; // tower centres either side of the gateway
  const deck = 1.6;
  for (const sx of [-1, 1]) {
    logTower(p, rnd, { x: sx * tx, r: 0.28, h: 1.55 });
    p.add(box(0.72, 0.08, 0.72), M.woodDark, { x: sx * tx, y: deck });
    boardParapet(p, { x: sx * tx, y: deck + 0.04, w: 0.7, d: 0.7 });
    gateLeaf(p, { hinge: sx * 0.56, z: 0.12, w: 0.56, h: 1.05, open: 1.25 });
  }
  archer(p, { x: tx, y: deck + 0.04, z: 0.05, ry: 0.4 });
  pennant(p, { x: -0.95, y: deck + 0.04, z: -0.1, h: 0.85, w: 0.4 });
  // The walkway over the gate, railed on both sides, with the banner hung beneath.
  p.add(box(1.36, 0.1, 0.5), M.woodDark, { y: 1.3 });
  for (const sz of [-1, 1]) {
    p.add(box(1.1, 0.05, 0.04), M.wood, { y: 1.58, z: sz * 0.22 });
    for (let i = 0; i < 5; i++) p.add(box(0.04, 0.28, 0.04), M.wood, { x: -0.44 + i * 0.22, y: 1.47, z: sz * 0.22 });
  }
  banner(p, { y: 1.26, z: 0.27, w: 0.34, h: 0.4 });
  // A packed-earth track through the gate.
  p.add(box(0.9, 0.04, 2.0), M.dirt, { y: 0.02 });
  groundDressing(p, { w: 2.2, d: 1.2, rnd, count: 8 });
  return p.build();
}

function gatehouse(opts = {}) {
  const g = new THREE.Group();
  const body = gatehouseBody();
  // In a north–south wall the way through runs along x.
  if (opts.inWall?.startsWith('ns')) body.rotation.y = Math.PI / 2;
  g.add(body);
  if (opts.inWall && opts.stubs !== false) {
    const p = new Parts();
    wallStubs(p, rng(IN_WALL_SHAPES.indexOf(opts.inWall) * 13 + 5), opts.inWall, IN_WALL_RADIUS.gatehouse);
    g.add(p.build());
  }
  return g;
}

const BUILDING_MODELS = { townHall, wall, wallJoint, archerTower, cannonTower, magicSpire, catapult, gatehouse };
/** Building types with a version built into a wall (see IN_WALL_SHAPES). */
export const IN_WALL_TYPES = [...Object.keys(IN_WALL_MODELS), 'gatehouse'];

/**
 * `opts` is model-specific: walls take `{ connections }`, wall joints `{ dir }`, and towers `{ inWall: shape }`
 * for the version built into a wall (see IN_WALL_SHAPES), with `stubs: false` for just the bastion (the baked
 * sprites draw the wall arms separately; see createWallArm).
 */
export function createBuildingModel(type, opts) {
  if (type === 'gatehouse') return gatehouse(opts);
  if (opts?.inWall) return IN_WALL_MODELS[type](opts.inWall, opts.stubs !== false);
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

// ------------------------------------------------------------------ bridges
// A narrow plank footbridge over a ford, in tile-long pieces: 'mid' over the water (log piers, stringers, a
// planked deck and post-and-rail sides) and the two ends, 'start' (on the bank at the -x end) and 'end' (+x),
// which ramp down onto the ground. Built along x; the catalogue turns it for bridges along z.

const DECK = 0.3;

function bridgePiece(part) {
  const M = MATERIALS;
  const p = new Parts();
  const rnd = rng(['mid', 'start', 'end'].indexOf(part) * 19 + 3);
  const half = 0.36; // half the deck's width
  if (part === 'mid') {
    for (const sz of [-1, 1]) {
      p.add(cyl(0.06, 0.07, DECK + 0.25, 8), rnd.pick(LOGS), { x: 0, y: (DECK + 0.25) / 2 - 0.2, z: sz * (half - 0.04) }); // pier
      p.add(box(1.0, 0.07, 0.07), M.woodDark, { y: DECK - 0.07, z: sz * (half - 0.08) }); // stringer
    }
    for (let i = 0; i < 7; i++) {
      const x = -0.5 + (i + 0.5) / 7;
      p.add(box(1 / 7 - 0.018, 0.04, 2 * half + rnd.range(-0.03, 0.03)), rnd.pick([M.wood, M.woodLight, M.wood]), { x, y: DECK, z: rnd.range(-0.015, 0.015), ry: rnd.range(-0.03, 0.03) });
    }
    for (const sz of [-1, 1]) {
      for (const x of [-0.45, 0.05]) p.add(box(0.05, 0.36, 0.05), M.woodDark, { x, y: DECK + 0.18, z: sz * half });
      p.add(box(1.0, 0.045, 0.04), M.wood, { y: DECK + 0.33, z: sz * half, rz: rnd.range(-0.03, 0.03) });
    }
  } else {
    // A ramp from the deck down to the ground, over the bank tile; the high side faces the water.
    const dir = part === 'start' ? 1 : -1; // where the water is
    const n = 6;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n; // 0 at the outer (low) end, 1 at the water
      const x = dir * (-0.5 + t);
      p.add(box(1 / n - 0.02, 0.04, 2 * half + rnd.range(-0.03, 0.03)), rnd.pick([M.wood, M.woodLight]), { x, y: 0.05 + t * (DECK - 0.05), z: rnd.range(-0.015, 0.015), rz: dir * 0.28 });
    }
    for (const sz of [-1, 1]) {
      p.add(box(0.06, 0.5, 0.06), M.woodDark, { x: -dir * 0.45, y: 0.25, z: sz * half }); // end post, on the bank
      p.add(box(0.95, 0.045, 0.04), M.wood, { x: 0, y: (0.45 + DECK + 0.33) / 2, z: sz * half, rz: dir * Math.atan2(DECK + 0.33 - 0.45, 0.95) });
      p.add(box(0.06, 0.06, 0.12), M.woodDark, { x: -dir * 0.45, y: 0.03, z: sz * (half - 0.04) }); // sill
    }
    for (let i = 0; i < 3; i++) p.add(cone(0.035, rnd.range(0.12, 0.2), 4), M.grass, { x: -dir * rnd.range(0.1, 0.4), y: 0.07, z: (rnd.next() < 0.5 ? -1 : 1) * rnd.range(0.38, 0.48), rz: rnd.range(-0.4, 0.4) });
  }
  return p.build();
}

export const BRIDGE_PARTS = ['mid', 'start', 'end'];

/** One piece of a footbridge running along `axis` ('x' or 'z'). */
export function createBridgePiece(part, axis) {
  const g = new THREE.Group();
  const piece = bridgePiece(part);
  if (axis === 'z') piece.rotation.y = -Math.PI / 2; // +x turns to +z, so 'start' stays at the low end
  g.add(piece);
  return g;
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
  birch: [
    ['#8a9c3c', '#a0ae48', '#70822e'],
    ['#94a03c', '#aab24a', '#788630'],
    ['#82983a', '#98ac46', '#6a7e2e'],
  ],
  spruce: [
    ['#4e6a2c', '#62803a'],
    ['#48622e', '#5c783a'],
    ['#56702e', '#6a883c'],
  ],
  beech: [
    ['#5e7a2a', '#74903a', '#4a6222'],
    ['#66802c', '#7c963c', '#506624'],
    ['#587428', '#6e8a36', '#465e20'],
  ],
};
const TRUNK = std({ color: 0x6b3f22 });
const BIRCH_BARK = std({ color: 0xfaf4e6, roughness: 0.8 });
const BIRCH_MARK = std({ color: 0x2e2a26 });
const DEADWOOD = std({ color: 0xa09280 });
const MUSHROOM = std({ color: 0xc8502e });

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

/** A slim, pale-barked birch with a light, narrow canopy. */
function birch(p, rnd, v) {
  const [mid, light, dark] = LEAF_COLORS.birch[v];
  const lean = rnd.range(-0.1, 0.1);
  const shift = (y) => -Math.sin(lean) * (y - 0.75); // x offset of the leaning trunk at height y
  p.add(cyl(0.065, 0.09, 1.5, 7), BIRCH_BARK, { y: 0.75, rz: lean });
  for (let i = 0; i < 5; i++) {
    const y = 0.18 + i * 0.24 + rnd.range(-0.05, 0.05);
    p.add(box(0.09, 0.025, 0.05), BIRCH_MARK, { x: shift(y) + rnd.range(-0.02, 0.02), y, z: 0.06, rz: rnd.range(-0.3, 0.3) });
  }
  const cx = shift(1.6);
  const ry = rnd.range(0, Math.PI / 2);
  p.add(rbox(0.76, 0.6, 0.72, 0.13), foliage(mid), { x: cx, y: 1.45, ry });
  p.add(rbox(0.58, 0.52, 0.56, 0.12), foliage(light), { x: cx + rnd.range(-0.06, 0.06), y: 1.86, ry: ry + 0.4 });
  p.add(rbox(0.32, 0.34, 0.32, 0.09), foliage(light), { x: cx + rnd.range(-0.05, 0.05), y: 2.16, ry: ry + 0.8 });
  for (let i = 0; i < 2; i++) {
    const a = ry + i * Math.PI + rnd.range(-0.4, 0.4);
    p.add(rbox(0.34, 0.32, 0.32, 0.09), foliage(dark), { x: cx + Math.cos(a) * 0.32, y: rnd.range(1.3, 1.6), z: Math.sin(a) * 0.3, ry: a });
  }
}

/** A tall, narrow, dark spruce: more, tighter tiers than the pine. */
function spruce(p, rnd, v) {
  const [dark, light] = LEAF_COLORS.spruce[v];
  p.add(box(0.13, 0.5, 0.13), TRUNK, { y: 0.25 });
  const tiers = 6;
  const ry = rnd.range(0, 1);
  for (let i = 0; i < tiers; i++) {
    const r = 0.5 - i * 0.065;
    p.add(cone(r, 0.56, 6), foliage(i % 2 ? light : dark), { y: 0.5 + i * 0.3, ry: ry + i * 0.45 });
  }
  p.add(cone(0.1, 0.3, 5), foliage(light), { y: 0.5 + tiers * 0.3 + 0.02, ry });
}

/** A broad old beech: a thick forked trunk and a wide, deep-green dome of lumps. */
function beech(p, rnd, v) {
  const [mid, light, dark] = LEAF_COLORS.beech[v];
  const ry = rnd.range(0, Math.PI / 2);
  p.add(box(0.26, 0.8, 0.26), TRUNK, { y: 0.4, ry });
  p.add(box(0.13, 0.5, 0.13), TRUNK, { x: -0.14, y: 0.92, rz: 0.5 });
  p.add(box(0.12, 0.46, 0.12), TRUNK, { x: 0.15, y: 0.9, rz: -0.55 });
  for (let i = 0; i < 3; i++) {
    const a = ry + (i / 3) * Math.PI * 2;
    p.add(box(0.1, 0.12, 0.26), TRUNK, { x: Math.cos(a) * 0.16, y: 0.05, z: Math.sin(a) * 0.16, ry: -a + Math.PI / 2 });
  }
  p.add(rbox(1.2, 0.56, 1.1, 0.16), foliage(mid), { y: 1.32, ry });
  p.add(rbox(0.8, 0.44, 0.76, 0.14), foliage(light), { x: rnd.range(-0.1, 0.1), y: 1.72, z: rnd.range(-0.1, 0.1), ry: ry + 0.3 });
  const lumps = 4;
  for (let i = 0; i < lumps; i++) {
    const a = ry + (i / lumps) * Math.PI * 2 + rnd.range(-0.3, 0.3);
    p.add(rbox(0.5, 0.4, 0.48, 0.12), foliage(i % 2 ? dark : light), { x: Math.cos(a) * 0.55, y: rnd.range(1.14, 1.5), z: Math.sin(a) * 0.5, ry: a });
  }
}

/** A dead, bare tree: grey wood, a snapped top and a few crooked branches. */
function snag(p, rnd, v) {
  const lean = rnd.range(-0.12, 0.12);
  const shift = (y) => -Math.sin(lean) * (y - 0.7);
  p.add(cyl(0.07, 0.12, 1.4, 6), DEADWOOD, { y: 0.7, rz: lean });
  p.add(cone(0.075, 0.18, 5), DEADWOOD, { x: shift(1.48), y: 1.48, rz: lean + 0.3 }); // the jagged break
  const branches = 3 + v;
  for (let i = 0; i < branches; i++) {
    const y = 0.7 + i * (0.6 / branches) + rnd.range(0, 0.1);
    const a = rnd.range(0, Math.PI * 2);
    const len = rnd.range(0.4, 0.65);
    const tilt = rnd.range(0.7, 1.1);
    p.add(cyl(0.02, 0.04, len, 5), DEADWOOD, { x: shift(y) + Math.cos(a) * len * 0.4, y: y + len * 0.3, z: Math.sin(a) * len * 0.4, ry: -a, rz: -tilt, order: 'YZX' });
  }
  for (let i = 0; i < 3; i++) {
    const a = rnd.range(0, Math.PI * 2);
    p.add(box(0.08, 0.1, 0.3), DEADWOOD, { x: Math.cos(a) * 0.14, y: 0.04, z: Math.sin(a) * 0.14, ry: -a + Math.PI / 2 });
  }
  p.add(rbox(0.3, 0.2, 0.26, 0.07), foliage(LEAF_COLORS.oak[v][2]), { x: 0.16, y: 0.1, z: 0.12, ry: 0.5 }); // undergrowth
}

/** An old stump with a mushroom or two (decoration outside the map). */
function stump(p, rnd, v) {
  p.add(cyl(0.19, 0.24, 0.26, 9), TRUNK, { y: 0.13 });
  p.add(cyl(0.18, 0.18, 0.02, 9), MATERIALS.woodLight, { y: 0.265 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + rnd.range(0, 1);
    p.add(box(0.08, 0.08, 0.22), TRUNK, { x: Math.cos(a) * 0.22, y: 0.04, z: Math.sin(a) * 0.22, ry: -a + Math.PI / 2 });
  }
  for (let i = 0; i < 1 + v; i++) {
    const x = rnd.range(-0.25, 0.3);
    p.add(cyl(0.015, 0.02, 0.07, 5), MATERIALS.bone, { x, y: 0.035, z: 0.24 });
    p.add(sphere(0.045, 8, 5), MUSHROOM, { x, y: 0.075, z: 0.24, sy: 0.55 });
  }
  p.add(rbox(0.26, 0.18, 0.22, 0.06), foliage(LEAF_COLORS.oak[v][0]), { x: -0.24, y: 0.09, z: 0.1, ry: 0.4 });
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

const SCENERY_BUILDERS = { oak, pine, birch, spruce, beech, snag, stump, bush, rock, outcrop };
export const SCENERY_TYPES = Object.keys(SCENERY_BUILDERS);
export const SCENERY_VARIANTS = 3;

/** How much each kind sways in the wind (1 = a typical tree; slim birches more, stiff dead wood barely). */
export const SCENERY_SWAY = { oak: 1, pine: 0.8, birch: 1.35, spruce: 0.7, beech: 0.85, snag: 0.2, bush: 0.35 };

/** One tree, bush or rock (for baking into a sprite). `variant` picks its shape and colour. */
export function createSceneryObject(kind, variant = 0) {
  const p = new Parts();
  SCENERY_BUILDERS[kind](p, rng(kind.length * 31 + variant * 7 + 3), variant);
  return p.build();
}
