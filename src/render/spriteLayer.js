import * as THREE from 'three';
import { ISO_QUATERNION, ISO_RIGHT, ISO_UP } from './iso.js';

/**
 * Draws baked sprites (see spriteBaker.js) as camera-facing quads: one InstancedMesh per atlas page, refilled
 * each frame, so every building, wall, enemy and tree costs one draw call per page in total.
 *
 * Each quad sits at its anchor's depth (quads face the camera, so the whole quad shares the depth of the point
 * where the model touches the ground), which gives correct back-to-front occlusion between sprites without
 * sorting. Two kinds of layer:
 *  - 'object': alpha-cut and depth-writing (the sprites themselves),
 *  - 'shadow': soft baked ground shadows, blended and drawn before objects, never occluding anything.
 *
 * Sprites can sway in the wind (trees): the quad's top is sheared sideways, by an amount that grows with height
 * (so the trunk's foot stays put), on a wave that drifts across the map in gusts. Set `time` each frame.
 *
 * Buildings and walls can look damaged (see damage.js): the shader adds soot and scorch patches and inked cracks,
 * and at the worst stage knocks pieces out (more towards the top: broken stakes, missing stones), edged in ink.
 * The pattern is noise in the sprite's own world units, seeded by its position, so it costs no atlas space and
 * every building breaks differently.
 */
// Damage look (fragment shader; vLocal is the position in the sprite in world units, vTop 0 at its foot to 1 at
// its top). Value noise, so it needs no textures.
const DAMAGE_GLSL = /* glsl */ `
  varying float vDamage;
  varying vec2 vLocal;
  varying float vTop;
  varying vec2 vSeed;
  float dHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float dNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(dHash(i), dHash(i + vec2(1.0, 0.0)), f.x), mix(dHash(i + vec2(0.0, 1.0)), dHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float dFbm(vec2 p) { return 0.5 * dNoise(p) + 0.3 * dNoise(p * 2.1 + 7.3) + 0.2 * dNoise(p * 4.3 + 3.1); }
  void applyDamage(inout vec4 color) {
    if (vDamage <= 0.0) return;
    const vec3 INK = vec3(0.17, 0.12, 0.09);
    // Soot and scorching in patches, spreading as the damage gets worse.
    float soot = smoothstep(0.6 - vDamage * 0.2, 0.74, dFbm(vLocal * 2.4 + vSeed));
    color.rgb *= mix(vec3(1.0), vec3(0.3, 0.26, 0.23), soot * (0.65 + 0.35 * vDamage));
    // Inked cracks: thin lines along a noise contour, only in some areas.
    float c = abs(dNoise(vLocal * 6.0 + vSeed * 1.7) - 0.5);
    float crack = (1.0 - smoothstep(0.02, 0.05, c)) * smoothstep(0.42, 0.55, dFbm(vLocal * 2.0 - vSeed));
    color.rgb = mix(color.rgb, INK, crack * 0.9);
    // Badly damaged: pieces knocked out, more towards the top, with inked edges.
    if (vDamage > 0.75) {
      float hole = dFbm(vLocal * 2.6 + vSeed * 2.3) + vTop * 0.45;
      if (hole > 0.88) discard;
      color.rgb = mix(color.rgb, INK, smoothstep(0.82, 0.88, hole));
    }
  }
`;

export class SpriteLayer {
  constructor(atlas, parent, kind = 'object') {
    this.atlas = atlas;
    this.kind = kind;
    this.layers = atlas.pages.map((page) => this._makePage(page.texture, parent));
    this._m = new THREE.Matrix4();
    this._centre = new THREE.Vector3();
    this._scale = new THREE.Vector3();
    this._time = { value: 0 };
  }

  set time(t) {
    this._time.value = t;
  }

  _makePage(texture, parent) {
    const shadow = this.kind === 'shadow';
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      alphaTest: shadow ? 0 : 0.5,
      depthWrite: !shadow,
      depthTest: !shadow,
      // Shadows blend but stay in the opaque pass, so renderOrder can put them under the sprites.
      blending: shadow ? THREE.CustomBlending : THREE.NormalBlending,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.ZeroFactor, // keep the canvas opaque (see underlay() in Renderer.js)
      blendDstAlpha: THREE.OneFactor,
      fog: false,
    });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this._time;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec4 aRect;\nattribute vec2 aFx;\nuniform float uTime;\nvarying float vDamage;\nvarying vec2 vLocal;\nvarying float vTop;\nvarying vec2 vSeed;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvMapUv = aRect.xy + uv * aRect.zw;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float sway = aFx.x;
          if (sway > 0.0) {
            vec2 at = instanceMatrix[3].xz;
            float gust = 0.55 + 0.45 * sin(uTime * 0.45 + (at.x + at.y) * 0.11);
            float wave = sin(uTime * 1.6 + at.x * 1.7 + at.y * 1.1) + 0.3 * sin(uTime * 3.7 + at.x * 3.1);
            transformed.x += sway * gust * wave * uv.y * uv.y;
          }
          vDamage = aFx.y;
          vLocal = uv * vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
          vTop = uv.y;
          vSeed = fract(instanceMatrix[3].xz * vec2(0.1731, 0.2417)) * 37.0;`,
        );
      if (!shadow) {
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', `#include <common>\n${DAMAGE_GLSL}`)
          .replace('#include <map_fragment>', '#include <map_fragment>\napplyDamage(diffuseColor);');
      }
    };
    const geometry = new THREE.PlaneGeometry(1, 1);
    const page = { material, geometry, mesh: null, rects: null, fx: null, count: 0, capacity: 0, parent };
    this._grow(page, 64);
    return page;
  }

  _grow(page, capacity) {
    const rects = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    rects.setUsage(THREE.DynamicDrawUsage);
    const fx = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 2), 2);
    fx.setUsage(THREE.DynamicDrawUsage);
    const geometry = page.geometry.clone();
    geometry.setAttribute('aRect', rects);
    geometry.setAttribute('aFx', fx);
    const mesh = new THREE.InstancedMesh(geometry, page.material, capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.renderOrder = this.kind === 'shadow' ? 1 : 2;
    if (page.mesh) {
      for (let i = 0; i < page.count; i++) {
        page.mesh.getMatrixAt(i, this._m);
        mesh.setMatrixAt(i, this._m);
        rects.setXYZW(i, page.rects.getX(i), page.rects.getY(i), page.rects.getZ(i), page.rects.getW(i));
        fx.setXY(i, page.fx.getX(i), page.fx.getY(i));
      }
      page.parent.remove(page.mesh);
      page.mesh.geometry.dispose();
      page.mesh.dispose();
    }
    page.mesh = mesh;
    page.rects = rects;
    page.fx = fx;
    page.capacity = capacity;
    page.parent.add(mesh);
  }

  begin() {
    for (const p of this.layers) p.count = 0;
  }

  /**
   * Draw sprite `key` with its ground anchor at scene position `ground`. `scale` scales it; `lift` raises it
   * (in world units, e.g. a walk bob or a floating crystal) without changing which way it faces. `sway`: how far
   * the top sways in the wind, as a fraction of the sprite's width (0 = still). `damage`: 0 sound, 0.5 damaged,
   * 1 badly damaged (see damage.js).
   */
  add(key, ground, scale = 1, lift = 0, sway = 0, damage = 0) {
    const base = this.atlas.frame(key);
    if (!base) return;
    const f = this.kind === 'shadow' ? base.shadow : base;
    if (!f) return;
    const page = this.layers[f.page];
    if (page.count >= page.capacity) this._grow(page, page.capacity * 2);
    const w = f.w * scale;
    const h = f.h * scale;
    this._centre
      .copy(ground)
      .addScaledVector(ISO_RIGHT, w / 2 - f.anchorX * scale)
      .addScaledVector(ISO_UP, h / 2 - f.anchorY * scale);
    this._centre.y += lift;
    this._m.compose(this._centre, ISO_QUATERNION, this._scale.set(w, h, 1));
    page.mesh.setMatrixAt(page.count, this._m);
    page.rects.setXYZW(page.count, f.u0, f.v0, f.u1 - f.u0, f.v1 - f.v0);
    page.fx.setXY(page.count, sway, damage);
    page.count++;
  }

  end() {
    for (const p of this.layers) {
      p.mesh.count = p.count;
      p.mesh.instanceMatrix.needsUpdate = true;
      p.rects.needsUpdate = true;
      p.fx.needsUpdate = true;
    }
  }
}
