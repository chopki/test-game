// All gameplay tuning lives here. The simulation reads these tables; nothing
// else should hard-code balance numbers. Adding a new building or enemy is
// (mostly) a matter of adding an entry below and a model in render/models.js.

/**
 * The map grid. `width` × `height` is the default size (World's, and the tests'); the game picks one of `sizes`
 * (square, in tiles) per map: Settings → Map size, `?size=`.
 */
export const GRID = {
  width: 40,
  height: 40,
  sizes: { small: 40, medium: 52, large: 64 },
  defaultSize: 'medium',
  // Tiles this close to the map edge are the enemy spawn zone and can't be built on.
  spawnMargin: 2,
};

export const ECONOMY = {
  startingGold: 300,
  // Fraction of the build cost returned when selling, scaled by remaining HP.
  sellRefund: 0.5,
  waveBonusBase: 30,
  waveBonusPerWave: 10,
};

export const TIMING = {
  firstBuildPhase: 60, // seconds before wave 1 auto-starts
  buildPhase: 30, // seconds between waves
  flowRefreshInterval: 0.5, // how often enemy pathing re-reads building HP
};

/**
 * Terrain (see sim/terrain.js). Water, rock and forest block both enemies and building; fords can be waded
 * (slowly) but not built on. Enemies can't break terrain, so it shapes routes and chokepoints.
 */
export const TERRAIN = {
  clearingRadius: 6, // open tiles around the Town Hall (from its edge)
  minOpenFraction: 0.65, // of the buildable area; maps below this are regenerated with less cover
  minSpawnTilesPerSide: 8, // reachable edge tiles each spawn side must keep
  fordSpeed: 0.6, // enemy speed multiplier while wading
  fordCost: 1.5, // extra pathing cost for entering a ford tile
  forest: { scale: 0.12, threshold: 0.62, edgeBoost: 0.3 },
  rock: { scale: 0.21, threshold: 0.75, ridges: [1, 3], ridgeLength: [3, 7] },
  water: { streamChance: 0.8, lakeChance: 0.5, fords: [1, 2], fordWidth: 3 },
  // Coast: on this share of maps the sea lies along one edge (`depth` tiles of sea give or take `wobble`, then
  // `beach` tiles of sand). No enemies come from the sea.
  sea: { chance: 0.35, depth: [5, 7.5], wobble: 1.4, beach: [1.2, 2.4] },
};

/**
 * The partly built fort the game starts with (when World is created with `fort: true`). Positions are tiles
 * relative to the Town Hall's top-left tile (the hall covers 0..2). Walls are runs from one tile to another;
 * the gaps are left for the player to close. The gatehouse and towers go into the wall lines (replacing the walls
 * under them). Starter buildings sell for nothing (ECONOMY.sellRefund doesn't apply to them).
 */
export const START_FORT = {
  walls: [
    [-4, -4, 3, -4], // north, open at the north-east corner
    [-4, -4, -4, 7], // west
    [-1, 7, 7, 7], // south, with the gate (a gap next to the south-west corner)
    [7, 2, 7, 7], // east, open at the north-east corner
  ],
  gatehouse: { x: 1, z: 6 }, // across the south wall (the side the camera faces)
  towers: [{ type: 'archerTower', x: -4, z: 1 }], // in the west wall
};

export const PATHING = {
  // Each HP point on a blocking building costs this many "tiles" of detour.
  // A full-HP wall (400hp) is worth a 10-tile detour: enemies will walk around
  // short walls but smash through long ones (or damaged ones).
  breachCostPerHp: 1 / 40,
};

/**
 * Building definitions.
 *  size      footprint in tiles (size x size)
 *  height    world height, used for projectile origin and health bar placement
 *  attack    optional; any building with an attack acts as a tower:
 *              kind      'projectile' (default) fires at one target; 'pulse' hits everything in range at once
 *              minRange  enemies closer than this can't be targeted (siege weapons)
 *              splash    radius of area damage where a projectile lands (0 = single target)
 *              slow      { factor, duration }: speed multiplier applied to enemies hit
 */
export const BUILDINGS = {
  townHall: {
    name: 'Town Hall',
    description: 'The heart of your town. If it falls, the game is over.',
    size: 3,
    maxHp: 2500,
    cost: 0,
    buildable: false,
    height: 2.2,
    attack: {
      range: 5,
      damage: 8,
      cooldown: 1.0,
      projectile: 'arrow',
      projectileSpeed: 16,
      splash: 0,
      arc: 0.5,
    },
  },
  wall: {
    name: 'Castle Wall',
    description: 'Cheap and sturdy. Enemies must walk around or smash through. Drag to build a line.',
    size: 1,
    maxHp: 400,
    cost: 10,
    buildable: true,
    hotkey: '1',
    height: 1.3,
  },
  archerTower: {
    name: 'Archer Tower',
    description: 'Fast, accurate single-target arrows.',
    size: 2,
    maxHp: 300,
    cost: 75,
    buildable: true,
    hotkey: '2',
    height: 2.2,
    attack: {
      range: 7,
      damage: 14,
      cooldown: 0.8,
      projectile: 'arrow',
      projectileSpeed: 18,
      splash: 0,
      arc: 0.4,
    },
  },
  cannonTower: {
    name: 'Cannon Tower',
    description: 'Slow, heavy shots that damage every enemy in the blast.',
    size: 2,
    maxHp: 500,
    cost: 150,
    buildable: true,
    hotkey: '3',
    height: 1.1,
    attack: {
      range: 6,
      damage: 40,
      cooldown: 2.2,
      projectile: 'cannonball',
      projectileSpeed: 9,
      splash: 1.6,
      arc: 2.0,
    },
  },
  magicSpire: {
    name: 'Magic Spire',
    description: 'Pulses arcane energy, damaging and slowing every enemy around it.',
    size: 2,
    maxHp: 350,
    cost: 125,
    buildable: true,
    hotkey: '4',
    height: 1.5,
    attack: {
      kind: 'pulse',
      range: 3.5,
      damage: 12,
      cooldown: 1.4,
      slow: { factor: 0.6, duration: 1.5 },
    },
  },
  catapult: {
    name: 'Catapult',
    description: 'Lobs boulders a long way for heavy area damage, but cannot hit enemies close by.',
    size: 2,
    maxHp: 300,
    cost: 180,
    buildable: true,
    hotkey: '5',
    height: 1.2,
    attack: {
      range: 10,
      minRange: 3,
      damage: 55,
      cooldown: 3.5,
      projectile: 'boulder',
      projectileSpeed: 8,
      splash: 1.8,
      arc: 4,
    },
  },
  gatehouse: {
    name: 'Gatehouse',
    description: "The fort's log gatehouse. While it stands, enemies can't get through: they must smash it or find another way in.",
    size: 2,
    maxHp: 1200,
    cost: 0,
    buildable: false, // only comes with the starting fort
    height: 2.5,
  },
};

/**
 * Enemy definitions: a human army that marches in squads.
 *  speed     tiles per second
 *  damage    per hit (or per shot) against buildings; siege engines hit far harder than men
 *  ranged    optional: { range, projectile, projectileSpeed, arc, prefer }. Ranged enemies stop and shoot a
 *            building within `range` (measured to its nearest edge) instead of walking up to it. `prefer`:
 *            'towers' (shoot the nearest tower, else whatever blocks their path) or 'breach' (shoot whatever
 *            blocks their path, else the nearest tower)
 *  siege     a siege engine (it can only damage buildings; drawn as a machine with its crew)
 *  threat    wave-budget cost per enemy; waves are filled with squads up to a threat budget
 *  weight    relative chance of a squad of this type being picked when filling a wave
 *  squad     [min, max] enemies per squad; `escort`: { type, count } that march with it
 *  plural    for the wave preview
 */
export const ENEMIES = {
  swordsman: {
    name: 'Swordsman',
    plural: 'Swordsmen',
    maxHp: 70,
    speed: 1.1,
    damage: 6,
    attackCooldown: 1.0,
    reward: 4,
    threat: 1,
    weight: 5,
    minWave: 1,
    height: 0.95,
    squad: [3, 5],
  },
  pikeman: {
    name: 'Pikeman',
    plural: 'Pikemen',
    maxHp: 100,
    speed: 0.95,
    damage: 5,
    attackCooldown: 1.1,
    reward: 5,
    threat: 1,
    weight: 3,
    minWave: 2,
    height: 0.95,
    squad: [3, 4],
  },
  archer: {
    name: 'Archer',
    plural: 'Archers',
    maxHp: 45,
    speed: 1.05,
    damage: 3,
    attackCooldown: 1.6,
    ranged: { range: 5, projectile: 'arrow', projectileSpeed: 14, arc: 0.6, prefer: 'towers' },
    reward: 4,
    threat: 1,
    weight: 3,
    minWave: 3,
    height: 0.9,
    squad: [3, 4],
  },
  ram: {
    name: 'Battering Ram',
    plural: 'Battering Rams',
    maxHp: 450,
    speed: 0.55,
    damage: 90,
    attackCooldown: 2.2,
    siege: true,
    reward: 18,
    threat: 6,
    weight: 1,
    minWave: 4,
    height: 1.1,
    squad: [1, 1],
    escort: { type: 'swordsman', count: 2 },
  },
  knight: {
    name: 'Knight',
    plural: 'Knights',
    maxHp: 240,
    speed: 0.9,
    damage: 12,
    attackCooldown: 1.3,
    reward: 12,
    threat: 4,
    weight: 1,
    minWave: 5,
    height: 1.1,
    squad: [1, 2],
  },
  mangonel: {
    name: 'Siege Catapult',
    plural: 'Siege Catapults',
    maxHp: 220,
    speed: 0.5,
    damage: 70,
    attackCooldown: 5,
    ranged: { range: 8, projectile: 'boulder', projectileSpeed: 7, arc: 3, prefer: 'breach' },
    siege: true,
    reward: 20,
    threat: 7,
    weight: 1,
    minWave: 6,
    height: 1.2,
    squad: [1, 1],
    escort: { type: 'pikeman', count: 2 },
  },
};

export const WAVES = {
  budgetBase: 4,
  budgetPerWave: 4,
  budgetQuadratic: 0.4,
  hpGrowthPerWave: 0.1, // +10% enemy HP per wave
  squadGap: [4, 1.5], // seconds between squads: wave 1, and the floor it shrinks to (−0.15 s per wave)
  memberGap: 0.25, // seconds between the men of one squad stepping out
  bossEvery: 5, // every Nth wave adds a squad of elite Knights (warlords)
  bossType: 'knight',
  bossHpMultiplier: 1.5,
};
