import * as THREE from 'three';

// Instanced drawing for things there are many of. Each batch draws all its instances in one draw
// call per material, however many there are: dozens of wall tiles, enemies or health bars cost the
// same as one. Instances are re-filled each frame (enemies, bars) or only when they change (walls).

/**
 * Draws many copies of one prototype model. The prototype's meshes (with their transforms relative to
 * the prototype root) each become an InstancedMesh that grows as needed.
 */
export class InstancedModel {
  constructor(prototype, parent, { castShadow = true, receiveShadow = true, renderOrder = 0 } = {}) {
    this.parent = parent;
    this.count = 0;
    this.capacity = 0;
    this.parts = [];
    prototype.updateMatrixWorld(true);
    const rootInverse = prototype.matrixWorld.clone().invert();
    prototype.traverse((o) => {
      if (!o.isMesh) return;
      const local = rootInverse.clone().multiply(o.matrixWorld);
      this.parts.push({ geometry: o.geometry, material: o.material, local, mesh: null });
    });
    this.castShadow = castShadow;
    this.receiveShadow = receiveShadow;
    this.renderOrder = renderOrder;
    this._matrix = new THREE.Matrix4();
    this._grow(16);
  }

  _grow(capacity) {
    for (const part of this.parts) {
      // Reuse the current mesh's material in case it was replaced after creation.
      const mesh = new THREE.InstancedMesh(part.geometry, part.mesh?.material ?? part.material, capacity);
      mesh.castShadow = this.castShadow;
      mesh.receiveShadow = this.receiveShadow;
      mesh.frustumCulled = false; // instances span the whole map; the bounding sphere would be stale
      mesh.renderOrder = this.renderOrder;
      if (part.mesh) {
        for (let i = 0; i < this.count; i++) {
          part.mesh.getMatrixAt(i, this._matrix);
          mesh.setMatrixAt(i, this._matrix);
        }
        this.parent.remove(part.mesh);
        part.mesh.dispose();
      }
      mesh.count = this.count;
      part.mesh = mesh;
      this.parent.add(mesh);
    }
    this.capacity = capacity;
  }

  begin() {
    this.count = 0;
  }

  /** Add one instance with root transform `matrix`. */
  push(matrix) {
    if (this.count >= this.capacity) this._grow(this.capacity * 2);
    for (const part of this.parts) {
      this._matrix.multiplyMatrices(matrix, part.local);
      part.mesh.setMatrixAt(this.count, this._matrix);
    }
    this.count++;
  }

  end() {
    for (const part of this.parts) {
      part.mesh.count = this.count;
      part.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  dispose() {
    for (const part of this.parts) {
      this.parent.remove(part.mesh);
      part.mesh.dispose();
    }
  }
}

// ------------------------------------------------------------------ health bars

const BAR_HEIGHT = 0.075;

/** All health bars in two draw calls: billboarded backgrounds and coloured fills. */
const FULL_HP = new THREE.Color(0xd9a33a);
const LOW_HP = new THREE.Color(0xb8281a);

export class HealthBarBatch {
  constructor(parent) {
    const geo = new THREE.PlaneGeometry(1, BAR_HEIGHT);
    // Fill grows from its left edge.
    const fillGeo = new THREE.PlaneGeometry(1, BAR_HEIGHT).translate(0.5, 0, 0);
    // Both transparent so they're sorted together and renderOrder puts the fill on top.
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x24160c, transparent: true, opacity: 0.7, depthTest: false });
    const fgMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthTest: false });
    this.bg = new InstancedModel(new THREE.Mesh(geo, bgMat), parent, { castShadow: false, receiveShadow: false });
    this.fg = new InstancedModel(new THREE.Mesh(fillGeo, fgMat), parent, { castShadow: false, receiveShadow: false });
    this.bg.renderOrder = 998;
    this.fg.renderOrder = 999;
    for (const p of this.bg.parts) p.mesh.renderOrder = 998;
    this._m = new THREE.Matrix4();
    this._pos = new THREE.Vector3();
    this._scale = new THREE.Vector3();
    this._offset = new THREE.Vector3();
    this._color = new THREE.Color();
    this._ratios = [];
    this.quaternion = new THREE.Quaternion();
  }

  /** Call once per frame before add(), with the camera's orientation for billboarding. */
  begin(cameraQuaternion) {
    this.quaternion.copy(cameraQuaternion);
    this.bg.begin();
    this.fg.begin();
    this._ratios.length = 0;
  }

  /** A bar centred at scene position `pos`, `width` wide, filled to `ratio` (0–1); `fade` (0–1) thins it away. */
  add(pos, width, ratio, fade = 1) {
    if (fade <= 0) return;
    const r = Math.max(0, Math.min(1, ratio));
    this.bg.push(this._m.compose(pos, this.quaternion, this._scale.set(width + 0.04, 1.5 * fade, 1)));
    // Fill starts at the bar's left edge (in the camera-facing plane).
    this._offset.set(-width / 2, 0, 0.001).applyQuaternion(this.quaternion);
    this._pos.copy(pos).add(this._offset);
    this.fg.push(this._m.compose(this._pos, this.quaternion, this._scale.set(Math.max(0.001, r * width), fade, 1)));
    this._ratios.push(r);
  }

  end() {
    this.bg.end();
    this.fg.end();
    // Colours are applied here, after any mid-frame growth has replaced the instanced mesh.
    const mesh = this.fg.parts[0].mesh;
    // Muted: from old gold when healthy to brick red when nearly gone (no bright traffic-light greens).
    this._ratios.forEach((r, i) => mesh.setColorAt(i, this._color.copy(LOW_HP).lerp(FULL_HP, r)));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  get count() {
    return this.bg.count;
  }
}

// ------------------------------------------------------------------ blob shadows

function blobTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.6, 'rgba(0,0,0,0.3)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

/**
 * Soft round shadows under moving units: one draw call for all of them, and no shadow-map work.
 */
export class BlobShadowBatch {
  constructor(parent) {
    // Drawn like the baked ground shadows: blended in the opaque pass, under every sprite (see Renderer).
    const mat = new THREE.MeshBasicMaterial({
      map: blobTexture(),
      depthTest: false,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.ZeroFactor, // keep the canvas opaque (see underlay() in Renderer.js)
      blendDstAlpha: THREE.OneFactor,
    });
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.batch = new InstancedModel(new THREE.Mesh(geo, mat), parent, { castShadow: false, receiveShadow: false, renderOrder: 1 });
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
  }

  begin() {
    this.batch.begin();
  }

  add(pos, radius) {
    this.batch.push(this._m.compose(pos, this._q, this._s.set(radius * 2, 1, radius * 2)));
  }

  end() {
    this.batch.end();
  }
}

function glowTexture() {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.15)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

/**
 * Soft light halos (crystals, torches, fires), added on top of everything as camera-facing quads with additive
 * blending. Not depth-tested: light bleeding a little past whatever stands in front reads as glow. One draw call.
 */
export class GlowBatch {
  constructor(parent, quaternion, capacity = 512) {
    const mat = new THREE.MeshBasicMaterial({
      map: glowTexture(),
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.ZeroFactor, // keep the canvas opaque (see underlay() in Renderer.js)
      blendDstAlpha: THREE.OneFactor,
    });
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, new THREE.Color());
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3.5;
    this.mesh.count = 0;
    parent.add(this.mesh);
    this.capacity = capacity;
    this.count = 0;
    this._q = quaternion;
    this._m = new THREE.Matrix4();
    this._s = new THREE.Vector3();
    this._c = new THREE.Color();
  }

  begin() {
    this.count = 0;
  }

  /** A halo `size` across at scene position `pos`; `color` is scaled by `strength` (0..1). */
  add(pos, size, color, strength = 1) {
    if (this.count >= this.capacity) return;
    this._m.compose(pos, this._q, this._s.set(size, size, size));
    this.mesh.setMatrixAt(this.count, this._m);
    this.mesh.setColorAt(this.count, this._c.set(color).multiplyScalar(strength));
    this.count++;
  }

  end() {
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
