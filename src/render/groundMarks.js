import * as THREE from 'three';

/**
 * Marks on the ground: worn earth round buildings and scorch marks where cannonballs and boulders land. Flat
 * decals from one small painted atlas (2×2 cells: two worn-earth patches, two scorch marks), drawn as one
 * InstancedMesh after the painted ground and before the sprites' shadows. Refill with begin() / add() / end() each
 * frame.
 */

export const MARKS = { earth: [0, 1], scorch: [2, 3] };

const VERTEX = /* glsl */ `
  attribute vec4 aMark; // cell x, cell y, opacity
  varying vec2 vUv;
  varying float vAlpha;
  void main() {
    vUv = aMark.xy * 0.5 + uv * 0.5;
    vAlpha = aMark.z;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform sampler2D map;
  varying vec2 vUv;
  varying float vAlpha;
  void main() {
    vec4 t = texture2D(map, vUv);
    gl_FragColor = vec4(t.rgb, t.a * vAlpha);
    #include <colorspace_fragment>
  }
`;

const MAX_MARKS = 600;

export class GroundMarks {
  constructor(parent) {
    const geometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this._attr = new THREE.InstancedBufferAttribute(new Float32Array(MAX_MARKS * 4), 4);
    this._attr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aMark', this._attr);
    const material = new THREE.ShaderMaterial({
      uniforms: { map: { value: marksTexture() } },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.ZeroFactor, // keep the canvas opaque (see underlay() in Renderer.js)
      blendDstAlpha: THREE.OneFactor,
    });
    this.mesh = new THREE.InstancedMesh(geometry, material, MAX_MARKS);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 0.5; // after the ground (-1), before the baked shadows (1)
    this.mesh.count = 0;
    parent.add(this.mesh);
    this.count = 0;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
  }

  begin() {
    this.count = 0;
  }

  /** A mark (cell 0–3, see MARKS) centred on scene position `pos`, `size` across, turned `angle`, at `opacity`. */
  add(cell, pos, size, angle, opacity = 1) {
    if (this.count >= MAX_MARKS) return;
    this._q.setFromAxisAngle(this._up, angle);
    this._m.compose(pos, this._q, this._s.set(size, 1, size));
    this.mesh.setMatrixAt(this.count, this._m);
    this._attr.setXYZW(this.count, cell % 2, Math.floor(cell / 2), opacity, 0);
    this.count++;
  }

  end() {
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
    this._attr.needsUpdate = true;
  }
}

/** The painted atlas: 2×2 cells of 128 px, each a soft-edged blotch with transparent surroundings. */
function marksTexture() {
  const cell = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = cell * 2;
  const ctx = canvas.getContext('2d');
  let seed = 1234567;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  // A ragged blotch: overlapping soft discs, densest in the middle.
  const blotch = (cx, cy, color, alpha, count, spread, rMin, rMax) => {
    for (let i = 0; i < count; i++) {
      const a = rnd() * Math.PI * 2;
      const d = Math.pow(rnd(), 1.6) * spread;
      const x = cx + Math.cos(a) * d;
      const y = cy + Math.sin(a) * d;
      const r = rMin + rnd() * (rMax - rMin);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${color},${alpha})`);
      g.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  };
  for (const [i, kind] of ['earth', 'earth', 'scorch', 'scorch'].entries()) {
    const cx = (i % 2) * cell + cell / 2;
    const cy = Math.floor(i / 2) * cell + cell / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - cell / 2, cy - cell / 2, cell, cell);
    ctx.clip();
    if (kind === 'earth') {
      // Trodden bare earth, patchy at the edges, with a few pebbles.
      blotch(cx, cy, '138,111,72', 0.16, 70, 38, 10, 26);
      blotch(cx, cy, '112,88,56', 0.12, 25, 26, 6, 14);
      for (let k = 0; k < 14; k++) {
        const a = rnd() * Math.PI * 2;
        const d = rnd() * 34;
        ctx.fillStyle = `rgba(${rnd() < 0.5 ? '96,84,70' : '176,160,132'},0.7)`;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1 + rnd() * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // A blackened burst: dark core, streaks thrown outwards, a sooty fringe.
      blotch(cx, cy, '46,36,30', 0.22, 40, 20, 8, 22);
      for (let k = 0; k < 12; k++) {
        const a = rnd() * Math.PI * 2;
        const len = 24 + rnd() * 30;
        ctx.strokeStyle = 'rgba(40,32,26,0.35)';
        ctx.lineWidth = 2 + rnd() * 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * 8, cy + Math.sin(a) * 8);
        ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
        ctx.stroke();
      }
      blotch(cx, cy, '70,58,48', 0.1, 30, 40, 8, 18);
    }
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
