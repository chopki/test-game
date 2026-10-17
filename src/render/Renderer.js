import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { GRID, TERRAIN } from '../sim/config.js';
import { groundHeight, T, tileCorners } from '../sim/terrain.js';
import { createRng } from '../sim/rng.js';
import { AUTO_RESOLUTION, GROUND_DETAIL, GROUND_PX, SCENERY_COUNT } from './graphicsSettings.js';
import { isOffshore, OCEAN, OUTER_GROUND, outsideForest, PAINT_BORDER, paintTerrain } from './terrainPainter.js';
import { cloudTexture } from './textures.js';
import { wallSeat } from './wallSeat.js';
import { DECOR_PENNANTS, WALL_DECOR_KINDS } from './wallDecor.js';
import { waterFlow } from './waterFlow.js';
import { cliffGeometry, cliffTexture, pushDepth, raisedGroundGeometry } from './hills.js';
import { waterTexture } from './waterTextures.js';
import { CHIMNEYS, CLIFF_VARIANTS, createProjectileModel, IN_WALL_RADIUS, PENNANTS, SCENERY_SWAY, SCENERY_VARIANTS, WALL_VARIANTS, wallArmOffset } from './models.js';
import { BlobShadowBatch, GlowBatch, HealthBarBatch } from './batches.js';
import { ISO_QUATERNION, isoDirection } from './iso.js';
import { fordBridges } from './bridges.js';
import { damageAmount, damageStage } from './damage.js';
import { GroundMarks, MARKS } from './groundMarks.js';
import { Particles } from './particles.js';
import { SPRITE_KIND, SpriteLayer } from './spriteLayer.js';
import { seasonFor, SEASONS, weatherFor, WEATHERS, weatherLook } from './weather.js';
import { GroundCover, Precipitation } from './weatherLayers.js';
import { Wildlife } from './wildlife.js';
import { CATAPULT_ARM_FRAMES, ENEMY_ANIMS, FLAG_FRAMES, crystalHeight, spriteKeys, turretHeight } from './spriteCatalog.js';
import { PENNANT_W } from './modelKit.js';

const SKY = 0xa9d3ee;

/** Debris colours by what's breaking (logs, sandstone, rock, earth). */
const LOG_CHIPS = [0xcba46e, 0xad8050, 0x8a6038, 0x6b4a2c];
const STONE_CHIPS = [0xd2b688, 0xc5a878, 0xbb9e6e, 0x9c8462];
const DEBRIS = {
  wall: LOG_CHIPS,
  gatehouse: LOG_CHIPS,
  archerTower: LOG_CHIPS,
  catapult: LOG_CHIPS,
  townHall: STONE_CHIPS,
  cannonTower: STONE_CHIPS,
  magicSpire: [0xbca7d8, 0x9a7fc4, ...STONE_CHIPS],
  rock: [0xdcc7a0, 0xcfb98e, 0xb7a27c],
  earth: [0x8a6f48, 0x6f5638, 0x9a8158],
};
const rand = (r) => (Math.random() * 2 - 1) * r;
/** The warm colour grade on High (a CSS filter on the canvas; see applySettings). */
const COLOUR_GRADE = 'sepia(0.08) saturate(1.04) contrast(1.04)';
/** Wall decorations that give off light: [x, y, z, glow size], placed as on an east–west wall (see wallDecor.js). */
const DECOR_LIGHTS = { torch: [0, 1.38, 0.2, 0.9], brazier: [0, 0.66, 0.24, 1.2], lantern: [0, 0.85, 0.36, 0.8] };
/** The light in rain and in winter (CSS filters on the canvas, after the grade). */
const RAIN_LIGHT = 'brightness(0.9) saturate(0.82)';
const WINTER_LIGHT = 'saturate(0.88) brightness(1.02)';
/** Broadleaf trees and bushes, whose leaves turn in autumn (conifers stay green). */
const BROADLEAF = new Set(['oak', 'birch', 'beech', 'bush']);
/** Scorch marks and craters: how long they last (seconds) and how many at once. */
const SCORCH_LIFE = 45;
const MAX_SCORCHES = 80;

const RING_GEOMETRY = new THREE.RingGeometry(0.85, 1, 48).rotateX(-Math.PI / 2);
const NEIGHBOURS = [
  ['n', 0, -1],
  ['e', 1, 0],
  ['s', 0, 1],
  ['w', -1, 0],
];
const ENEMY_BAR_WIDTH = { swordsman: 0.55, pikeman: 0.55, archer: 0.5, knight: 0.7, ram: 1.0, mangonel: 1.0 };
const ENEMY_BLOB_RADIUS = { swordsman: 0.26, pikeman: 0.26, archer: 0.24, knight: 0.32, ram: 0.72, mangonel: 0.78 };
// Tiles covered by one walk cycle, so feet keep pace with the ground.
const WALK_STRIDE = { swordsman: 0.7, pikeman: 0.7, archer: 0.7, knight: 0.75, ram: 0.6, mangonel: 0.6 };
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
    this.particles = new Particles(this.overlayLayer);
    this.groundMarks = new GroundMarks(this.groundLayer);
    this.glows = new GlowBatch(this.overlayLayer, ISO_QUATERNION);
    this.precipitation = new Precipitation(this.overlayLayer);
    this.wildlife = new Wildlife(this);
    this.weather = { season: 'summer', weather: 'clear' };
    this._look = weatherLook('summer', 'clear');
    this.scorches = [];
    this.corpses = [];
    this._decorPos = new THREE.Vector3();
    this._armPos = new THREE.Vector3();
    this._fxPos = new THREE.Vector3();
    this._flagPos = new THREE.Vector3();
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
    // Flat ground to the horizon; each map's painted ground (see _buildTerrain) fades into it.
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshBasicMaterial({ color: OUTER_GROUND, depthWrite: false }));
    this._outerGround = outer;
    this._dampGround = new THREE.Color();
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.03;
    outer.renderOrder = -2;
    this.scene.add(outer);

    // Shown only while building (BuildController toggles it): the tile grid, plus a tint on tiles whose
    // terrain can't be built on (added per map).
    this.grid = new THREE.Group();
    this.grid.visible = false;
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
    for (const obj of [this._ground, this._shimmer, this._blockedTint, this._ocean, this._raised, this._cliffs]) {
      if (!obj) continue;
      obj.removeFromParent();
      obj.geometry.dispose();
      obj.material.map?.dispose();
      obj.material.uniforms?.mask.value.dispose();
      obj.material.dispose();
    }
    this._ground = this._shimmer = this._blockedTint = this._ocean = this._raised = this._cliffs = null;
    this._raisedCover?.dispose();
    this._raisedCover = null;
    if (this._gridLines) {
      this._gridLines.removeFromParent();
      this._gridLines.geometry.dispose();
      this._gridLines.material.dispose();
      this._gridLines = null;
    }
    this._cover?.dispose();
    this._cover = null;
    if (!world) return;

    const grid = world.grid;
    const scenery = this.graphics.scenery;
    const started = performance.now();
    // Footbridges across the fords (decoration: fords stay fords for the sim), with a worn track on from each end.
    const bridges = fordBridges(grid, waterFlow(grid));
    const tracks = [];
    for (const b of bridges) {
      if (b.part === 'mid') continue;
      const [dx, dz] = (b.axis === 'x' ? [1, 0] : [0, 1]).map((d) => (b.part === 'start' ? -d : d));
      for (let k = 0, x = b.x, z = b.z; k <= TERRAIN.water.fordPath && [T.open, T.sand].includes(grid.terrainAt(x, z)); k++, x += dx, z += dz) tracks.push({ x, z });
    }
    const painted = paintTerrain(grid, { pxPerTile: GROUND_PX[scenery], detail: GROUND_DETAIL[scenery], seed: world.seed, coast: world.coast, tracks });
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

    // Hills: the plateau tops wear the same painted ground, raised to their level, above cliff faces (hills.js).
    const raised = raisedGroundGeometry(grid, painted, this.offsetX, this.offsetZ);
    if (raised) {
      this._raised = new THREE.Mesh(raised, pushDepth(new THREE.MeshBasicMaterial({ map: texture }), this.camera));
      this._cliffTexture ??= cliffTexture();
      const cliffs = cliffGeometry(grid, this.offsetX, this.offsetZ, TERRAIN.hills.levelHeight);
      this._cliffs = new THREE.Mesh(cliffs, pushDepth(new THREE.MeshBasicMaterial({ map: this._cliffTexture, vertexColors: true, side: THREE.DoubleSide }), this.camera));
      // Drawn after the flat ground and its weather cover, before everything else on the ground.
      this._raised.renderOrder = this._cliffs.renderOrder = -0.9;
      this.scene.add(this._raised, this._cliffs);
      this._raisedCover = new GroundCover(this.scene, painted.tiles, painted.waterMask, { geometry: raised.clone(), renderOrder: -0.85 });
    }

    if (world.coast) this._ocean = this._createOcean(world.coast);
    if (painted.hasWater) this._shimmer = this._createShimmer(painted);
    this._cover = new GroundCover(this.scene, painted.tiles, painted.waterMask, { renderOrder: -0.95 });
    this._blockedTint = this._createBlockedTint(grid);
    this.grid.add(this._blockedTint);
    // The build grid over the buildable area (inside the spawn margin), each tile's edges at its own height.
    this._gridLines = this._createGridLines(grid);
    this.grid.add(this._gridLines);

    // Terrain sprites: one tree per forest tile (a mix of kinds, by region: see treeKind), an outcrop per rock tile.
    this.terrainSpots = [];
    const rnd = createRng(world.seed ^ 0x7ee5);
    for (let z = 0; z < grid.height; z++) {
      for (let x = 0; x < grid.width; x++) {
        const t = grid.terrain[z * grid.width + x];
        if (t === T.cliff && rnd.next() < 0.3) {
          // Boulders here and there along the cliff tops.
          const pos = this.toScene(x + 0.5 + rnd.range(-0.2, 0.2), 0, z + 0.5 + rnd.range(-0.2, 0.2));
          this.terrainSpots.push(this._scenerySpot('rock', rnd.int(0, SCENERY_VARIANTS - 1), pos, rnd.range(0.55, 0.85)));
          continue;
        }
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
    this._cliffSpots(grid, rnd);
    for (const b of bridges) {
      this.terrainSpots.push({ key: spriteKeys.bridge(b.part, b.axis), pos: this.toScene(b.x + 0.5, 0, b.z + 0.5), scale: 1, sway: 0 });
    }
    // As many decorative trees per stretch of map edge on every size of map.
    this._buildScenery(Math.round((SCENERY_COUNT[scenery] * grid.width) / GRID.width));
  }

  /**
   * Baked cliff faces (createCliffPiece) along every edge the camera sees (south and east) where the ground drops a
   * level: the whole way ('full'), or from nothing to a level beside a ramp ('up' / 'down' along the piece). They
   * stand in front of the cliff mesh, which fills in behind them.
   */
  _cliffSpots(grid, rnd) {
    const lh = TERRAIN.hills.levelHeight;
    const near = (a, b) => Math.abs(a - b) < 0.01;
    for (let z = 0; z < grid.height; z++) {
      for (let x = 0; x < grid.width; x++) {
        if (grid.levelAt(x, z) === 0) continue;
        const mine = tileCorners(grid, x, z);
        // [face, neighbour, this tile's corners along the edge, the neighbour's, the edge's middle]
        const faces = [
          ['s', tileCorners(grid, x, z + 1), [2, 3], [0, 1], [x + 0.5, z + 1]],
          ['e', tileCorners(grid, x + 1, z), [3, 1], [2, 0], [x + 1, z + 0.5]], // from the south end (the piece's -x)
        ];
        for (const [face, other, ours, theirs, [mx, mz]] of faces) {
          const [d0, d1] = ours.map((k, i) => mine[k] - other[theirs[i]]);
          const profile = near(d0, lh) && near(d1, lh) ? 'full' : near(d0, 0) && near(d1, lh) ? 'up' : near(d0, lh) && near(d1, 0) ? 'down' : null;
          if (!profile) continue;
          const key = spriteKeys.cliff(face, profile, rnd.int(0, CLIFF_VARIANTS[profile] - 1));
          this.terrainSpots.push({ key, pos: this.toScene(mx, 0, mz), scale: 1, sway: 0 });
        }
      }
    }
  }

  /** Open sea to the horizon beyond the painted ground on the coast side (the painted sea fades into it). */
  _createOcean(coast) {
    const { width: W, height: H } = this.world.grid;
    const S = 600;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(S, S), new THREE.MeshBasicMaterial({ color: OCEAN, depthWrite: false }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -0.02;
    mesh.renderOrder = -1.5; // over the outer ground, under the painted ground
    // Its inner edge on the map's coast edge; it reaches out along the whole horizon.
    const [cx, cz] = { north: [W / 2, -S / 2], south: [W / 2, H + S / 2], west: [-S / 2, H / 2], east: [W + S / 2, H / 2] }[coast];
    this.toScene(cx, -0.02, cz, mesh.position, true);
    this.scene.add(mesh);
    return mesh;
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
    // Distance from land at a quad corner (the mean over the sea tiles round it), or -1 for streams and lakes.
    const shoreAt = (cx, cz) => {
      let sum = 0;
      let n = 0;
      for (const [x, z] of [[cx - 1, cz - 1], [cx, cz - 1], [cx - 1, cz], [cx, cz]]) {
        const i = (z + b) * TW + (x + b);
        if (x + b < 0 || z + b < 0 || x + b >= TW || z + b >= TH || !painted.sea[i]) continue;
        sum += painted.seaDist[i];
        n++;
      }
      return n ? sum / n : -1;
    };
    const positions = [];
    const uvs = [];
    const flows = [];
    const shores = [];
    // Every wet tile of the map, and the sea out through the painted border.
    for (let z = -b; z < grid.height + b; z++) {
      for (let x = -b; x < grid.width + b; x++) {
        const inMap = grid.inBounds(x, z);
        const t = inMap ? grid.terrain[z * grid.width + x] : -1;
        if (inMap ? t !== T.water && t !== T.ford && t !== T.sea : !painted.sea[(z + b) * TW + (x + b)]) continue;
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
          shores.push(shoreAt(qx, qz));
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('flow', new THREE.Float32BufferAttribute(flows, 2));
    geometry.setAttribute('shoreDist', new THREE.Float32BufferAttribute(shores, 1));
    const mask = new THREE.CanvasTexture(painted.waterMask);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        mask: { value: mask },
        water: { value: waterTexture() },
        time: { value: 0 },
        rain: { value: 0 },
        tileUv: { value: new THREE.Vector2(1 / TW, 1 / TH) }, // one tile, in mask UVs
      },
      vertexShader: /* glsl */ `
        attribute vec2 flow;
        attribute float shoreDist;
        varying vec2 vUv;
        varying vec2 vWorld;
        varying vec2 vFlow;
        varying float vShore;
        void main() {
          vUv = uv;
          vWorld = position.xz;
          vFlow = flow;
          vShore = shoreDist;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D mask;
        uniform sampler2D water;
        uniform float time;
        uniform float rain;
        uniform vec2 tileUv;
        varying vec2 vUv;
        varying vec2 vWorld;
        varying vec2 vFlow;
        varying float vShore; // sea: tiles from the shore; -1 for streams and lakes
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

          // The sea: lines of surf rolling in and breaking on the beach (fading out to sea), and a slow swell
          // further out.
          float sea = step(0.0, vShore);
          float roll = sin(vShore * 2.6 - time * 1.35 + nz * 3.0);
          float surf = smoothstep(0.72, 0.96, roll) * (1.0 - smoothstep(0.6, 3.6, vShore)) * smoothstep(0.15, 0.5, nz + 0.3) * sea;
          float swell = smoothstep(0.92, 1.0, sin(vShore * 1.1 - time * 0.7 + nz * 4.0 + p.x * 0.25)) * smoothstep(1.5, 3.0, vShore) * sea;
          shore *= 1.0 + 0.5 * sea;

          // Rain: small rings spreading where drops land (one per cell, each on its own beat).
          float rings = 0.0;
          if (rain > 0.0) {
            vec2 cell = floor(p * 2.2);
            vec2 f = fract(p * 2.2);
            float h = fract(sin(dot(cell, vec2(41.3, 289.1))) * 43758.5);
            vec2 at = vec2(fract(h * 7.1), fract(h * 13.7)) * 0.6 + 0.2;
            float t = fract(time * 0.9 + h);
            float d = length(f - at);
            rings = (1.0 - smoothstep(0.0, 0.05, abs(d - t * 0.35))) * (1.0 - t) * rain;
          }
          float light = max(max(max(crest * 0.22, streak * 0.38), max(glint * 0.3 * (1.0 - rain * 0.8), shore * 0.5)), max(rings * 0.6, max(surf * 0.95, swell * 0.22)));
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

  /** Build-mode grid lines: the edges of every tile inside the spawn margin, on the ground (hills included). */
  _createGridLines(grid) {
    const m = grid.spawnMargin;
    const positions = [];
    for (let z = m; z < grid.height - m; z++) {
      for (let x = m; x < grid.width - m; x++) {
        const [a, b, c, d] = tileCorners(grid, x, z).map((h) => h + 0.01);
        const [x0, z0, x1, z1] = [x - this.offsetX, z - this.offsetZ, x + 1 - this.offsetX, z + 1 - this.offsetZ];
        positions.push(x0, a, z0, x1, b, z0, x0, a, z0, x0, c, z1); // north and west edges
        if (x === grid.width - m - 1) positions.push(x1, b, z0, x1, d, z1);
        if (z === grid.height - m - 1) positions.push(x0, c, z1, x1, d, z1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({ color: 0x2b4a1c });
    underlay(material, 0.25);
    const lines = new THREE.LineSegments(geometry, material);
    lines.renderOrder = 1;
    return lines;
  }

  /** Build-mode tint over tiles whose terrain can't be built on. */
  _createBlockedTint(grid) {
    const m = grid.spawnMargin;
    const positions = [];
    for (let z = m; z < grid.height - m; z++) {
      for (let x = m; x < grid.width - m; x++) {
        if (grid.isBuildable(x, z)) continue;
        const [x0, z0, x1, z1] = [x - this.offsetX, z - this.offsetZ, x + 1 - this.offsetX, z + 1 - this.offsetZ];
        const [a, b, c, d] = tileCorners(grid, x, z).map((h) => h + 0.012);
        positions.push(x0, a, z0, x1, d, z1, x1, b, z0, x0, a, z0, x0, c, z1, x1, d, z1);
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
    const kindFlag = BROADLEAF.has(kind) ? SPRITE_KIND.foliage : 0;
    return { key: spriteKeys.scenery(kind, variant), pos, scale, sway: (SCENERY_SWAY[kind] ?? 0) * TREE_SWAY, kind: kindFlag };
  }

  /** Scatter decorative trees, bushes and rocks in the woods outside the map. */
  _buildScenery(count) {
    this.scenerySpots = [];
    const noise = this._terrainNoise;
    if (!noise || !count) return;
    const { width: W, height: H } = this.world.grid;
    const rnd = createRng(0x5ce7e);
    for (let tries = 0; this.scenerySpots.length < count && tries < count * 30; tries++) {
      const x = rnd.range(-16, W + 16);
      const z = rnd.range(-16, H + 16);
      const wood = outsideForest(noise, x, z, W, H);
      if (wood <= 0.05) continue;
      if ([[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => isOffshore(this.world.grid, this.world.coast, x + dx, z + dz))) continue; // not in (or right by) the sea
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
    // Glow and colour (High): halos round lights, and a warm grade over the canvas (a CSS filter, so it costs
    // no render pass and leaves the HUD alone).
    this.glows.mesh.visible = graphics.glow;
    this._applyFilter();
    if (prev && prev.weather !== graphics.weather) this._look = this._targetLook(); // the setting applies at once
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
    this.particles.clear();
    this.scorches = [];
    this.corpses = [];

    this.world = world;
    // The scene is centred on the map, whatever its size. Bigger maps let the camera zoom further out, but never so
    // far that the edge of the painted ground (map + border) comes into view.
    this.offsetX = world.grid.width / 2;
    this.offsetZ = world.grid.height / 2;
    this.controls.minZoom = (0.55 * (GRID.width + 2 * PAINT_BORDER)) / (world.grid.width + 2 * PAINT_BORDER);
    if (this.camera.zoom < this.controls.minZoom) {
      this.camera.zoom = this.controls.minZoom;
      this.camera.updateProjectionMatrix();
    }
    this._buildTerrain();
    // This map's season, and its weather before the first wave (?season= / ?weather= override them).
    const params = new URLSearchParams(location.search);
    const season = SEASONS.includes(params.get('season')) ? params.get('season') : seasonFor(world.seed);
    this.setWeather(season, this._weatherFor(0, season));
    this._look = this._targetLook();
    this.wildlife.reset(world);
    const ev = world.events;
    this._unsubscribe = [
      ev.on('projectileFired', ({ projectile }) => {
        this._fxFired(projectile);
        if (projectile.kind === 'cannonball') this.wildlife.startle(projectile.sx, projectile.sz, 5);
      }),
      ev.on('projectileImpact', (p) => {
        this._fxImpact(p);
        if (p.kind !== 'arrow') this.wildlife.startle(p.x, p.z, 4);
      }),
      ev.on('towerPulse', ({ x, z, radius }) => this._spawnRing(x, z, radius, 0xa66bff, 0.55)),
      ev.on('enemyKilled', ({ enemy }) => {
        this._fxDust(enemy.x, 0.25, enemy.z, enemy.def.siege ? 8 : 3, enemy.def.siege ? 0.7 : 0.35);
        if (enemy.def.siege && this.graphics.effects) {
          // A siege engine breaks up: splinters and planks thrown off.
          const at = this.toScene(enemy.x, 0.5, enemy.z, this._fxPos);
          for (let i = 0; i < 10; i++) this._fxChunk(at, 0.06 + Math.random() * 0.06, DEBRIS.wall, 2.4);
        }
        this.corpses.push({ type: enemy.type, elite: enemy.elite, heading: enemy.heading, x: enemy.x, z: enemy.z, age: 0 });
      }),
      ev.on('buildingHit', (hit) => this._fxHit(hit)),
      ev.on('waveStarted', ({ wave }) => this.setWeather(this.weather.season, this._weatherFor(wave, this.weather.season))),
      ev.on('buildingDestroyed', ({ building }) => this._fxCollapse(building)),
    ];
  }

  /**
   * Scene position for map position (x, z) at height `y` above the ground there (hills raise it), or with `flat`,
   * at height `y` above level 0.
   */
  toScene(x, y, z, out = new THREE.Vector3(), flat = false) {
    const ground = flat || !this.world ? 0 : groundHeight(this.world.grid, x, z);
    return out.set(x - this.offsetX, y + ground, z - this.offsetZ);
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
    // On hills, the highest level whose ground is where the ray crosses that level's height.
    const grid = this.world?.grid;
    const lh = TERRAIN.hills.levelHeight;
    for (let level = 2; level >= 1 && grid; level--) {
      this._groundPlane.constant = -level * lh;
      if (!this._raycaster.ray.intersectPlane(this._groundPlane, hit)) continue;
      const x = hit.x + this.offsetX;
      const z = hit.z + this.offsetZ;
      if (grid.levelAt(Math.floor(x), Math.floor(z)) >= level) {
        this._groundPlane.constant = 0;
        return { x, z };
      }
    }
    this._groundPlane.constant = 0;
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
    const limit = (this.world?.grid.width ?? GRID.width) / 2 + 5;
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
    this.groundMarks.begin();
    this.glows.begin();
    this._drawScorches(dt);
    this.sprites.time = this._time;
    const wind = this.graphics.effects ? 1 : 0;
    for (const spots of [this.terrainSpots, this.scenerySpots]) {
      for (const s of spots) {
        this.sprites.add(s.key, s.pos, s.scale, 0, s.sway * wind, s.kind ?? 0);
        this.shadowSprites.add(s.key, s.pos, s.scale);
      }
    }
    this._updateWeather(dt);
    this.wildlife.update(dt, this._time);
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
    this.groundMarks.end();
    this.glows.end();
    this.healthBars.end();

    this.particles.update(dt);
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
    return { phase: Math.random() * Math.PI * 2, wallKey: null, smoke: Math.random() };
  }

  _updateBuildingView(view, b) {
    // Towers built into a wall are drawn on it, with their in-wall model (see wallSeat.js).
    const seat = b.type === 'wall' ? { shape: null, dx: 0, dz: 0 } : wallSeat(this.world, b.type, b.x, b.z);
    const ground = this.toScene(b.cx + seat.dx, 0, b.cz + seat.dz, this._v);
    // Battered look by health (see damage.js): cracks and soot, then pieces missing, smoke and fire.
    view.damageStage = damageStage(b.hp, b.maxHp);
    // Worn earth round towers (the Town Hall has its yard; walls their own grassy foot).
    if (b.type !== 'wall' && b.type !== 'townHall') {
      this.groundMarks.add(MARKS.earth[b.id % 2], ground, b.size * 1.5, b.id * 2.4, 0.9);
    }
    const dmg = damageAmount(view.damageStage);
    if (view.damageStage === 2) this._smoulder(view, b, seat);
    if (b.type === 'wall') {
      view.wallKey = this._wallConnections(b).key;
      // Each tile keeps the same variant (from its position), so long runs don't repeat.
      view.wallVariant = wallVariant(b.x, b.z);
      const key = spriteKeys.wall(view.wallKey, view.wallVariant);
      this.sprites.add(key, ground, 1, 0, 0, dmg);
      this.shadowSprites.add(key, ground);
      // Now and then a straight stretch carries a decoration (a flag, a torch, shields…), always the same one.
      const axis = view.wallKey === '-e-w' ? 'x' : view.wallKey === 'n-s-' ? 'z' : null;
      view.decor = axis && wallDecorAt(b.x, b.z);
      if (view.decor) {
        const decorKey = spriteKeys.wallDecor(view.decor, axis);
        this.shadowSprites.add(decorKey, ground);
        // Drawn from a point nudged towards the camera, so it's always in front of its own wall's logs.
        this.sprites.add(decorKey, this._decorPos.copy(ground).addScaledVector(this._toCamera, 0.3), 1, 0, 0, dmg);
        this.wallDecorDrawn++;
        const flag = DECOR_PENNANTS[view.decor];
        if (flag) this._drawFlag(view, b.cx, b.cz, flag, axis === 'z');
        const light = DECOR_LIGHTS[view.decor];
        if (light && this.graphics.glow) {
          const [lx, ly, lz, size] = light;
          const [ox, oz] = axis === 'x' ? [lx, lz] : [lz, -lx]; // the north–south version is turned a quarter
          const flicker = 0.5 + 0.08 * Math.sin(this._time * 11 + view.phase) + 0.06 * Math.sin(this._time * 17.3 + view.phase * 2);
          this.glows.add(this.toScene(b.cx + ox, ly, b.cz + oz, this._fxPos), size, 0xff9a3c, flicker);
        }
      }
    } else {
      const key = seat.shape ? spriteKeys.inWall(b.type, seat.shape) : spriteKeys.building(b.type);
      this.sprites.add(key, ground, 1, 0, 0, dmg);
      this.shadowSprites.add(key, ground);
      if (seat.shape) {
        this.inWallDrawn++;
        this._drawWallArms(b, seat, dmg);
      }
      const turretDmg = Math.min(dmg, 0.5); // turrets scorch and crack but keep their shape
      const lift = this._turretHeight(b.type, seat.shape);
      const attack = b.def.attack;
      if (b.type === 'catapult') {
        // Arm thrown forward when it fires, winched back while reloading.
        const reload = 1 - b.cooldown / attack.cooldown;
        const frame = Math.min(CATAPULT_ARM_FRAMES - 1, Math.floor(THREE.MathUtils.smoothstep(reload, 0.05, 0.75) * (CATAPULT_ARM_FRAMES - 1) + 0.5));
        this.sprites.add(spriteKeys.turret(b.type, b.aim, frame), ground, 1, lift, 0, turretDmg);
      } else if (lift) {
        const aim = b.type === 'archerTower' ? this._lookoutAim(view, b) : b.aim;
        this.sprites.add(spriteKeys.turret(b.type, aim), ground, 1, lift, 0, turretDmg);
      }
      // Waving pennants, chimney smoke, crystal sparkles.
      const turned = b.type === 'gatehouse' && seat.shape?.startsWith('ns');
      for (const flag of PENNANTS[b.type] ?? []) this._drawFlag(view, b.cx + seat.dx, b.cz + seat.dz, flag, turned);
      if (CHIMNEYS[b.type]) this._chimneySmoke(view, b, CHIMNEYS[b.type]);
      if (b.type === 'magicSpire') {
        const bob = Math.sin(this._time * 2 + view.phase) * 0.08;
        this.sprites.add(spriteKeys.crystal(), ground, 1, crystalHeight() + bob, 0, SPRITE_KIND.unit);
        this._sparkle(view, b.cx + seat.dx, crystalHeight() + bob + 0.25, b.cz + seat.dz);
        if (this.graphics.glow) {
          const pulse = 0.5 + 0.15 * Math.sin(this._time * 3 + view.phase);
          this.glows.add(this.toScene(b.cx + seat.dx, crystalHeight() + bob + 0.3, b.cz + seat.dz, this._fxPos), 1.8, 0xa860ff, pulse);
        }
      }
      if (!seat.shape) this._drawWallJoints(b, dmg); // in-wall models carry their own wall stubs
    }
    if (b.hp < b.maxHp || b.type === 'townHall') {
      this.healthBars.add(this.toScene(b.cx + seat.dx, b.def.height + 0.6, b.cz + seat.dz, this._v), Math.min(2.4, 0.8 * b.size + 0.2), b.hp / b.maxHp);
    }
  }

  // ---------------------------------------------------------------- seasons and weather (weather.js)

  /**
   * Set the season and weather (cosmetic; also for tests and the dev console). The look eases over a few seconds,
   * or changes at once with `instant`.
   */
  setWeather(season, weather, { instant = false } = {}) {
    this.weather = { season, weather };
    this._applyFilter();
    if (instant) this._look = this._targetLook();
  }

  _weatherFor(wave, season) {
    const asked = new URLSearchParams(location.search).get('weather');
    return WEATHERS.includes(asked) ? asked : weatherFor(this.world.seed, wave, season);
  }

  /** The look to ease towards: none with the Weather setting off (summer, clear). */
  _targetLook() {
    return this.graphics.weather === false ? weatherLook('summer', 'clear') : weatherLook(this.weather.season, this.weather.weather);
  }

  _updateWeather(dt) {
    const target = this._targetLook();
    const step = Math.min(1, dt * 0.4);
    for (const k of Object.keys(target)) this._look[k] += (target[k] - this._look[k]) * step;
    const look = this._look;
    this.sprites.setSeason(look.autumn, look.snowCover);
    this._cover?.set(look);
    this._raisedCover?.set(look);
    // Rain darkens the ground beyond the painted map just as GroundCover darkens the map (same blend), so the
    // edge of the painted ground never shows.
    const wet = 0.2 * look.wet;
    this._outerGround.material.color.set(OUTER_GROUND).lerp(this._dampGround.setRGB(0.1, 0.12, 0.15, THREE.SRGBColorSpace), wet);
    if (this._shimmer) this._shimmer.material.uniforms.rain.value = look.rain;
    // Falling rain and snow are effects (off with the Effects setting).
    const falling = this.graphics.effects ? look : { rain: 0, snowfall: 0 };
    this.precipitation.update(dt, this.controls.target, falling, this._time);
  }

  /** The canvas's CSS filter: the warm grade (Glow and colour) and the weather's light (dimmer in rain). */
  _applyFilter() {
    const parts = [];
    if (this.graphics?.glow) parts.push(COLOUR_GRADE);
    if (this.graphics?.weather !== false) {
      if (this.weather?.weather === 'rain') parts.push(RAIN_LIGHT);
      else if (this.weather?.season === 'winter') parts.push(WINTER_LIGHT);
    }
    const el = this.renderer.domElement;
    el.style.transition = 'filter 3s';
    el.style.filter = parts.join(' ');
  }

  /**
   * A pennant flying from the pole top at `flag` (model coordinates; see PENNANTS) of the thing centred on (cx, cz),
   * turned a quarter if `turned`. Each building's flags ripple at their own phase.
   */
  _drawFlag(view, cx, cz, flag, turned) {
    const [ox, oz] = turned ? [flag.z, -flag.x] : [flag.x, flag.z];
    const frame = Math.floor(this._time * 7 + view.phase * FLAG_FRAMES) % FLAG_FRAMES;
    this.sprites.add(spriteKeys.flag(turned ? 1 : 0, frame), this.toScene(cx + ox, 0, cz + oz, this._flagPos), flag.w / PENNANT_W, flag.y, 0, SPRITE_KIND.unit);
  }

  /** Which way a watchtower's lookouts face: their target while shooting, otherwise slowly scanning round. */
  _lookoutAim(view, b) {
    if (b.cooldown > 0) {
      view.look = b.aim;
      view.idle = 0;
      return b.aim;
    }
    view.idle = (view.idle ?? 0) + this._dt;
    return (view.look ?? view.phase) + Math.sin(view.idle * 0.35 + view.phase) * 1.6;
  }

  /** A thin column of smoke from a chimney (model coordinates). */
  _chimneySmoke(view, b, at) {
    if (!this.graphics.effects) return;
    view.chimney = (view.chimney ?? 0) - this._dt;
    if (view.chimney > 0) return;
    view.chimney += 0.45;
    const p = this.toScene(b.cx + at.x, at.y, b.cz + at.z, this._fxPos);
    this.particles.puff({ x: p.x, y: p.y, z: p.z, vx: 0.12 + rand(0.04), vy: 0.35, vz: -0.05 + rand(0.04), size: 0.12, grow: 0.7, life: 3, color: 0xd6d0c6, alpha: 0.4, rise: 0.05, drag: 0.6 });
  }

  /** Now and then a bright spark drifts up round a crystal. */
  _sparkle(view, x, y, z) {
    if (!this.graphics.effects) return;
    view.sparkle = (view.sparkle ?? 0) - this._dt;
    if (view.sparkle > 0) return;
    view.sparkle += 0.18 + Math.random() * 0.2;
    const a = Math.random() * Math.PI * 2;
    const p = this.toScene(x + Math.cos(a) * 0.3, y + rand(0.2), z + Math.sin(a) * 0.3, this._fxPos);
    this.particles.puff({ x: p.x, y: p.y, z: p.z, vy: 0.35, size: 0.07, grow: -0.04, life: 0.7, color: Math.random() < 0.5 ? 0xf3e2ff : 0xc89bff, alpha: 0.95, drag: 1 });
  }

  /** The wall arms of a tower built into a wall: one sprite each, centred on the arm so it sorts by its own depth. */
  _drawWallArms(b, seat, damage = 0) {
    const from = IN_WALL_RADIUS[b.type];
    const straight = seat.shape === 'we' || seat.shape === 'ns';
    for (const dir of seat.shape) {
      const [ox, oz] = wallArmOffset(dir, from, straight);
      const at = this.toScene(b.cx + seat.dx + ox, 0, b.cz + seat.dz + oz, this._armPos);
      const key = spriteKeys.wallArm(dir, from, straight);
      this.sprites.add(key, at, 1, 0, 0, damage);
      this.shadowSprites.add(key, at);
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
  _drawWallJoints(b, damage = 0) {
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
        this.sprites.add(spriteKeys.wallJoint(dir), at, 1, 0, 0, damage);
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
    this.sprites.add(key, ground, spriteScale, 0, 0, SPRITE_KIND.unit);
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
    this.toScene(p.x, p.y + this._projectileLift(p), p.z, obj.position, true);
    this.entityLayer.add(obj);
    return { obj };
  }

  /** A shot flies from the ground height it was fired from to that of where it lands (hills). */
  _projectileLift(p) {
    const g = this.world.grid;
    const from = groundHeight(g, p.sx, p.sz);
    return from + (groundHeight(g, p.tx, p.tz) - from) * p.t;
  }

  _updateProjectileView(view, p) {
    const prev = view.obj.position.clone();
    this.toScene(p.x, p.y + this._projectileLift(p), p.z, view.obj.position, true);
    if (p.kind === 'arrow' && prev.distanceToSquared(view.obj.position) > 1e-8) {
      view.obj.lookAt(view.obj.position.clone().multiplyScalar(2).sub(prev));
      // A faint trail: small pale puffs left behind, fading fast.
      if (this.graphics.effects) {
        const { x, y, z } = view.obj.position;
        this.particles.puff({ x, y, z, size: 0.07, grow: 0.05, life: 0.3, color: 0xf2ead8, alpha: 0.5, drag: 1 });
      }
    } else if (p.kind === 'boulder') {
      view.obj.rotation.x += 0.15;
      view.obj.rotation.z += 0.1;
    }
  }

  // ---------------------------------------------------------------- combat effects (particles.js)
  // Positions passed in are world tile coordinates; nothing here touches the world.

  /** Cannon smoke and flash at the muzzle when a cannon fires. */
  _fxFired(p) {
    if (!this.graphics.effects || p.kind !== 'cannonball') return;
    const dx = p.tx - p.sx;
    const dz = p.tz - p.sz;
    const len = Math.hypot(dx, dz) || 1;
    const [ux, uz] = [dx / len, dz / len];
    const at = this.toScene(p.sx + ux * 0.45, p.sy, p.sz + uz * 0.45, this._fxPos);
    const P = this.particles;
    P.puff({ x: at.x, y: at.y, z: at.z, size: 0.25, grow: 0.15, life: 0.12, color: 0xffd27a, alpha: 0.95 });
    for (let i = 0; i < 6; i++) {
      const s = 0.6 + Math.random() * 1.4;
      P.puff({ x: at.x, y: at.y, z: at.z, vx: ux * s + rand(0.3), vy: 0.2 + Math.random() * 0.3, vz: uz * s + rand(0.3), size: 0.2, grow: 0.6, life: 1 + Math.random() * 0.6, color: 0xbab3a6, alpha: 0.55, rise: 0.4, drag: 0.15 });
    }
  }

  /** Where a cannonball or boulder lands: a flash (cannon), a cloud of smoke or dust, and earth or rock thrown up. */
  _fxImpact(p) {
    if (!this.graphics.effects) return;
    if (p.kind !== 'arrow') {
      // A scorch mark (cannonball) or a crater of churned earth (boulder) that fades over a while.
      if (this.scorches.length >= MAX_SCORCHES) this.scorches.shift();
      this.scorches.push({ x: p.x, z: p.z, size: (p.splash || 0.6) * 1.5, angle: Math.random() * 6.3, cell: p.kind === 'boulder' ? MARKS.earth[1] : MARKS.scorch[Math.floor(Math.random() * 2)], age: 0 });
    }
    const at = this.toScene(p.x, 0.15, p.z, this._fxPos);
    const P = this.particles;
    const r = p.splash || 0.5;
    if (p.kind === 'cannonball') {
      P.puff({ x: at.x, y: at.y + 0.1, z: at.z, size: 0.4, grow: 0.5, life: 0.15, color: 0xffb04a, alpha: 0.95 });
      this._fxCloud(at, 8, r, 0x6f6a62, 0.6);
    } else if (p.kind === 'boulder') {
      this._fxCloud(at, 9, r, 0xc2a77c, 0.6);
      for (let i = 0; i < 7; i++) this._fxChunk(at, 0.12, DEBRIS.rock, 2.2);
    }
    if (p.kind !== 'arrow') for (let i = 0; i < 6; i++) this._fxChunk(at, 0.06, DEBRIS.earth, 2.6);
  }

  /** An enemy's blow on a wall or building: a puff of dust and a few splinters or stone chips where it lands. */
  _fxHit({ building: b, x, z }) {
    if (!this.graphics.effects) return;
    const dx = b.cx - x;
    const dz = b.cz - z;
    const len = Math.hypot(dx, dz) || 1;
    const at = this.toScene(x + (dx / len) * 0.45, 0.35 + Math.random() * 0.3, z + (dz / len) * 0.45, this._fxPos);
    this._fxCloud(at, 2, 0.25, 0xb59e7a, 0.45);
    const colors = DEBRIS[b.type] ?? DEBRIS.wall;
    for (let i = 0; i < 3; i++) this._fxChunk(at, 0.05, colors, 1.6);
  }

  /** A building falls: a big dust cloud and a shower of logs or stones, sized to it. */
  _fxCollapse(b) {
    if (!this.graphics.effects) return;
    const at = this.toScene(b.cx, 0.3, b.cz, this._fxPos);
    this._fxCloud(at, 6 + b.size * 6, b.size * 0.6, 0x9d8f7a, 0.7, 1.6);
    const colors = DEBRIS[b.type] ?? DEBRIS.wall;
    for (let i = 0; i < 8 + b.size * 8; i++) {
      const c = at.clone();
      c.x += rand(b.size * 0.4);
      c.z += rand(b.size * 0.4);
      c.y += Math.random() * b.def.height * 0.6;
      this._fxChunk(c, 0.07 + Math.random() * 0.08 * b.size, colors, 2.4);
    }
  }

  /**
   * A badly damaged building smoulders: smoke rising from it now and then, with small flames licking up from the
   * buildings (walls just smoke, and less often).
   */
  _smoulder(view, b, seat) {
    if (!this.graphics.effects) return;
    if (b.type !== 'wall' && this.graphics.glow) {
      const flicker = 0.45 + 0.12 * Math.sin(this._time * 9 + view.phase) + 0.08 * Math.sin(this._time * 23 + view.phase);
      this.glows.add(this.toScene(b.cx + seat.dx, b.def.height * 0.6, b.cz + seat.dz, this._fxPos), b.size * 1.3, 0xff7a2a, flicker);
    }
    view.smoke -= this._dt * (b.type === 'wall' ? 0.6 : 2.5);
    if (view.smoke > 0) return;
    view.smoke += 1;
    const h = b.type === 'wall' ? 1 : b.def.height;
    const at = this.toScene(b.cx + seat.dx + rand(b.size * 0.3), h * (0.5 + Math.random() * 0.4), b.cz + seat.dz + rand(b.size * 0.3), this._fxPos);
    this.particles.puff({ x: at.x, y: at.y, z: at.z, vx: rand(0.1), vy: 0.5, vz: rand(0.1), size: 0.2, grow: 0.9, life: 2.4, color: 0x5d5752, alpha: 0.45, rise: 0.2, drag: 0.5 });
    if (b.type !== 'wall') {
      this.particles.puff({ x: at.x, y: at.y - 0.1, z: at.z, vy: 0.6, size: 0.18, grow: 0.05, life: 0.45, color: 0xffa23c, alpha: 0.9 });
      this.particles.puff({ x: at.x, y: at.y - 0.05, z: at.z, vy: 0.7, size: 0.1, grow: 0.02, life: 0.35, color: 0xffe08a, alpha: 0.95 });
    }
  }

  _drawScorches(dt) {
    this.scorches = this.scorches.filter((s) => (s.age += dt) < SCORCH_LIFE);
    for (const s of this.scorches) {
      const fade = Math.min(1, s.age * 6) * Math.min(1, (SCORCH_LIFE - s.age) / 8);
      this.groundMarks.add(s.cell, this.toScene(s.x, 0, s.z, this._fxPos), s.size, s.angle, fade);
    }
  }

  _fxDust(x, y, z, n, r) {
    if (!this.graphics.effects) return;
    this._fxCloud(this.toScene(x, y, z, this._fxPos), n, r, 0x9a8f80, 0.45);
  }

  /** `n` puffs billowing out from `at` over radius `r`. */
  _fxCloud(at, n, r, color, alpha, life = 1.1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (0.4 + Math.random()) * r * 1.6;
      this.particles.puff({ x: at.x + Math.cos(a) * r * 0.3, y: at.y, z: at.z + Math.sin(a) * r * 0.3, vx: Math.cos(a) * s, vy: 0.3 + Math.random() * 0.5, vz: Math.sin(a) * s, size: 0.25 + r * 0.3, grow: 0.5 + r * 0.6, life: life * (0.7 + Math.random() * 0.6), color, alpha, rise: 0.25, drag: 0.08 });
    }
  }

  _fxChunk(at, size, colors, speed) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.6);
    this.particles.chunk({ x: at.x, y: at.y, z: at.z, vx: Math.cos(a) * s * 0.6, vy: s, vz: Math.sin(a) * s * 0.6, size: size * (0.7 + Math.random() * 0.6), color: colors[Math.floor(Math.random() * colors.length)] });
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

/** About one straight wall tile in six carries a decoration; which tile and which kind come from its position. */
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
