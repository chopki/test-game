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
 */
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
        .replace('#include <common>', '#include <common>\nattribute vec4 aRect;\nattribute float aSway;\nuniform float uTime;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvMapUv = aRect.xy + uv * aRect.zw;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          if (aSway > 0.0) {
            vec2 at = instanceMatrix[3].xz;
            float gust = 0.55 + 0.45 * sin(uTime * 0.45 + (at.x + at.y) * 0.11);
            float wave = sin(uTime * 1.6 + at.x * 1.7 + at.y * 1.1) + 0.3 * sin(uTime * 3.7 + at.x * 3.1);
            transformed.x += aSway * gust * wave * uv.y * uv.y;
          }`,
        );
    };
    const geometry = new THREE.PlaneGeometry(1, 1);
    const page = { material, geometry, mesh: null, rects: null, sway: null, count: 0, capacity: 0, parent };
    this._grow(page, 64);
    return page;
  }

  _grow(page, capacity) {
    const rects = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    rects.setUsage(THREE.DynamicDrawUsage);
    const sway = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    sway.setUsage(THREE.DynamicDrawUsage);
    const geometry = page.geometry.clone();
    geometry.setAttribute('aRect', rects);
    geometry.setAttribute('aSway', sway);
    const mesh = new THREE.InstancedMesh(geometry, page.material, capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.renderOrder = this.kind === 'shadow' ? 1 : 2;
    if (page.mesh) {
      for (let i = 0; i < page.count; i++) {
        page.mesh.getMatrixAt(i, this._m);
        mesh.setMatrixAt(i, this._m);
        rects.setXYZW(i, page.rects.getX(i), page.rects.getY(i), page.rects.getZ(i), page.rects.getW(i));
        sway.setX(i, page.sway.getX(i));
      }
      page.parent.remove(page.mesh);
      page.mesh.geometry.dispose();
      page.mesh.dispose();
    }
    page.mesh = mesh;
    page.rects = rects;
    page.sway = sway;
    page.capacity = capacity;
    page.parent.add(mesh);
  }

  begin() {
    for (const p of this.layers) p.count = 0;
  }

  /**
   * Draw sprite `key` with its ground anchor at scene position `ground`. `scale` scales it; `lift` raises it
   * (in world units, e.g. a walk bob or a floating crystal) without changing which way it faces. `sway`: how far
   * the top sways in the wind, as a fraction of the sprite's width (0 = still).
   */
  add(key, ground, scale = 1, lift = 0, sway = 0) {
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
    page.sway.setX(page.count, sway);
    page.count++;
  }

  end() {
    for (const p of this.layers) {
      p.mesh.count = p.count;
      p.mesh.instanceMatrix.needsUpdate = true;
      p.rects.needsUpdate = true;
      p.sway.needsUpdate = true;
    }
  }
}
