import * as THREE from 'three';
import { REALM } from '../sim/config.js';
import { seenAt } from '../sim/realm/fog.js';
import { flagSpot } from '../sim/realm/bounties.js';
import { FLAGPOLE } from './models.js';
import { MARKS } from './groundMarks.js';
import { PAINT_BORDER } from './terrainPainter.js';
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

// Unseen land is blank vellum, as on a chart not yet drawn: warm, mottled paper with a faint grain, and where it
// gives way to the known land a dark ink-bleed rim, as if that edge had just been drawn (the chunk texture is sampled
// smoothly, and noise breaks up the line). See docs/research/10-ui-and-art-direction.md.
const FOG_FRAGMENT = /* glsl */ `
  uniform sampler2D seen;
  uniform vec2 size;
  varying vec2 vMap;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  void main() {
    float s = texture2D(seen, clamp(vMap / size, 0.0, 1.0)).r;
    float n = noise(vMap * 0.35) * 0.6 + noise(vMap * 1.1) * 0.4; // the edge's wobble and the paper's mottling
    float fog = 1.0 - smoothstep(0.3 + n * 0.14, 0.58 + n * 0.14, s);
    if (fog < 0.01) discard;
    float grain = noise(vMap * 6.0) * 0.5 + noise(vMap * 13.0) * 0.5;
    vec3 paper = mix(vec3(0.78, 0.7, 0.54), vec3(0.9, 0.84, 0.68), n) * (0.93 + grain * 0.1);
    // The rim: strongest part-way into the fog, fading both ways.
    float rim = smoothstep(0.08, 0.45, fog) * (1.0 - smoothstep(0.5, 0.9, fog));
    vec3 colour = mix(paper, vec3(0.3, 0.2, 0.12), rim * 0.8);
    gl_FragColor = vec4(colour, max(fog * 0.95, rim * 0.9));
  }
`;

export class RealmLayer {
  constructor(renderer) {
    this.r = renderer;
    this.fog = null;
    this._flagViews = new Map(); // flag id → { phase }
    this._lairViews = new Map(); // lair index → { lastHp, hitAt }
    this._pos = new THREE.Vector3();
  }

  attach(world) {
    this.detach();
    this.world = world;
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
    const { width, height } = world.grid;
    const w = width + PAINT_BORDER * 2;
    const h = height + PAINT_BORDER * 2;
    const material = new THREE.ShaderMaterial({
      uniforms: {
        seen: { value: this._fogTexture },
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
