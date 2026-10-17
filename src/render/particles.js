import * as THREE from 'three';
import { ISO_QUATERNION } from './iso.js';

/**
 * Combat effects: soft inked puffs (smoke, dust, muzzle flashes, arrow trails) and tumbling chunks (debris,
 * splinters). Two InstancedMeshes refilled each frame, so any number of effects costs two draw calls.
 *
 * Puffs face the camera and fade and grow over their life; chunks fall, bounce once, and fade. Positions and
 * velocities are in scene units. The renderer spawns them from world events (see Renderer.attach) and never
 * touches the world.
 */

const MAX_PUFFS = 1500;
const MAX_CHUNKS = 400;
const GRAVITY = 9;

const PUFF_VERTEX = /* glsl */ `
  attribute vec4 aTint;
  varying vec4 vTint;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vTint = aTint;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

// A soft round puff with a faint warm-brown ink rim, like the baked sprites' line work.
const PUFF_FRAGMENT = /* glsl */ `
  varying vec4 vTint;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    if (d > 1.0) discard;
    float body = smoothstep(1.0, 0.55, d);
    float rim = smoothstep(0.62, 0.8, d) * smoothstep(1.0, 0.86, d);
    vec3 color = mix(vTint.rgb, vec3(0.17, 0.12, 0.09), rim * 0.45);
    gl_FragColor = vec4(color, vTint.a * max(body, rim * 0.6));
    #include <colorspace_fragment>
  }
`;

export class Particles {
  constructor(parent) {
    this.puffs = [];
    this.chunks = [];
    this.peak = 0;

    const puffGeometry = new THREE.PlaneGeometry(1, 1);
    this._tints = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PUFFS * 4), 4);
    this._tints.setUsage(THREE.DynamicDrawUsage);
    puffGeometry.setAttribute('aTint', this._tints);
    const puffMaterial = new THREE.ShaderMaterial({
      vertexShader: PUFF_VERTEX,
      fragmentShader: PUFF_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.ZeroFactor, // keep the canvas opaque (see underlay() in Renderer.js)
      blendDstAlpha: THREE.OneFactor,
    });
    this._puffMesh = new THREE.InstancedMesh(puffGeometry, puffMaterial, MAX_PUFFS);
    this._chunkMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), MAX_CHUNKS);
    for (const mesh of [this._puffMesh, this._chunkMesh]) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.renderOrder = 3;
      mesh.count = 0;
      parent.add(mesh);
    }
    this._chunkMesh.setColorAt(0, new THREE.Color()); // creates instanceColor

    this._m = new THREE.Matrix4();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._c = new THREE.Color();
  }

  /**
   * A puff at scene position (x, y, z). `size`: starting diameter; `grow`: diameter added over its life; `rise`:
   * upward drift (units/s²); `drag`: fraction of speed kept per second; `alpha`: peak opacity.
   */
  puff({ x, y, z, vx = 0, vy = 0, vz = 0, size = 0.3, grow = 0.5, life = 0.8, color = 0x9a8f80, alpha = 0.7, rise = 0, drag = 0.3 }) {
    if (this.puffs.length >= MAX_PUFFS) this.puffs.shift();
    const c = new THREE.Color(color);
    this.puffs.push({ x, y, z, vx, vy, vz, size, grow, life, age: 0, r: c.r, g: c.g, b: c.b, alpha, rise, drag });
  }

  /** A chunk of debris: falls under gravity, bounces once off the ground, tumbles, and fades at the end. */
  chunk({ x, y, z, vx = 0, vy = 2, vz = 0, size = 0.08, life = 1.4, color = 0x8a6a48 }) {
    if (this.chunks.length >= MAX_CHUNKS) this.chunks.shift();
    this.chunks.push({ x, y, z, vx, vy, vz, size, life, age: 0, color, rx: Math.random() * 6, ry: Math.random() * 6, spin: 4 + Math.random() * 8, bounced: false });
  }

  get count() {
    return this.puffs.length + this.chunks.length;
  }

  clear() {
    this.puffs.length = 0;
    this.chunks.length = 0;
    this._puffMesh.count = 0;
    this._chunkMesh.count = 0;
  }

  update(dt) {
    this.puffs = this.puffs.filter((p) => (p.age += dt) < p.life);
    this.chunks = this.chunks.filter((c) => (c.age += dt) < c.life);
    this.peak = Math.max(this.peak, this.count);

    let i = 0;
    for (const p of this.puffs) {
      const keep = Math.pow(p.drag, dt);
      p.vx *= keep;
      p.vz *= keep;
      p.vy = p.vy * keep + p.rise * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const t = p.age / p.life;
      const d = p.size + p.grow * Math.sqrt(t);
      this._m.compose(this._p.set(p.x, p.y, p.z), ISO_QUATERNION, this._s.set(d, d, d));
      this._puffMesh.setMatrixAt(i, this._m);
      // Quick fade in, long fade out.
      const a = p.alpha * Math.min(1, t * 8) * Math.pow(1 - t, 1.4);
      this._tints.setXYZW(i, p.r, p.g, p.b, a);
      i++;
    }
    this._puffMesh.count = i;
    this._puffMesh.instanceMatrix.needsUpdate = true;
    this._tints.needsUpdate = true;

    i = 0;
    for (const c of this.chunks) {
      c.vy -= GRAVITY * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.z += c.vz * dt;
      if (c.y < c.size / 2) {
        c.y = c.size / 2;
        if (!c.bounced && c.vy < -1) {
          c.vy *= -0.3;
          c.vx *= 0.5;
          c.vz *= 0.5;
          c.bounced = true;
        } else {
          c.vy = c.vx = c.vz = 0;
          c.spin = 0;
        }
      }
      c.rx += c.spin * dt;
      c.ry += c.spin * 0.7 * dt;
      const t = c.age / c.life;
      const s = c.size * (t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1); // shrink away at the end
      this._q.setFromEuler(this._e.set(c.rx, c.ry, 0));
      this._m.compose(this._p.set(c.x, c.y, c.z), this._q, this._s.set(s, s * 0.7, s * 1.3));
      this._chunkMesh.setMatrixAt(i, this._m);
      this._chunkMesh.setColorAt(i, this._c.set(c.color));
      i++;
    }
    this._chunkMesh.count = i;
    this._chunkMesh.instanceMatrix.needsUpdate = true;
    if (this._chunkMesh.instanceColor) this._chunkMesh.instanceColor.needsUpdate = true;
  }
}
