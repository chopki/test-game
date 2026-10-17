import * as THREE from 'three';
import { T } from '../sim/terrain.js';
import { createRng } from '../sim/rng.js';
import { ISO_QUATERNION } from './iso.js';
import { SPRITE_KIND } from './spriteLayer.js';
import { spriteKeys } from './spriteCatalog.js';

/**
 * Wildlife, for a world that feels lived in (decoration only: the sim never sees it, and nothing here is ever in
 * the way):
 *  - birds: small inked flocks crossing the map now and then, flapping; they scatter when a cannon fires or a shot
 *    lands near them;
 *  - fish: now and then one leaps from a stream or lake, with a splash;
 *  - deer and rabbits grazing at the woods' edge, away from the hall; they bolt into the trees when enemies come
 *    near, a shot lands close or something is built on their spot, and come back in quiet times.
 * Driven by the renderer (it draws through the renderer's sprite, shadow and particle batches).
 */

const BIRD_FRAMES = 3;
const MAX_BIRDS = 48;
const DANGER_ENEMY = 5; // tiles: enemies this close send animals running
const DANGER_SHOT = 4;

export class Wildlife {
  constructor(renderer) {
    this.r = renderer;
    this.birds = [];
    this.animals = [];
    this.fish = null;
    this._birdTimer = 6;
    this._fishTimer = 3;
    this._birdMesh = birdMesh();
    renderer.overlayLayer.add(this._birdMesh.mesh);
    this._fishMesh = fishModel();
    this._fishMesh.visible = false;
    renderer.entityLayer.add(this._fishMesh);
    this._m = new THREE.Matrix4();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._v = new THREE.Vector3();
  }

  /** New map: find water for the fish and spots at the woods' edge for the animals. */
  reset(world) {
    this.world = world;
    this.birds = [];
    this.fish = null;
    const grid = world.grid;
    const at = (x, z) => (grid.inBounds(x, z) ? grid.terrain[z * grid.width + x] : -1);
    this._water = [];
    this._edges = [];
    const hall = world.townHall;
    for (let z = 1; z < grid.height - 1; z++) {
      for (let x = 1; x < grid.width - 1; x++) {
        const t = at(x, z);
        const around = [at(x + 1, z), at(x - 1, z), at(x, z + 1), at(x, z - 1)];
        if (t === T.water && around.every((a) => a === T.water || a === T.ford)) this._water.push([x, z]);
        if (t === T.open && around.includes(T.forest) && Math.hypot(x + 0.5 - hall.cx, z + 0.5 - hall.cz) > 9) this._edges.push([x, z]);
      }
    }
    this._rng = createRng(world.seed ^ 0xdee5);
    this.animals = [];
    for (let i = 0; i < 6 && this._edges.length; i++) {
      const a = { kind: i < 2 ? 'deer' : 'rabbit', state: 'gone', respawn: 0 };
      this._spawn(a); // there from the start
      this.animals.push(a);
    }
  }

  get visibleAnimals() {
    return this.animals.filter((a) => a.state !== 'gone').length;
  }

  /** Something loud at (x, z) (world tiles): birds nearby scatter, animals nearby run. */
  startle(x, z, radius) {
    for (const b of this.birds) {
      if (!b.scatter && Math.hypot(b.x - x, b.z - z) < radius + 3) {
        const a = Math.atan2(b.z - z, b.x - x) + (Math.random() - 0.5);
        b.scatter = true;
        b.vx = Math.cos(a) * 6;
        b.vz = Math.sin(a) * 6;
        b.vy = 2 + Math.random() * 2;
      }
    }
    for (const a of this.animals) if (a.state !== 'gone' && a.state !== 'flee' && Math.hypot(a.x - x, a.z - z) < radius) this._flee(a);
  }

  update(dt, time) {
    if (!this.world) return;
    const g = this.r.graphics;
    this._updateBirds(dt, time, g.effects);
    this._updateFish(dt, g.effects);
    this._updateAnimals(dt, time, g.scenery !== 'off');
  }

  // ---------------------------------------------------------------- birds

  _updateBirds(dt, time, on) {
    const grid = this.world.grid;
    this._birdTimer -= dt;
    if (on && this._birdTimer <= 0 && this.birds.length === 0) {
      this._birdTimer = 25 + Math.random() * 30;
      // A loose flock in a V, from one side of the map to the other.
      const angle = Math.random() * Math.PI * 2;
      const [dx, dz] = [Math.cos(angle), Math.sin(angle)];
      const cx = grid.width / 2 - dx * (grid.width * 0.75);
      const cz = grid.height / 2 - dz * (grid.height * 0.75);
      const n = 5 + Math.floor(Math.random() * 6);
      for (let i = 0; i < n; i++) {
        const row = Math.ceil(i / 2);
        const side = i % 2 ? 1 : -1;
        this.birds.push({
          x: cx - dx * row * 0.8 + -dz * side * row * 0.7 + (Math.random() - 0.5) * 0.4,
          z: cz - dz * row * 0.8 + dx * side * row * 0.7 + (Math.random() - 0.5) * 0.4,
          y: 5.5 + Math.random() * 0.8,
          vx: dx * 3,
          vz: dz * 3,
          vy: 0,
          phase: Math.random(),
          scatter: false,
        });
      }
    }
    const mesh = this._birdMesh;
    let count = 0;
    const far = grid.width * 0.9;
    this.birds = this.birds.filter((b) => {
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      b.y += b.vy * dt;
      if (b.scatter) b.vy *= Math.pow(0.5, dt);
      return Math.hypot(b.x - grid.width / 2, b.z - grid.height / 2) < far && b.y < 14;
    });
    if (!on) return void (mesh.mesh.count = 0);
    for (const b of this.birds) {
      if (count >= MAX_BIRDS) break;
      const flap = b.scatter ? 14 : 7;
      const frame = Math.floor(time * flap + b.phase * BIRD_FRAMES) % BIRD_FRAMES;
      this.r.toScene(b.x, b.y, b.z, this._p);
      this._m.compose(this._p, ISO_QUATERNION, this._s.set(0.34, 0.17, 1));
      mesh.mesh.setMatrixAt(count, this._m);
      mesh.frames.setX(count, frame);
      count++;
      this.r.blobShadows.add(this.r.toScene(b.x + b.y * 0.35, 0.02, b.z + b.y * 0.35, this._v), 0.09);
    }
    mesh.mesh.count = count;
    mesh.mesh.instanceMatrix.needsUpdate = true;
    mesh.frames.needsUpdate = true;
  }

  // ---------------------------------------------------------------- fish

  _updateFish(dt, on) {
    if (this.fish) {
      const f = this.fish;
      f.t += dt;
      const k = f.t / f.life;
      const x = f.x + f.dx * k * 0.9;
      const z = f.z + f.dz * k * 0.9;
      const y = Math.sin(Math.PI * k) * 0.45 - 0.05;
      this.r.toScene(x, y, z, this._fishMesh.position);
      this._fishMesh.rotation.set(0, Math.atan2(f.dx, f.dz), 0);
      this._fishMesh.rotateX(-Math.cos(Math.PI * k) * 0.9); // nose up as it leaves the water, down as it dives
      this._fishMesh.visible = on;
      if (k >= 1) {
        this._splash(x, z);
        this._fishMesh.visible = false;
        this.fish = null;
      }
      return;
    }
    this._fishTimer -= dt;
    if (!on || this._fishTimer > 0 || !this._water.length) return;
    this._fishTimer = 4 + Math.random() * 6;
    const [tx, tz] = this._water[Math.floor(Math.random() * this._water.length)];
    const a = Math.random() * Math.PI * 2;
    this.fish = { x: tx + 0.5, z: tz + 0.5, dx: Math.cos(a), dz: Math.sin(a), t: 0, life: 0.75 };
    this._splash(tx + 0.5, tz + 0.5);
    this.jumps = (this.jumps ?? 0) + 1;
  }

  _splash(x, z) {
    const at = this.r.toScene(x, 0.05, z, this._v);
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * Math.PI * 2;
      this.r.particles.puff({ x: at.x, y: at.y, z: at.z, vx: Math.cos(a) * 0.5, vy: 0.8, vz: Math.sin(a) * 0.5, size: 0.08, grow: 0.12, life: 0.45, color: 0xeef6ff, alpha: 0.8, drag: 0.2 });
    }
  }

  // ---------------------------------------------------------------- deer and rabbits

  _updateAnimals(dt, time, on) {
    const world = this.world;
    const quiet = world.phase === 'build' && world.enemies.length === 0;
    for (const a of this.animals) {
      if (a.state === 'gone') {
        a.respawn -= dt;
        if (a.respawn <= 0 && quiet) this._spawn(a);
        continue;
      }
      a.timer -= dt;
      if (a.state !== 'flee') {
        // Danger: an enemy coming close, or something built on the spot.
        const near = world.enemies.some((e) => Math.hypot(e.x - a.x, e.z - a.z) < DANGER_ENEMY);
        if (near || world.buildingAt(Math.floor(a.x), Math.floor(a.z))) this._flee(a);
      }
      if (a.state === 'flee') {
        const dx = a.tx - a.x;
        const dz = a.tz - a.z;
        const d = Math.hypot(dx, dz);
        const step = (a.kind === 'deer' ? 3.6 : 4.4) * dt;
        if (d <= step || a.timer <= 0) {
          a.state = 'gone'; // into the trees
          a.respawn = 25 + Math.random() * 35;
          continue;
        }
        a.x += (dx / d) * step;
        a.z += (dz / d) * step;
        a.heading = Math.atan2(dx, dz);
        a.pose = Math.floor(time * (a.kind === 'deer' ? 8 : 10)) % 2 ? 'run1' : 'run0';
      } else if (a.state === 'hop') {
        a.x += Math.sin(a.heading) * 1.2 * dt;
        a.z += Math.cos(a.heading) * 1.2 * dt;
        a.pose = Math.floor(time * 10) % 2 ? 'run1' : 'run0';
        if (a.timer <= 0) this._idle(a);
      } else if (a.timer <= 0) {
        // Idle: graze, look up, turn a little; rabbits hop now and then.
        if (a.kind === 'rabbit' && Math.random() < 0.3) {
          a.state = 'hop';
          a.heading += (Math.random() - 0.5) * 2;
          a.timer = 0.4;
        } else {
          this._idle(a);
        }
      }
      if (!on) continue;
      const pos = this.r.toScene(a.x, 0, a.z, this._v);
      this.r.sprites.add(spriteKeys.animal(a.kind, a.heading, a.pose), pos, 1, 0, 0, SPRITE_KIND.unit);
      this.r.blobShadows.add(this.r.toScene(a.x, 0.02, a.z, this._p), a.kind === 'deer' ? 0.24 : 0.1);
    }
  }

  _spawn(a) {
    const [x, z] = this._edges[this._rng.int(0, this._edges.length - 1)];
    if (this.world.buildingAt(x, z)) return;
    Object.assign(a, { x: x + 0.3 + Math.random() * 0.4, z: z + 0.3 + Math.random() * 0.4, heading: Math.random() * Math.PI * 2 });
    this._idle(a);
  }

  _idle(a) {
    a.state = 'idle';
    a.pose = Math.random() < 0.65 ? 'graze' : 'alert';
    a.heading += (Math.random() - 0.5) * 0.8;
    a.timer = 1.5 + Math.random() * 3.5;
  }

  /** Bolt for the nearest trees. */
  _flee(a) {
    const grid = this.world.grid;
    let best = null;
    for (let r = 1; r <= 6 && !best; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          const x = Math.floor(a.x) + dx;
          const z = Math.floor(a.z) + dz;
          if (grid.inBounds(x, z) && grid.terrainAt(x, z) === T.forest) {
            const d = Math.hypot(x + 0.5 - a.x, z + 0.5 - a.z);
            if (!best || d < best.d) best = { x: x + 0.5, z: z + 0.5, d };
          }
        }
      }
    }
    a.state = 'flee';
    a.tx = best ? best.x : a.x + Math.sin(a.heading) * 4;
    a.tz = best ? best.z : a.z + Math.cos(a.heading) * 4;
    a.timer = 3;
    this.fled = (this.fled ?? 0) + 1;
  }
}

/** Birds: small inked "v" shapes, three wing frames in one texture, drawn as one instanced batch. */
function birdMesh() {
  const w = 64;
  const c = document.createElement('canvas');
  c.width = w * BIRD_FRAMES;
  c.height = w / 2;
  const g = c.getContext('2d');
  g.strokeStyle = '#2c1e16';
  g.lineWidth = 4;
  g.lineCap = 'round';
  for (let f = 0; f < BIRD_FRAMES; f++) {
    const ox = f * w;
    const lift = [-10, 0, 9][f]; // wings up, level, down
    g.beginPath();
    g.moveTo(ox + 6, 16 + lift);
    g.quadraticCurveTo(ox + 20, 6 + lift * 0.4, ox + 32, 17);
    g.quadraticCurveTo(ox + 44, 6 + lift * 0.4, ox + 58, 16 + lift);
    g.stroke();
  }
  const texture = new THREE.CanvasTexture(c);
  const geometry = new THREE.PlaneGeometry(1, 1);
  const frames = new THREE.InstancedBufferAttribute(new Float32Array(MAX_BIRDS), 1);
  frames.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aFrame', frames);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    alphaTest: 0.4,
    depthTest: false,
    depthWrite: false,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aFrame;')
      .replace('#include <uv_vertex>', `#include <uv_vertex>\nvMapUv = vec2((uv.x + aFrame) / ${BIRD_FRAMES}.0, uv.y);`);
  };
  const mesh = new THREE.InstancedMesh(geometry, material, MAX_BIRDS);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.renderOrder = 3.3;
  mesh.count = 0;
  return { mesh, frames };
}

/** A small fish (silver back, pale belly), nose along +z. */
function fishModel() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0x9fb2b8 }));
  body.scale.set(0.7, 0.8, 2);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.08, 4), new THREE.MeshBasicMaterial({ color: 0x6f8790 }));
  tail.rotation.x = Math.PI / 2;
  tail.position.z = -0.14;
  g.add(body, tail);
  g.traverse((o) => (o.renderOrder = 3));
  return g;
}
