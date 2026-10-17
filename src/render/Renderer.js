import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { GRID } from '../sim/config.js';
import { T } from '../sim/terrain.js';
import { createRng } from '../sim/rng.js';
import { AUTO_RESOLUTION, GROUND_DETAIL, GROUND_PX, SCENERY_COUNT } from './graphicsSettings.js';
import { OUTER_GROUND, outsideForest, paintTerrain } from './terrainPainter.js';
import { cloudTexture } from './textures.js';
import { wallSeat } from './wallSeat.js';
import { WALL_DECOR_KINDS } from './wallDecor.js';
import { waterFlow } from './waterFlow.js';
import { waterTexture } from './waterTextures.js';
import { createProjectileModel, SCENERY_SWAY, SCENERY_VARIANTS, WALL_VARIANTS } from './models.js';
import { BlobShadowBatch, HealthBarBatch } from './batches.js';
import { ISO_QUATERNION, isoDirection } from './iso.js';
import { SpriteLayer } from './spriteLayer.js';
import { CATAPULT_ARM_FRAMES, ENEMY_ANIMS, crystalHeight, spriteKeys, turretHeight } from './spriteCatalog.js';

const SKY = 0xa9d3ee;

const BURST_GEOMETRY = new THREE.SphereGeometry(1, 12, 8);
const RING_GEOMETRY = new THREE.RingGeometry(0.85, 1, 48).rotateX(-Math.PI / 2);
const NEIGHBOURS = [
  ['n', 0, -1],
  ['e', 1, 0],
  ['s', 0, 1],
  ['w', -1, 0],
];
const ENEMY_BAR_WIDTH = { grunt: 0.6, runner: 0.6, orc: 0.75, brute: 0.9 };
const ENEMY_BLOB_RADIUS = { grunt: 0.28, runner: 0.24, orc: 0.38, brute: 0.6 };
// Tiles covered by one walk cycle, so feet keep pace with the ground.
const WALK_STRIDE = { grunt: 0.7, runner: 0.8, orc: 0.85, brute: 1.2 };
const DEATH_FRAME_TIME = 0.11; // seconds per death frame
const CORPSE_TIME = 0.9; // how long a fallen enemy stays before vanishing
// Visible world height at zoom 1 is at least this; portrait screens show at least VIEW_WIDTH across.
const VIEW_HEIGHT = 30;
const VIEW_WIDTH = 30;

/**
 * Owns the Three.js scene and mirrors a sim World into it every frame.
 * The renderer never mutates the world: it reads entity state, keeps one
 * view per entity id, and spawns short-lived effects from world events.
 *
 * The battlefield is drawn the way classic isometric games are: a fixed iso camera, and every building,
 * wall, enemy and tree is a pre-rendered sprite (see spriteBaker.js / spriteCatalog.js), drawn by SpriteLayer
 * in a handful of draw calls. Models are baked once at start-up with lighting and soft shadows a phone
 * couldn't afford live. Projectiles and effects are small real-time 3D meshes on top.
 *
 * Draw order: ground (no depth writes) → baked ground shadows, unit blob shadows, grid and selection marks
 * (no depth test, renderOrder 1) → sprites (alpha-cut, depth-tested, renderOrder 2) → 3D projectiles and
 * effects (renderOrder 3) → health bars. Cloud shadows (renderOrder 2.5) multiply over the sprites.
 *
 * Sim coordinates (tile units, origin at the grid corner) map to scene coordinates with the grid centred on
 * the origin.
 */
export class Renderer {
  /**
   * `graphics` is a settings object from graphicsSettings.js (see applySettings()); `atlas` the battlefield
   * sprites (see spriteAssets.js).
   */
  constructor(container, graphics, atlas) {
    this.container = container;
    this.offsetX = GRID.width / 2;
    this.offsetZ = GRID.height / 2;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
    this.camera.position.copy(isoDirection()).multiplyScalar(120);
    this.camera.quaternion.copy(ISO_QUATERNION);

    // Anti-aliasing can only be chosen when the WebGL context is created; other settings apply live.
    this.renderer = new THREE.WebGLRenderer({
      antialias: graphics.antialias,
      powerPreference: graphics.preset === 'low' ? 'low-power' : 'default',
    });
    this.renderScale = 1;
    container.appendChild(this.renderer.domElement);

    this.controls = new MapControls(this.camera, this.renderer.domElement);
    // Fixed iso view: pan and zoom only. Left mouse is reserved for building.
    this.controls.enableRotate = false;
    this.controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN };
    this.controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.screenSpacePanning = false;
    this.controls.minZoom = 0.55;
    this.controls.maxZoom = 2.6;

    this._setupLights();
    this._setupTerrain();

    this.atlas = atlas;
    this.groundLayer = new THREE.Group();
    this.entityLayer = new THREE.Group();
    this.overlayLayer = new THREE.Group();
    this.scene.add(this.groundLayer, this.entityLayer, this.overlayLayer);
    this.shadowSprites = new SpriteLayer(this.atlas, this.groundLayer, 'shadow');
    this.sprites = new SpriteLayer(this.atlas, this.entityLayer, 'object');
    this.turretHeights = {};

    this.views = { buildings: new Map(), enemies: new Map(), projectiles: new Map() };
    this.healthBars = new HealthBarBatch(this.overlayLayer);
    this.blobShadows = new BlobShadowBatch(this.groundLayer);
    this.effects = [];
    this.corpses = [];
    this._decorPos = new THREE.Vector3();
    this._toCamera = isoDirection(new THREE.Vector3());
    this._unsubscribe = [];
    this._raycaster = new THREE.Raycaster();
    this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._time = 0;
    this._v = new THREE.Vector3();
    this.scenerySpots = [];
    this.terrainSpots = [];

    this.applySettings(graphics);
    window.addEventListener('resize', () => this._resize());
    this._resize();
  }

  get canvas() {
    return this.renderer.domElement;
  }

  // ---------------------------------------------------------------- setup

  _setupLights() {
    // Only projectiles and the build ghost are lit live; everything else has baked lighting.
    this.scene.add(new THREE.HemisphereLight(0xfff4e0, 0x5a6a3a, 1.5));
    const sun = new THREE.DirectionalLight(0xffe2b8, 2.4);
    sun.position.set(-18, 34, 8);
    this.scene.add(sun);
  }

  _setupTerrain() {
    const W = GRID.width;
    const H = GRID.height;
    const m = GRID.spawnMargin;
    // Flat ground to the horizon; each map's painted ground (see _buildTerrain) fades into it.
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshBasicMaterial({ color: OUTER_GROUND, depthWrite: false }));
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.03;
    outer.renderOrder = -2;
    this.scene.add(outer);

    // Shown only while building (BuildController toggles it): the tile grid, plus a tint on tiles whose
    // terrain can't be built on (added per map).
    this.grid = new THREE.Group();
    this.grid.visible = false;
    const lines = new THREE.GridHelper(W - 2 * m, W - 2 * m, 0x2b4a1c, 0x2b4a1c);
    underlay(lines.material, 0.25);
    lines.position.y = 0.01;
    lines.renderOrder = 1;
    this.grid.add(lines);
    this.scene.add(this.grid);
    this._clouds = this._createClouds();
  }

  /**
   * Cloud shadows drifting across the battlefield: one big ground-level plane drawn after the sprites, which
   * multiplies a soft, scrolling cloud mask into what's already there (so clouds pass over trees and walls too).
   * Shown with the Effects setting.
   */
  _createClouds() {
    const material = new THREE.ShaderMaterial({
      uniforms: { mask: { value: cloudTexture() }, time: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vWorld;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D mask;
        uniform float time;
        varying vec2 vWorld;
        void main() {
          // Two layers drifting at different speeds and slightly different headings, so the clouds visibly move
          // and slowly change shape.
          float a = texture2D(mask, (vWorld - vec2(1.6, 0.9) * time) / 46.0).r;
          float b = texture2D(mask, (vWorld * 0.7 - vec2(1.1, 1.0) * time + 13.0) / 46.0).r;
          float cloud = smoothstep(0.22, 0.5, a * 0.7 + b * 0.55);
          vec3 shade = mix(vec3(1.0), vec3(0.66, 0.69, 0.78), cloud);
          gl_FragColor = vec4(shade, 1.0);
        }`,
      depthTest: false,
      depthWrite: false,
      blending: THREE.CustomBlending,
      // result = what's drawn × shade; the canvas alpha is left alone (see underlay()).
      blendSrc: THREE.DstColorFactor,
      blendDst: THREE.ZeroFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(320, 320).rotateX(-Math.PI / 2), material);
    mesh.position.y = 0.02;
    mesh.renderOrder = 2.5; // after the sprites, before projectiles, effects and health bars
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    return mesh;
  }

  /**
   * Paint this map's ground and place its terrain sprites (trees on forest tiles, outcrops on rock tiles),
   * the water shimmer and the build-mode tint. Runs when a world is attached or the scenery setting changes.
   */
  _buildTerrain() {
    const world = this.world;
    for (const obj of [this._ground, this._shimmer, this._blockedTint]) {
      if (!obj) continue;
      obj.removeFromParent();
      obj.geometry.dispose();
      obj.material.map?.dispose();
      obj.material.uniforms?.mask.value.dispose();
      obj.material.dispose();
    }
    this._ground = this._shimmer = this._blockedTint = null;
    if (!world) return;

    const grid = world.grid;
    const scenery = this.graphics.scenery;
    const started = performance.now();
    const painted = paintTerrain(grid, { pxPerTile: GROUND_PX[scenery], detail: GROUND_DETAIL[scenery], seed: world.seed });
    this.terrainPaintMs = Math.round(performance.now() - started);
    this._terrainNoise = painted.noise;

    const texture = new THREE.CanvasTexture(painted.canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const { width: TW, height: TH } = painted.tiles;
    this._ground = new THREE.Mesh(new THREE.PlaneGeometry(TW, TH), new THREE.MeshBasicMaterial({ map: texture, depthWrite: false }));
    this._ground.rotation.x = -Math.PI / 2;
    this._ground.renderOrder = -1;
    this.scene.add(this._ground);

    if (painted.hasWater) this._shimmer = this._createShimmer(painted);
    this._blockedTint = this._createBlockedTint(grid);
    this.grid.add(this._blockedTint);

    // Terrain sprites: one tree per forest tile (a mix of kinds, by region: see treeKind), an outcrop per rock tile.
    this.terrainSpots = [];
    const rnd = createRng(world.seed ^ 0x7ee5);
    for (let z = 0; z < grid.height; z++) {
      for (let x = 0; x < grid.width; x++) {
        const t = grid.terrain[z * grid.width + x];
        if (t !== T.forest && t !== T.rock) continue;
        const jitter = t === T.forest ? 0.18 : 0.06;
        const pos = this.toScene(x + 0.5 + rnd.range(-jitter, jitter), 0, z + 0.5 + rnd.range(-jitter, jitter));
        const variant = rnd.int(0, SCENERY_VARIANTS - 1);
        if (t === T.rock) {
          this.terrainSpots.push(this._scenerySpot('outcrop', variant, pos, rnd.range(0.95, 1.1)));
          continue;
        }
        this.terrainSpots.push(this._scenerySpot(treeKind(painted.noise, x, z, rnd), variant, pos, rnd.range(0.85, 1.18)));
      }
    }
    this._buildScenery(SCENERY_COUNT[scenery]);
  }

  /**
   * Moving water: foam streaks drifting downstream (streams flow off the map; see waterFlow.js) and glints on
   * every wet tile, masked to the painted shoreline. One quad per wet tile; each corner carries the flow direction
   * averaged from the tiles around it, so the streaks turn smoothly round bends.
   */
  _createShimmer(painted) {
    const grid = this.world.grid;
    const { width: TW, height: TH } = painted.tiles;
    const b = painted.border;
    const flow = waterFlow(grid);
    const W = grid.width;
    const cornerFlow = (cx, cz) => {
      let fx = 0;
      let fz = 0;
      for (const [x, z] of [
        [cx - 1, cz - 1],
        [cx, cz - 1],
        [cx - 1, cz],
        [cx, cz],
      ]) {
        if (!grid.inBounds(x, z)) continue;
        fx += flow[(z * W + x) * 2];
        fz += flow[(z * W + x) * 2 + 1];
      }
      const len = Math.hypot(fx, fz);
      return len > 1e-6 ? [fx / len, fz / len] : [0, 0];
    };
    const positions = [];
    const uvs = [];
    const flows = [];
    for (let z = 0; z < grid.height; z++) {
      for (let x = 0; x < grid.width; x++) {
        const t = grid.terrain[z * grid.width + x];
        if (t !== T.water && t !== T.ford) continue;
        // Wound anticlockwise seen from above, so the quads face up (the camera) and aren't culled.
        const quad = [
          [x, z],
          [x, z + 1],
          [x + 1, z + 1],
          [x, z],
          [x + 1, z + 1],
          [x + 1, z],
        ];
        for (const [qx, qz] of quad) {
          positions.push(qx - this.offsetX, 0.005, qz - this.offsetZ);
          uvs.push((qx + b) / TW, 1 - (qz + b) / TH);
          flows.push(...cornerFlow(qx, qz));
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('flow', new THREE.Float32BufferAttribute(flows, 2));
    const mask = new THREE.CanvasTexture(painted.waterMask);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        mask: { value: mask },
        water: { value: waterTexture() },
        time: { value: 0 },
        tileUv: { value: new THREE.Vector2(1 / TW, 1 / TH) }, // one tile, in mask UVs
      },
      vertexShader: /* glsl */ `
        attribute vec2 flow;
        varying vec2 vUv;
        varying vec2 vWorld;
        varying vec2 vFlow;
        void main() {
          vUv = uv;
          vWorld = position.xz;
          vFlow = flow;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D mask;
        uniform sampler2D water;
        uniform float time;
        uniform vec2 tileUv;
        varying vec2 vUv;
        varying vec2 vWorld;
        varying vec2 vFlow;
        float maskAt(vec2 o) { return texture2D(mask, vUv + o * tileUv).a; }
        void main() {
          float m = maskAt(vec2(0.0));
          if (m < 0.01) discard;
          vec2 p = vWorld;
          float speed = length(vFlow);
          float flowing = smoothstep(0.05, 0.4, speed);
          vec2 d = speed > 0.05 ? vFlow / speed : vec2(0.707, 0.707);
          vec2 q = vec2(dot(p, d), dot(p, vec2(-d.y, d.x))); // x downstream, y across

          float nz = texture2D(water, p * 0.23 + vec2(time * 0.015, 0.0)).g;
          // Ripple bands across the current, carried downstream and broken up by noise.
          float bands = sin(q.x * 6.0 - time * (0.8 + 3.2 * flowing) + q.y * 1.7 + nz * 5.0);
          float crest = smoothstep(0.72, 0.97, bands) * smoothstep(0.15, 0.5, nz);
          float trough = smoothstep(-0.55, -0.95, bands);
          // Soft foam streaks riding the current (two layers at different speeds).
          float s1 = texture2D(water, vec2(q.x - time * 1.0, q.y * 1.3) / 6.0).r;
          float s2 = texture2D(water, vec2(q.x - time * 0.65 + 0.37, q.y * 1.3 + 0.5) / 4.5).r;
          float streak = max(s1, s2 * 0.7) * flowing;
          // Sun glints.
          float w = sin(p.x * 4.1 + time * 1.3 + sin(p.y * 2.3 + time * 0.7) * 1.6)
                  + sin(p.y * 5.3 - time * 1.1 + sin(p.x * 1.9 - time * 0.5) * 1.4);
          float glint = smoothstep(1.45, 1.9, w);
          // Foam along the shore, lapping gently.
          float r = 0.16;
          float inner = min(min(maskAt(vec2(r, 0.0)), maskAt(vec2(-r, 0.0))), min(maskAt(vec2(0.0, r)), maskAt(vec2(0.0, -r))));
          float shore = (1.0 - inner) * (0.55 + 0.45 * sin(time * 1.7 + (p.x + p.y) * 2.3));

          float light = max(max(crest * 0.22, streak * 0.38), max(glint * 0.3, shore * 0.5));
          float dark = trough * 0.1 * (1.0 - light);
          vec3 color = mix(vec3(0.12, 0.3, 0.45), vec3(0.95, 0.98, 1.0), light / max(light + dark, 0.0001));
          gl_FragColor = vec4(color, max(light, dark) * m);
        }`,
    });
    underlay(material); // drawn over the ground, under every sprite
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 0;
    this.scene.add(mesh);
    return mesh;
  }

  /** Build-mode tint over tiles whose terrain can't be built on. */
  _createBlockedTint(grid) {
    const m = grid.spawnMargin;
    const positions = [];
    for (let z = m; z < grid.height - m; z++) {
      for (let x = m; x < grid.width - m; x++) {
        if (grid.isBuildable(x, z)) continue;
        const [x0, z0, x1, z1] = [x - this.offsetX, z - this.offsetZ, x + 1 - this.offsetX, z + 1 - this.offsetZ];
        positions.push(x0, 0.012, z0, x1, 0.012, z1, x1, 0.012, z0, x0, 0.012, z0, x0, 0.012, z1, x1, 0.012, z1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.MeshBasicMaterial({ color: 0xc0392b, side: THREE.DoubleSide });
    underlay(material, 0.22);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 1;
    return mesh;
  }

  _scenerySpot(kind, variant, pos, scale) {
    return { key: spriteKeys.scenery(kind, variant), pos, scale, sway: (SCENERY_SWAY[kind] ?? 0) * TREE_SWAY };
  }

  /** Scatter decorative trees, bushes and rocks in the woods outside the map. */
  _buildScenery(count) {
    this.scenerySpots = [];
    const noise = this._terrainNoise;
    if (!noise || !count) return;
    const W = GRID.width;
    const H = GRID.height;
    const rnd = createRng(0x5ce7e);
    for (let tries = 0; this.scenerySpots.length < count && tries < count * 30; tries++) {
      const x = rnd.range(-16, W + 16);
      const z = rnd.range(-16, H + 16);
      const wood = outsideForest(noise, x, z, W, H);
      if (wood <= 0.05) continue;
      const dense = wood > 0.5;
      if (!dense && rnd.next() > 0.12) continue;
      const kind = dense ? treeKind(noise, x, z, rnd) : rnd.pick(['bush', 'bush', 'rock', 'oak', 'birch', 'stump']);
      this.scenerySpots.push(this._scenerySpot(kind, rnd.int(0, SCENERY_VARIANTS - 1), this.toScene(x, 0, z), rnd.range(0.85, 1.25)));
    }
  }

  /** Apply graphics settings without recreating the WebGL context (anti-aliasing is fixed at creation). */
  applySettings(graphics) {
    const prev = this.graphics;
    this.graphics = { ...graphics };
    if (graphics.resolution !== 'auto') this.setRenderScale(graphics.resolution);
    else if (!prev || prev.resolution !== 'auto') this.setRenderScale(defaultAutoScale());
    if (prev && prev.scenery !== graphics.scenery) this._buildTerrain();
    this._clouds.visible = graphics.effects;
  }

  /**
   * Pixels drawn per CSS pixel: a number, or 'native' for the screen's own density. Always capped at that density:
   * drawing more pixels than the screen has (supersampling) costs a lot for very little smoothing.
   */
  setRenderScale(scale) {
    this.renderScale = scale;
    const screen = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(scale === 'native' ? screen : Math.min(screen, scale));
    this._resize();
  }

  /** The render scale actually in use (after the device cap). */
  get effectiveScale() {
    return this.renderer.getPixelRatio();
  }

  _resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const aspect = w / h;
    const viewH = Math.max(VIEW_HEIGHT, VIEW_WIDTH / aspect);
    Object.assign(this.camera, { left: (-viewH * aspect) / 2, right: (viewH * aspect) / 2, top: viewH / 2, bottom: -viewH / 2 });
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  // ---------------------------------------------------------------- world binding

  attach(world) {
    for (const off of this._unsubscribe) off();
    for (const map of Object.values(this.views)) {
      for (const view of map.values()) this._removeView(view);
      map.clear();
    }
    for (const fx of this.effects) this.scene.remove(fx.obj);
    this.effects = [];
    this.corpses = [];

    this.world = world;
    this._buildTerrain();
    const ev = world.events;
    this._unsubscribe = [
      ev.on('projectileImpact', (p) => {
        if (p.kind === 'cannonball') this._spawnBurst(p.x, 0.2, p.z, 0xffa040, p.splash, 0.35);
        if (p.kind === 'boulder') this._spawnBurst(p.x, 0.2, p.z, 0xb59a70, p.splash, 0.5);
      }),
      ev.on('towerPulse', ({ x, z, radius }) => this._spawnRing(x, z, radius, 0xa66bff, 0.55)),
      ev.on('enemyKilled', ({ enemy }) => {
        this._spawnBurst(enemy.x, 0.5, enemy.z, 0x9a8f80, 0.5, 0.4);
        this.corpses.push({ type: enemy.type, elite: enemy.elite, heading: enemy.heading, x: enemy.x, z: enemy.z, age: 0 });
      }),
      ev.on('buildingDestroyed', ({ building }) =>
        this._spawnBurst(building.cx, 0.6, building.cz, 0x8a7f70, building.size * 0.9, 0.7),
      ),
    ];
  }

  toScene(x, y, z, out = new THREE.Vector3()) {
    return out.set(x - this.offsetX, y, z - this.offsetZ);
  }

  /** Project sim coords to client (CSS pixel) coordinates; null if behind the camera. */
  toScreen(x, y, z) {
    const v = this.toScene(x, y, z).project(this.camera);
    if (v.z > 1) return null;
    const rect = this.canvas.getBoundingClientRect();
    return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
  }

  /** Raycast screen coordinates onto the ground; returns sim coords or null. */
  pickGround(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this._raycaster.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    if (!this._raycaster.ray.intersectPlane(this._groundPlane, hit)) return null;
    return { x: hit.x + this.offsetX, z: hit.z + this.offsetZ };
  }

  /** Pan the camera across the ground relative to its current facing. */
  pan(forward, right) {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();
    const side = new THREE.Vector3().crossVectors(dir, this.camera.up).normalize();
    const delta = dir.multiplyScalar(forward).add(side.multiplyScalar(right));
    const limit = GRID.width / 2 + 5;
    const target = this.controls.target.clone().add(delta);
    target.x = THREE.MathUtils.clamp(target.x, -limit, limit);
    target.z = THREE.MathUtils.clamp(target.z, -limit, limit);
    const applied = target.sub(this.controls.target);
    this.controls.target.add(applied);
    this.camera.position.add(applied);
  }

  // ---------------------------------------------------------------- per-frame

  update(dt) {
    this._time += dt;
    this._dt = dt;
    this.wallJointsDrawn = 0;
    this.inWallDrawn = 0;
    this.wallDecorDrawn = 0;
    const world = this.world;
    this.controls.update();
    this.sprites.begin();
    this.shadowSprites.begin();
    this.healthBars.begin(this.camera.quaternion);
    this.blobShadows.begin();
    this.sprites.time = this._time;
    const wind = this.graphics.effects ? 1 : 0;
    for (const spots of [this.terrainSpots, this.scenerySpots]) {
      for (const s of spots) {
        this.sprites.add(s.key, s.pos, s.scale, 0, s.sway * wind);
        this.shadowSprites.add(s.key, s.pos, s.scale);
      }
    }
    if (this._shimmer) this._shimmer.material.uniforms.time.value = this._time;
    this._clouds.material.uniforms.time.value = this._time;
    if (world) {
      this._sync(this.views.buildings, world.buildings.values(), (b) => this._createBuildingView(b), (v, b) => this._updateBuildingView(v, b));
      this._sync(this.views.enemies, world.enemies, () => ({ walk: Math.random() }), (v, e) => this._updateEnemyView(v, e));
      this._drawCorpses(dt);
      this._sync(this.views.projectiles, world.projectiles, (p) => this._createProjectileView(p), (v, p) => this._updateProjectileView(v, p));
    }
    this.sprites.end();
    this.shadowSprites.end();
    this.blobShadows.end();
    this.healthBars.end();

    for (const fx of this.effects) {
      fx.age += dt;
      const t = fx.age / fx.life;
      if (fx.ring) fx.obj.scale.set(fx.size * (0.2 + 0.8 * t), 1, fx.size * (0.2 + 0.8 * t));
      else fx.obj.scale.setScalar(fx.size * (0.3 + t));
      fx.obj.material.opacity = 0.7 * (1 - t);
    }
    this.effects = this.effects.filter((fx) => {
      if (fx.age < fx.life) return true;
      this.scene.remove(fx.obj);
      fx.obj.material.dispose();
      return false;
    });
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  _sync(map, items, create, update) {
    const seen = new Set();
    for (const item of items) {
      let view = map.get(item.id);
      if (!view) {
        view = create(item);
        map.set(item.id, view);
      }
      update(view, item);
      seen.add(item.id);
    }
    for (const [id, view] of map) {
      if (!seen.has(id)) {
        this._removeView(view);
        map.delete(id);
      }
    }
  }

  _removeView(view) {
    if (view.obj) this.entityLayer.remove(view.obj);
  }

  /** Which orthogonal neighbours of a wall hold a building or rock (walls butt up against outcrops). */
  _wallConnections(b) {
    const c = {};
    let key = '';
    const grid = this.world.grid;
    for (const [dir, dx, dz] of NEIGHBOURS) {
      c[dir] = grid.get(b.x + dx, b.z + dz) !== null || grid.terrainAt(b.x + dx, b.z + dz) === T.rock;
      key += c[dir] ? dir : '-';
    }
    return { connections: c, key };
  }

  _createBuildingView(b) {
    return { phase: Math.random() * Math.PI * 2, wallKey: null };
  }

  _updateBuildingView(view, b) {
    // Towers built into a wall are drawn on it, with their in-wall model (see wallSeat.js).
    const seat = b.type === 'wall' ? { shape: null, dx: 0, dz: 0 } : wallSeat(this.world, b.type, b.x, b.z);
    const ground = this.toScene(b.cx + seat.dx, 0, b.cz + seat.dz, this._v);
    if (b.type === 'wall') {
      view.wallKey = this._wallConnections(b).key;
      // Each tile keeps the same variant (from its position), so long runs don't repeat.
      view.wallVariant = wallVariant(b.x, b.z);
      const key = spriteKeys.wall(view.wallKey, view.wallVariant);
      this.sprites.add(key, ground);
      this.shadowSprites.add(key, ground);
      // Now and then a straight stretch carries a decoration (a flag, a torch, shields…), always the same one.
      const axis = view.wallKey === '-e-w' ? 'x' : view.wallKey === 'n-s-' ? 'z' : null;
      view.decor = axis && wallDecorAt(b.x, b.z);
      if (view.decor) {
        const decorKey = spriteKeys.wallDecor(view.decor, axis);
        this.shadowSprites.add(decorKey, ground);
        // Drawn from a point nudged towards the camera, so it's always in front of its own wall's logs.
        this.sprites.add(decorKey, this._decorPos.copy(ground).addScaledVector(this._toCamera, 0.3));
        this.wallDecorDrawn++;
      }
    } else {
      const key = seat.shape ? spriteKeys.inWall(b.type, seat.shape) : spriteKeys.building(b.type);
      if (seat.shape) this.inWallDrawn++;
      this.sprites.add(key, ground);
      this.shadowSprites.add(key, ground);
      const lift = this._turretHeight(b.type, seat.shape);
      const attack = b.def.attack;
      if (b.type === 'catapult') {
        // Arm thrown forward when it fires, winched back while reloading.
        const reload = 1 - b.cooldown / attack.cooldown;
        const frame = Math.min(CATAPULT_ARM_FRAMES - 1, Math.floor(THREE.MathUtils.smoothstep(reload, 0.05, 0.75) * (CATAPULT_ARM_FRAMES - 1) + 0.5));
        this.sprites.add(spriteKeys.turret(b.type, b.aim, frame), ground, 1, lift);
      } else if (lift) {
        this.sprites.add(spriteKeys.turret(b.type, b.aim), ground, 1, lift);
      }
      if (b.type === 'magicSpire') {
        this.sprites.add(spriteKeys.crystal(), ground, 1, crystalHeight() + Math.sin(this._time * 2 + view.phase) * 0.08);
      }
      if (!seat.shape) this._drawWallJoints(b); // in-wall models carry their own wall stubs
    }
    if (b.hp < b.maxHp || b.type === 'townHall') {
      this.healthBars.add(this.toScene(b.cx + seat.dx, b.def.height + 0.6, b.cz + seat.dz, this._v), Math.min(2.4, 0.8 * b.size + 0.2), b.hp / b.maxHp);
    }
  }

  /** Turret pivot height for a building type, normal or built into a wall (cached; models are built once). */
  _turretHeight(type, shape) {
    const key = shape ? `${type}:${shape}` : type;
    if (!(key in this.turretHeights)) this.turretHeights[key] = turretHeight(type, shape);
    return this.turretHeights[key];
  }

  /**
   * Where a wall touches this building, tie it in with a joint piece (palisade arm and anchor post) in the
   * building's edge tile. A tower drawn shifted onto its wall (wallSeat.js) only ever moves across those arms or
   * away from them, so the post still lands on the tower's edge.
   */
  _drawWallJoints(b) {
    const grid = this.world.grid;
    for (let i = 0; i < b.size; i++) {
      for (const [dir, ix, iz, ox, oz] of [
        ['n', b.x + i, b.z, b.x + i, b.z - 1],
        ['s', b.x + i, b.z + b.size - 1, b.x + i, b.z + b.size],
        ['w', b.x, b.z + i, b.x - 1, b.z + i],
        ['e', b.x + b.size - 1, b.z + i, b.x + b.size, b.z + i],
      ]) {
        const id = grid.get(ox, oz);
        if (id === null || this.world.buildings.get(id)?.type !== 'wall') continue;
        const at = this.toScene(ix + 0.5, 0, iz + 0.5, this._v);
        this.sprites.add(spriteKeys.wallJoint(dir), at);
        this.shadowSprites.add(spriteKeys.wallJoint(dir), at);
        this.wallJointsDrawn++;
      }
    }
  }

  _updateEnemyView(view, e) {
    // Animation frame: attacks follow the sim's attack timer (the blow lands on the last frame, as the hit
    // does); walking advances with the distance actually covered.
    let anim = 'walk';
    let frame = 0;
    if (e.attackTargetId !== null) {
      anim = 'attack';
      const t = 1 - e.attackTimer / e.def.attackCooldown;
      frame = Math.min(ENEMY_ANIMS.attack - 1, Math.max(0, Math.floor(t * ENEMY_ANIMS.attack)));
    } else {
      if (e.moving) view.walk = (view.walk + (e.def.speed * e.slowFactor * this._dt) / (WALK_STRIDE[e.type] ?? 0.8)) % 1;
      frame = Math.floor(view.walk * ENEMY_ANIMS.walk) % ENEMY_ANIMS.walk;
    }
    view.anim = anim;
    view.frame = frame;
    const scale = e.elite ? 1.3 : 1;
    this._addEnemySprite(e.type, e.elite, e.heading, anim, frame, this.toScene(e.x, 0, e.z, this._v));
    this.blobShadows.add(this.toScene(e.x, 0.02, e.z, this._v), (ENEMY_BLOB_RADIUS[e.type] ?? 0.3) * scale);
    if (e.hp < e.maxHp) {
      this.healthBars.add(this.toScene(e.x, e.def.height * scale + 0.25, e.z, this._v), ENEMY_BAR_WIDTH[e.type] ?? 0.6, e.hp / e.maxHp);
    }
  }

  _addEnemySprite(type, elite, heading, anim, frame, ground) {
    let key = spriteKeys.enemy(type, heading, elite, anim, frame);
    let spriteScale = 1;
    if (elite && !this.atlas.frame(key)) {
      // No baked elite sprite for this type: scale the normal one.
      key = spriteKeys.enemy(type, heading, false, anim, frame);
      spriteScale = 1.3;
    }
    this.sprites.add(key, ground, spriteScale);
  }

  /** Killed enemies play their death frames, lie still a moment, then vanish. */
  _drawCorpses(dt) {
    this.corpses = this.corpses.filter((c) => {
      c.age += dt;
      if (c.age > ENEMY_ANIMS.death * DEATH_FRAME_TIME + CORPSE_TIME) return false;
      const frame = Math.min(ENEMY_ANIMS.death - 1, Math.floor(c.age / DEATH_FRAME_TIME));
      this._addEnemySprite(c.type, c.elite, c.heading, 'death', frame, this.toScene(c.x, 0, c.z, this._v));
      return true;
    });
  }

  _createProjectileView(p) {
    const obj = createProjectileModel(p.kind);
    obj.traverse((o) => (o.renderOrder = 3));
    this.toScene(p.x, p.y, p.z, obj.position);
    this.entityLayer.add(obj);
    return { obj };
  }

  _updateProjectileView(view, p) {
    const prev = view.obj.position.clone();
    this.toScene(p.x, p.y, p.z, view.obj.position);
    if (p.kind === 'arrow' && prev.distanceToSquared(view.obj.position) > 1e-8) {
      view.obj.lookAt(view.obj.position.clone().multiplyScalar(2).sub(prev));
    } else if (p.kind === 'boulder') {
      view.obj.rotation.x += 0.15;
      view.obj.rotation.z += 0.1;
    }
  }

  _spawnBurst(x, y, z, color, size, life) {
    if (!this.graphics.effects) return;
    const obj = new THREE.Mesh(BURST_GEOMETRY, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthWrite: false }));
    obj.renderOrder = 3;
    this.toScene(x, y, z, obj.position);
    this.scene.add(obj);
    this.effects.push({ obj, age: 0, life, size });
  }

  // Expanding flat ring on the ground (Magic Spire pulse).
  _spawnRing(x, z, radius, color, life) {
    if (!this.graphics.effects) return;
    const obj = new THREE.Mesh(
      RING_GEOMETRY,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }),
    );
    obj.renderOrder = 3;
    this.toScene(x, 0.06, z, obj.position);
    this.scene.add(obj);
    this.effects.push({ obj, age: 0, life, size: radius, ring: true });
  }
}

/**
 * Make a material draw like a ground decal: blended, but in the opaque pass with no depth test, so with
 * renderOrder 1 it lands after the ground and underneath every sprite.
 */
/** Which baked version of a wall a tile uses: a stable hash of its position, so it never changes. */
export function wallVariant(x, z) {
  const h = Math.imul(x * 73856093 ^ z * 19349663, 0x9e3779b1) >>> 0;
  return (h >>> 7) % WALL_VARIANTS;
}

/** About one straight wall tile in nine carries a decoration; which tile and which kind come from its position. */
export const WALL_DECOR_EVERY = 6;

/** How far a typical tree's top sways in the wind, as a fraction of its sprite's width (see SpriteLayer). */
export const TREE_SWAY = 0.025;

/**
 * Which tree grows at (x, z) in a wood: pine woods (pines with spruce) and broadleaf woods (oak and beech, with
 * birch groves) by region, a ragged mix where they meet, and the odd dead tree.
 */
export function treeKind(noise, x, z, rnd) {
  const r = rnd.next();
  if (r < 0.04) return 'snag';
  if (noise.fbm(x * 0.1 + 500, z * 0.1) > 0.52 + rnd.range(-0.035, 0.035)) return r < 0.62 ? 'pine' : 'spruce';
  if (noise.fbm(x * 0.16 + 900, z * 0.16 + 300) > 0.56) return r < 0.65 ? 'birch' : r < 0.85 ? 'oak' : 'beech';
  return r < 0.58 ? 'oak' : r < 0.86 ? 'beech' : 'birch';
}
export function wallDecorAt(x, z) {
  const h = Math.imul(x * 83492791 ^ z * 2654435761, 0x85ebca6b) >>> 0;
  if ((h >>> 3) % WALL_DECOR_EVERY) return null;
  return WALL_DECOR_KINDS[(h >>> 11) % WALL_DECOR_KINDS.length];
}

export function underlay(material, opacity = 1) {
  material.transparent = false;
  material.depthTest = false;
  material.depthWrite = false;
  material.opacity = opacity;
  material.blending = THREE.CustomBlending;
  material.blendSrc = THREE.SrcAlphaFactor;
  material.blendDst = THREE.OneMinusSrcAlphaFactor;
  // Leave the canvas alpha alone: otherwise blended decals make the canvas see-through there and the page
  // background shows through (it tinted every shadow sky-blue).
  material.blendSrcAlpha = THREE.ZeroFactor;
  material.blendDstAlpha = THREE.OneFactor;
  return material;
}

function defaultAutoScale() {
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  return touch ? AUTO_RESOLUTION.startTouch : AUTO_RESOLUTION.startDesktop;
}
