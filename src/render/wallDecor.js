import { banner, barrel, box, cone, crate, cyl, dodeca, MATERIALS, Parts, pennant, rng, sphere, std, torus } from './modelKit.js';

// Decorations that can be scattered sparsely along palisade walls for variety (flags, fires, shields…).
// Each is placed relative to a straight east–west wall tile's centre: the wall's logs stand along x at z = 0,
// and +z is the side the camera sees, so most things lean on or hang from that face.

const FLAME = std({ color: 0xffb040, emissive: 0xff7a10, emissiveIntensity: 1.6, roughness: 0.6 });
const FLAME_CORE = std({ color: 0xfff1a0, emissive: 0xffd040, emissiveIntensity: 1.8, roughness: 0.6 });
const EMBER = std({ color: 0xc0401a, emissive: 0xa02a08, emissiveIntensity: 1.2 });
const BRONZE = std({ color: 0xb08a3a, metalness: 0.6, roughness: 0.4 });
const SHIELD_RED = std({ color: 0xa8321f });
const SHIELD_BLUE = std({ color: 0x34507e });
const GLOW = std({ color: 0xffe08a, emissive: 0xffc040, emissiveIntensity: 1.4, roughness: 0.5 });
const FEATHER = std({ color: 0x1e1e24 });
const WATER = std({ color: 0x5a9fc0, roughness: 0.3 });

function flame(p, { x = 0, y, z = 0, s = 1 }) {
  p.add(cone(0.07 * s, 0.22 * s, 7), FLAME, { x, y: y + 0.11 * s, z });
  p.add(cone(0.04 * s, 0.14 * s, 6), FLAME_CORE, { x, y: y + 0.08 * s, z: z + 0.01 });
}

const DECOR = {
  /** A tall pole with a red pennant, planted just inside the wall. */
  pennantPole: (p) => pennant(p, { z: 0.16, h: 1.75, w: 0.5 }),
  /** A red banner with gold trim hung on the wall face. */
  hangingBanner: (p) => {
    p.add(box(0.36, 0.04, 0.04), MATERIALS.woodDark, { y: 1.02, z: 0.11 });
    banner(p, { y: 1.0, z: 0.1, w: 0.3, h: 0.6 });
  },
  /** A torch burning on a post. */
  torch: (p) => {
    p.add(cyl(0.03, 0.04, 1.25, 7), MATERIALS.woodDark, { y: 0.625, z: 0.2 });
    p.add(cyl(0.06, 0.035, 0.1, 8), MATERIALS.iron, { y: 1.27, z: 0.2 });
    flame(p, { y: 1.3, z: 0.2 });
  },
  /** An iron brazier of glowing coals on a tripod. */
  brazier: (p) => {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      p.add(box(0.03, 0.5, 0.03), MATERIALS.iron, { x: Math.cos(a) * 0.12, y: 0.24, z: 0.24 + Math.sin(a) * 0.12, rx: Math.sin(a) * 0.25, rz: -Math.cos(a) * 0.25 });
    }
    p.add(cyl(0.18, 0.1, 0.12, 12), MATERIALS.iron, { y: 0.52, z: 0.24 });
    for (let i = 0; i < 6; i++) p.add(dodeca(0.04), EMBER, { x: Math.cos(i) * 0.08, y: 0.59, z: 0.24 + Math.sin(i) * 0.08 });
    flame(p, { x: -0.04, y: 0.58, z: 0.24, s: 1.1 });
    flame(p, { x: 0.05, y: 0.58, z: 0.27, s: 0.8 });
  },
  /** Two painted round shields hung on the wall. */
  shields: (p) => {
    for (const [x, mat] of [
      [-0.2, SHIELD_RED],
      [0.18, SHIELD_BLUE],
    ]) {
      p.add(cyl(0.16, 0.16, 0.03, 16), mat, { x, y: 0.72, z: 0.11, rx: Math.PI / 2 });
      p.add(torus(0.16, 0.012, 16), MATERIALS.iron, { x, y: 0.72, z: 0.125 });
      p.add(sphere(0.04, 8, 6), MATERIALS.gold, { x, y: 0.72, z: 0.13 });
    }
  },
  /** Spears leaning against the wall. */
  spears: (p) => {
    for (const [x, lean] of [
      [-0.16, 0.2],
      [0.0, 0.26],
      [0.14, 0.18],
    ]) {
      p.add(cyl(0.015, 0.015, 1.45, 5), MATERIALS.woodDark, { x, y: 0.7, z: 0.28, rx: -lean });
      p.add(cone(0.03, 0.14, 5), MATERIALS.iron, { x, y: 1.43, z: 0.28 - Math.sin(lean) * 0.72, rx: -lean });
    }
  },
  /** A ladder leaning against the wall. */
  ladder: (p) => {
    const lean = 0.3;
    for (const x of [-0.12, 0.12]) p.add(box(0.035, 1.3, 0.035), MATERIALS.woodLight, { x, y: 0.62, z: 0.3, rx: -lean });
    for (let i = 0; i < 6; i++) {
      const t = (i + 0.5) / 6;
      p.add(box(0.26, 0.025, 0.025), MATERIALS.woodLight, { y: 0.06 + t * 1.18, z: 0.3 + 0.19 - t * 0.38 });
    }
  },
  /** Barrels and a crate stacked at the foot of the wall. */
  supplies: (p) => {
    barrel(p, { x: -0.18, z: 0.22 });
    barrel(p, { x: 0.06, z: 0.26, r: 0.11, h: 0.26 });
    crate(p, { x: 0.24, z: 0.2, s: 0.22, ry: 0.3 });
    crate(p, { x: 0.24, y: 0.22, z: 0.2, s: 0.16, ry: 0.9 });
  },
  /** A stack of split firewood. */
  firewood: (p) => {
    const rnd = rng(7);
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 4 - row; i++) {
        p.add(cyl(0.05, 0.05, 0.5, 7), rnd.pick([MATERIALS.wood, MATERIALS.woodLight, MATERIALS.woodDark]), {
          x: rnd.range(-0.03, 0.03),
          y: 0.05 + row * 0.085,
          z: 0.16 + (i - (3 - row) / 2) * 0.1,
          rz: Math.PI / 2,
        });
      }
    }
  },
  /** An alarm bell hung in a small post frame. */
  alarmBell: (p) => {
    for (const x of [-0.16, 0.16]) p.add(box(0.05, 1.05, 0.05), MATERIALS.woodDark, { x, y: 0.52, z: 0.25 });
    p.add(box(0.42, 0.06, 0.06), MATERIALS.woodDark, { y: 1.04, z: 0.25 });
    p.add(cyl(0.05, 0.11, 0.16, 12), BRONZE, { y: 0.9, z: 0.25 });
    p.add(sphere(0.025, 6, 5), MATERIALS.iron, { y: 0.81, z: 0.25 });
  },
  /** A lantern hanging from an iron arm on a stake. */
  lantern: (p) => {
    p.add(box(0.035, 0.035, 0.32), MATERIALS.iron, { y: 1.06, z: 0.22 });
    p.add(box(0.016, 0.1, 0.016), MATERIALS.iron, { y: 1.0, z: 0.36 });
    p.add(box(0.14, 0.18, 0.14), GLOW, { y: 0.85, z: 0.36 });
    for (const [x, z] of [
      [-0.07, -0.07],
      [0.07, -0.07],
      [-0.07, 0.07],
      [0.07, 0.07],
    ]) {
      p.add(box(0.02, 0.19, 0.02), MATERIALS.iron, { x, y: 0.85, z: 0.36 + z });
    }
    p.add(cone(0.11, 0.09, 4), MATERIALS.iron, { y: 0.985, z: 0.36, ry: Math.PI / 4 });
    p.add(box(0.15, 0.025, 0.15), MATERIALS.iron, { y: 0.75, z: 0.36 });
  },
  /** A bow and a quiver of arrows hung on the wall. */
  bowAndQuiver: (p) => {
    p.add(torus(0.3, 0.018, 14), MATERIALS.woodDark, { x: -0.17, y: 0.76, z: 0.12, sx: 0.45, rz: 0.15 });
    p.add(box(0.008, 0.56, 0.008), MATERIALS.rope, { x: -0.13, y: 0.76, z: 0.12, rz: 0.15 });
    p.add(cyl(0.075, 0.065, 0.46, 8), MATERIALS.leather, { x: 0.17, y: 0.64, z: 0.14, rz: -0.2 });
    for (let i = 0; i < 5; i++) p.add(cone(0.03, 0.09, 4), MATERIALS.bannerRed, { x: 0.13 + i * 0.022, y: 0.9, z: 0.14, rz: -0.2 });
  },
  /** A crow perched on top of a stake. */
  crow: (p) => {
    p.add(sphere(0.09, 9, 7), FEATHER, { y: 1.36, sz: 1.4 });
    p.add(sphere(0.058, 8, 6), FEATHER, { y: 1.46, z: 0.1 });
    p.add(cone(0.02, 0.08, 4), MATERIALS.gold, { y: 1.455, z: 0.18, rx: Math.PI / 2 });
    p.add(box(0.05, 0.015, 0.15), FEATHER, { y: 1.35, z: -0.15, rx: -0.3 });
    for (const x of [-0.03, 0.03]) p.add(box(0.012, 0.06, 0.012), MATERIALS.gold, { x, y: 1.29 });
  },
  /** A water bucket and a ladle, ready for fires. */
  waterBucket: (p) => {
    for (const [x, s] of [
      [-0.12, 1],
      [0.15, 0.8],
    ]) {
      p.add(cyl(0.15 * s, 0.12 * s, 0.28 * s, 12), MATERIALS.woodLight, { x, y: 0.14 * s, z: 0.24 });
      p.add(cyl(0.14 * s, 0.14 * s, 0.01, 12), WATER, { x, y: 0.27 * s, z: 0.24 });
      p.add(torus(0.15 * s, 0.012, 12), MATERIALS.iron, { x, y: 0.22 * s, z: 0.24, rx: Math.PI / 2 });
      p.add(torus(0.14 * s, 0.012, 10), MATERIALS.iron, { x, y: 0.28 * s, z: 0.24, ry: 0.2 });
    }
  },
};

export const WALL_DECOR_KINDS = Object.keys(DECOR);

/** One wall decoration (see DECOR), at a wall tile's centre. */
export function createWallDecor(kind) {
  const p = new Parts();
  DECOR[kind](p);
  const g = p.build();
  g.name = kind;
  return g;
}

