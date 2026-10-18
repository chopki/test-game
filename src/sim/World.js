import { BUILDINGS, CONQUEST, ECONOMY, ENEMIES, GRID, HEROES, PATHING, START_FORT, TERRAIN, TIMING, TROOPS, UPGRADES } from './config.js';
import { nextUpgradeCost, stageDef } from './upgrades.js';
import { createRng } from './rng.js';
import { EventBus } from './EventBus.js';
import { Grid } from './Grid.js';
import { FlowField } from './FlowField.js';
import { Economy } from './Economy.js';
import { WaveManager } from './WaveManager.js';
import { planWall } from './wallPlanner.js';
import { generateMap, groundHeight, spawnTilesBySide, T } from './terrain.js';
import { SIDES } from './WaveManager.js';
import { refreshPosts, updateBarracks, updateTroop } from './troops.js';
import { generateLaneMap, nearestLane } from './lanes.js';
import { aiThink, buildForts, otherTeam, placeFlags, sendSquads, updateLaneSoldier } from './conquest.js';
import { inTerritory, updateFlags } from './flags.js';
import { heroFell, heroXp, orderHero, spawnHero, updateHero, updateHeroes, useAbility } from './heroes.js';
import { campAlarm, campGuardFell, setupCamps, updateCampGuard, updateCamps } from './camps.js';

/**
 * The whole game state and rules, with no rendering or DOM dependencies.
 * The renderer and UI read from it each frame and listen to `world.events`.
 *
 * Coordinates are in tile units: tile (x, z) spans [x, x+1) × [z, z+1).
 *
 * `terrain`: 'open' (no terrain, the default, used by most tests), 'generate' (a map generated from the seed,
 * as the game uses), or a Uint8Array of terrain types (see terrain.js). For generated maps, `river` forces a
 * stream and `sea` picks the coast: false (none, the default), 'sometimes' (TERRAIN.sea.chance of maps) or
 * true (always); `this.coast` is the side the sea lies along, or null. `size`: the map's width and height in
 * tiles (default GRID.width × GRID.height); the Town Hall sits in the middle. `hills`: false (flat, the default),
 * 'sometimes' (TERRAIN.hills.chance of maps) or true: plateaus with cliffs and ramps (`grid.levels`).
 *
 * `mode`: 'survival' (the default: hold the Town Hall against waves) or 'conquest' (castle against castle on the
 * lane map; see conquest.js). In Conquest every building and soldier has a `team` ('red', the player, or 'blue',
 * the AI), `enemyHall` is blue's Town Hall, each side has its own gold (`economyOf(team)`), and the phase stays
 * 'build' (counting down to the next wave of squads) until a Town Hall falls; `won` says whose.
 *
 * Phases: 'build' (countdown to next wave) → 'wave' (enemies spawning/alive)
 * → back to 'build' when the wave is cleared, or 'gameover' when the Town Hall falls.
 *
 * Enemies march in squads (see WaveManager.js). Men walk the flow field to the Town Hall and hack at whatever
 * blocks their way (walls, towers, the gatehouse); ranged enemies (archers, siege catapults) stop and shoot a
 * building in range instead; rams and catapults hit buildings far harder than men.
 *
 * The player's troops (`troops`, see troops.js) come from Barracks and fight enemies near its post; enemy men stop
 * to fight a soldier who comes up to them, and enemy archers with nothing else to shoot shoot soldiers.
 *
 * Events emitted: goldChanged, buildingPlaced, buildingSold, buildingDestroyed,
 * enemySpawned, enemyKilled, projectileFired, projectileImpact, towerPulse, buildingHit, waveStarted,
 * waveCleared, gameOver, troopTrained, troopKilled. Enemy shots are projectiles too (`hostile: true`, fired by `enemy`).
 */
export class World {
  constructor({ seed = Date.now(), terrain = 'open', fort = false, river = false, sea = false, size = null, hills = false, mode = 'survival', hero = null } = {}) {
    this.seed = seed >>> 0;
    this.mode = mode;
    this._heroChoice = hero; // Conquest: the player's hero (a key of HEROES.roster)
    this.rng = createRng(seed);
    this.troopRng = createRng(this.seed ^ 0x7a00b5); // soldiers' small choices, so they don't change the waves
    this.events = new EventBus();
    const conquest = mode === 'conquest';
    this.grid = conquest ? new Grid(CONQUEST.width, CONQUEST.height, GRID.spawnMargin) : new Grid(size ?? GRID.width, size ?? GRID.height, GRID.spawnMargin);
    this.flow = new FlowField(this.grid);
    this.economy = new Economy(conquest ? CONQUEST.startingGold : ECONOMY.startingGold, this.events);
    // Conquest: the AI's purse (its own events, so the player's HUD doesn't hear of it).
    this.blueEconomy = conquest ? new Economy(CONQUEST.startingGold, new EventBus()) : null;

    this.buildings = new Map();
    this.enemies = [];
    this.projectiles = [];
    this.troops = [];

    this.phase = 'build';
    this.phaseTimer = TIMING.firstBuildPhase;
    this.time = 0;
    this.stats = { kills: 0, wavesSurvived: 0 };
    this.won = null; // Conquest: true if the player took the enemy's Town Hall, false if they lost their own

    this._nextId = 1;
    this._squads = new Map(); // squad number → where its men line up on the edge (this wave)
    this._flowDirty = true;
    this._flowTimer = 0;
    this._postsDirty = true; // Barracks posts need finding again (buildings came or went)

    if (conquest) {
      this._setupConquest();
      return;
    }
    const s = BUILDINGS.townHall.size;
    const { width: W, height: H } = this.grid;
    const hall = { x: Math.floor((W - s) / 2), z: Math.floor((H - s) / 2), size: s };
    const mapInfo = { width: W, height: H, spawnMargin: GRID.spawnMargin, hall };
    this.coast = null;
    this.hills = false; // whether this map was given hills
    if (terrain === 'generate') {
      // The coast is decided on a random stream of its own, so maps without one are just as they were.
      const coastRng = createRng(this.seed ^ 0x5ea5ea);
      if (sea === true || (sea === 'sometimes' && coastRng.next() < TERRAIN.sea.chance)) this.coast = coastRng.pick(SIDES);
      // Hills too: on a stream of their own (the roll and the shapes).
      const hillsRng = createRng(this.seed ^ 0x411e5);
      const hilly = hills === true || (hills === 'sometimes' && hillsRng.next() < TERRAIN.hills.chance);
      this.hills = hilly;
      // Its own random stream, so the map doesn't change the waves that follow.
      const map = generateMap({ ...mapInfo, rng: createRng(this.seed ^ 0x9e3779b9), river, coast: this.coast, hillsRng: hilly ? hillsRng : null });
      this.grid.terrain = map.types;
      this.grid.levels = map.levels;
    } else if (terrain instanceof Uint8Array) {
      this.grid.terrain = Uint8Array.from(terrain);
    }
    this.spawnTiles = spawnTilesBySide(this.grid.terrain, mapInfo);
    // Waves come only from sides with somewhere to land (not the sea).
    this.waves = new WaveManager(this.rng, SIDES.filter((side) => this.spawnTiles[side].length > 0));
    this.townHall = this._addBuilding('townHall', hall.x, hall.z);
    if (fort) this._buildStartingFort();
    this._refreshFlow();
  }

  /** The lane map, both Town Halls and both forts (Conquest). */
  _setupConquest() {
    const map = generateLaneMap({ width: this.grid.width, height: this.grid.height, rng: createRng(this.seed ^ 0x9e3779b9) });
    this.grid.terrain = map.types;
    this.grid.levels = map.levels;
    this.lanes = map.lanes;
    this.layout = map.layout; // its name (see LAYOUTS in lanes.js)
    this.camps = map.camps;
    this.coast = null;
    this.hills = map.levels.some((l) => l > 0);
    this.spawnTiles = { north: [], south: [], west: [], east: [] };
    this.waves = new WaveManager(this.rng, ['north']); // only counts the waves: squads come from the Barracks
    this.phaseTimer = CONQUEST.firstPush;
    this.townHall = this._addBuilding('townHall', map.halls.red.x, map.halls.red.z, 'red');
    this.enemyHall = this._addBuilding('townHall', map.halls.blue.x, map.halls.blue.z, 'blue');
    buildForts(this);
    placeFlags(this);
    // The player's hero as chosen (else the default); the AI's at random (on a stream of its own).
    const kinds = Object.keys(HEROES.roster);
    this.heroKinds = { red: HEROES.roster[this._heroChoice] ? this._heroChoice : HEROES.default, blue: createRng(this.seed ^ 0x4e40).pick(kinds) };
    this.heroes = {};
    for (const team of ['red', 'blue']) spawnHero(this, team);
    setupCamps(this);
    this._aiTimer = CONQUEST.ai.think;
    this._refreshFlow();
  }

  /** Conquest: send the player's hero to a point ({ x, z }), at a foe ({ target }), or home (null). See heroes.js. */
  orderHero(order, team = 'red') {
    return orderHero(this, team, order);
  }

  /** Conquest: the hero's ability in `slot` (0: Q, 1: W; see HEROES.abilities). { ok, reason }. */
  useAbility(slot = 0, team = 'red') {
    return useAbility(this, team, slot);
  }

  /** A side's gold: the player's (red), or in Conquest the AI's (blue). */
  economyOf(team = 'red') {
    return team === 'blue' ? this.blueEconomy : this.economy;
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
  canPlace(type, x, z, { ignoreCost = false, team = 'red', anywhere = false } = {}) {
    const def = BUILDINGS[type];
    if (!def || !def.buildable) return { ok: false, reason: 'Cannot build that' };
    if (this.phase === 'gameover') return { ok: false, reason: 'Game over' };
    if (this.mode === 'conquest' && !anywhere && !inTerritory(this, team, x + def.size / 2, z + def.size / 2)) return { ok: false, reason: 'Outside your territory' };
    for (const [tx, tz] of this.grid.footprint(x, z, def.size)) {
      if (!this.grid.inBounds(tx, tz)) return { ok: false, reason: 'Out of bounds' };
      if (this.grid.isInSpawnZone(tx, tz)) return { ok: false, reason: 'Too close to the edge' };
    }
    const level = this.grid.levelAt(x, z);
    for (const [tx, tz] of this.grid.footprint(x, z, def.size)) {
      if (!this.grid.isBuildable(tx, tz)) return { ok: false, reason: 'Blocked by terrain' };
      if (this.grid.levelAt(tx, tz) !== level) return { ok: false, reason: 'Uneven ground' };
    }
    const replaces = this.wallsUnder(type, x, z);
    if (!replaces) return { ok: false, reason: 'Space is occupied' };
    if (this._enemyInArea(x, z, def.size)) return { ok: false, reason: 'Enemies in the way' };
    // Walls a tower replaces are sold, and that refund counts towards the tower.
    const refund = replaces.reduce((sum, w) => sum + this.sellValue(w), 0);
    if (replaces.some((w) => w.team !== team)) return { ok: false, reason: 'Space is occupied' };
    if (!ignoreCost && this.economyOf(team).gold + refund < def.cost) return { ok: false, reason: 'Not enough gold' };
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
    return Boolean(building?.def.buildable) && building.team === 'red' && this.phase !== 'gameover';
  }

  sellValue(building) {
    // What it cost (build plus upgrades; the starting fort was free), scaled by its health.
    return Math.floor((building.spent ?? building.def.cost) * ECONOMY.sellRefund * (building.hp / building.maxHp));
  }

  // ---------------------------------------------------------------- upgrades and repairs

  /**
   * Whether `building` can go up a stage now: { ok, reason, cost, next } (`next`: the next stage's definition, or
   * null at the last stage). Nothing may stand more than UPGRADES.aboveHall stages above its side's Town Hall.
   * `team`: who's upgrading (the player, or in Conquest the AI), who may only upgrade their own.
   */
  upgradeCheck(building, team = 'red') {
    const cost = building ? nextUpgradeCost(building.type, building.stage) : null;
    if (cost === null) return { ok: false, reason: building && UPGRADES.stages[building.type] ? 'Fully upgraded' : 'Cannot be upgraded', cost: null, next: null };
    const next = stageDef(building.type, building.stage + 1);
    const fail = (reason) => ({ ok: false, reason, cost, next });
    if (this.phase === 'gameover') return fail('The battle is over');
    if (building.team !== team) return fail("The enemy's");
    const hall = team === 'blue' ? this.enemyHall : this.townHall;
    if (building.type !== 'townHall' && next.stage > hall.stage + UPGRADES.aboveHall) return fail(`Needs the Town Hall at stage ${next.stage - UPGRADES.aboveHall}`);
    if (!this.economyOf(team).canAfford(cost)) return fail('Not enough gold');
    return { ok: true, reason: null, cost, next };
  }

  /** Upgrade building `id` a stage: it keeps the damage it has taken and gains the new stage's extra health. */
  upgrade(id, { team = 'red' } = {}) {
    const b = this.buildings.get(id);
    const check = this.upgradeCheck(b, team);
    if (!check.ok) return check;
    this.economyOf(team).spend(check.cost);
    b.stage = check.next.stage;
    b.def = check.next;
    b.hp += check.next.maxHp - b.maxHp;
    b.maxHp = check.next.maxHp;
    b.spent = (b.spent ?? 0) + check.cost;
    this._flowDirty = true; // enemies weigh a wall's health when choosing a way through
    this.events.emit('buildingUpgraded', { building: b, stage: b.stage });
    return check;
  }

  /**
   * The walls joined to wall `id` (along the four sides) that are at the same stage, nearest first: the line
   * "Upgrade line" upgrades.
   */
  wallLine(id) {
    const start = this.buildings.get(id);
    if (start?.type !== 'wall') return [];
    const line = [start];
    const seen = new Set([start.id]);
    for (let i = 0; i < line.length && line.length < 400; i++) {
      const w = line[i];
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = this.buildingAt(w.x + dx, w.z + dz);
        if (n?.type === 'wall' && n.stage === start.stage && !seen.has(n.id)) {
          seen.add(n.id);
          line.push(n);
        }
      }
    }
    return line;
  }

  /** Upgrade every wall in wall `id`'s line (wallLine) that it can afford, nearest first. Returns how many. */
  upgradeLine(id) {
    let done = 0;
    for (const w of this.wallLine(id)) if (this.upgrade(w.id).ok) done++;
    return done;
  }

  /** What repairing `building` to full health costs (ECONOMY.repairCost of all it was worth, by the damage). */
  repairCost(building) {
    const worth = (building.type === 'townHall' ? ECONOMY.hallRepairWorth : building.def.cost) + this._upgradeSpend(building);
    return Math.ceil(worth * ECONOMY.repairCost * (1 - building.hp / building.maxHp));
  }

  _upgradeSpend(building) {
    let sum = 0;
    for (let s = 2; s <= building.stage; s++) sum += stageDef(building.type, s).upgradeCost;
    return sum;
  }

  /** Whether `building` can be repaired now (between waves, damaged, affordable): { ok, reason, cost }. */
  repairCheck(building) {
    if (!building || building.hp >= building.maxHp) return { ok: false, reason: 'Not damaged', cost: 0 };
    const cost = this.repairCost(building);
    if (building.team !== 'red') return { ok: false, reason: "The enemy's", cost };
    if (this.mode === 'conquest') {
      // Real time: any time, but not in the thick of it.
      if (this.phase === 'gameover') return { ok: false, reason: 'The battle is over', cost };
      if (this.time - (building.lastHit ?? -Infinity) < CONQUEST.repairDelay) return { ok: false, reason: 'Under attack', cost };
    } else if (this.phase !== 'build') return { ok: false, reason: 'Repairs wait until the wave is over', cost };
    if (!this.economy.canAfford(cost)) return { ok: false, reason: 'Not enough gold', cost };
    return { ok: true, reason: null, cost };
  }

  repair(id) {
    const b = this.buildings.get(id);
    const check = this.repairCheck(b);
    if (!check.ok) return check;
    this.economy.spend(check.cost);
    b.hp = b.maxHp;
    this._flowDirty = true;
    this.events.emit('buildingRepaired', { building: b, cost: check.cost });
    return check;
  }

  // ---------------------------------------------------------------- commands

  /** Build `type` at (x, z): for the player, or in Conquest for `team` (the AI builds this way too). */
  place(type, x, z, { team = 'red' } = {}) {
    const check = this.canPlace(type, x, z, { team });
    if (!check.ok) return check;
    const eco = this.economyOf(team);
    for (const wall of check.replaces) {
      this._removeBuilding(wall);
      this.events.emit('buildingSold', { building: wall, refund: this.sellValue(wall) });
    }
    if (check.refund) eco.earn(check.refund, 'sell');
    eco.spend(BUILDINGS[type].cost);
    const building = this._addBuilding(type, x, z, team);
    if (this.mode === 'conquest' && building.def.trains) building.lane = nearestLane(this.lanes, building.cx, building.cz).lane;
    if (building.def.trains) {
      // Find its way out now (not on the next tick), so it's known even while the game is paused.
      this._postsDirty = false;
      refreshPosts(this);
    }
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
    if (this.mode === 'conquest') {
      // Both sides' Barracks send their squads at once, and the count starts again.
      const wave = ++this.waves.wave;
      this.stats.wavesSurvived = wave - 1;
      this.phaseTimer = CONQUEST.pushEvery;
      if (this._postsDirty) {
        this._postsDirty = false;
        refreshPosts(this); // the Barracks' doors
      }
      sendSquads(this, wave);
      this.events.emit('waveStarted', { wave, sides: [], count: this.troops.length });
      return true;
    }
    this.phase = 'wave';
    this._squads = new Map();
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
    if (this.mode === 'conquest') {
      for (const team of ['red', 'blue']) this.economyOf(team).earn(CONQUEST.income * dt, 'income');
      if ((this._aiTimer -= dt) <= 0) {
        this._aiTimer = CONQUEST.ai.think;
        aiThink(this);
      }
      updateHeroes(this, dt);
      updateFlags(this, dt);
      updateCamps(this);
    }
    if (this.phase === 'wave') {
      for (const entry of this.waves.update(dt)) this._spawnEnemy(entry);
    }

    this._flowTimer -= dt;
    if (this._flowDirty || this._flowTimer <= 0) this._refreshFlow();

    if (this._postsDirty) {
      this._postsDirty = false;
      refreshPosts(this);
    }

    for (const e of this.enemies) if (e.alive) this._updateEnemy(e, dt);
    if (this.phase === 'gameover') return;
    for (const b of this.buildings.values()) {
      if (b.def.attack) this._updateTower(b, dt);
      else if (b.def.trains && this.mode !== 'conquest') updateBarracks(this, b, dt);
    }
    for (const t of this.troops) {
      if (!t.alive) continue;
      if (t.hero) updateHero(this, t, dt);
      else if (t.camp !== undefined) updateCampGuard(this, t, dt);
      else if (t.lane !== undefined) updateLaneSoldier(this, t, dt);
      else updateTroop(this, t, dt);
      if (this.phase === 'gameover') return;
    }
    for (const p of this.projectiles) this._updateProjectile(p, dt);

    this.enemies = this.enemies.filter((e) => e.alive);
    this.troops = this.troops.filter((t) => t.alive);
    this.projectiles = this.projectiles.filter((p) => p.alive);

    if (this.mode !== 'conquest' && this.phase === 'wave' && this.waves.isSpawningDone() && this.enemies.length === 0) this._endWave();
  }

  // ---------------------------------------------------------------- buildings

  _addBuilding(type, x, z, team = 'red') {
    const def = stageDef(type, 1);
    const b = {
      id: this._nextId++,
      type,
      team,
      def,
      stage: 1,
      spent: def.cost, // build plus upgrades, for the sell value
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
    this._postsDirty = true;
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
      Object.assign(this._addBuilding(type, x, z), { starter: true, spent: 0 });
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
    // A Barracks' men go with it.
    for (const t of this.troops) if (t.barracksId === b.id && t.alive) this._removeTroop(t, 'dismissed');
    this._flowDirty = true;
    this._postsDirty = true;
  }

  /** `from`: where the blow came from ({ x, z }, e.g. the attacker), for the renderer's hit effects. */
  _damageBuilding(b, amount, from = null) {
    if (b.hp <= 0) return;
    b.hp -= amount;
    b.lastHit = this.time;
    if (from) this.events.emit('buildingHit', { building: b, amount, x: from.x, z: from.z });
    if (b.hp > 0) return;
    b.hp = 0;
    this._removeBuilding(b);
    this.events.emit('buildingDestroyed', { building: b });
    if (this.mode === 'conquest' && b.type !== 'wall') {
      this.economyOf(otherTeam(b.team)).earn(CONQUEST.buildingBounty, 'bounty');
      heroXp(this, otherTeam(b.team), b.cx, b.cz, CONQUEST.buildingBounty);
    }
    if (b === this.townHall || b === this.enemyHall) {
      this.phase = 'gameover';
      if (this.mode === 'conquest') this.won = b === this.enemyHall;
      this.events.emit('gameOver', { ...this.stats, wave: this.waves.wave, won: this.won });
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

  /** A tower's reach: its attack range, plus TERRAIN.hills.rangePerLevel for each level it stands above the lowest. */
  rangeOf(b) {
    return this.rangeAt(b.type, b.x, b.z, b.stage);
  }

  /** The range a building of `type` at `stage` would have with its top-left tile at (x, z) (the build preview too). */
  rangeAt(type, x, z, stage = 1) {
    const attack = stageDef(type, stage).attack;
    return attack ? attack.range + this.grid.levelAt(x, z) * TERRAIN.hills.rangePerLevel : 0;
  }

  _updateTower(b, dt) {
    const attack = b.def.attack;
    b.cooldown = Math.max(0, b.cooldown - dt);
    if (b.cooldown > 0) return;
    const target = this._pickTarget(b.cx, b.cz, this.rangeOf(b), attack.minRange ?? 0, b.team);
    if (!target) return;
    b.cooldown = attack.cooldown * this._uphillReload(attack.projectile, b.cx, b.cz, target.x, target.z);
    b.aim = Math.atan2(target.x - b.cx, target.z - b.cz);
    if (attack.kind === 'pulse') this._pulse(b);
    else this._fire(b, target);
  }

  /**
   * How much longer an archer takes to reload when shooting up at higher ground: 1 + TERRAIN.hills.uphillReload for
   * each level (part level on a ramp) the target stands above the shooter. Only arrows; anything else gives 1.
   */
  _uphillReload(projectile, fromX, fromZ, toX, toZ) {
    if (projectile !== 'arrow' || !this.hills) return 1;
    const up = (groundHeight(this.grid, toX, toZ) - groundHeight(this.grid, fromX, fromZ)) / TERRAIN.hills.levelHeight;
    return 1 + Math.max(0, up) * TERRAIN.hills.uphillReload;
  }

  // Area pulse (Magic Spire): damage and slow every enemy in range.
  _pulse(b) {
    const a = b.def.attack;
    const range = this.rangeOf(b);
    const r2 = range * range;
    for (const e of this.foesOf(b.team)) {
      if (!e.alive || (e.x - b.cx) ** 2 + (e.z - b.cz) ** 2 > r2) continue;
      if (a.slow) this._slowEnemy(e, a.slow);
      this._hurt(e, a.damage, b.team);
    }
    this.events.emit('towerPulse', { building: b, x: b.cx, z: b.cz, radius: range });
  }

  _slowEnemy(e, { factor, duration }) {
    e.slowFactor = Math.min(e.slowFactor, factor);
    e.slowUntil = Math.max(e.slowUntil, this.time + duration);
  }

  /**
   * Who `team`'s towers and shots may hit: for the player the enemy army and (Conquest) blue soldiers; for blue,
   * red soldiers. The player's own troops are never targets of their towers.
   */
  foesOf(team = 'red') {
    const soldiers = this.troops.filter((t) => t.team !== team && t.alive);
    return team === 'red' ? (soldiers.length ? [...this.enemies, ...soldiers] : this.enemies) : soldiers;
  }

  /** Damage an enemy or a soldier. */
  _hurt(u, amount, by = null) {
    if (u.team) this._damageTroop(u, amount, by);
    else this._damageEnemy(u, amount);
  }

  // Towers shoot the enemy in range that is closest to reaching the Town Hall (soldiers: the nearest).
  _pickTarget(x, z, range, minRange = 0, team = 'red') {
    let best = null;
    let bestScore = Infinity;
    const r2 = range * range;
    const min2 = minRange * minRange;
    for (const e of this.foesOf(team)) {
      if (!e.alive || e.delay > 0) continue;
      const dx = e.x - x;
      const dz = e.z - z;
      const d2 = dx * dx + dz * dz;
      if (d2 > r2 || d2 < min2) continue;
      const score = e.team ? Math.sqrt(d2) : this.flow.distanceAt(e.tx, e.tz);
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
      team: b.team,
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

  /** An enemy's shot at building `b` (an arrow or a boulder at the nearest point of its footprint), or at soldier `troop`. */
  _fireAtBuilding(e, b, troop = null) {
    const r = e.def.ranged;
    const scale = e.elite ? 1.3 : 1;
    const [tx, tz] = troop ? [troop.x, troop.z] : this._nearestPoint(b, e.x, e.z);
    const p = {
      id: this._nextId++,
      kind: r.projectile,
      hostile: true,
      sx: e.x,
      sy: e.def.height * 0.7 * scale,
      sz: e.z,
      x: e.x,
      y: e.def.height * 0.7 * scale,
      z: e.z,
      tx,
      ty: troop ? troop.def.height * 0.6 : Math.min(1, b.def.height * 0.5),
      tz,
      target: null,
      building: b,
      troop,
      damage: e.def.damage * (e.elite ? 1.5 : 1),
      splash: r.projectile === 'boulder' ? 0.8 : 0,
      slow: null,
      arc: r.arc,
      t: 0,
      flightTime: Math.max(0.05, Math.hypot(tx - e.x, tz - e.z) / r.projectileSpeed),
      alive: true,
    };
    this.projectiles.push(p);
    this.events.emit('projectileFired', { projectile: p, enemy: e });
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
    if (p.building || p.troop) {
      // Shots aimed at a building or soldier only hurt it (if it still stands).
      if (p.troop) {
        if (p.troop.alive) this._damageTroop(p.troop, p.damage);
      } else if (this.buildings.get(p.building.id) === p.building) this._damageBuilding(p.building, p.damage, { x: p.sx, z: p.sz });
    } else if (p.splash > 0) {
      const r2 = p.splash * p.splash;
      for (const e of this.foesOf(p.team)) {
        if (e.alive && (e.x - p.x) ** 2 + (e.z - p.z) ** 2 <= r2) this._hurt(e, p.damage, p.team);
      }
    } else if (p.target?.alive) {
      if (p.slow) this._slowEnemy(p.target, p.slow);
      this._hurt(p.target, p.damage, p.team);
      if (p.from && p.target.alive && p.target.camp !== undefined) campAlarm(this, p.target.camp, p.from);
    }
    this.events.emit('projectileImpact', { x: p.x, y: p.y, z: p.z, kind: p.kind, splash: p.splash, hostile: Boolean(p.hostile) });
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

  /**
   * Where a squad's next man steps out: the first takes a random edge tile, the rest the free edge tiles nearest
   * it, so the squad lines up side by side.
   */
  _squadTile(entry) {
    if (entry.squad === undefined) return this._spawnTile(entry.side);
    let squad = this._squads.get(entry.squad);
    if (!squad) {
      const anchor = this._spawnTile(entry.side);
      const tiles = this.spawnTiles[entry.side]?.length ? this.spawnTiles[entry.side] : [anchor];
      const near = [...tiles].sort((a, b) => Math.hypot(a[0] - anchor[0], a[1] - anchor[1]) - Math.hypot(b[0] - anchor[0], b[1] - anchor[1]));
      squad = { tiles: near, next: 0 };
      this._squads.set(entry.squad, squad);
    }
    return squad.tiles[squad.next++ % squad.tiles.length];
  }

  _spawnEnemy(entry) {
    const def = ENEMIES[entry.type];
    const [tx, tz] = this._squadTile(entry);
    const maxHp = Math.round(def.maxHp * entry.hpMult);
    const e = {
      id: this._nextId++,
      type: entry.type,
      def,
      elite: entry.elite,
      squad: entry.squad ?? null,
      x: tx + 0.5,
      z: tz + 0.5,
      tx,
      tz,
      target: null,
      hp: maxHp,
      maxHp,
      attackTargetId: null, // the building it's hacking at, battering or shooting
      troopTarget: null, // the soldier it's fighting (or shooting)
      troopScan: 0, // seconds until it looks for soldiers nearby again
      attackTimer: 0,
      retarget: 0, // ranged enemies: seconds until they look for something to shoot again
      // Small per-enemy offset so groups don't walk in a single-file line.
      offX: def.siege ? 0 : this.rng.range(-0.22, 0.22),
      offZ: def.siege ? 0 : this.rng.range(-0.22, 0.22),
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
    const ranged = e.def.ranged;

    if (e.troopTarget && this._fightTroop(e, dt)) return;
    if (!e.def.siege && this.troops.length && (e.troopScan -= dt) <= 0) {
      e.troopScan = 0.25;
      // Men fight a soldier who comes up to them; archers shoot one in range if they've no building to shoot.
      const reach = ranged ? (e.attackTargetId === null && !this._rangedTarget(e) ? ranged.range : 0) : TROOPS.engage;
      const t = reach > 0 ? this._troopNear(e, reach) : null;
      if (t) {
        this._engageTroop(e, t);
        return;
      }
    }

    if (e.attackTargetId !== null) {
      const b = this.buildings.get(e.attackTargetId);
      if (!b) {
        e.attackTargetId = null;
      } else {
        const [px, pz] = this._nearestPoint(b, e.x, e.z);
        e.heading = Math.atan2(px - e.x, pz - e.z);
        e.attackTimer -= dt;
        if (e.attackTimer <= 0) {
          if (ranged) {
            e.attackTimer += e.def.attackCooldown * this._uphillReload(ranged.projectile, e.x, e.z, b.cx, b.cz);
            this._fireAtBuilding(e, b);
            // Something better may have come into range (a tower built, or the way through opened).
            const best = this._rangedTarget(e);
            if (best !== b) e.attackTargetId = best?.id ?? null;
          } else {
            e.attackTimer += e.def.attackCooldown;
            this._damageBuilding(b, e.def.damage * (e.elite ? 1.5 : 1), e);
            // A cheaper route may have opened up (e.g. another wall fell).
            const next = this.flow.nextStep(e.tx, e.tz);
            if (!next || this.grid.get(next.x, next.z) !== b.id) e.attackTargetId = null;
          }
        }
        return;
      }
    }

    if (ranged && (e.retarget -= dt) <= 0) {
      e.retarget = 0.4;
      const b = this._rangedTarget(e);
      if (b) {
        e.attackTargetId = b.id;
        e.attackTimer = e.def.attackCooldown * 0.5;
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
    const ground = this.grid.terrainAt(e.target.x, e.target.z);
    const slow = ground === T.ford ? TERRAIN.fordSpeed : ground === T.ramp ? TERRAIN.hills.rampSpeed : 1;
    const step = e.def.speed * e.slowFactor * slow * dt;
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

  /** The point of building `b`'s footprint nearest to (x, z). */
  _nearestPoint(b, x, z) {
    return [Math.min(Math.max(x, b.x), b.x + b.size), Math.min(Math.max(z, b.z), b.z + b.size)];
  }

  _distanceTo(b, x, z) {
    const [px, pz] = this._nearestPoint(b, x, z);
    return Math.hypot(px - x, pz - z);
  }

  /**
   * What a ranged enemy shoots from where it stands, or null to keep walking: the nearest tower in range, or the
   * building blocking its route (a wall, the gatehouse, the Town Hall) once that's in range. Archers prefer
   * towers; siege catapults prefer to batter a way through.
   */
  _rangedTarget(e) {
    const { range, prefer } = e.def.ranged;
    let tower = null;
    let towerDist = Infinity;
    for (const b of this.buildings.values()) {
      if (!b.def.attack) continue;
      const d = this._distanceTo(b, e.x, e.z);
      if (d <= range && d < towerDist) {
        tower = b;
        towerDist = d;
      }
    }
    // Follow the route ahead to the first building on it.
    let blocker = null;
    let [tx, tz] = [e.tx, e.tz];
    for (let i = 0; i < range + 2; i++) {
      const next = this.flow.nextStep(tx, tz);
      if (!next) break;
      const b = this.buildingAt(next.x, next.z);
      if (b) {
        if (this._distanceTo(b, e.x, e.z) <= range) blocker = b;
        break;
      }
      [tx, tz] = [next.x, next.z];
    }
    return prefer === 'towers' ? (tower ?? blocker) : (blocker ?? tower);
  }

  // ---------------------------------------------------------------- troops (see troops.js)

  /** The nearest living soldier within `reach` of enemy `e`, or null. */
  _troopNear(e, reach) {
    let best = null;
    let bestDist = reach;
    for (const t of this.troops) {
      if (!t.alive) continue;
      const d = Math.hypot(t.x - e.x, t.z - e.z);
      if (d <= bestDist) {
        best = t;
        bestDist = d;
      }
    }
    return best;
  }

  _engageTroop(e, t) {
    e.troopTarget = t;
    e.attackTargetId = null;
    e.attackTimer = e.def.attackCooldown * 0.5;
  }

  /** Enemy `e` fights its soldier: false (and lets go) once he's dead or out of reach, so it carries on its way. */
  _fightTroop(e, dt) {
    const t = e.troopTarget;
    const ranged = e.def.ranged;
    const reach = ranged ? ranged.range : TROOPS.engage * 1.5;
    if (!t.alive || Math.hypot(t.x - e.x, t.z - e.z) > reach) {
      e.troopTarget = null;
      return false;
    }
    e.heading = Math.atan2(t.x - e.x, t.z - e.z);
    e.attackTimer -= dt;
    if (e.attackTimer <= 0) {
      e.attackTimer += e.def.attackCooldown;
      if (ranged) this._fireAtBuilding(e, null, t);
      else this._damageTroop(t, e.def.damage * (e.elite ? 1.5 : 1));
    }
    return true;
  }

  /** `by`: the side that struck (who earns the bounty; for a neutral camp's guards it could be either). */
  _damageTroop(t, amount, by = null) {
    if (!t.alive) return;
    if (t.guardUntil > this.time) amount *= 1 - t.guard; // a Warden's shield wall
    t.hp -= amount;
    if (by) t.lastHitBy = by;
    if (t.hp > 0) return;
    this._removeTroop(t, 'killed');
    if (this.mode === 'conquest') {
      const killer = t.team === 'neutral' ? t.lastHitBy : otherTeam(t.team);
      if (killer === 'red' || killer === 'blue') {
        this.economyOf(killer).earn(t.def.reward, 'kill');
        heroXp(this, killer, t.x, t.z, t.def.reward);
      }
      if (t.camp !== undefined) campGuardFell(this, t);
      if (t.hero) heroFell(this, t);
      if (t.team === 'blue') this.stats.kills++;
    }
  }

  /**
   * Conquest: lane soldier `u` strikes `target` (a soldier or a building): a blow, or an arrow. A man struck by
   * a sword turns to fight back if he has nothing better to do.
   */
  _soldierStrike(u, target) {
    const r = u.def.ranged;
    const building = target.size !== undefined;
    if (!r) {
      if (building) this._damageBuilding(target, u.def.damage, u);
      else {
        this._damageTroop(target, u.def.damage * (u.charged ? u.charged : 1), u.team);
        u.charged = 0;
        if (target.alive && target.camp !== undefined) campAlarm(this, target.camp, u);
        if (target.alive && !target.def.siege && (!target.target || target.target.size !== undefined)) target.target = u;
      }
      return;
    }
    const [tx, tz] = building ? this._nearestPoint(target, u.x, u.z) : [target.x, target.z];
    const y = u.def.height * 0.7;
    const p = {
      id: this._nextId++,
      kind: r.projectile,
      hostile: u.team === 'blue',
      sx: u.x,
      sy: y,
      sz: u.z,
      x: u.x,
      y,
      z: u.z,
      tx,
      ty: building ? Math.min(1, target.def.height * 0.5) : target.def.height * 0.6,
      tz,
      target: building ? null : target,
      building: building ? target : null,
      team: u.team,
      from: u,
      damage: u.def.damage,
      splash: 0,
      slow: null,
      arc: r.arc,
      t: 0,
      flightTime: Math.max(0.05, Math.hypot(tx - u.x, tz - u.z) / r.projectileSpeed),
      alive: true,
    };
    this.projectiles.push(p);
    this.events.emit('projectileFired', { projectile: p, troop: u });
  }

  _removeTroop(t, how) {
    t.alive = false;
    t.hp = Math.max(0, t.hp);
    this.events.emit('troopKilled', { troop: t, dismissed: how === 'dismissed' });
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
