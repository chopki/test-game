import * as THREE from 'three';
import { REALM } from '../sim/config.js';
import { seenAt } from '../sim/realm/fog.js';
import { flagSpot } from '../sim/realm/bounties.js';
import { FLAGPOLE } from './models.js';
import { MARKS } from './groundMarks.js';
import { PAINT_BORDER } from './terrainPainter.js';
import { parchmentTexture } from './parchment.js';
import { underlay } from './Renderer.js';
import { spriteKeys } from './spriteCatalog.js';

// Realm mode's battlefield (see src/sim/realm/): the fog of war over land no one has seen, the outlaws' camps (and
// the scorched ground where they burnt), and the bounty flags. The renderer calls in each frame; like it, this only
// reads the world.

const FOG_VERTEX = /* glsl */ `
  uniform vec2 offset;
  varying vec2 vMap;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vMap = world.xz + offset;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

// Unseen land is a sheet of old paper, as on a chart not yet drawn (the sheet itself is parchment.js, one copy every
// PAPER_TILES tiles; it mipmaps, so it stays crisp close up and calm far out), with a faint graticule of chart lines.
// Towards the known land the paper is aged and browned, a cartographer's hatching shades it, and where it gives way
// there's a dark ink-bleed line, as if that edge had just been drawn (the chunk texture is sampled smoothly, and noise
// breaks up the line). See docs/research/10-ui-and-art-direction.md.
// The hero rings: the guild's colour round the part of the ring that's the hero's health (clockwise from the top of
// the screen), the rest dark.
const RING_VERTEX = /* glsl */ `
  attribute float hp;
  attribute vec3 tint;
  varying vec3 vColour;
  varying float vHp;
  varying vec2 vLocal;
  void main() {
    vColour = tint;
    vHp = hp;
    vLocal = position.xz;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;
const RING_FRAGMENT = /* glsl */ `
  uniform float opacity;
  varying vec3 vColour;
  varying float vHp;
  varying vec2 vLocal;
  void main() {
    // The iso camera looks from +x +z, so "up the screen" is towards -x -z.
    float a = atan(vLocal.x - vLocal.y, -(vLocal.x + vLocal.y)) / 6.28318 + 0.5;
    vec3 colour = a <= vHp ? vColour : vColour * 0.25 + vec3(0.08);
    gl_FragColor = vec4(colour, opacity);
  }
`;

const PAPER_TILES = 14;
const MAX_RINGS = 64;
const FOG_FRAGMENT = /* glsl */ `
  uniform sampler2D seen;
  uniform sampler2D paper;
  uniform vec2 size;
  uniform float night; // 0 by day, 1 at night: the paper goes to an indigo ink wash
  varying vec2 vMap;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  // A line of width w (in tiles) once every so many tiles along v, with soft edges.
  float lines(float v, float every, float w) {
    float d = abs(fract(v / every + 0.5) - 0.5) * every;
    return 1.0 - smoothstep(w * 0.5, w * 0.5 + 0.04, d);
  }
  void main() {
    float s = texture2D(seen, clamp(vMap / size, 0.0, 1.0)).r;
    float n = noise(vMap * 0.35) * 0.6 + noise(vMap * 1.1) * 0.4; // the edge's wobble
    float fog = 1.0 - smoothstep(0.3 + n * 0.14, 0.58 + n * 0.14, s);
    if (fog < 0.01) discard;
    // Two copies of the sheet, at different sizes and turned, so its repeats don't show.
    vec2 turned = mat2(0.8, -0.6, 0.6, 0.8) * vMap;
    vec3 sheet = mix(texture2D(paper, vMap / ${PAPER_TILES.toFixed(1)}).rgb, texture2D(paper, turned / ${(PAPER_TILES * 1.7).toFixed(1)} + 0.37).rgb, 0.45);
    // Broad variation across the sheet (so its repeats don't show), and the chart's graticule: thin sepia lines every
    // eight tiles, broken into dashes.
    float broad = noise(vMap * 0.06) * 0.6 + noise(vMap * 0.17) * 0.4;
    vec3 colour = sheet * mix(0.9, 1.05, broad);
    float dash = step(0.35, fract((vMap.x + vMap.y) * 0.5));
    float grid = max(lines(vMap.x, 8.0, 0.05), lines(vMap.y, 8.0, 0.05)) * dash;
    colour = mix(colour, vec3(0.45, 0.3, 0.18), grid * 0.35);
    // Towards the known land (the last few tiles of the fog): aged and browned, and shaded with a cartographer's
    // hatching (diagonal strokes, broken up), then the inked edge.
    float near = smoothstep(0.0, 0.32, s + (n - 0.5) * 0.08); // 0 deep in the fog, 1 at its edge
    colour = mix(colour, colour * vec3(0.74, 0.6, 0.44), near * 0.75);
    float hatch = lines((vMap.x - vMap.y) * 0.7071, 0.3, 0.07) * step(0.35, noise(vMap * 1.7));
    colour = mix(colour, vec3(0.3, 0.2, 0.12), hatch * smoothstep(0.2, 0.75, near) * 0.7);
    float rim = smoothstep(0.08, 0.42, fog) * (1.0 - smoothstep(0.48, 0.85, fog));
    colour = mix(colour, vec3(0.26, 0.17, 0.1), rim * 0.85);
    colour = mix(colour, colour * vec3(0.32, 0.36, 0.62) + vec3(0.02, 0.03, 0.08), night * 0.8);
    gl_FragColor = vec4(colour, max(smoothstep(0.0, 0.5, fog) * 0.97, rim * 0.92));
  }
`;

export class RealmLayer {
  constructor(renderer) {
    this.r = renderer;
    this.fog = null;
    // A ring on the ground under each hero, in its guild's colour (REALM.classes), so heroes stand out from the
    // soldiers and the outlaws, and tell you whose they are; the ring is also its health, the lost part darkened.
    const material = underlay(
      new THREE.ShaderMaterial({
        uniforms: { opacity: { value: 0.9 } },
        vertexShader: RING_VERTEX,
        fragmentShader: RING_FRAGMENT,
      }),
      0.9,
    );
    const ring = new THREE.RingGeometry(0.3, 0.44, 32).rotateX(-Math.PI / 2);
    this._ringHp = new THREE.InstancedBufferAttribute(new Float32Array(MAX_RINGS), 1);
    this._ringTint = new THREE.InstancedBufferAttribute(new Float32Array(MAX_RINGS * 3), 3);
    ring.setAttribute('hp', this._ringHp);
    ring.setAttribute('tint', this._ringTint);
    this.rings = new THREE.InstancedMesh(ring, material, MAX_RINGS);
    this.rings.renderOrder = 1;
    this.rings.frustumCulled = false;
    this.rings.count = 0;
    renderer.groundLayer.add(this.rings);
    this._m = new THREE.Matrix4();
    this._colour = new THREE.Color();
    this._flagViews = new Map(); // flag id → { phase }
    this._lairViews = new Map(); // lair index → { lastHp, hitAt }
    this._pos = new THREE.Vector3();
  }

  attach(world) {
    this.detach();
    this.world = world;
    this.r.setNight(false);
    this._flagViews.clear();
    this._lairViews.clear();
    if (!world.realm) return;
    const f = world.realm.fog;
    const data = new Uint8Array(f.cols * f.rows * 4);
    this._fogData = data;
    this._fogTexture = new THREE.DataTexture(data, f.cols, f.rows, THREE.RGBAFormat);
    this._fogTexture.magFilter = THREE.LinearFilter;
    this._fogTexture.minFilter = THREE.LinearFilter;
    this._fogVersion = -1;
    this._night = 0;
    const { width, height } = world.grid;
    const w = width + PAINT_BORDER * 2;
    const h = height + PAINT_BORDER * 2;
    const material = new THREE.ShaderMaterial({
      uniforms: {
        seen: { value: this._fogTexture },
        paper: { value: parchmentTexture() },
        night: { value: 0 },
        size: { value: new THREE.Vector2(f.cols * REALM.chunk, f.rows * REALM.chunk) },
        offset: { value: new THREE.Vector2(this.r.offsetX, this.r.offsetZ) },
      },
      vertexShader: FOG_VERTEX,
      fragmentShader: FOG_FRAGMENT,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.fog = new THREE.Mesh(new THREE.PlaneGeometry(w, h).rotateX(-Math.PI / 2), material);
    this.fog.position.set(width / 2 - this.r.offsetX, 0.05, height / 2 - this.r.offsetZ);
    this.fog.renderOrder = 10; // over the battlefield's sprites, under the health bars of what can be seen
    this.fog.frustumCulled = false;
    this.r.overlayLayer.add(this.fog);
    this._unsubscribe = [
      world.events.on('lairRazed', ({ lair }) => {
        this.r._fxCollapse(lair);
        for (let i = 0; i < 3; i++) this.r.scorches.push({ x: lair.cx + (i - 1) * 0.5, z: lair.cz + (i % 2) * 0.4 - 0.2, size: 1.6, angle: i * 2.1, cell: MARKS.scorch[i % 2], age: 0 });
      }),
    ];
  }

  detach() {
    this.rings.count = 0;
    for (const off of this._unsubscribe ?? []) off();
    this._unsubscribe = [];
    if (this.fog) {
      this.r.overlayLayer.remove(this.fog);
      this.fog.geometry.dispose();
      this.fog.material.dispose();
      this._fogTexture.dispose();
      this.fog = null;
    }
    this.world = null;
  }

  /** Whether the renderer should leave unit `t` out: heroes indoors, and outlaws out in the fog. */
  hides(t) {
    const w = this.world;
    if (!w?.realm) return false;
    return t.inside > 0 || (t.team === 'neutral' && !seenAt(w, t.x, t.z));
  }

  /** Each frame (from Renderer.update, between begin and end of its batches). */
  update(time) {
    const w = this.world;
    if (!w?.realm) return;
    const r = this.r;
    const realm = w.realm;
    if (realm.fog.version !== this._fogVersion) {
      this._fogVersion = realm.fog.version;
      const seen = realm.fog.seen;
      for (let i = 0; i < seen.length; i++) this._fogData[i * 4] = seen[i] ? 255 : 0;
      this._fogTexture.needsUpdate = true;
    }

    // Night (the wave): the field dims and cools (Renderer.setNight), the paper turns to ink wash, and lantern light
    // pools round the Hall, the camps and each hero out of doors, so they can still be found.
    const night = w.phase === 'wave';
    r.setNight(night);
    this._night += ((night ? 1 : 0) - this._night) * Math.min(1, (r._dt ?? 0.016) * 0.5);
    this.fog.material.uniforms.night.value = this._night;
    if (this._night > 0.05 && r.graphics.glow) {
      const k = this._night;
      const hall = w.townHall;
      r.glows.add(r.toScene(hall.cx, 1.2, hall.cz, this._pos), 4.5, 0xffc27a, 0.55 * k);
      for (const h of realm.heroes) {
        if (!h.alive || h.inside > 0) continue;
        r.glows.add(r.toScene(h.x, 0.6, h.z, this._pos), 2.2, 0xffd08a, (0.45 + 0.05 * Math.sin(time * 7 + h.id)) * k);
      }
    }

    let n = 0;
    for (const h of realm.heroes) {
      if (!h.alive || h.inside > 0 || n >= MAX_RINGS) continue;
      r.toScene(h.x, 0.03, h.z, this._pos);
      this.rings.setMatrixAt(n, this._m.makeTranslation(this._pos.x, this._pos.y, this._pos.z));
      this._colour.setStyle(REALM.classes[h.cls].colour, THREE.LinearSRGBColorSpace); // (as given: the shader outputs it as is)
      this._ringTint.setXYZ(n, this._colour.r, this._colour.g, this._colour.b);
      this._ringHp.setX(n, Math.max(0, h.hp / h.maxHp));
      n++;
    }
    this.rings.count = n;
    this.rings.instanceMatrix.needsUpdate = true;
    this._ringTint.needsUpdate = true;
    this._ringHp.needsUpdate = true;

    const camp = spriteKeys.building(REALM.lairs.type);
    for (const lair of realm.lairs) {
      if (!lair.discovered || lair.razed) continue;
      const ground = r.toScene(lair.cx, 0, lair.cz, this._pos);
      r.groundMarks.add(MARKS.earth[lair.index % 2], ground, lair.size * 1.6, lair.index * 1.7, 0.9);
      r.sprites.add(camp, ground, 1, 0, 0, 0);
      r.shadowSprites.add(camp, ground);
      const view = this._lairViews.get(lair.index) ?? { phase: Math.random() };
      this._lairViews.set(lair.index, view);
      const bar = r._barFade(view, lair);
      if (bar) r.healthBars.add(r.toScene(lair.cx, lair.def.height + 0.5, lair.cz, this._pos), 1.4, lair.hp / lair.maxHp, bar);
      if (r.graphics.glow) {
        const flicker = 0.45 + 0.1 * Math.sin(time * 9 + view.phase * 6) + 0.06 * Math.sin(time * 21 + view.phase);
        r.glows.add(r.toScene(lair.x + 1.1, 0.25, lair.z + 1.15, this._pos), 1.1, 0xff8a2a, flicker);
      }
    }

    // Bounty flags: a pole with a red flag for an attack bounty, a pale one for an explore flag.
    const pole = spriteKeys.flagpole();
    const live = new Set();
    for (const f of realm.bounties) {
      live.add(f.id);
      const view = this._flagViews.get(f.id) ?? { phase: Math.random() };
      this._flagViews.set(f.id, view);
      const at = flagSpot(w, f);
      // On a foe or a camp the flag stands just beside it.
      const x = f.kind === 'explore' ? at.x : at.x + (f.lair !== undefined ? 1.2 : 0.45);
      const z = f.kind === 'explore' ? at.z : at.z + (f.lair !== undefined ? 1.2 : 0.2);
      const ground = r.toScene(x, 0, z, this._pos);
      const scale = f.unit ? 0.6 : 1;
      r.sprites.add(pole, ground, scale, 0, 0, 0);
      r.shadowSprites.add(pole, ground, scale);
      r._drawFlag(view, x, z, { ...FLAGPOLE, w: FLAGPOLE.w * scale, y: FLAGPOLE.y * scale }, false, f.kind === 'explore' ? 'neutral' : 'red');
    }
    for (const id of this._flagViews.keys()) if (!live.has(id)) this._flagViews.delete(id);
  }

  /** Where each flag's gold tag goes (map coords at the top of its pole), for the HUD. */
  flagTags() {
    const w = this.world;
    if (!w?.realm) return [];
    return w.realm.bounties.map((f) => {
      const at = flagSpot(w, f);
      const near = f.kind === 'explore' ? [0, 0] : f.lair !== undefined ? [1.2, 1.2] : [0.45, 0.2];
      return { flag: f, x: at.x + near[0], y: (f.unit ? 0.6 : 1) * (FLAGPOLE.y + 0.35), z: at.z + near[1] };
    });
  }
}
