import * as THREE from 'three';
import { box, capsule, cone, cyl, MATERIALS, Parts, sphere, std } from './modelKit.js';

/**
 * Wild animals for the woods' edge (decoration; see wildlife.js): a deer and a rabbit, each facing +z, in four
 * poses: 'graze' (head down), 'alert' (head up), and two running frames, 'run0' (legs gathered) and 'run1'
 * (stretched out). Baked per direction like the enemies.
 */
export const ANIMAL_KINDS = ['deer', 'rabbit'];
export const ANIMAL_POSES = ['graze', 'alert', 'run0', 'run1'];

const HIDE = std({ color: 0x9a6438 });
const HIDE_PALE = std({ color: 0xd9bf98 });
const FUR = std({ color: 0x8c7a66 });
const FUR_PALE = std({ color: 0xe8ddcc });
const DARK = std({ color: 0x2a2018 });

function deer(p, pose) {
  const M = MATERIALS;
  const run = pose.startsWith('run');
  const stretch = pose === 'run1';
  const bodyY = run ? 0.5 : 0.48;
  p.add(capsule(0.12, 0.36), HIDE, { y: bodyY, rx: Math.PI / 2 + (run ? (stretch ? -0.12 : 0.1) : 0) });
  p.add(sphere(0.1, 8, 6), HIDE_PALE, { y: bodyY - 0.02, z: -0.27, sx: 0.8 }); // rump
  p.add(cone(0.035, 0.1, 5), FUR_PALE, { y: bodyY + 0.06, z: -0.33, rx: -2.2 }); // tail
  // Legs: hips at the back, shoulders at the front.
  const LEG = bodyY - 0.03;
  for (const [lx, lz, front] of [[-0.07, 0.17, 1], [0.07, 0.17, 1], [-0.07, -0.19, 0], [0.07, -0.19, 0]]) {
    // Swung from the hip: forward is +z. Stretched out in a leap, gathered under the body between.
    const swing = run ? (front ? 1 : -1) * (stretch ? 0.75 : -0.4) : 0;
    const footY = bodyY - Math.cos(swing) * LEG;
    const footZ = lz + Math.sin(swing) * LEG;
    p.add(box(0.035, LEG, 0.035), HIDE, { x: lx, y: (bodyY + footY) / 2, z: (lz + footZ) / 2, rx: -swing });
    p.add(box(0.03, 0.04, 0.04), DARK, { x: lx, y: footY + 0.02, z: footZ }); // hoof
  }
  // Neck and head: down to the grass when grazing, up and alert otherwise.
  const down = pose === 'graze';
  const neckA = down ? 2.45 : run ? 0.75 : 0.35; // from straight up, tipping forwards
  const neckLen = down ? 0.4 : 0.26;
  const nx = 0;
  const ny = bodyY + 0.06;
  const nz = 0.2;
  const hx = nx;
  const hy = ny + Math.cos(neckA) * neckLen;
  const hz = nz + Math.sin(neckA) * neckLen;
  p.add(cyl(0.045, 0.06, neckLen, 6), HIDE, { x: nx, y: (ny + hy) / 2, z: (nz + hz) / 2, rx: neckA });
  p.add(capsule(0.05, 0.1), HIDE, { x: hx, y: hy - (down ? 0.05 : 0), z: hz + 0.04, rx: Math.PI / 2 + (down ? 0.9 : -0.15) });
  p.add(sphere(0.022, 6, 4), DARK, { x: hx, y: hy - (down ? 0.05 : 0.01), z: hz + 0.12 }); // nose
  for (const s of [-1, 1]) {
    p.add(cone(0.03, 0.08, 5), HIDE, { x: hx + s * 0.05, y: hy + 0.06, z: hz - 0.02, rz: -s * 0.6 }); // ears
    // Small antlers.
    p.add(cyl(0.01, 0.012, 0.16, 4), M.bone, { x: hx + s * 0.03, y: hy + 0.11, z: hz, rz: -s * 0.35 });
    p.add(cyl(0.008, 0.01, 0.08, 4), M.bone, { x: hx + s * 0.07, y: hy + 0.17, z: hz + 0.03, rz: -s * 0.9, rx: 0.4 });
  }
}

function rabbit(p, pose) {
  const run = pose.startsWith('run');
  const stretch = pose === 'run1';
  const lift = run && stretch ? 0.06 : 0;
  p.add(sphere(0.1, 9, 7), FUR, { y: 0.1 + lift, z: -0.02, sz: run ? 1.5 : 1.25, sy: 0.85 });
  p.add(sphere(0.045, 6, 5), FUR_PALE, { y: 0.12 + lift, z: -0.15 }); // tail
  const up = pose === 'alert';
  const hy = (pose === 'graze' ? 0.1 : up ? 0.22 : 0.17) + lift;
  const hz = pose === 'graze' ? 0.13 : 0.1;
  p.add(sphere(0.06, 8, 6), FUR, { y: hy, z: hz, sz: 1.2 });
  for (const s of [-1, 1]) p.add(capsule(0.018, up ? 0.12 : 0.09), FUR, { x: s * 0.025, y: hy + (up ? 0.11 : 0.06), z: hz - (up ? 0.01 : 0.05), rx: up ? -0.15 : -0.9, rz: -s * 0.15 });
  p.add(sphere(0.012, 5, 4), DARK, { y: hy, z: hz + 0.07 });
  // Hind feet: tucked, or kicked out behind in the stretched running frame.
  for (const s of [-1, 1]) p.add(box(0.035, 0.03, 0.11), FUR, { x: s * 0.06, y: 0.02 + lift * 0.5, z: stretch ? -0.14 : -0.04, rx: stretch ? 0.5 : 0 });
}

/** One animal (`kind`, `pose`), standing at the origin facing +z. */
export function createAnimal(kind, pose) {
  const p = new Parts();
  (kind === 'deer' ? deer : rabbit)(p, pose);
  const g = new THREE.Group();
  g.add(p.build());
  return g;
}
