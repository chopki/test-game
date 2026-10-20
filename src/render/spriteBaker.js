import * as THREE from 'three';
import { ISO_QUATERNION, SUN_DIRECTION, isoDirection } from './iso.js';
import { inkSprite } from './inkStyle.js';
import { packAtlas, pageTexture } from './atlasPacking.js';

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
 * Sprites are rendered first, then packed into atlas pages (see atlasPacking.js). A frame records where it is in
 * the atlas, its size in world units, and the anchor: where the model's origin (its spot on the ground) falls
 * inside the sprite.
 */

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
 * Bake `specs` = [{ key, make: () => Object3D, shadow = true, ink = true, pxPerUnit?, res? }] into a SpriteAtlas.
 * `pxPerUnit` is the sprite resolution at zoom 1 (rendered at `supersample`× and scaled down for smooth edges); a
 * spec's own `pxPerUnit` overrides it, and `res` 'unit' or 'hero' takes the set's `unitPx` or `heroPx` instead.
 *
 * `cached` (scripts/bake-sprites.mjs's incremental bake): a Map of key → a sprite rendered before
 * ({ image, shadowImage?, w, h, anchorX, anchorY }, see spriteFingerprint), used as it is; `onRendered(key, item)`
 * hears of each sprite rendered afresh, so it can be cached.
 */
export function bakeSprites(specs, { pxPerUnit = 64, supersample = 2, ink = true, cached = null, onRendered = null, unitPx = 56, heroPx = unitPx } = {}) {
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
    // Each sprite is rendered up to four times (colour, normals, depth, shadow); its shadow map is drawn once, for
    // the first (left to update itself, three.js redraws it, blur and all, for every render: most of the bake).
    renderer.shadowMap.autoUpdate = false;

    const scene = new THREE.Scene();
    // Studio lighting: warm key from the sun direction, cool sky fill, a soft rim from behind.
    scene.add(new THREE.HemisphereLight(0xfff2dc, 0x6a5a3a, 1.35));
    const sun = new THREE.DirectionalLight(0xffe2b8, 2.6);
    sun.castShadow = true;
    // Crisp ground shadows with just a slightly softened edge, like the reference's strong cast shadows. The map's
    // size is set per sprite (see below).
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.015;
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
      const hit = cached?.get(key);
      if (hit) {
        rendered.push({ key, ...hit });
        continue;
      }
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
      // A spec can bake at its own resolution, or a soldier's or hero's from the set (`res`).
      const ppu = spec.pxPerUnit ?? (spec.res === 'hero' ? heroPx : spec.res === 'unit' ? unitPx : pxPerUnit);
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
      // A shadow map only as fine as the sprite needs (a power of two, 256 to 2048 texels across), with the blur
      // scaled to match, so the softness is the same in world units whatever the size.
      const mapSize = Math.min(2048, Math.max(256, 2 ** Math.ceil(Math.log2(radius * 3.2 * ppu * supersample * 1.5))));
      if (sun.shadow.mapSize.x !== mapSize) {
        sun.shadow.map?.dispose();
        sun.shadow.map = null;
        sun.shadow.mapPass?.dispose();
        sun.shadow.mapPass = null;
        sun.shadow.mapSize.set(mapSize, mapSize);
      }
      sun.shadow.radius = 1.5 * (mapSize / 2048);
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

      // Layer 1: the object (its shadow map is drawn now, for this and the shadow layer).
      catcher.visible = false;
      renderer.shadowMap.needsUpdate = shadow;
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
      onRendered?.(key, item);
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

/**
 * Part of a model that's there only to hide what's behind it (flag a group with userData.occluder): e.g. a tower
 * baked invisibly round its turning lookouts, so their frames hold only what shows past its roof and boards.
 */
function isOccluder(o) {
  for (let p = o; p; p = p.parent) if (p.userData.occluder) return true;
  return false;
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

// ---------------------------------------------------------------- fingerprints (the incremental bake)

/**
 * A fingerprint of what `spec`'s sprite will look like: everything about its built model `object` that rendering
 * reads (each visible mesh's geometry, material, textures' pixels and place), its own bake options, and `salt`
 * (the set's options and the baker's own sources, from scripts/bake-sprites.mjs). Two sprites with the same
 * fingerprint render the same, so a sprite whose fingerprint is unchanged needn't be rendered again.
 */
export function spriteFingerprint(object, spec, salt, memo = new Map()) {
  const h = new Hasher();
  h.str(salt);
  h.str(JSON.stringify([spec.shadow ?? true, spec.ink ?? true, spec.pxPerUnit ?? null, spec.res ?? null]));
  object.updateMatrixWorld(true);
  object.traverseVisible((o) => {
    if (!o.isMesh) return;
    h.str(o.type);
    h.str(isOccluder(o) ? 'occluder' : 'solid');
    h.numbers(o.matrixWorld.elements);
    h.str(memoized(memo, o.geometry, geometryPrint));
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) h.str(memoized(memo, m, (m) => materialPrint(m, memo)));
  });
  return h.digest();
}

const memoized = (memo, thing, print) => {
  if (!memo.has(thing.uuid)) memo.set(thing.uuid, print(thing));
  return memo.get(thing.uuid);
};

function geometryPrint(g) {
  const h = new Hasher();
  for (const name of Object.keys(g.attributes).sort()) {
    const a = g.attributes[name];
    h.str(`${name}:${a.itemSize}:${a.normalized}`);
    h.array(a.array);
  }
  if (g.index) h.array(g.index.array);
  h.str(JSON.stringify([g.groups, g.drawRange]));
  return h.digest();
}

const SKIP = new Set(['uuid', 'name', 'id', 'version', 'userData', 'needsUpdate']);

function materialPrint(m, memo) {
  const parts = [];
  for (const k of Object.keys(m).sort()) {
    const v = m[k];
    if (SKIP.has(k) || k.startsWith('_') || typeof v === 'function' || v === null || v === undefined) continue;
    if (v.isColor) parts.push(`${k}=${v.getHexString()}`);
    else if (v.isTexture) parts.push(`${k}=${memoized(memo, v, texturePrint)}`);
    else if (v.isVector2 || v.isVector3) parts.push(`${k}=${v.toArray().join(',')}`);
    else if (typeof v === 'object') parts.push(`${k}=${JSON.stringify(v)}`);
    else parts.push(`${k}=${v}`);
  }
  return parts.join(';');
}

function texturePrint(t) {
  const h = new Hasher();
  h.str(JSON.stringify([t.wrapS, t.wrapT, t.repeat.toArray(), t.offset.toArray(), t.rotation, t.center.toArray(), t.colorSpace, t.flipY, t.minFilter, t.magFilter, t.anisotropy, t.generateMipmaps]));
  const img = t.image;
  if (img?.getContext) h.array(img.getContext('2d').getImageData(0, 0, img.width, img.height).data);
  else h.str(String(img?.src ?? img?.width));
  return h.digest();
}

/** Two 32-bit FNV-style hashes side by side (64 bits: plenty for a few thousand sprites). */
class Hasher {
  constructor() {
    this.a = 0x811c9dc5;
    this.b = 0x01000193 ^ 0x9e3779b9;
  }

  word(w) {
    this.a = Math.imul(this.a ^ w, 0x01000193);
    this.b = Math.imul(this.b ^ w, 0x5bd1e995) ^ (this.b >>> 15);
  }

  str(s) {
    for (let i = 0; i < s.length; i++) this.word(s.charCodeAt(i));
    this.word(0xff);
  }

  /** A typed array's bytes (as 32-bit words, plus the odd bytes left over). */
  array(arr) {
    const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
    const words = arr.byteOffset % 4 ? new Uint32Array(0) : new Uint32Array(arr.buffer, arr.byteOffset, bytes.length >> 2);
    for (let i = 0; i < words.length; i++) this.word(words[i]);
    for (let i = words.length * 4; i < bytes.length; i++) this.word(bytes[i]);
    this.word(bytes.length);
  }

  numbers(list) {
    // Rounded, so float noise in the last place doesn't count as a change.
    for (const v of list) this.word(Math.round(v * 1e5) | 0);
  }

  digest() {
    return (this.a >>> 0).toString(16).padStart(8, '0') + (this.b >>> 0).toString(16).padStart(8, '0');
  }
}
