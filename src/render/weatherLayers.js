import * as THREE from 'three';
import { ISO_QUATERNION } from './iso.js';

/**
 * The drawn side of the weather (see weather.js for which season and weather a map has):
 *  - GroundCover: one plane over the land (not the water) that lays patchy snow, darkens the ground when wet, or
 *    scatters fallen leaves, from value noise in world units;
 *  - Precipitation: falling rain streaks or snowflakes in a box that follows the camera, as one InstancedMesh.
 * Both blend in the opaque pass like the other ground decals, so the canvas stays opaque.
 */

const NOISE_GLSL = /* glsl */ `
  float wHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float wNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(wHash(i), wHash(i + vec2(1.0, 0.0)), f.x), mix(wHash(i + vec2(0.0, 1.0)), wHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float wFbm(vec2 p) { return 0.5 * wNoise(p) + 0.3 * wNoise(p * 2.07 + 5.1) + 0.2 * wNoise(p * 4.13 + 1.7); }
`;

const blendOver = {
  depthTest: false,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendSrc: THREE.SrcAlphaFactor,
  blendDst: THREE.OneMinusSrcAlphaFactor,
  blendSrcAlpha: THREE.ZeroFactor, // keep the canvas opaque (see underlay() in Renderer.js)
  blendDstAlpha: THREE.OneFactor,
};

export class GroundCover {
  /**
   * `size`: the painted ground's size in tiles ({ width, height }); `waterMask`: its water mask canvas. Covers the
   * flat ground, or with `geometry` (UVs into the painted ground), that: the raised plateau tops.
   */
  constructor(parent, size, waterMask, { geometry = null, renderOrder = -0.5 } = {}) {
    this.uniforms = {
      mask: { value: new THREE.CanvasTexture(waterMask) },
      snow: { value: 0 },
      wet: { value: 0 },
      leaves: { value: 0 },
    };
    const material = new THREE.ShaderMaterial({
      ...blendOver,
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec2 vWorld;
        void main() {
          vUv = uv;
          vWorld = (modelMatrix * vec4(position, 1.0)).xz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D mask;
        uniform float snow;
        uniform float wet;
        uniform float leaves;
        varying vec2 vUv;
        varying vec2 vWorld;
        ${NOISE_GLSL}
        void main() {
          float land = 1.0 - texture2D(mask, vUv).a;
          if (land < 0.01) discard;
          vec4 c = vec4(0.0);
          if (wet > 0.0) c = vec4(0.1, 0.12, 0.15, 0.2 * wet); // damp, darker ground
          if (leaves > 0.0) {
            // Fallen leaves: sparse speckles in drifts, in a few autumn colours.
            float drift = smoothstep(0.45, 0.75, wFbm(vWorld * 0.35));
            float n = wNoise(vWorld * 9.0);
            float leaf = step(0.82 - drift * 0.12, n);
            vec3 col = mix(vec3(0.75, 0.38, 0.1), vec3(0.85, 0.65, 0.16), wHash(floor(vWorld * 9.0)));
            col = mix(col, vec3(0.55, 0.18, 0.08), step(0.7, wHash(floor(vWorld * 9.0) + 3.0)));
            c = mix(c, vec4(col, 0.85), leaf * leaves);
            c = mix(c, vec4(0.7, 0.45, 0.15, 0.08), (1.0 - leaf) * leaves * 0.5);
          }
          if (snow > 0.0) {
            // Patchy snow: lies thicker in drifts, thins out in patches where the grass shows through.
            float n = wFbm(vWorld * 0.45) + wNoise(vWorld * 3.0) * 0.12;
            float cover = smoothstep(0.62 - snow * 0.35, 0.72 - snow * 0.3, n);
            vec3 col = mix(vec3(0.86, 0.9, 0.96), vec3(0.97, 0.98, 1.0), wNoise(vWorld * 1.7));
            c = mix(c, vec4(col, 0.92), cover * snow);
          }
          gl_FragColor = vec4(c.rgb, c.a * land);
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(geometry ?? new THREE.PlaneGeometry(size.width, size.height).rotateX(-Math.PI / 2), material);
    this.mesh.renderOrder = renderOrder; // flat: over the painted ground (-1), under the water (0) and everything else
    this.mesh.position.y = 0.005;
    parent.add(this.mesh);
  }

  set({ snowCover, wet, autumn }) {
    this.uniforms.snow.value = snowCover;
    this.uniforms.wet.value = wet;
    this.uniforms.leaves.value = autumn;
    this.mesh.visible = snowCover > 0.01 || wet > 0.01 || autumn > 0.01;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.uniforms.mask.value.dispose();
    this.mesh.material.dispose();
  }
}

const MAX_DROPS = 900;
const BOX = { half: 20, height: 10 };

function flakeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.8)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

/** A rain streak: bright at the head (bottom), fading to nothing at the tail. */
function streakTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 32;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 32, 0, 0);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 32);
  return new THREE.CanvasTexture(c);
}

/** Falling rain or snow in a box round the camera's target. */
export class Precipitation {
  constructor(parent) {
    this.rain = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ ...blendOver, map: streakTexture(), color: 0xdfe8f2, opacity: 0.45 }),
      MAX_DROPS,
    );
    this.snow = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ ...blendOver, map: flakeTexture(), color: 0xffffff }), MAX_DROPS);
    for (const mesh of [this.rain, this.snow]) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.renderOrder = 3.2; // after the sprites and particles, under the glow and health bars
      mesh.count = 0;
      parent.add(mesh);
    }
    // Each drop: position in the box (relative to the target) and its own speed and drift.
    this.drops = Array.from({ length: MAX_DROPS }, () => ({
      x: (Math.random() * 2 - 1) * BOX.half,
      y: Math.random() * BOX.height,
      z: (Math.random() * 2 - 1) * BOX.half,
      speed: 0.8 + Math.random() * 0.4,
      phase: Math.random() * 6.3,
    }));
    this._m = new THREE.Matrix4();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this.drawn = 0;
  }

  /** Advance by `dt` and draw `rain` / `snow` (0..1: how heavy) round `target` (scene position). */
  update(dt, target, { rain, snowfall }, time) {
    this.drawn = 0;
    for (const [mesh, amount, fall, size] of [
      [this.rain, rain, 14, [0.025, 0.5]],
      [this.snow, snowfall, 1.2, [0.09, 0.09]],
    ]) {
      const n = Math.round(MAX_DROPS * amount);
      for (let i = 0; i < n; i++) {
        const d = this.drops[i];
        d.y -= fall * d.speed * dt;
        if (d.y < 0) {
          d.y += BOX.height;
          d.x = (Math.random() * 2 - 1) * BOX.half;
          d.z = (Math.random() * 2 - 1) * BOX.half;
        }
        const sway = mesh === this.snow ? Math.sin(time * 1.3 + d.phase) * 0.3 : 0;
        this._p.set(target.x + d.x + sway, d.y, target.z + d.z + sway * 0.5);
        this._m.compose(this._p, ISO_QUATERNION, this._s.set(size[0], size[1], 1));
        mesh.setMatrixAt(i, this._m);
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      this.drawn += n;
    }
  }
}
