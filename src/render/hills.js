import * as THREE from 'three';
import { tileCorners } from '../sim/terrain.js';

/**
 * Hills on the battlefield (see hills in sim/terrain.js): plateau tops raised to their level, wearing the painted
 * ground, and cliff faces wherever two neighbouring tiles' edges stand at different heights (a plateau's rim, the
 * sides of a ramp). The level-0 ground stays the flat painted plane underneath.
 *
 * Both meshes write depth, so things behind a plateau are hidden by it, but pushed back from the camera by
 * DEPTH_PUSH: a sprite is one flat card at the depth of its anchor, so without the push the ground just in front
 * of its anchor would cut off the front of anything standing on a plateau.
 */

const DEPTH_PUSH = 1.8; // world units

/** Push a material's depth back from the camera by `units` (orthographic camera with `near` / `far`). */
export function pushDepth(material, camera, units = DEPTH_PUSH) {
  const k = ((2 * units) / (camera.far - camera.near)).toFixed(6);
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>\n  gl_Position.z += ${k} * gl_Position.w;`);
  };
  material.customProgramCacheKey = () => `pushDepth:${k}`;
  return material;
}

/**
 * The raised ground: one quad per tile that stands above level 0 (ramps slope), at map position (x, z) minus
 * (offsetX, offsetZ), with UVs into the painted ground (`painted.tiles`, `painted.border`). Null if the map is flat.
 */
export function raisedGroundGeometry(grid, painted, offsetX, offsetZ) {
  const { width: TW, height: TH } = painted.tiles;
  const b = painted.border;
  const positions = [];
  const uvs = [];
  for (let z = 0; z < grid.height; z++) {
    for (let x = 0; x < grid.width; x++) {
      const c = tileCorners(grid, x, z);
      if (!c.some((h) => h > 0)) continue;
      const corner = [
        [x, z, c[0]],
        [x + 1, z, c[1]],
        [x, z + 1, c[2]],
        [x + 1, z + 1, c[3]],
      ];
      // Two triangles, wound to face up.
      for (const k of [0, 2, 3, 0, 3, 1]) {
        const [qx, qz, h] = corner[k];
        positions.push(qx - offsetX, h, qz - offsetZ);
        uvs.push((qx + b) / TW, 1 - (qz + b) / TH);
      }
    }
  }
  if (!positions.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  return g;
}

/**
 * Cliff faces: a quad on every tile edge whose two sides stand at different heights, from the lower side's edge
 * up to the higher side's. Faces looking towards the camera (south, east) are lit; the others are darker. UVs: u
 * along the edge, v down from the face's top (one tile of cliff texture per level).
 */
export function cliffGeometry(grid, offsetX, offsetZ, levelHeight) {
  const positions = [];
  const uvs = [];
  const colors = [];
  // Edges as [neighbour dx, dz, this tile's corner indices along the edge, the neighbour's matching corners].
  const EDGES = [
    [1, 0, [1, 3], [0, 2]], // east
    [0, 1, [2, 3], [0, 1]], // south
    [-1, 0, [0, 2], [1, 3]], // west
    [0, -1, [0, 1], [2, 3]], // north
  ];
  const cornerXZ = (x, z, k) => [x + (k & 1), z + (k >> 1)];
  for (let z = 0; z < grid.height; z++) {
    for (let x = 0; x < grid.width; x++) {
      const mine = tileCorners(grid, x, z, levelHeight);
      if (!mine.some((h) => h > 0)) continue;
      for (const [dx, dz, ours, theirs] of EDGES) {
        const other = tileCorners(grid, x + dx, z + dz, levelHeight);
        const top = ours.map((k) => mine[k]);
        const bottom = theirs.map((k) => other[k]);
        // Only from the higher side, so each face is made once.
        if (top[0] + top[1] <= bottom[0] + bottom[1] + 1e-6) continue;
        const [p0, p1] = ours.map((k) => cornerXZ(x, z, k));
        const shade = dz === 1 ? 1 : dx === 1 ? 0.8 : 0.62;
        // v runs down from the top of the face (1) by how far it drops, a level per texture tile.
        const vb = [0, 1].map((i) => 1 - (top[i] - bottom[i]) / levelHeight);
        const quad = [
          [p0, bottom[0], 0, vb[0]],
          [p1, bottom[1], 1, vb[1]],
          [p1, top[1], 1, 1],
          [p0, bottom[0], 0, vb[0]],
          [p1, top[1], 1, 1],
          [p0, top[0], 0, 1],
        ];
        for (const [[qx, qz], h, u, v] of quad) {
          positions.push(qx - offsetX, h, qz - offsetZ);
          uvs.push(u, v);
          colors.push(shade, shade, shade);
        }
      }
    }
  }
  if (!positions.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return g;
}

/**
 * A cliff face, one level high and one tile across (it repeats both ways): a grassy lip with an ink line along the
 * top, then banded earth and rock with stones in it, darkening towards the foot.
 */
export function cliffTexture() {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  let seed = 4242;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const grad = g.createLinearGradient(0, 0, 0, S);
  grad.addColorStop(0, '#86663f');
  grad.addColorStop(0.55, '#6a4f33');
  grad.addColorStop(1, '#4a3624');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  // Strata.
  for (let i = 0; i < 6; i++) {
    const y = 24 + i * 17 + rnd() * 6;
    g.strokeStyle = `rgba(60,40,24,${0.25 + rnd() * 0.2})`;
    g.lineWidth = 1.5 + rnd() * 1.5;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= S; x += 16) g.lineTo(x, y + (rnd() - 0.5) * 4);
    g.stroke();
  }
  // Stones bedded in the earth.
  for (let i = 0; i < 22; i++) {
    const x = rnd() * S;
    const y = 22 + rnd() * (S - 28);
    const r = 3 + rnd() * 6;
    g.fillStyle = rnd() < 0.5 ? '#9a8a70' : '#7c6c58';
    g.beginPath();
    g.ellipse(x, y, r * 1.3, r, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(56,40,26,0.7)';
    g.lineWidth = 1.2;
    g.stroke();
  }
  // Shadowed foot, with the ink line where the cliff meets the ground.
  const foot = g.createLinearGradient(0, S - 26, 0, S);
  foot.addColorStop(0, 'rgba(40,28,18,0)');
  foot.addColorStop(1, 'rgba(40,28,18,0.55)');
  g.fillStyle = foot;
  g.fillRect(0, S - 26, S, 26);
  g.fillStyle = '#3a2a18';
  g.fillRect(0, S - 3, S, 3);
  // Grassy lip hanging over the top, with the ink line along the edge.
  g.fillStyle = '#7f8a3a';
  g.beginPath();
  g.moveTo(0, 0);
  for (let x = 0; x <= S; x += 8) g.lineTo(x, 9 + (rnd() - 0.3) * 7);
  g.lineTo(S, 0);
  g.fill();
  g.fillStyle = '#4a3a22';
  g.fillRect(0, 0, S, 3);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace; // (flipY: v = 1 is the canvas's top row, the cliff top)
  return t;
}
