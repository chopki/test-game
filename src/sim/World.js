import { BUILDINGS, ECONOMY, ENEMIES, GRID, PATHING, START_FORT, TERRAIN, TIMING } from './config.js';
import { createRng } from './rng.js';
import { EventBus } from './EventBus.js';
import { Grid } from './Grid.js';
import { FlowField } from './FlowField.js';
import { Economy } from './Economy.js';
import { WaveManager } from './WaveManager.js';
import { planWall } from './wallPlanner.js';
import { generateTerrain, spawnTilesBySide, T } from './terrain.js';

/**
 * The whole game state and rules, with no rendering or DOM dependencies.
 * The renderer and UI read from it each frame and listen to `world.events`.
 *
 * Coordinates are in tile units: tile (x, z) spans [x, x+1) × [z, z+1).
 *
 * `terrain`: 'open' (no terrain, the default, used by most tests), 'generate' (a map generated from the seed,
 * as the game uses), or a Uint8Array of terrain types (see terrain.js).
 *
 * Phases: 'build' (countdown to next wave) → 'wave' (enemies spawning/alive)
 * → back to 'build' when the wave is cleared, or 'gameover' when the Town Hall falls.
 *
 * Events emitted: goldChanged, buildingPlaced, buildingSold, buildingDestroyed,
 * enemySpawned, enemyKilled, projectileFired, projectileImpact, towerPulse, buildingHit, waveStarted,
 * waveCleared, gameOver.
 */
export class World {
  constructor({ seed = Date.now(), terrain = 'open', fort = false } = {}) {
    this.seed = seed >>> 0;
    this.rng = createRng(seed);
    this.events = new EventBus();
    this.grid = new Grid(GRID.width, GRID.height, GRID.spawnMargin);
    this.flow = new FlowField(this.grid);
    this.economy = new Economy(ECONOMY.startingGold, this.events);
    this.waves = new WaveManager(this.rng);

    this.buildings = new Map();
    this.enemies = [];
    this.projectiles = [];

    this.phase = 'build';
    this.phaseTimer = TIMING.firstBuildPhase;
    this.time = 0;
    this.stats = { kills: 0, wavesSurvived: 0 };

    this._nextId = 1;
    this._flowDirty = true;
    this._flowTimer = 0;

    const s = BUILDINGS.townHall.size;
    const hall = { x: Math.floor((GRID.width - s) / 2), z: Math.floor((GRID.height - s) / 2), size: s };
    const mapInfo = { width: GRID.width, height: GRID.height, spawnMargin: GRID.spawnMargin, hall };
    if (terrain === 'generate') {
      // Its own random stream, so the map doesn't change the waves that follow.
      this.grid.terrain = generateTerrain({ ...mapInfo, rng: createRng(this.seed ^ 0x9e3779b9) });
    } else if (terrain instanceof Uint8Array) {
      this.grid.terrain = Uint8Array.from(terrain);
    }
    this.spawnTiles = spawnTilesBySide(this.grid.terrain, mapInfo);
    this.townHall = this._addBuilding('townHall', hall.x, hall.z);
    if (fort) this._buildStartingFort();
    this._refreshFlow();
  }

  // ---------------------------------------------------------------- queries

  buildingAt(x, z) {
    const id = this.grid.get(x, z);
    return id === null ? null : this.buildings.get(id);
  }

  /**
   * Top-left tile for a building of `type` placed at the hovered tile: centred on it (as near as possible), or,
   * when a tower is put on a wall, snapped into the wall: across the middle of a straight run (the wall carries
   * on from both sides) or onto a corner (both arms join it). See _wallSnap().
   */
  anchorFor(type, tileX, tileZ) {
    const offset = Math.floor((BUILDINGS[type].size - 1) / 2);
    const centred = { x: tileX - offset, z: tileZ - offset };
    if (type === 'wall' || this.buildingAt(tileX, tileZ)?.type !== 'wall') return centred;
    return this._wallSnap(type, tileX, tileZ) ?? centred;
  }

  /**
   * Of the footprints that cover the hovered wall tile, the one that sits best in the wall: most wall ends
   * joining it from outside (2 for a straight run or a corner), then most wall tiles replaced, then nearest the
   * Town Hall (towers usually go on the inner side of a wall). Null if none can be built.
   */
  _wallSnap(type, tileX, tileZ) {
    const size = BUILDINGS[type].size;
    const hall = this.townHall;
    let best = null;
    for (let dz = 0; dz < size; dz++) {
      for (let dx = 0; dx < size; dx++) {
        const x = tileX - dx;
        const z = tileZ - dz;
        if (!this.canPlace(type, x, z, { ignoreCost: true }).ok) continue;
        const replaced = this.wallsUnder(type, x, z).length;
        let joins = 0;
        for (let i = 0; i < size; i++) {
          for (const [ox, oz] of [
            [x + i, z - 1],
            [x + i, z + size],
            [x - 1, z + i],
            [x + size, z + i],
          ]) {
            if (this.buildingAt(ox, oz)?.type === 'wall') joins++;
          }
        }
        const toHall = Math.hypot(x + size / 2 - hall.cx, z + size / 2 - hall.cz);
        const score = joins * 100 + replaced * 10 - toHall * 0.01;
        if (!best || score > best.score) best = { x, z, score };
      }
    }
    return best && { x: best.x, z: best.z };
  }

  /** Can `type` go at (x, z)? With `ignoreCost`, gold isn't checked (used when planning several at once). */
  canPlace(type, x, z, { ignoreCost = false } = {}) {
    const def = BUILDINGS[type];
    if (!def || !def.buildable) return { ok: false, reason: 'Cannot build that' };
    if (this.phase === 'gameover') return { ok: false, reason: 'Game over' };
    for (const [tx, tz] of this.grid.footprint(x, z, def.size)) {
      if (!this.grid.inBounds(tx, tz)) return { ok: false, reason: 'Out of bounds' };
      if (this.grid.isInSpawnZone(tx, tz)) return { ok: false, reason: 'Too close to the edge' };
    }
    for (const [tx, tz] of this.grid.footprint(x, z, def.size)) {
      if (!this.grid.isBuildable(tx, tz)) return { ok: false, reason: 'Blocked by terrain' };
    }
    const replaces = this.wallsUnder(type, x, z);
    if (!replaces) return { ok: false, reason: 'Space is occupied' };
    if (this._enemyInArea(x, z, def.size)) return { ok: false, reason: 'Enemies in the way' };
    // Walls a tower replaces are sold, and that refund counts towards the tower.
    const refund = replaces.reduce((sum, w) => sum + this.sellValue(w), 0);
    if (!ignoreCost && this.economy.gold + refund < def.cost) return { ok: false, reason: 'Not enough gold' };
    return { ok: true, replaces, refund };
  }

  /**
   * The walls a building of `type` at (x, z) would replace: [] on clear ground, the walls in its footprint when
   * a tower is built into a wall line, or null if anything else is in the way (walls can't replace walls).
   */
  wallsUnder(type, x, z) {
    const found = new Set();
    for (const [tx, tz] of this.grid.footprint(x, z, BUILDINGS[type].size)) {
      const b = this.buildingAt(tx, tz);
      if (!b) continue;
      if (b.type !== 'wall' || type === 'wall') return null;
      found.add(b);
    }
    return [...found];
  }

  /** Plan a wall line from tile `from` to tile `to` (see planWall in wallPlanner.js). */
  planWall(from, to) {
    return planWall(this, from, to);
  }

  /**
   * Build the buildable tiles of a wall plan, in order, until gold runs out.
   * Returns { built, planned } so callers can report a partial build.
   */
  buildWall(plan) {
    let built = 0;
    for (const t of plan.tiles) {
      if (t.ok && this.place('wall', t.x, t.z).ok) built++;
    }
    return { built, planned: plan.count };
  }

  /** Whether the player may sell `building` (not the Town Hall or the gatehouse). */
  canSell(building) {
    return Boolean(building?.def.buildable) && this.phase !== 'gameover';
  }

  sellValue(building) {
    if (building.starter) return 0; // the starting fort was free
    return Math.floor(building.def.cost * ECONOMY.sellRefund * (building.hp / building.maxHp));
  }

  // ---------------------------------------------------------------- commands

  place(type, x, z) {
    const check = this.canPlace(type, x, z);
    if (!check.ok) return check;
    for (const wall of check.replaces) {
      this._removeBuilding(wall);
      this.events.emit('buildingSold', { building: wall, refund: this.sellValue(wall) });
    }
    if (check.refund) this.economy.earn(check.refund, 'sell');
    this.economy.spend(BUILDINGS[type].cost);
    const building = this._addBuilding(type, x, z);
    this.events.emit('buildingPlaced', { building });
    return { ok: true, building };
  }

  sell(id) {
    const b = this.buildings.get(id);
    if (!this.canSell(b)) return false;
    const refund = this.sellValue(b);
    this._removeBuilding(b);
    this.economy.earn(refund, 'sell');
    this.events.emit('buildingSold', { building: b, refund });
    return true;
  }

  startWave() {
    if (this.phase !== 'build') return false;
    this.phase = 'wave';
    const plan = this.waves.start();
    this.events.emit('waveStarted', { wave: plan.wave, sides: plan.sides, count: plan.entries.length });
    return true;
  }

  // ---------------------------------------------------------------- tick

  update(dt) {
    if (this.phase === 'gameover') return;
    this.time += dt;

    if (this.phase === 'build') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) this.startWave();
    }
    if (this.phase === 'wave') {
      for (const entry of this.waves.update(dt)) this._spawnEnemy(entry);
    }

    this._flowTimer -= dt;
    if (this._flowDirty || this._flowTimer <= 0) this._refreshFlow();

    for (const e of this.enemies) if (e.alive) this._updateEnemy(e, dt);
    if (this.phase === 'gameover') return;
    for (const b of this.buildings.values()) if (b.def.attack) this._updateTower(b, dt);
    for (const p of this.projectiles) this._updateProjectile(p, dt);

    this.enemies = this.enemies.filter((e) => e.alive);
    this.projectiles = this.projectiles.filter((p) => p.alive);

    if (this.phase === 'wave' && this.waves.isSpawningDone() && this.enemies.length === 0) this._endWave();
  }

  // ---------------------------------------------------------------- buildings

  _addBuilding(type, x, z) {
    const def = BUILDINGS[type];
    const b = {
      id: this._nextId++,
      type,
      def,
      x,
      z,
      size: def.size,
      cx: x + def.size / 2,
      cz: z + def.size / 2,
      hp: def.maxHp,
      maxHp: def.maxHp,
      cooldown: 0,
      aim: 0,
    };
    this.buildings.set(b.id, b);
    this.grid.fill(x, z, def.size, b.id);
    this._flowDirty = true;
    return b;
  }

  /** Lay out START_FORT round the Town Hall, skipping any piece that terrain or the map edge would block. */
  _buildStartingFort() {
    const { x: hx, z: hz } = this.townHall;
    const fits = (x, z, size) => {
      for (const [tx, tz] of this.grid.footprint(x, z, size)) {
        if (!this.grid.inBounds(tx, tz) || this.grid.isInSpawnZone(tx, tz) || !this.grid.isBuildable(tx, tz)) return false;
        const b = this.buildingAt(tx, tz);
        if (b && b.type !== 'wall') return false;
      }
      return true;
    };
    const add = (type, x, z) => {
      if (!fits(x, z, BUILDINGS[type].size)) return;
      for (const [tx, tz] of this.grid.footprint(x, z, BUILDINGS[type].size)) {
        const wall = this.buildingAt(tx, tz);
        if (wall) this._removeBuilding(wall);
      }
      this._addBuilding(type, x, z).starter = true;
    };
    for (const [x0, z0, x1, z1] of START_FORT.walls) {
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
        for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) {
          if (!this.buildingAt(hx + x, hz + z)) add('wall', hx + x, hz + z);
        }
      }
    }
    add('gatehouse', hx + START_FORT.gatehouse.x, hz + START_FORT.gatehouse.z);
    for (const t of START_FORT.towers) add(t.type, hx + t.x, hz + t.z);
  }

  _removeBuilding(b) {
    this.buildings.delete(b.id);
    this.grid.fill(b.x, b.z, b.size, null);
    for (const e of this.enemies) if (e.attackTargetId === b.id) e.attackTargetId = null;
    this._flowDirty = true;
  }

  /** `from`: where the blow came from ({ x, z }, e.g. the attacker), for the renderer's hit effects. */
  _damageBuilding(b, amount, from = null) {
    if (b.hp <= 0) return;
    b.hp -= amount;
    if (from) this.events.emit('buildingHit', { building: b, amount, x: from.x, z: from.z });
    if (b.hp > 0) return;
    b.hp = 0;
    this._removeBuilding(b);
    this.events.emit('buildingDestroyed', { building: b });
    if (b === this.townHall) {
      this.phase = 'gameover';
      this.events.emit('gameOver', { ...this.stats, wave: this.waves.wave });
    }
  }

  _penaltyAt(x, z) {
    const b = this.buildingAt(x, z);
    return b ? 1 + b.hp * PATHING.breachCostPerHp : 0;
  }

  _refreshFlow() {
    this._flowDirty = false;
    this._flowTimer = TIMING.flowRefreshInterval;
    if (!this.buildings.has(this.townHall.id)) return;
    const { x, z, size } = this.townHall;
    this.flow.compute([...this.grid.footprint(x, z, size)], (tx, tz) => this._penaltyAt(tx, tz));
  }

  _updateTower(b, dt) {
    const attack = b.def.attack;
    b.cooldown = Math.max(0, b.cooldown - dt);
    if (b.cooldown > 0) return;
    const target = this._pickTarget(b.cx, b.cz, attack.range, attack.minRange ?? 0);
    if (!target) return;
    b.cooldown = attack.cooldown;
    b.aim = Math.atan2(target.x - b.cx, target.z - b.cz);
    if (attack.kind === 'pulse') this._pulse(b);
    else this._fire(b, target);
  }

  // Area pulse (Magic Spire): damage and slow every enemy in range.
  _pulse(b) {
    const a = b.def.attack;
    const r2 = a.range * a.range;
    for (const e of this.enemies) {
      if (!e.alive || (e.x - b.cx) ** 2 + (e.z - b.cz) ** 2 > r2) continue;
      if (a.slow) this._slowEnemy(e, a.slow);
      this._damageEnemy(e, a.damage);
    }
    this.events.emit('towerPulse', { building: b, x: b.cx, z: b.cz, radius: a.range });
  }

  _slowEnemy(e, { factor, duration }) {
    e.slowFactor = Math.min(e.slowFactor, factor);
    e.slowUntil = Math.max(e.slowUntil, this.time + duration);
  }

  // Towers shoot the enemy in range that is closest to reaching the Town Hall.
  _pickTarget(x, z, range, minRange = 0) {
    let best = null;
    let bestScore = Infinity;
    const r2 = range * range;
    const min2 = minRange * minRange;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = e.x - x;
      const dz = e.z - z;
      const d2 = dx * dx + dz * dz;
      if (d2 > r2 || d2 < min2) continue;
      const score = this.flow.distanceAt(e.tx, e.tz);
      if (score < bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  // ---------------------------------------------------------------- projectiles

  _fire(b, target) {
    const a = b.def.attack;
    const homing = a.splash === 0;
    const p = {
      id: this._nextId++,
      kind: a.projectile,
      sx: b.cx,
      sy: b.def.height,
      sz: b.cz,
      x: b.cx,
      y: b.def.height,
      z: b.cz,
      tx: target.x,
      ty: homing ? target.def.height * 0.6 : 0.2,
      tz: target.z,
      target: homing ? target : null,
      damage: a.damage,
      splash: a.splash,
      slow: a.slow ?? null,
      arc: a.arc,
      t: 0,
      flightTime: Math.max(0.05, Math.hypot(target.x - b.cx, target.z - b.cz) / a.projectileSpeed),
      alive: true,
    };
    this.projectiles.push(p);
    this.events.emit('projectileFired', { projectile: p, building: b });
  }

  _updateProjectile(p, dt) {
    if (!p.alive) return;
    if (p.target?.alive) {
      p.tx = p.target.x;
      p.tz = p.target.z;
    }
    p.t = Math.min(1, p.t + dt / p.flightTime);
    const t = p.t;
    p.x = p.sx + (p.tx - p.sx) * t;
    p.z = p.sz + (p.tz - p.sz) * t;
    p.y = p.sy + (p.ty - p.sy) * t + p.arc * 4 * t * (1 - t);
    if (t < 1) return;

    p.alive = false;
    if (p.splash > 0) {
      const r2 = p.splash * p.splash;
      for (const e of this.enemies) {
        if (e.alive && (e.x - p.x) ** 2 + (e.z - p.z) ** 2 <= r2) this._damageEnemy(e, p.damage);
      }
    } else if (p.target?.alive) {
      if (p.slow) this._slowEnemy(p.target, p.slow);
      this._damageEnemy(p.target, p.damage);
    }
    this.events.emit('projectileImpact', { x: p.x, y: p.y, z: p.z, kind: p.kind, splash: p.splash });
  }

  // ---------------------------------------------------------------- enemies

  _spawnTile(side) {
    // Walkable edge tiles that can reach the hall (the whole edge, minus the corners, on an open map).
    const tiles = this.spawnTiles[side];
    if (tiles?.length) return this.rng.pick(tiles);
    const { width: w, height: h, spawnMargin: m } = this.grid;
    const along = (len) => this.rng.int(m, len - m - 1);
    switch (side) {
      case 'north':
        return [along(w), 0];
      case 'south':
        return [along(w), h - 1];
      case 'west':
        return [0, along(h)];
      default:
        return [w - 1, along(h)];
    }
  }

  _spawnEnemy(entry) {
    const def = ENEMIES[entry.type];
    const [tx, tz] = this._spawnTile(entry.side);
    const maxHp = Math.round(def.maxHp * entry.hpMult);
    const e = {
      id: this._nextId++,
      type: entry.type,
      def,
      elite: entry.elite,
      x: tx + 0.5,
      z: tz + 0.5,
      tx,
      tz,
      target: null,
      hp: maxHp,
      maxHp,
      attackTargetId: null,
      attackTimer: 0,
      // Small per-enemy offset so groups don't walk in a single-file line.
      offX: this.rng.range(-0.22, 0.22),
      offZ: this.rng.range(-0.22, 0.22),
      heading: 0,
      moving: false,
      slowFactor: 1,
      slowUntil: 0,
      alive: true,
    };
    this.enemies.push(e);
    this.events.emit('enemySpawned', { enemy: e });
  }

  _updateEnemy(e, dt) {
    e.moving = false;

    if (e.attackTargetId !== null) {
      const b = this.buildings.get(e.attackTargetId);
      if (!b) {
        e.attackTargetId = null;
      } else {
        e.heading = Math.atan2(b.cx - e.x, b.cz - e.z);
        e.attackTimer -= dt;
        if (e.attackTimer <= 0) {
          e.attackTimer += e.def.attackCooldown;
          this._damageBuilding(b, e.def.damage * (e.elite ? 1.5 : 1), e);
          // A cheaper route may have opened up (e.g. another wall fell).
          const next = this.flow.nextStep(e.tx, e.tz);
          if (!next || this.grid.get(next.x, next.z) !== b.id) e.attackTargetId = null;
        }
        return;
      }
    }

    if (!e.target) {
      const next = this.flow.nextStep(e.tx, e.tz);
      if (!next) return;
      const occupant = this.grid.get(next.x, next.z);
      if (occupant !== null) {
        e.attackTargetId = occupant;
        e.attackTimer = e.def.attackCooldown * 0.5;
        return;
      }
      e.target = next;
    }

    const gx = e.target.x + 0.5 + e.offX;
    const gz = e.target.z + 0.5 + e.offZ;
    const dx = gx - e.x;
    const dz = gz - e.z;
    const dist = Math.hypot(dx, dz);
    if (e.slowUntil <= this.time) e.slowFactor = 1;
    const wading = this.grid.terrainAt(e.target.x, e.target.z) === T.ford;
    const step = e.def.speed * e.slowFactor * (wading ? TERRAIN.fordSpeed : 1) * dt;
    e.moving = true;
    if (dist > 1e-6) e.heading = Math.atan2(dx, dz);
    if (dist <= step) {
      e.x = gx;
      e.z = gz;
      e.tx = e.target.x;
      e.tz = e.target.z;
      e.target = null;
    } else {
      e.x += (dx / dist) * step;
      e.z += (dz / dist) * step;
    }
  }

  _damageEnemy(e, amount) {
    if (!e.alive) return;
    e.hp -= amount;
    if (e.hp > 0) return;
    e.alive = false;
    this.stats.kills++;
    const reward = e.def.reward * (e.elite ? 3 : 1);
    this.economy.earn(reward, 'kill');
    this.events.emit('enemyKilled', { enemy: e, reward });
  }

  _enemyInArea(x, z, size) {
    const inside = (tx, tz) => tx >= x && tx < x + size && tz >= z && tz < z + size;
    return this.enemies.some((e) => e.alive && (inside(e.tx, e.tz) || (e.target && inside(e.target.x, e.target.z))));
  }

  _endWave() {
    const wave = this.waves.wave;
    this.stats.wavesSurvived = wave;
    const bonus = ECONOMY.waveBonusBase + ECONOMY.waveBonusPerWave * wave;
    this.economy.earn(bonus, 'wave');
    this.phase = 'build';
    this.phaseTimer = TIMING.buildPhase;
    this.events.emit('waveCleared', { wave, bonus });
  }
}
