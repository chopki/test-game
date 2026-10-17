import * as THREE from 'three';
import { ISO_QUATERNION, SUN_DIRECTION, isoDirection } from './iso.js';
import { inkSprite } from './inkStyle.js';

/**
 * Pre-renders 3D models into sprites ("baking"), the way classic isometric games were made.
 *
 * Each model is rendered once, from the fixed iso view, with lighting a phone could never afford every frame
 * (soft shadow maps, extra fill and rim light, supersampling). The game then draws only flat textured quads,
 * so the models can be as detailed as we like. Every sprite has two layers:
 *  - the object itself (opaque, alpha-cut), and
 *  - its shadow on the ground (semi-transparent), drawn underneath everything as a decal.
 *
 * With `ink` (the default), each object layer also gets the hand-drawn treatment from inkStyle.js: two more
 * renders (surface normals and depth) find the edges to ink, and the shading is flattened and warmed.
 *
 * Sprites are rendered first, then packed into atlas pages tallest first (shelf packing wastes little that
 * way), and the last page is trimmed to what it uses. A frame records where it is in the atlas, its size in
 * world units, and the anchor: where the model's origin (its spot on the ground) falls inside the sprite.
 */

const PAGE_SIZE = 2048;
const PADDING = 3;

class Page {
  constructor() {
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

  get usedHeight() {
    return this.y + this.rowHeight + PADDING;
  }
}

/** A canvas of the given size (a sprite on its own, before packing). */
function canvasOf(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
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
 * Bake `specs` = [{ key, make: () => Object3D, shadow = true, ink = true, pxPerUnit? }] into a SpriteAtlas.
 * `pxPerUnit` is the sprite resolution at zoom 1 (rendered at `supersample`× and scaled down for smooth edges).
 */
export function bakeSprites(specs, { pxPerUnit = 64, supersample = 2, ink = true } = {}) {
  const started = performance.now();
  const atlas = new SpriteAtlas();
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, preserveDrawingBuffer: true });
  const rendered = []; // { key, image, shadowImage?, w, h, anchorX, anchorY }
  try {
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap; // filtered shadows (affordable: this runs once)

    const scene = new THREE.Scene();
    // Studio lighting: warm key from the sun direction, cool sky fill, a soft rim from behind.
    scene.add(new THREE.HemisphereLight(0xfff2dc, 0x6a5a3a, 1.35));
    const sun = new THREE.DirectionalLight(0xffe2b8, 2.6);
    sun.castShadow = true;
    // Crisp ground shadows with just a slightly softened edge, like the reference's strong cast shadows.
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.015;
    sun.shadow.radius = 1.5;
    sun.shadow.blurSamples = 8;
    scene.add(sun, sun.target);
    const rim = new THREE.DirectionalLight(0xc8dcff, 0.6);
    scene.add(rim, rim.target);

    // Ground that only shows shadows.
    const catcher = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.42 }));
    catcher.receiveShadow = true;
    scene.add(catcher);
    const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false });
    // Edge-finding passes for the ink style.
    const normalPass = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });
    const depthPass = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: { near: { value: 0 }, far: { value: 1 } },
      vertexShader: /* glsl */ `
        varying float vDepth;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vDepth = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float near;
        uniform float far;
        varying float vDepth;
        void main() {
          float d = clamp((vDepth - near) / (far - near), 0.0, 1.0) * 255.0;
          gl_FragColor = vec4(floor(d) / 255.0, fract(d), 0.0, 1.0);
        }`,
    });
    const work = document.createElement('canvas');
    const workCtx = work.getContext('2d', { willReadFrequently: true });
    const grab = (cw, ch) => {
      workCtx.clearRect(0, 0, cw, ch);
      workCtx.drawImage(canvas, 0, 0);
      return workCtx.getImageData(0, 0, cw, ch);
    };

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    camera.quaternion.copy(ISO_QUATERNION);
    const inverse = ISO_QUATERNION.clone().invert();
    const v = new THREE.Vector3();
    const box = new THREE.Box3();

    for (const spec of specs) {
      const { key, make, shadow = true } = spec;
      const object = make();
      scene.add(object);
      object.updateMatrixWorld(true);
      // Precise: tight around rotated parts, so frames stay small. Occluders (see isOccluder) don't count.
      box.makeEmpty();
      object.traverse((o) => {
        if (o.isMesh && !isOccluder(o)) box.expandByObject(o, true);
      });
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
      const ppu = spec.pxPerUnit ?? pxPerUnit; // a spec can bake at its own resolution (small, moving sprites)
      const outW = Math.max(1, Math.ceil(w * ppu));
      const outH = Math.max(1, Math.ceil(h * ppu));

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

      renderer.setSize(Math.ceil(outW * supersample), Math.ceil(outH * supersample), false);
      // Sprites without a ground shadow skip the shadow map entirely (much faster to bake).
      sun.castShadow = shadow;
      const meshes = [];
      object.traverse((o) => {
        if (o.isMesh && isOccluder(o)) {
          o.material = depthOnly; // hides what's behind it in every pass, but draws nothing itself
        } else if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          meshes.push([o, o.material]);
        }
      });

      // Layer 1: the object.
      catcher.visible = false;
      renderer.render(scene, camera);
      let source = canvas;
      if (ink && spec.ink !== false) {
        const cw = canvas.width;
        const ch = canvas.height;
        work.width = cw;
        work.height = ch;
        const color = grab(cw, ch);
        const passes = {};
        for (const [name, mat] of [
          ['normal', normalPass],
          ['depth', depthPass],
        ]) {
          for (const [o] of meshes) o.material = mat;
          if (name === 'depth') {
            // Depth only needs to span the object, which keeps the 16-bit packing precise.
            const mid = 60 - centre.dot(isoDirection(v));
            depthPass.uniforms.near.value = mid - radius * 1.2;
            depthPass.uniforms.far.value = mid + radius * 1.2;
          }
          renderer.render(scene, camera);
          passes[name] = grab(cw, ch).data;
        }
        for (const [o, mat] of meshes) o.material = mat;
        inkSprite({ color: color.data, normal: passes.normal, depth: passes.depth, w: cw, h: ch, depthRange: radius * 2.4 });
        workCtx.putImageData(color, 0, 0);
        source = work;
      }
      const image = canvasOf(outW, outH);
      image.getContext('2d').drawImage(source, 0, 0, source.width, source.height, 0, 0, outW, outH);
      const item = { key, image, w, h, anchorX: -minX, anchorY: -minY };
      rendered.push(item);

      // Layer 2: its shadow on the ground (the object itself writes depth only). Shadows are soft, so they're
      // stored at half resolution.
      if (shadow) {
        for (const [o] of meshes) o.material = depthOnly;
        catcher.visible = true;
        renderer.render(scene, camera);
        for (const [o, mat] of meshes) o.material = mat;
        item.shadowImage = canvasOf(Math.ceil(outW / 2), Math.ceil(outH / 2));
        item.shadowImage.getContext('2d').drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, item.shadowImage.width, item.shadowImage.height);
      }
      scene.remove(object);
    }
  } finally {
    renderer.dispose();
    renderer.forceContextLoss();
  }

  packAtlas(atlas, rendered);
  atlas.bakeMs = Math.round(performance.now() - started);
  return atlas;
}

/** Pack rendered sprites (and their shadows) onto pages, tallest first; trim the last page's height. */
/**
 * Part of a model that's there only to hide what's behind it (flag a group with userData.occluder): e.g. a tower
 * baked invisibly round its turning lookouts, so their frames hold only what shows past its roof and boards.
 */
function isOccluder(o) {
  for (let p = o; p; p = p.parent) if (p.userData.occluder) return true;
  return false;
}

function packAtlas(atlas, rendered) {
  const rects = [];
  for (const item of rendered) {
    rects.push({ item, image: item.image, shadow: false });
    if (item.shadowImage) rects.push({ item, image: item.shadowImage, shadow: true });
  }
  rects.sort((a, b) => b.image.height - a.image.height || b.image.width - a.image.width);
  const pages = [new Page()];
  for (const r of rects) {
    r.spot = pages.at(-1).place(r.image.width, r.image.height);
    if (!r.spot) {
      pages.push(new Page());
      r.spot = pages.at(-1).place(r.image.width, r.image.height);
    }
    r.page = pages.length - 1;
  }
  const canvases = pages.map((p, i) => canvasOf(PAGE_SIZE, i === pages.length - 1 ? Math.ceil(p.usedHeight / 4) * 4 : PAGE_SIZE));
  for (const r of rects) {
    const c = canvases[r.page];
    c.getContext('2d').drawImage(r.image, r.spot.x, r.spot.y);
    const { item } = r;
    const frame = frameFor(r.page, r.spot, r.image.width, r.image.height, item.w, item.h, item.anchorX, item.anchorY, c.width, c.height);
    // An object and its shadow are packed separately, in either order; link them up whichever comes second.
    if (r.shadow) {
      item.shadowFrame = frame;
      const objectFrame = atlas.frames.get(item.key);
      if (objectFrame) objectFrame.shadow = frame;
    } else {
      if (item.shadowFrame) frame.shadow = item.shadowFrame;
      atlas.frames.set(item.key, frame);
    }
  }
  atlas.pages = canvases.map((c) => ({ source: c, texture: pageTexture(new THREE.CanvasTexture(c)) }));
}

function pageTexture(texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Plain data for saving an atlas to files: { frames, pages: [image data URLs] }. Pages are WebP (high quality;
 * its alpha is stored losslessly, so sprite edges stay clean) unless `format` says otherwise.
 */
export function serializeAtlas(atlas, { format = 'image/webp', quality = 0.92 } = {}) {
  return {
    frames: Object.fromEntries(atlas.frames),
    pages: atlas.pages.map((p) => p.source.toDataURL(format, quality)),
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

function frameFor(pageIndex, spot, outW, outH, w, h, anchorX, anchorY, pageW = PAGE_SIZE, pageH = PAGE_SIZE) {
  return {
    page: pageIndex,
    // UV rectangle (v measured from the bottom, as WebGL textures are flipped).
    u0: spot.x / pageW,
    v0: 1 - (spot.y + outH) / pageH,
    u1: (spot.x + outW) / pageW,
    v1: 1 - spot.y / pageH,
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
