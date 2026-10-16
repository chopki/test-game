import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { GRID } from '../sim/config.js';
import {
  createBuildingModel,
  createEnemyModel,
  createHealthBar,
  createProjectileModel,
  createRock,
  createTree,
  setHealthBar,
} from './models.js';

const SKY = 0xa9d3ee;
const BURST_GEOMETRY = new THREE.SphereGeometry(1, 12, 8);

/**
 * Owns the Three.js scene and mirrors a sim World into it every frame.
 * The renderer never mutates the world: it reads entity state, keeps one
 * view object per entity id, and spawns short-lived effects from world events.
 *
 * Sim coordinates (tile units, origin at the grid corner) map to scene
 * coordinates with the grid centred on the origin.
 */
export class Renderer {
  constructor(container) {
    this.container = container;
    this.offsetX = GRID.width / 2;
    this.offsetZ = GRID.height / 2;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY);
    this.scene.fog = new THREE.Fog(SKY, 70, 160);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
    this.camera.position.set(0, 26, 23);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

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
    this.effects = [];
    this._unsubscribe = [];
    this._raycaster = new THREE.Raycaster();
    this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._time = 0;

    window.addEventListener('resize', () => this._resize());
    this._resize();
  }

  get canvas() {
    return this.renderer.domElement;
  }

  // ---------------------------------------------------------------- setup

  _setupLights() {
    this.scene.add(new THREE.HemisphereLight(0xe8f4ff, 0x4a5a35, 1.4));
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
    sun.position.set(18, 34, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const s = Math.max(GRID.width, GRID.height) * 0.65;
    Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 100 });
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);
  }

  _setupTerrain() {
    const W = GRID.width;
    const H = GRID.height;
    const m = GRID.spawnMargin;

    const outer = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshStandardMaterial({ color: 0x4f7a36, roughness: 1 }),
    );
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.03;
    outer.receiveShadow = true;
    this.scene.add(outer);

    // Spawn zone ring (dirt) and the buildable field (grass) on top of it.
    const dirt = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ color: 0x8f7b55, roughness: 1 }));
    dirt.rotation.x = -Math.PI / 2;
    dirt.position.y = -0.01;
    dirt.receiveShadow = true;
    this.scene.add(dirt);

    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(W - 2 * m, H - 2 * m),
      new THREE.MeshStandardMaterial({ color: 0x67a046, roughness: 1 }),
    );
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    this.scene.add(grass);

    const grid = new THREE.GridHelper(W, W, 0x2b4a1c, 0x2b4a1c);
    grid.material.transparent = true;
    grid.material.opacity = 0.18;
    grid.position.y = 0.01;
    this.scene.add(grid);

    // Scenery outside the play area.
    const scenery = new THREE.Group();
    const half = Math.max(W, H) / 2;
    for (let i = 0; i < 220; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = half + 2.5 + Math.random() * 45;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (Math.abs(x) < half + 1.5 && Math.abs(z) < half + 1.5) continue;
      const obj = Math.random() < 0.85 ? createTree(0.8 + Math.random() * 0.8) : createRock(0.6 + Math.random() * 1.2);
      obj.position.set(x, 0, z);
      obj.rotation.y = Math.random() * Math.PI * 2;
      scenery.add(obj);
    }
    this.scene.add(scenery);
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
    for (const fx of this.effects) this.scene.remove(fx.obj);
    this.effects = [];

    this.world = world;
    const ev = world.events;
    this._unsubscribe = [
      ev.on('projectileImpact', (p) => {
        if (p.kind === 'cannonball') this._spawnBurst(p.x, 0.2, p.z, 0xffa040, p.splash, 0.35);
      }),
      ev.on('enemyKilled', ({ enemy }) => this._spawnBurst(enemy.x, 0.5, enemy.z, 0x9a8f80, 0.5, 0.4)),
      ev.on('buildingDestroyed', ({ building }) =>
        this._spawnBurst(building.cx, 0.6, building.cz, 0x8a7f70, building.size * 0.9, 0.7),
      ),
    ];
  }

  toScene(x, y, z, out = new THREE.Vector3()) {
    return out.set(x - this.offsetX, y, z - this.offsetZ);
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
    if (world) {
      this._sync(this.views.buildings, world.buildings.values(), (b) => this._createBuildingView(b), (v, b) => this._updateBuildingView(v, b));
      this._sync(this.views.enemies, world.enemies, (e) => this._createEnemyView(e), (v, e) => this._updateEnemyView(v, e));
      this._sync(this.views.projectiles, world.projectiles, (p) => this._createProjectileView(p), (v, p) => this._updateProjectileView(v, p));
    }

    for (const fx of this.effects) {
      fx.age += dt;
      const t = fx.age / fx.life;
      fx.obj.scale.setScalar(fx.size * (0.3 + t));
      fx.obj.material.opacity = 0.7 * (1 - t);
    }
    this.effects = this.effects.filter((fx) => {
      if (fx.age < fx.life) return true;
      this.scene.remove(fx.obj);
      fx.obj.material.dispose();
      return false;
    });

    this.controls.update();
    // Billboard health bars toward the camera.
    for (const bar of this.overlayLayer.children) bar.quaternion.copy(this.camera.quaternion);
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
    this.entityLayer.remove(view.obj);
    if (view.bar) {
      this.overlayLayer.remove(view.bar);
      view.bar.userData.fg.material.dispose();
    }
  }

  _createBuildingView(b) {
    const obj = createBuildingModel(b.type);
    this.toScene(b.cx, 0, b.cz, obj.position);
    this.entityLayer.add(obj);
    const bar = createHealthBar(Math.min(2.4, 0.8 * b.size + 0.2));
    this.overlayLayer.add(bar);
    return { obj, bar };
  }

  _updateBuildingView(view, b) {
    const turret = view.obj.userData.turret;
    if (turret) turret.rotation.y = b.aim;
    const flag = view.obj.userData.flag;
    if (flag) flag.rotation.y = Math.sin(this._time * 2.5) * 0.25;
    const damaged = b.hp < b.maxHp;
    view.bar.visible = damaged || b.type === 'townHall';
    if (view.bar.visible) {
      this.toScene(b.cx, b.def.height + 0.6, b.cz, view.bar.position);
      setHealthBar(view.bar, b.hp / b.maxHp);
    }
  }

  _createEnemyView(e) {
    const obj = createEnemyModel(e.type, e.elite);
    this.entityLayer.add(obj);
    const bar = createHealthBar(e.type === 'brute' ? 0.9 : 0.6);
    this.overlayLayer.add(bar);
    return { obj, bar, phase: Math.random() * Math.PI * 2 };
  }

  _updateEnemyView(view, e) {
    this.toScene(e.x, 0, e.z, view.obj.position);
    view.obj.rotation.y = e.heading;
    const body = view.obj.userData.body;
    const t = this._time * e.def.speed * 6 + view.phase;
    if (e.moving) {
      body.position.y = Math.abs(Math.sin(t)) * 0.08;
      body.position.z = 0;
      body.rotation.x = 0.1;
    } else if (e.attackTargetId !== null) {
      body.position.y = 0;
      body.position.z = Math.max(0, Math.sin(this._time * 8 + view.phase)) * 0.15;
      body.rotation.x = 0.25;
    }
    view.bar.visible = e.hp < e.maxHp;
    if (view.bar.visible) {
      this.toScene(e.x, e.def.height * (e.elite ? 1.3 : 1) + 0.25, e.z, view.bar.position);
      setHealthBar(view.bar, e.hp / e.maxHp);
    }
  }

  _createProjectileView(p) {
    const obj = createProjectileModel(p.kind);
    this.toScene(p.x, p.y, p.z, obj.position);
    this.entityLayer.add(obj);
    return { obj };
  }

  _updateProjectileView(view, p) {
    const prev = view.obj.position.clone();
    this.toScene(p.x, p.y, p.z, view.obj.position);
    if (p.kind === 'arrow' && prev.distanceToSquared(view.obj.position) > 1e-8) {
      view.obj.lookAt(view.obj.position.clone().multiplyScalar(2).sub(prev));
    }
  }

  _spawnBurst(x, y, z, color, size, life) {
    const obj = new THREE.Mesh(
      BURST_GEOMETRY,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthWrite: false }),
    );
    this.toScene(x, y, z, obj.position);
    this.scene.add(obj);
    this.effects.push({ obj, age: 0, life, size });
  }
}
