import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { GRID } from '../sim/config.js';
import { AUTO_RESOLUTION, SCENERY_COUNT, SHADOW_MAP_SIZE } from './graphicsSettings.js';
import { dirtTexture, grassTexture } from './textures.js';
import { createBuildingModel, createEnemyModel, createProjectileModel, createScenery } from './models.js';
import { BlobShadowBatch, HealthBarBatch, KeyedBatches } from './batches.js';

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

/** Wall connection key ('n-s-' etc.) back to { n, e, s, w }. */
const connectionsFromKey = (key) => Object.fromEntries(NEIGHBOURS.map(([dir], i) => [dir, key[i] === dir]));

/**
 * Owns the Three.js scene and mirrors a sim World into it every frame.
 * The renderer never mutates the world: it reads entity state, keeps one
 * view per entity id, and spawns short-lived effects from world events.
 *
 * Performance (mainly for phones):
 * - Walls and ordinary enemies are drawn with instancing (one draw call per wall shape or enemy
 *   type per material), and all health bars and unit blob-shadows are one batch each.
 * - The shadow map is only re-rendered when buildings change. Things that move (enemies,
 *   projectiles, turrets) don't cast shadow-map shadows; units get a soft blob shadow instead.
 * - Render scale can be fixed or driven by the game's DynamicResolution ('auto').
 *
 * Sim coordinates (tile units, origin at the grid corner) map to scene
 * coordinates with the grid centred on the origin.
 */
export class Renderer {
  /** `graphics` is a settings object from graphicsSettings.js; see applySettings(). */
  constructor(container, graphics) {
    this.container = container;
    this.offsetX = GRID.width / 2;
    this.offsetZ = GRID.height / 2;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY);
    this.scene.fog = new THREE.Fog(SKY, 70, 160);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
    this.camera.position.set(0, 26, 23);

    // Anti-aliasing can only be chosen when the WebGL context is created; other settings apply live.
    this.renderer = new THREE.WebGLRenderer({
      antialias: graphics.antialias,
      powerPreference: graphics.preset === 'low' ? 'low-power' : 'default',
    });
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // Shadows are redrawn only when something static changes (see _shadowsDirty).
    this.renderer.shadowMap.autoUpdate = false;
    this._shadowsDirty = true;
    this.renderScale = 1;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.addEventListener('webglcontextrestored', () => (this._shadowsDirty = true));

    this.controls = new MapControls(this.camera, this.renderer.domElement);
    // Left mouse is reserved for building; right rotates, middle pans, wheel zooms.
    this.controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 75;
    this.controls.maxPolarAngle = Math.PI * 0.42;

    this._setupLights();
    this._setupTerrain();

    this.entityLayer = new THREE.Group();
    this.overlayLayer = new THREE.Group();
    this.scene.add(this.entityLayer, this.overlayLayer);

    this.views = { buildings: new Map(), enemies: new Map(), projectiles: new Map() };
    this.wallBatches = new KeyedBatches(this.entityLayer, (key) => createBuildingModel('wall', { connections: connectionsFromKey(key) }));
    this.enemyBatches = new KeyedBatches(this.entityLayer, (type) => createEnemyModel(type), { castShadow: false });
    this.healthBars = new HealthBarBatch(this.overlayLayer);
    this.blobShadows = new BlobShadowBatch(this.entityLayer);
    this._wallSignature = '';
    this._m = new THREE.Matrix4();
    this._m2 = new THREE.Matrix4();
    this._v = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._one = new THREE.Vector3(1, 1, 1);
    this.effects = [];
    this._unsubscribe = [];
    this._raycaster = new THREE.Raycaster();
    this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._time = 0;

    this.applySettings(graphics);
    window.addEventListener('resize', () => this._resize());
    this._resize();
    // Portrait screens see much less of the map sideways; start further back so it fits.
    if (this.camera.aspect < 1) this.camera.position.multiplyScalar(Math.min(1.8, 1 / this.camera.aspect));
  }

  get canvas() {
    return this.renderer.domElement;
  }

  // ---------------------------------------------------------------- setup

  _setupLights() {
    // Warm afternoon light to suit the sandstone and clay palette.
    this.scene.add(new THREE.HemisphereLight(0xfff4e0, 0x5a6a3a, 1.5));
    const sun = new THREE.DirectionalLight(0xffe2b8, 2.7);
    sun.position.set(18, 34, 12);
    this.sun = sun;
    const s = Math.max(GRID.width, GRID.height) * 0.65;
    Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 100 });
    sun.shadow.bias = -0.0005;
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
    const outer = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshStandardMaterial({ map: tiled(grassTexture(), 400 / 6), color: 0xc4d6a8, roughness: 1 }),
    );
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.03;
    outer.receiveShadow = true;
    this.scene.add(outer);

    // Spawn zone ring (dirt) and the buildable field (grass) on top of it.
    const dirt = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: tiled(dirtTexture(), W / 2), roughness: 1 }));
    dirt.rotation.x = -Math.PI / 2;
    dirt.position.y = -0.01;
    dirt.receiveShadow = true;
    this.scene.add(dirt);

    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(W - 2 * m, H - 2 * m),
      new THREE.MeshStandardMaterial({ map: tiled(grassTexture(), (W - 2 * m) / 6), roughness: 1 }),
    );
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    this.scene.add(grass);

    // Tile grid, shown only while building (BuildController toggles it).
    const grid = new THREE.GridHelper(W - 2 * m, W - 2 * m, 0x2b4a1c, 0x2b4a1c);
    grid.material.transparent = true;
    grid.material.opacity = 0.22;
    grid.position.y = 0.01;
    grid.visible = false;
    this.scene.add(grid);
    this.grid = grid;

    this.scenery = null;
  }

  /** (Re)build the trees and rocks around the play area. */
  _buildScenery(count) {
    if (this.scenery) this.scene.remove(this.scenery);
    this.scenery = null;
    if (count === 0) return;
    const spots = [];
    const half = Math.max(GRID.width, GRID.height) / 2;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = half + 2.5 + Math.random() * 45;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (Math.abs(x) < half + 1.5 && Math.abs(z) < half + 1.5) continue;
      const roll = Math.random();
      const kind = roll < 0.45 ? 'oak' : roll < 0.75 ? 'pine' : roll < 0.88 ? 'bush' : 'rock';
      spots.push({
        kind,
        x,
        z,
        scale: kind === 'rock' ? 0.7 + Math.random() * 1.1 : 0.8 + Math.random() * 0.7,
        rot: Math.random() * Math.PI * 2,
        variant: Math.floor(Math.random() * 3),
      });
    }
    this.scenery = createScenery(spots);
    this.scene.add(this.scenery);
    this._shadowsDirty = true;
  }

  /**
   * Apply graphics settings without recreating the WebGL context (anti-aliasing is the exception:
   * it's fixed at creation). Resolution is capped at the device's real pixel ratio.
   */
  applySettings(graphics) {
    const prev = this.graphics;
    this.graphics = { ...graphics };
    if (graphics.resolution !== 'auto') this.setRenderScale(graphics.resolution);
    else if (!prev || prev.resolution !== 'auto') this.setRenderScale(defaultAutoScale());
    this._shadowsDirty = true;

    const size = SHADOW_MAP_SIZE[graphics.shadows];
    const enabled = size > 0;
    if (enabled !== this.renderer.shadowMap.enabled) {
      this.renderer.shadowMap.enabled = enabled;
      // Materials compile different shaders with and without shadows.
      this.scene.traverse((o) => {
        for (const m of [o.material].flat()) if (m) m.needsUpdate = true;
      });
    }
    this.sun.castShadow = enabled;
    if (enabled && this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }

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
    this.camera.aspect = w / h;
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
    this.wallBatches.clear();
    this._wallSignature = '';
    this._shadowsDirty = true;
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
    if (world) {
      this.healthBars.begin(this.camera.quaternion);
      this.blobShadows.begin();
      this.enemyBatches.begin();
      this._wallParts = [];
      this._sync(this.views.buildings, world.buildings.values(), (b) => this._createBuildingView(b), (v, b) => this._updateBuildingView(v, b));
      this._updateWalls();
      this._sync(this.views.enemies, world.enemies, (e) => this._createEnemyView(e), (v, e) => this._updateEnemyView(v, e));
      this._sync(this.views.projectiles, world.projectiles, (p) => this._createProjectileView(p), (v, p) => this._updateProjectileView(v, p));
      this.enemyBatches.end();
      this.blobShadows.end();
      this.healthBars.end();
    }

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
    if (this._shadowsDirty && this.renderer.shadowMap.enabled) this.renderer.shadowMap.needsUpdate = true;
    this._shadowsDirty = false;
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
    if (view.static) this._shadowsDirty = true;
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
    this._shadowsDirty = true;
    if (b.type === 'wall') return { obj: null, static: true, wallKey: null }; // drawn by wallBatches
    const obj = createBuildingModel(b.type);
    this.toScene(b.cx, 0, b.cz, obj.position);
    // Animated parts would leave stale shadows (the shadow map isn't redrawn every frame).
    for (const key of ['turret', 'flag', 'crystal', 'arm']) obj.userData[key]?.traverse((o) => (o.castShadow = false));
    this.entityLayer.add(obj);
    return { obj, static: true, phase: Math.random() * Math.PI * 2 };
  }

  _updateBuildingView(view, b) {
    if (b.type === 'wall') {
      view.wallKey = this._wallConnections(b).key;
      this._wallParts.push(b, view.wallKey);
    } else {
      this._animateBuilding(view, b);
    }
    if (b.hp < b.maxHp || b.type === 'townHall') {
      this.healthBars.add(this.toScene(b.cx, b.def.height + 0.6, b.cz, this._v), Math.min(2.4, 0.8 * b.size + 0.2), b.hp / b.maxHp);
    }
  }

  /** Re-fill the wall instances when any wall is added, removed or changes shape. */
  _updateWalls() {
    let signature = '';
    for (let i = 0; i < this._wallParts.length; i += 2) signature += `${this._wallParts[i].id}${this._wallParts[i + 1]},`;
    if (signature === this._wallSignature) return;
    this._wallSignature = signature;
    this._shadowsDirty = true;
    this.wallBatches.begin();
    for (let i = 0; i < this._wallParts.length; i += 2) {
      const b = this._wallParts[i];
      this._m.makeTranslation(this.toScene(b.cx, 0, b.cz, this._v));
      this.wallBatches.push(this._wallParts[i + 1], this._m);
    }
    this.wallBatches.end();
  }

  _animateBuilding(view, b) {
    const ud = view.obj.userData;
    if (ud.turret) ud.turret.rotation.y = b.aim;
    if (ud.flag) ud.flag.rotation.y = Math.sin(this._time * 2.5 + view.phase) * 0.25;
    if (ud.crystal) {
      ud.crystal.rotation.y = this._time * 1.5;
      ud.crystal.position.y = 3.35 + Math.sin(this._time * 2 + view.phase) * 0.12;
    }
    if (ud.arm) {
      // Catapult: the arm is thrown forward when it fires, then winched back down while reloading.
      const reload = 1 - b.cooldown / b.def.attack.cooldown; // 0 just fired → 1 ready
      const wind = THREE.MathUtils.smoothstep(reload, 0.05, 0.75);
      ud.arm.rotation.x = THREE.MathUtils.lerp(1.9, -0.35, wind);
      ud.ammo.visible = reload > 0.75;
    }
  }

  _createEnemyView(e) {
    // Ordinary enemies are drawn by enemyBatches; rare elites get their own model (crown, scale).
    let obj = null;
    if (e.elite) {
      obj = createEnemyModel(e.type, true);
      obj.traverse((o) => (o.castShadow = false));
      this.entityLayer.add(obj);
    }
    return { obj, phase: Math.random() * Math.PI * 2 };
  }

  _updateEnemyView(view, e) {
    // Walk bob or attack lunge, applied to the body.
    const t = this._time * e.def.speed * 6 + view.phase;
    let by = 0;
    let bz = 0;
    let tilt = 0;
    if (e.moving) {
      by = Math.abs(Math.sin(t)) * 0.08;
      tilt = 0.1;
    } else if (e.attackTargetId !== null) {
      bz = Math.max(0, Math.sin(this._time * 8 + view.phase)) * 0.15;
      tilt = 0.25;
    }
    const pos = this.toScene(e.x, 0, e.z, this._v);
    const scale = e.elite ? 1.3 : 1;
    if (view.obj) {
      view.obj.position.copy(pos);
      view.obj.rotation.y = e.heading;
      const body = view.obj.userData.body;
      body.position.set(0, by, bz);
      body.rotation.x = tilt;
    } else {
      this._q.setFromEuler(this._e.set(0, e.heading, 0));
      this._m.compose(pos, this._q, this._one);
      this._q.setFromEuler(this._e.set(tilt, 0, 0));
      this._m2.compose(this._v.set(0, by, bz), this._q, this._one);
      this.enemyBatches.push(e.type, this._m.multiply(this._m2));
    }
    this.blobShadows.add(this.toScene(e.x, 0.025, e.z, this._v), (ENEMY_BLOB_RADIUS[e.type] ?? 0.3) * scale);
    if (e.hp < e.maxHp) {
      this.healthBars.add(this.toScene(e.x, e.def.height * scale + 0.25, e.z, this._v), ENEMY_BAR_WIDTH[e.type] ?? 0.6, e.hp / e.maxHp);
    }
  }

  _createProjectileView(p) {
    const obj = createProjectileModel(p.kind);
    obj.traverse((o) => (o.castShadow = false));
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
    const obj = new THREE.Mesh(
      BURST_GEOMETRY,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthWrite: false }),
    );
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
    this.toScene(x, 0.06, z, obj.position);
    this.scene.add(obj);
    this.effects.push({ obj, age: 0, life, size: radius, ring: true });
  }
}

function defaultAutoScale() {
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  return touch ? AUTO_RESOLUTION.startTouch : AUTO_RESOLUTION.startDesktop;
}
