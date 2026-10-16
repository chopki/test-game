import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { GRID } from '../sim/config.js';
import { AUTO_RESOLUTION, SCENERY_COUNT } from './graphicsSettings.js';
import { dirtTexture, grassTexture } from './textures.js';
import { createProjectileModel, SCENERY_TYPES, SCENERY_VARIANTS } from './models.js';
import { BlobShadowBatch, HealthBarBatch } from './batches.js';
import { ISO_QUATERNION, isoDirection } from './iso.js';
import { SpriteLayer } from './spriteLayer.js';
import { CATAPULT_ARM_FRAMES, CRYSTAL_HEIGHT, spriteKeys, turretHeight } from './spriteCatalog.js';

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
 * effects (renderOrder 3) → health bars.
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
    this._unsubscribe = [];
    this._raycaster = new THREE.Raycaster();
    this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._time = 0;
    this._v = new THREE.Vector3();
    this.scenerySpots = [];

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

    const tiled = (tex, repeat) => {
      const t = tex.clone();
      t.repeat.set(repeat, repeat);
      t.needsUpdate = true;
      return t;
    };
    // The ground never writes depth, so sprites standing on it are never clipped by it.
    const ground = (geometry, material, y) => {
      material.depthWrite = false;
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = y;
      mesh.renderOrder = -1;
      this.scene.add(mesh);
      return mesh;
    };
    ground(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ map: tiled(grassTexture(), 400 / 6), color: 0xd8e4c0 }), -0.03);
    ground(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: tiled(dirtTexture(), W / 2), color: 0xf2eadc }), -0.01);
    ground(new THREE.PlaneGeometry(W - 2 * m, H - 2 * m), new THREE.MeshBasicMaterial({ map: tiled(grassTexture(), (W - 2 * m) / 6), color: 0xf4f8ec }), 0);

    // Tile grid, shown only while building (BuildController toggles it).
    const grid = new THREE.GridHelper(W - 2 * m, W - 2 * m, 0x2b4a1c, 0x2b4a1c);
    underlay(grid.material, 0.25);
    grid.position.y = 0.01;
    grid.renderOrder = 1;
    grid.visible = false;
    this.scene.add(grid);
    this.grid = grid;
  }

  /** Scatter trees, bushes and rocks around the play area. */
  _buildScenery(count) {
    this.scenerySpots = [];
    const half = Math.max(GRID.width, GRID.height) / 2;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = half + 2 + Math.random() * 30;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (Math.abs(x) < half + 1.2 && Math.abs(z) < half + 1.2) continue;
      const kind = SCENERY_TYPES[Math.floor(Math.random() * SCENERY_TYPES.length)];
      this.scenerySpots.push({
        key: spriteKeys.scenery(kind, Math.floor(Math.random() * SCENERY_VARIANTS)),
        pos: new THREE.Vector3(x, 0, z),
        scale: 0.8 + Math.random() * 0.6,
      });
    }
  }

  /** Apply graphics settings without recreating the WebGL context (anti-aliasing is fixed at creation). */
  applySettings(graphics) {
    const prev = this.graphics;
    this.graphics = { ...graphics };
    if (graphics.resolution !== 'auto') this.setRenderScale(graphics.resolution);
    else if (!prev || prev.resolution !== 'auto') this.setRenderScale(defaultAutoScale());
    if (!prev || prev.scenery !== graphics.scenery) this._buildScenery(SCENERY_COUNT[graphics.scenery]);
  }

  /** Pixels drawn per CSS pixel, capped at the screen's real pixel ratio. */
  setRenderScale(scale) {
    this.renderScale = scale;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, scale));
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

    this.world = world;
    const ev = world.events;
    this._unsubscribe = [
      ev.on('projectileImpact', (p) => {
        if (p.kind === 'cannonball') this._spawnBurst(p.x, 0.2, p.z, 0xffa040, p.splash, 0.35);
        if (p.kind === 'boulder') this._spawnBurst(p.x, 0.2, p.z, 0xb59a70, p.splash, 0.5);
      }),
      ev.on('towerPulse', ({ x, z, radius }) => this._spawnRing(x, z, radius, 0xa66bff, 0.55)),
      ev.on('enemyKilled', ({ enemy }) => this._spawnBurst(enemy.x, 0.5, enemy.z, 0x9a8f80, 0.5, 0.4)),
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
    const world = this.world;
    this.controls.update();
    this.sprites.begin();
    this.shadowSprites.begin();
    this.healthBars.begin(this.camera.quaternion);
    this.blobShadows.begin();
    for (const s of this.scenerySpots) {
      this.sprites.add(s.key, s.pos, s.scale);
      this.shadowSprites.add(s.key, s.pos, s.scale);
    }
    if (world) {
      this._sync(this.views.buildings, world.buildings.values(), (b) => this._createBuildingView(b), (v, b) => this._updateBuildingView(v, b));
      this._sync(this.views.enemies, world.enemies, () => ({ phase: Math.random() * Math.PI * 2 }), (v, e) => this._updateEnemyView(v, e));
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

  /** Which orthogonal neighbours of a wall hold a building, as { n, e, s, w } plus a key. */
  _wallConnections(b) {
    const c = {};
    let key = '';
    for (const [dir, dx, dz] of NEIGHBOURS) {
      c[dir] = this.world.grid.get(b.x + dx, b.z + dz) !== null;
      key += c[dir] ? dir : '-';
    }
    return { connections: c, key };
  }

  _createBuildingView(b) {
    if (!(b.type in this.turretHeights)) this.turretHeights[b.type] = turretHeight(b.type);
    return { phase: Math.random() * Math.PI * 2, wallKey: null };
  }

  _updateBuildingView(view, b) {
    const ground = this.toScene(b.cx, 0, b.cz, this._v);
    if (b.type === 'wall') {
      view.wallKey = this._wallConnections(b).key;
      this.sprites.add(spriteKeys.wall(view.wallKey), ground);
      this.shadowSprites.add(spriteKeys.wall(view.wallKey), ground);
    } else {
      const key = spriteKeys.building(b.type);
      this.sprites.add(key, ground);
      this.shadowSprites.add(key, ground);
      const attack = b.def.attack;
      if (b.type === 'catapult') {
        // Arm thrown forward when it fires, winched back while reloading.
        const reload = 1 - b.cooldown / attack.cooldown;
        const frame = Math.min(CATAPULT_ARM_FRAMES - 1, Math.floor(THREE.MathUtils.smoothstep(reload, 0.05, 0.75) * (CATAPULT_ARM_FRAMES - 1) + 0.5));
        this.sprites.add(spriteKeys.turret(b.type, b.aim, frame), ground, 1, this.turretHeights[b.type]);
      } else if (this.turretHeights[b.type]) {
        this.sprites.add(spriteKeys.turret(b.type, b.aim), ground, 1, this.turretHeights[b.type]);
      }
      if (b.type === 'magicSpire') {
        this.sprites.add(spriteKeys.crystal(), ground, 1, CRYSTAL_HEIGHT + Math.sin(this._time * 2 + view.phase) * 0.12);
      }
    }
    if (b.hp < b.maxHp || b.type === 'townHall') {
      this.healthBars.add(this.toScene(b.cx, b.def.height + 0.6, b.cz, this._v), Math.min(2.4, 0.8 * b.size + 0.2), b.hp / b.maxHp);
    }
  }

  _updateEnemyView(view, e) {
    // Walk bob or attack lunge.
    const t = this._time * e.def.speed * 6 + view.phase;
    let lift = 0;
    let lunge = 0;
    if (e.moving) lift = Math.abs(Math.sin(t)) * 0.08;
    else if (e.attackTargetId !== null) lunge = Math.max(0, Math.sin(this._time * 8 + view.phase)) * 0.15;
    const scale = e.elite ? 1.3 : 1;
    const ground = this.toScene(e.x + Math.sin(e.heading) * lunge, 0, e.z + Math.cos(e.heading) * lunge, this._v);
    let key = spriteKeys.enemy(e.type, e.heading, e.elite);
    let spriteScale = 1;
    if (!this.atlas.frame(key)) {
      // No baked elite sprite for this type: scale the normal one.
      key = spriteKeys.enemy(e.type, e.heading);
      spriteScale = scale;
    }
    this.sprites.add(key, ground, spriteScale, lift);
    this.blobShadows.add(this.toScene(e.x, 0.02, e.z, this._v), (ENEMY_BLOB_RADIUS[e.type] ?? 0.3) * scale);
    if (e.hp < e.maxHp) {
      this.healthBars.add(this.toScene(e.x, e.def.height * scale + 0.25, e.z, this._v), ENEMY_BAR_WIDTH[e.type] ?? 0.6, e.hp / e.maxHp);
    }
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
export function underlay(material, opacity = 1) {
  material.transparent = false;
  material.depthTest = false;
  material.depthWrite = false;
  material.opacity = opacity;
  material.blending = THREE.CustomBlending;
  material.blendSrc = THREE.SrcAlphaFactor;
  material.blendDst = THREE.OneMinusSrcAlphaFactor;
  return material;
}

function defaultAutoScale() {
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  return touch ? AUTO_RESOLUTION.startTouch : AUTO_RESOLUTION.startDesktop;
}
