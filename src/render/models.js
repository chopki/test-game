import * as THREE from 'three';
import {
  BOULDER,
  GREYSTONE,
  MATERIALS,
  Parts,
  SANDSTONE,
  SLATE,
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
  ico,
  merlonsRect,
  merlonsRing,
  octa,
  pennant,
  place,
  rbox,
  rng,
  shingleCone,
  shingleGable,
  sphere,
  std,
  stoneBlocks,
  stoneRing,
  timberFace,
  torus,
  wheel,
  windowFrame,
} from './modelKit.js';

// The game's models, built after docs/reference/art-style.jpg: block-laid sandstone, red clay shingles, timber
// framing and plaster, chunky crenellations, round leafy trees, green goblins and orcs, grey trolls.
//
// These are only rendered when sprites are baked (see spriteBaker.js), so they can be as detailed as needed.
// Parts that move in game (turrets, the catapult arm, the spire crystal) are exposed on userData and baked
// separately in their poses. +z and +x are the faces the iso camera sees, so most detail goes there.

// ------------------------------------------------------------------ buildings

function townHall() {
  const M = MATERIALS;
  const p = new Parts();
  const rnd = rng(11);
  // Flagstone platform and front steps.
  stoneBlocks(p, { w: 2.92, h: 0.2, d: 2.92, rows: 1, rnd, minBlock: 0.36, maxBlock: 0.62 });
  stoneBlocks(p, { y: 0.2, z: 1.06, w: 0.8, h: 0.1, d: 0.28, rows: 1, rnd });
  // Stone ground floor.
  stoneBlocks(p, { y: 0.2, z: 0.1, w: 2.2, h: 1.0, d: 1.6, rows: 5, rnd });
  // Jettied, half-timbered upper floor.
  p.add(box(2.48, 0.1, 1.86), M.beam, { y: 1.25, z: 0.1 });
  p.add(box(2.36, 0.9, 1.76), M.plaster, { y: 1.75, z: 0.1 });
  timberFace(p, { y: 1.75, z: 0.98, w: 2.36, h: 0.9 });
  timberFace(p, { y: 1.75, z: -0.78, w: 2.36, h: 0.9, ry: Math.PI });
  timberFace(p, { x: 1.18, y: 1.75, z: 0.1, w: 1.76, h: 0.9, ry: Math.PI / 2, spacing: 0.45 });
  timberFace(p, { x: -1.18, y: 1.75, z: 0.1, w: 1.76, h: 0.9, ry: -Math.PI / 2, spacing: 0.45 });
  for (const x of [-0.78, 0.78]) windowFrame(p, { x, y: 1.75, z: 1.0, w: 0.26, h: 0.32 });
  for (const z of [-0.35, 0.55]) windowFrame(p, { x: 1.2, y: 1.75, z, ry: Math.PI / 2, w: 0.24, h: 0.3 });
  // Ground floor: door, windows and banners.
  door(p, { z: 0.9, y: 0.2, w: 0.5, h: 0.74 });
  for (const x of [-0.72, 0.72]) windowFrame(p, { x, y: 0.72, z: 0.92, w: 0.24, h: 0.3, shutters: false });
  windowFrame(p, { x: 1.11, y: 0.72, z: 0.35, ry: Math.PI / 2, w: 0.24, h: 0.3, shutters: false });
  for (const x of [-0.42, 0.42]) banner(p, { x, y: 1.1, z: 0.92, w: 0.22, h: 0.5 });
  // Main roof and a front cross-gable over the door.
  shingleGable(p, { y: 2.2, z: 0.1, length: 2.36, width: 1.76, height: 1.15, rnd });
  p.add(box(0.92, 0.9, 0.56), M.plaster, { y: 1.75, z: 1.26 });
  timberFace(p, { y: 1.75, z: 1.54, w: 0.92, h: 0.9, spacing: 0.46 });
  windowFrame(p, { y: 1.78, z: 1.56, w: 0.22, h: 0.3 });
  shingleGable(p, { y: 2.2, z: 1.2, length: 0.7, width: 1.0, height: 0.72, ry: Math.PI / 2, rnd, overhang: 0.1 });
  // Chimney.
  stoneBlocks(p, { x: 0.72, y: 2.3, z: -0.32, w: 0.3, h: 1.0, d: 0.3, rows: 4, rnd });
  p.add(box(0.36, 0.06, 0.36), M.capstone, { x: 0.72, y: 3.33, z: -0.32 });
  // Round stone corner tower with a stepped cone roof.
  stoneRing(p, { x: -1.06, y: 0.2, z: -0.86, r: 0.5, h: 3.0, rnd, taper: 0.04 });
  for (const y of [1.3, 2.3]) windowFrame(p, { x: -0.85, y, z: -0.43, ry: Math.PI / 5, w: 0.14, h: 0.26, shutters: false });
  p.add(cyl(0.52, 0.52, 0.08, 16), M.capstone, { x: -1.06, y: 3.22, z: -0.86 });
  shingleCone(p, { x: -1.06, y: 3.24, z: -0.86, r: 0.68, h: 1.35, rows: 7, rnd });
  pennant(p, { x: -1.06, y: 4.55, z: -0.86, h: 0.55, w: 0.42 });
  // Small watch turret on the front-right corner.
  stoneRing(p, { x: 1.13, y: 0.2, z: 0.93, r: 0.3, h: 2.1, rnd, thickness: 0.16, blockLen: 0.32 });
  shingleCone(p, { x: 1.13, y: 2.3, z: 0.93, r: 0.42, h: 0.85, rows: 5, rnd });
  // Props.
  barrel(p, { x: -1.15, y: 0.2, z: 1.15 });
  barrel(p, { x: -0.92, y: 0.2, z: 1.25, r: 0.11, h: 0.26 });
  crate(p, { x: 1.25, y: 0.2, z: -0.95, ry: 0.4 });
  groundDressing(p, { w: 2.92, d: 2.92, rnd, count: 16 });
  return p.build();
}

/**
 * A wall tile that joins up with its neighbours. `connections` = { n, e, s, w } booleans: true where the
 * neighbouring tile has a wall or another building, so runs, corners and tower joins connect.
 */
function wall({ connections = {} } = {}) {
  const M = MATERIALS;
  const p = new Parts();
  const key = ['n', 'e', 's', 'w'].map((d) => (connections[d] ? 1 : 0)).join('');
  const rnd = rng(parseInt(key, 2) + 101);
  const H = 1.0;
  const T = 0.58;
  const dirs = [
    ['e', 1, 0],
    ['w', -1, 0],
    ['s', 0, 1],
    ['n', 0, -1],
  ].filter(([k]) => connections[k]);
  const straight = dirs.length === 2 && dirs[0][1] === -dirs[1][1] && dirs[0][2] === -dirs[1][2];

  for (const [, dx, dz] of dirs) {
    const alongX = dx !== 0;
    const c = { x: dx * 0.25, z: dz * 0.25 };
    const [w, d] = alongX ? [0.5, T] : [T, 0.5];
    // Footing course, then the wall body, built along the run.
    stoneBlocks(p, { ...c, w: alongX ? 0.5 : T + 0.1, d: alongX ? T + 0.1 : 0.5, h: 0.16, rows: 1, along: alongX ? 'x' : 'z', rnd });
    stoneBlocks(p, { ...c, y: 0.16, w, h: H - 0.16, d, rows: 3, along: alongX ? 'x' : 'z', rnd });
    // One merlon per arm and side, so runs of wall get evenly spaced crenellations (0.5 apart).
    for (const side of [-1, 1]) {
      const off = side * (T / 2 - 0.09);
      const at = { x: alongX ? dx * 0.25 : off, z: alongX ? off : dz * 0.25 };
      p.add(box(0.2, 0.24, 0.17), rnd.pick(SANDSTONE), { ...at, y: H + 0.12, ry: alongX ? 0 : Math.PI / 2 });
      p.add(box(0.24, 0.05, 0.21), M.capstone, { ...at, y: H + 0.265, ry: alongX ? 0 : Math.PI / 2 });
    }
  }

  if (straight) {
    const alongX = dirs[0][1] !== 0;
    stoneBlocks(p, { w: T, d: T, h: 0.16, rows: 1, along: alongX ? 'x' : 'z', rnd });
    stoneBlocks(p, { y: 0.16, w: T, d: T, h: H - 0.16, rows: 3, along: alongX ? 'x' : 'z', rnd });
  } else {
    // End, corner or junction: a buttressed post with its own merlons.
    const size = dirs.length === 0 ? 0.74 : 0.7;
    const h = H + (dirs.length === 0 ? 0.18 : 0.28);
    stoneBlocks(p, { w: size + 0.1, d: size + 0.1, h: 0.18, rows: 1, rnd });
    stoneBlocks(p, { y: 0.18, w: size, d: size, h: h - 0.18, rows: 4, along: 'z', rnd });
    p.add(box(size + 0.06, 0.06, size + 0.06), M.capstone, { y: h + 0.03 });
    merlonsRect(p, { y: h + 0.06, w: size, d: size, size: 0.17, height: 0.22, spacing: 0.27, rnd });
  }
  groundDressing(p, { w: 0.6, d: 0.6, rnd, count: 3 });
  const g = p.build();
  g.userData.connections = connections;
  return g;
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

function archerTower() {
  const M = MATERIALS;
  const p = new Parts();
  const rnd = rng(23);
  stoneBlocks(p, { w: 1.72, h: 0.22, d: 1.72, rows: 1, rnd, minBlock: 0.3, maxBlock: 0.5 });
  // Tapering shaft: one course at a time, alternating direction so the corners interlock.
  const courses = 10;
  const top = 2.5;
  for (let i = 0; i < courses; i++) {
    const t = i / (courses - 1);
    const w = 1.34 - 0.2 * t;
    const rowH = (top - 0.22) / courses;
    stoneBlocks(p, { y: 0.22 + i * rowH, w, d: w, h: rowH, rows: 1, along: i % 2 ? 'x' : 'z', rnd });
  }
  door(p, { y: 0.22, z: 0.67, w: 0.38, h: 0.56 });
  for (const [x, z, ry] of [
    [0, 0.62, 0],
    [0.62, 0, Math.PI / 2],
  ]) {
    for (const y of [1.25, 1.95]) {
      const at = place(x, z, ry, 0, 0.005);
      p.add(box(0.07, 0.3, 0.05), M.opening, { x: at.x, y, z: at.z, ry });
      p.add(box(0.15, 0.05, 0.07), M.capstone, { x: at.x, y: y - 0.17, z: at.z, ry });
    }
  }
  // Corbels under an overhanging fighting platform, then the parapet.
  for (let i = 0; i < 5; i++) {
    const t = -0.5 + (i + 0.5) / 5;
    for (const [x, z] of [
      [t * 1.2, 0.6],
      [0.6, t * 1.2],
      [t * 1.2, -0.6],
      [-0.6, t * 1.2],
    ]) {
      p.add(box(0.12, 0.16, 0.12), rnd.pick(SANDSTONE), { x: x * 1.04, y: top - 0.04, z: z * 1.04 });
    }
  }
  stoneBlocks(p, { y: top + 0.04, w: 1.56, d: 1.56, h: 0.16, rows: 1, rnd, minBlock: 0.3, maxBlock: 0.5 });
  p.add(box(1.3, 0.04, 1.3), M.woodLight, { y: top + 0.21 });
  merlonsRect(p, { y: top + 0.2, w: 1.56, d: 1.56, size: 0.22, height: 0.32, spacing: 0.4, rnd });
  archer(p, { x: 0.2, y: top + 0.23, z: 0.25, ry: Math.PI / 4 });
  pennant(p, { x: -0.55, y: top + 0.2, z: -0.55, h: 1.05, w: 0.46 });
  groundDressing(p, { w: 1.72, d: 1.72, rnd, count: 9 });
  return p.build();
}

function cannonTower() {
  const M = MATERIALS;
  const p = new Parts();
  const rnd = rng(37);
  stoneRing(p, { r: 0.98, h: 0.2, rows: 1, rnd, thickness: 0.3, blockLen: 0.5 });
  stoneRing(p, { y: 0.2, r: 0.88, h: 1.05, rows: 4, rnd, taper: 0.06, thickness: 0.26 });
  p.add(cyl(0.86, 0.86, 0.08, 20), M.capstone, { y: 1.29 });
  p.add(cyl(0.74, 0.74, 0.04, 20), M.woodLight, { y: 1.33 });
  merlonsRing(p, { y: 1.33, r: 0.78, count: 10, size: 0.22, height: 0.28, rnd });
  door(p, { y: 0.2, z: 0.85, w: 0.36, h: 0.54 });
  windowFrame(p, { x: 0.6, y: 0.85, z: 0.6, ry: Math.PI / 4, w: 0.14, h: 0.22, shutters: false });
  // A neat pyramid of cannonballs.
  for (const [x, z, y] of [
    [-0.42, -0.2, 0],
    [-0.28, -0.32, 0],
    [-0.46, -0.38, 0],
    [-0.39, -0.3, 0.1],
  ]) {
    p.add(sphere(0.07, 8, 6), M.cannonball, { x, y: 1.42 + y, z });
  }
  groundDressing(p, { w: 1.9, d: 1.9, rnd, count: 9 });
  const g = p.build();

  // Turret: a heavy cannon on a carriage with spoked wheels; rotates to aim (+z is forward).
  const t = new Parts({ yOffset: 1.35 });
  for (const sx of [-0.18, 0.18]) t.add(box(0.07, 0.24, 0.72), M.wood, { x: sx, y: 0.17, z: -0.02 });
  t.add(box(0.44, 0.06, 0.5), M.woodDark, { y: 0.07 });
  for (const sx of [-0.27, 0.27]) {
    for (const sz of [-0.22, 0.22]) wheel(t, { x: sx, y: 0.14, z: sz, r: 0.14, spokes: 5 });
  }
  t.add(cyl(0.13, 0.18, 1.0, 14), M.iron, { y: 0.36, z: 0.2, rx: Math.PI / 2 - 0.2 });
  for (const zz of [0.62, 0.04]) t.add(torus(0.17, 0.03, 14), M.iron, { y: 0.36 + (zz - 0.2) * Math.sin(0.2), z: zz, rx: -0.2 });
  t.add(sphere(0.19, 12, 9), M.iron, { y: 0.28, z: -0.28 });
  t.add(sphere(0.06, 8, 6), M.iron, { y: 0.24, z: -0.48 });
  const turret = t.build();
  turret.position.y = 1.35;
  g.add(turret);
  g.userData.turret = turret;
  return g;
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

function magicSpire() {
  const M = MATERIALS;
  const p = new Parts();
  const rnd = rng(41);
  // Three-tier dark stone platform with glowing runes.
  let y = 0;
  for (const [w, h] of [
    [1.82, 0.24],
    [1.46, 0.28],
    [1.12, 0.28],
  ]) {
    stoneBlocks(p, { y, w, d: w, h, rows: 1, rnd, stones: GREYSTONE, mortar: M.mortarDark, minBlock: 0.28, maxBlock: 0.46 });
    p.add(box(w + 0.04, 0.04, w + 0.04), M.capstone, { y: y + h + 0.01 });
    for (const [rx, rz, ry] of [
      [0, w / 2 + 0.01, 0],
      [w / 2 + 0.01, 0, Math.PI / 2],
    ]) {
      for (const k of [-0.25, 0, 0.25]) {
        const at = place(rx, rz, ry, k * w, 0);
        p.add(box(0.1, 0.05, 0.02), M.rune, { x: at.x, y: y + h / 2, z: at.z, ry });
      }
    }
    y += h + 0.02;
  }
  // Tapering obelisk.
  const courses = 8;
  const top = 2.75;
  for (let i = 0; i < courses; i++) {
    const t = i / (courses - 1);
    const w = 0.62 - 0.26 * t;
    const rowH = (top - y) / courses;
    stoneBlocks(p, { y: y + i * rowH, w, d: w, h: rowH, rows: 1, along: i % 2 ? 'x' : 'z', rnd, stones: GREYSTONE, mortar: M.mortarDark, minBlock: 0.18, maxBlock: 0.32 });
  }
  for (const [x, z, ry] of [
    [0, 0.26, 0],
    [0.26, 0, Math.PI / 2],
  ]) {
    const at = place(x, z, ry, 0, 0.0);
    p.add(box(0.05, 1.3, 0.03), M.rune, { x: at.x, y: y + 0.9, z: at.z, ry });
  }
  p.add(box(0.44, 0.08, 0.44), M.capstone, { y: top + 0.04 });
  p.add(cone(0.34, 0.6, 4), SLATE[0], { y: top + 0.38, ry: Math.PI / 4 });
  p.add(octa(0.07), M.crystal, { y: top + 0.74, sy: 1.8 });
  for (const [x, z] of [
    [0.72, 0.72],
    [-0.72, 0.72],
    [0.72, -0.72],
    [-0.72, -0.72],
  ]) {
    crystalCluster(p, { x, y: 0.24, z, rnd });
  }
  groundDressing(p, { w: 1.82, d: 1.82, rnd, count: 8 });
  const g = p.build();
  // Floating crystal, baked separately and bobbed in game.
  const c = new Parts({ yOffset: 3.4 });
  c.add(octa(0.26), M.crystal, { sy: 1.6 });
  for (const a of [0, 2.1, 4.2]) c.add(octa(0.06), M.crystal, { x: Math.cos(a) * 0.32, y: Math.sin(a * 2) * 0.08, z: Math.sin(a) * 0.32, sy: 1.7 });
  const crystal = c.build();
  crystal.position.y = 3.45;
  g.add(crystal);
  g.userData.crystal = crystal;
  return g;
}

function catapult() {
  const M = MATERIALS;
  const p = new Parts();
  const rnd = rng(53);
  // Plank deck on stone footings, with a pile of boulders.
  for (const [x, z] of [
    [-0.72, -0.72],
    [0.72, -0.72],
    [-0.72, 0.72],
    [0.72, 0.72],
  ]) {
    stoneBlocks(p, { x, z, w: 0.24, d: 0.24, h: 0.16, rows: 1, rnd });
  }
  p.add(box(1.62, 0.08, 1.62), M.woodLight, { y: 0.2 });
  for (let i = 0; i < 7; i++) p.add(box(0.03, 0.01, 1.62), M.woodDark, { x: -0.7 + i * 0.233, y: 0.245 });
  for (const s of [-1, 1]) {
    p.add(box(1.7, 0.09, 0.09), M.beam, { y: 0.23, z: s * 0.8 });
    p.add(box(0.09, 0.09, 1.7), M.beam, { x: s * 0.8, y: 0.23 });
  }
  for (const [x, z, r] of [
    [-0.6, -0.45, 0.13],
    [-0.45, -0.6, 0.11],
    [-0.62, -0.62, 0.1],
    [-0.52, -0.52, 0.09],
  ]) {
    p.add(dodeca(r), M.boulder, { x, y: 0.3 + (r < 0.1 ? 0.12 : 0), z });
  }
  groundDressing(p, { w: 1.7, d: 1.7, rnd, count: 8 });
  const g = p.build();

  // Turret: frame on wheels (rotates to aim, +z forward) carrying the throwing arm.
  const t = new Parts({ yOffset: 0.36 });
  for (const sx of [-0.4, 0.4]) {
    t.add(box(0.1, 0.1, 1.3), M.wood, { x: sx, y: 0.12 });
    t.add(box(0.09, 0.9, 0.09), M.wood, { x: sx, y: 0.52, z: -0.14, rx: 0.32 });
    t.add(box(0.09, 0.9, 0.09), M.wood, { x: sx, y: 0.52, z: 0.14, rx: -0.32 });
    for (const sz of [-0.48, 0.48]) wheel(t, { x: sx + Math.sign(sx) * 0.09, y: 0.12, z: sz, r: 0.15, spokes: 6 });
  }
  for (const sz of [-0.56, 0.56]) t.add(box(0.9, 0.09, 0.09), M.wood, { y: 0.14, z: sz });
  t.add(cyl(0.045, 0.045, 0.96, 8), M.iron, { y: 0.88, rz: Math.PI / 2 });
  t.add(box(0.86, 0.1, 0.1), M.woodDark, { y: 0.6, z: 0.42 });
  t.add(torus(0.08, 0.025, 10), M.rope, { x: 0.3, y: 0.62, z: 0.42, ry: Math.PI / 2 });
  const turret = t.build();
  turret.position.y = 0.36;

  // Throwing arm: pivots at the axle; the bucket end points to -z when loaded.
  const a = new Parts({ yOffset: 1.24 });
  a.add(box(0.1, 0.1, 1.5), M.woodDark, { z: -0.42 });
  a.add(cyl(0.17, 0.11, 0.14, 12), M.wood, { y: 0.06, z: -1.12 });
  a.add(torus(0.16, 0.02, 12), M.iron, { y: 0.12, z: -1.12, rx: Math.PI / 2 });
  stoneBlocks(a, { y: -0.27, z: 0.38, w: 0.36, h: 0.3, d: 0.3, rows: 2, rnd });
  for (const yy of [-0.2, -0.05]) a.add(box(0.4, 0.03, 0.34), M.iron, { y: yy, z: 0.38 });
  const arm = a.build();
  arm.position.y = 0.88;
  const ammo = new Parts({ yOffset: 1.3 }).add(dodeca(0.13), M.boulder).build();
  ammo.position.set(0, 0.2, -1.12);
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
// Each enemy's parts are merged into a `body` group. Models face +z.

function finishEnemy(p) {
  const g = new THREE.Group();
  const body = p.build();
  g.add(body);
  g.userData.body = body;
  return g;
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
  const p = new Parts();
  for (const s of [-1, 1]) {
    p.add(capsule(0.045, 0.18), M.goblinSkinDark, { x: s * 0.08, y: 0.13 });
    p.add(box(0.08, 0.05, 0.12), M.leatherDark, { x: s * 0.08, y: 0.025, z: 0.02 });
  }
  p.add(box(0.26, 0.12, 0.18), M.cloth, { y: 0.28 }); // loincloth
  p.add(capsule(0.13, 0.14), M.leather, { y: 0.45, z: 0.02, rx: 0.25 }); // hunched torso in a vest
  p.add(box(0.28, 0.04, 0.2), M.leatherDark, { y: 0.36, z: 0.02 }); // belt
  goblinHead(p, { y: 0.72, z: 0.08 });
  for (const s of [-1, 1]) p.add(capsule(0.04, 0.2), M.goblinSkin, { x: s * 0.19, y: 0.45, z: 0.06, rz: s * 0.25, rx: -0.4 });
  // Spiked club.
  p.add(cyl(0.035, 0.065, 0.42, 8), M.woodDark, { x: 0.23, y: 0.48, z: 0.2, rx: 0.9 });
  for (let i = 0; i < 4; i++) p.add(cone(0.02, 0.06, 4), M.bone, { x: 0.23 + (i % 2 ? 0.05 : -0.05), y: 0.6, z: 0.36, rx: 0.9 + i });
  return finishEnemy(p);
}

function runner() {
  const M = MATERIALS;
  const p = new Parts();
  for (const s of [-1, 1]) p.add(capsule(0.035, 0.18), M.goblinSkinDark, { x: s * 0.065, y: 0.12, rx: s * 0.3 });
  p.add(capsule(0.1, 0.12), M.hood, { y: 0.38, z: 0.03, rx: 0.4 });
  goblinHead(p, { y: 0.6, z: 0.1, s: 0.85 });
  p.add(cone(0.15, 0.26, 8), M.hood, { y: 0.7, z: 0.06, rx: -0.3 }); // hood
  p.add(cone(0.16, 0.36, 8), M.hood, { y: 0.32, z: -0.08, rx: -0.5 }); // cape
  p.add(box(0.025, 0.025, 0.26), M.iron, { x: 0.15, y: 0.38, z: 0.18 }); // dagger
  p.add(box(0.06, 0.03, 0.03), M.gold, { x: 0.15, y: 0.38, z: 0.05 });
  return finishEnemy(p);
}

function orc() {
  const M = MATERIALS;
  const p = new Parts();
  for (const s of [-1, 1]) {
    p.add(capsule(0.07, 0.22), M.leatherDark, { x: s * 0.11, y: 0.17 });
    p.add(box(0.12, 0.07, 0.17), M.iron, { x: s * 0.11, y: 0.035, z: 0.03 });
  }
  p.add(box(0.36, 0.16, 0.24), M.leather, { y: 0.38 });
  p.add(capsule(0.19, 0.16), M.orcSkin, { y: 0.62, z: 0.02, rx: 0.15 });
  p.add(box(0.4, 0.3, 0.3), M.iron, { y: 0.66, z: 0.03, rx: 0.15 }); // breastplate
  for (const s of [-1, 1]) {
    p.add(sphere(0.13, 10, 7), M.iron, { x: s * 0.27, y: 0.84, sy: 0.7 }); // pauldrons
    p.add(cone(0.035, 0.12, 5), M.bone, { x: s * 0.3, y: 0.95, rz: -s * 0.5 });
    p.add(capsule(0.065, 0.24), M.orcSkin, { x: s * 0.32, y: 0.6, z: 0.05, rz: s * 0.15, rx: -0.3 });
  }
  p.add(sphere(0.15, 12, 9), M.orcSkin, { y: 1.0, z: 0.06 });
  p.add(box(0.2, 0.06, 0.12), M.orcSkin, { y: 0.92, z: 0.15 }); // jaw
  for (const s of [-1, 1]) {
    p.add(cone(0.022, 0.08, 5), M.bone, { x: s * 0.06, y: 0.97, z: 0.2 });
    p.add(sphere(0.028, 6, 5), M.eyes, { x: s * 0.06, y: 1.04, z: 0.18 });
  }
  p.add(box(0.2, 0.05, 0.05), M.leatherDark, { y: 1.08, z: 0.16 }); // brow
  // Two-handed axe.
  p.add(cyl(0.025, 0.025, 0.8, 6), M.woodDark, { x: 0.36, y: 0.6, z: 0.18, rx: 0.15 });
  p.add(box(0.03, 0.24, 0.2), M.iron, { x: 0.36, y: 0.92, z: 0.3, rx: 0.15 });
  return finishEnemy(p);
}

function brute() {
  const M = MATERIALS;
  const p = new Parts();
  for (const s of [-1, 1]) {
    p.add(cyl(0.12, 0.16, 0.42, 10), M.trollSkinDark, { x: s * 0.2, y: 0.21 });
    p.add(sphere(0.13, 10, 7), M.trollSkinDark, { x: s * 0.2, y: 0.04, z: 0.06, sy: 0.5 });
  }
  p.add(box(0.56, 0.2, 0.42), M.leather, { y: 0.46 }); // loincloth
  p.add(sphere(0.42, 14, 10), M.trollSkin, { y: 0.86, z: 0.04, sy: 1.05, sz: 0.9 }); // hunched torso
  p.add(sphere(0.3, 12, 9), M.trollSkinDark, { y: 1.08, z: -0.12, sx: 1.1 }); // back hump
  p.add(sphere(0.17, 12, 9), M.trollSkin, { y: 1.18, z: 0.3 }); // head, jutting forward
  p.add(box(0.22, 0.07, 0.12), M.trollSkinDark, { y: 1.1, z: 0.42 }); // jaw
  for (const s of [-1, 1]) {
    p.add(sphere(0.032, 6, 5), M.eyes, { x: s * 0.065, y: 1.22, z: 0.45 });
    p.add(cone(0.025, 0.07, 5), M.bone, { x: s * 0.07, y: 1.15, z: 0.47, rx: -0.4 });
    // Long arms ending in big fists.
    p.add(cyl(0.08, 0.12, 0.72, 10), M.trollSkin, { x: s * 0.46, y: 0.62, z: 0.14, rz: s * 0.18 });
    p.add(sphere(0.13, 10, 7), M.trollSkinDark, { x: s * 0.52, y: 0.24, z: 0.18 });
  }
  // Tree-trunk club.
  p.add(cyl(0.07, 0.15, 0.95, 10), M.woodDark, { x: 0.55, y: 0.38, z: 0.45, rx: 1.05 });
  p.add(dodeca(0.13), MATERIALS.boulder, { x: 0.55, y: 0.14, z: 0.82 });
  return finishEnemy(p);
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
    c.position.set(0, type === 'brute' ? 1.36 : 1.15, type === 'brute' ? 0.3 : 0);
    g.userData.body.add(c);
  }
  return g;
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
