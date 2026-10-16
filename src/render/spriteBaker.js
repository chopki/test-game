import * as THREE from 'three';
import { ISO_QUATERNION, SUN_DIRECTION, isoDirection } from './iso.js';

/**
 * Pre-renders 3D models into sprites ("baking"), the way classic isometric games were made.
 *
 * Each model is rendered once, from the fixed iso view, with lighting a phone could never afford every frame
 * (soft shadow maps, extra fill and rim light, supersampling). The game then draws only flat textured quads,
 * so the models can be as detailed as we like. Every sprite has two layers:
 *  - the object itself (opaque, alpha-cut), and
 *  - its shadow on the ground (semi-transparent), drawn underneath everything as a decal.
 *
 * Sprites are packed into atlas pages. A frame records where it is in the atlas, its size in world units, and
 * the anchor: where the model's origin (its spot on the ground) falls inside the sprite.
 */

const PAGE_SIZE = 2048;
const PADDING = 3;

class Page {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = PAGE_SIZE;
    this.ctx = this.canvas.getContext('2d');
    this.x = PADDING;
    this.y = PADDING;
    this.rowHeight = 0;
  }

  /** Shelf packing: returns { x, y } or null if it doesn't fit on this page. */
  place(w, h) {
    if (this.x + w + PADDING > PAGE_SIZE) {
      this.x = PADDING;
      this.y += this.rowHeight + PADDING;
      this.rowHeight = 0;
    }
    if (this.y + h + PADDING > PAGE_SIZE || w + 2 * PADDING > PAGE_SIZE) return null;
    const spot = { x: this.x, y: this.y };
    this.x += w + PADDING;
    this.rowHeight = Math.max(this.rowHeight, h);
    return spot;
  }
}

/** The baked result: atlas pages (as textures) and frames by key. */
export class SpriteAtlas {
  constructor() {
    this.pages = [];
    this.frames = new Map();
  }

  frame(key) {
    return this.frames.get(key);
  }
}

/**
 * Bake `specs` = [{ key, make: () => Object3D, shadow = true }] into a SpriteAtlas.
 * `pxPerUnit` is the sprite resolution at zoom 1 (rendered at `supersample`× and scaled down for smooth edges).
 */
export function bakeSprites(specs, { pxPerUnit = 64, supersample = 2 } = {}) {
  const started = performance.now();
  const atlas = new SpriteAtlas();
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, preserveDrawingBuffer: true });
  try {
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap; // soft, blurred shadows (affordable: this runs once)

    const scene = new THREE.Scene();
    // Studio lighting: warm key from the sun direction, cool sky fill, a soft rim from behind.
    scene.add(new THREE.HemisphereLight(0xfff2dc, 0x6a5a3a, 1.35));
    const sun = new THREE.DirectionalLight(0xffe2b8, 2.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 6;
    sun.shadow.blurSamples = 8;
    scene.add(sun, sun.target);
    const rim = new THREE.DirectionalLight(0xc8dcff, 0.6);
    scene.add(rim, rim.target);

    // Ground that only shows shadows.
    const catcher = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.42 }));
    catcher.receiveShadow = true;
    scene.add(catcher);
    const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false });

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    camera.quaternion.copy(ISO_QUATERNION);
    const inverse = ISO_QUATERNION.clone().invert();
    const v = new THREE.Vector3();
    const box = new THREE.Box3();
    let page = new Page();
    atlas.pages.push(page);

    for (const { key, make, shadow = true } of specs) {
      const object = make();
      scene.add(object);
      object.updateMatrixWorld(true);
      box.setFromObject(object);
      if (box.isEmpty()) {
        scene.remove(object);
        continue;
      }
      // Extents in the view plane, including where the shadow falls on the ground.
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      const include = (p) => {
        v.copy(p).applyQuaternion(inverse);
        minX = Math.min(minX, v.x);
        maxX = Math.max(maxX, v.x);
        minY = Math.min(minY, v.y);
        maxY = Math.max(maxY, v.y);
      };
      for (let i = 0; i < 8; i++) {
        const corner = new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
        include(corner);
        if (shadow && corner.y > 0) include(corner.clone().addScaledVector(SUN_DIRECTION, -corner.y / SUN_DIRECTION.y));
      }
      const m = 0.06;
      minX -= m;
      maxX += m;
      minY -= m;
      maxY += m;

      const w = maxX - minX;
      const h = maxY - minY;
      const outW = Math.max(1, Math.ceil(w * pxPerUnit));
      const outH = Math.max(1, Math.ceil(h * pxPerUnit));
      let spot = page.place(outW, outH);
      if (!spot) {
        page = new Page();
        atlas.pages.push(page);
        spot = page.place(outW, outH);
      }

      camera.left = minX;
      camera.right = maxX;
      camera.top = maxY;
      camera.bottom = minY;
      camera.position.copy(isoDirection(v)).multiplyScalar(60);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();

      // Shadow camera fitted around this object.
      const centre = box.getCenter(new THREE.Vector3());
      const radius = box.getSize(new THREE.Vector3()).length() / 2 + 0.3;
      sun.position.copy(centre).addScaledVector(SUN_DIRECTION, 30);
      sun.target.position.copy(centre);
      Object.assign(sun.shadow.camera, { left: -radius * 1.6, right: radius * 1.6, top: radius * 1.6, bottom: -radius * 1.6, near: 1, far: 80 });
      sun.shadow.camera.updateProjectionMatrix();
      rim.position.copy(centre).add(new THREE.Vector3(-6, 5, -6));
      rim.target.position.copy(centre);

      renderer.setSize(outW * supersample, outH * supersample, false);
      // Sprites without a ground shadow skip the shadow map entirely (much faster to bake).
      sun.castShadow = shadow;
      const meshes = [];
      object.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          meshes.push([o, o.material]);
        }
      });

      // Layer 1: the object.
      catcher.visible = false;
      renderer.render(scene, camera);
      page.ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, spot.x, spot.y, outW, outH);
      const objectFrame = frameFor(atlas.pages.length - 1, spot, outW, outH, w, h, -minX, -minY);
      atlas.frames.set(key, objectFrame);

      // Layer 2: its shadow on the ground (the object itself writes depth only). Shadows are soft, so they're
      // stored at half resolution.
      if (shadow) {
        const sw = Math.ceil(outW / 2);
        const sh = Math.ceil(outH / 2);
        let shadowSpot = page.place(sw, sh);
        if (!shadowSpot) {
          page = new Page();
          atlas.pages.push(page);
          shadowSpot = page.place(sw, sh);
        }
        for (const [o] of meshes) o.material = depthOnly;
        catcher.visible = true;
        renderer.render(scene, camera);
        for (const [o, mat] of meshes) o.material = mat;
        page.ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, shadowSpot.x, shadowSpot.y, sw, sh);
        objectFrame.shadow = frameFor(atlas.pages.length - 1, shadowSpot, sw, sh, w, h, -minX, -minY);
      }
      scene.remove(object);
    }
  } finally {
    renderer.dispose();
    renderer.forceContextLoss();
  }

  atlas.bakeMs = Math.round(performance.now() - started);
  atlas.pages = atlas.pages.map((p) => ({ source: p.canvas, texture: pageTexture(new THREE.CanvasTexture(p.canvas)) }));
  return atlas;
}

function pageTexture(texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

/** Plain data for saving an atlas to files: { frames, pages: [PNG data URLs] }. */
export function serializeAtlas(atlas) {
  return {
    frames: Object.fromEntries(atlas.frames),
    pages: atlas.pages.map((p) => p.source.toDataURL('image/png')),
  };
}

/** Load an atlas saved by scripts/bake-sprites.mjs from `baseUrl` (atlas.json + page images). */
export async function loadAtlas(baseUrl) {
  const res = await fetch(`${baseUrl}atlas.json`);
  if (!res.ok) throw new Error(`atlas.json: HTTP ${res.status}`);
  const data = await res.json();
  const atlas = new SpriteAtlas();
  atlas.frames = new Map(Object.entries(data.frames));
  atlas.pages = await Promise.all(
    data.pages.map(async (file) => {
      const img = new Image();
      img.src = `${baseUrl}${file}`;
      await img.decode();
      const texture = new THREE.Texture(img);
      return { source: img, texture: pageTexture(texture) };
    }),
  );
  atlas.sourceHash = data.sourceHash;
  return atlas;
}

function frameFor(pageIndex, spot, outW, outH, w, h, anchorX, anchorY) {
  return {
    page: pageIndex,
    // UV rectangle (v measured from the bottom, as WebGL textures are flipped).
    u0: spot.x / PAGE_SIZE,
    v0: 1 - (spot.y + outH) / PAGE_SIZE,
    u1: (spot.x + outW) / PAGE_SIZE,
    v1: 1 - spot.y / PAGE_SIZE,
    pixels: { x: spot.x, y: spot.y, w: outW, h: outH },
    w,
    h,
    anchorX,
    anchorY,
  };
}

/** A data URL of one baked frame (for UI icons). */
export function frameToDataURL(atlas, key) {
  const f = atlas.frame(key);
  if (!f) return null;
  const c = document.createElement('canvas');
  c.width = f.pixels.w;
  c.height = f.pixels.h;
  c.getContext('2d').drawImage(atlas.pages[f.page].source, f.pixels.x, f.pixels.y, f.pixels.w, f.pixels.h, 0, 0, f.pixels.w, f.pixels.h);
  return c.toDataURL('image/png');
}
