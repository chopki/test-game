// All gameplay tuning lives here. The simulation reads these tables; nothing
// else should hard-code balance numbers. Adding a new building or enemy is
// (mostly) a matter of adding an entry below and a model in render/models.js.

export const GRID = {
  width: 40,
  height: 40,
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
 *  attack    optional; any building with an attack acts as a tower
 */
export const BUILDINGS = {
  townHall: {
    name: 'Town Hall',
    description: 'The heart of your town. If it falls, the game is over.',
    size: 3,
    maxHp: 2500,
    cost: 0,
    buildable: false,
    height: 3.2,
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
    height: 2.8,
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
    height: 1.6,
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
};

/**
 * Enemy definitions.
 *  speed     tiles per second
 *  damage    per hit against buildings
 *  threat    wave-budget cost; waves are filled up to a threat budget
 *  weight    relative chance of being picked when filling a wave
 */
export const ENEMIES = {
  grunt: {
    name: 'Raider',
    maxHp: 60,
    speed: 1.6,
    damage: 8,
    attackCooldown: 1.0,
    reward: 4,
    threat: 1,
    weight: 5,
    minWave: 1,
    height: 1.1,
  },
  runner: {
    name: 'Scout',
    maxHp: 35,
    speed: 3.0,
    damage: 6,
    attackCooldown: 0.7,
    reward: 3,
    threat: 1,
    weight: 3,
    minWave: 2,
    height: 0.9,
  },
  brute: {
    name: 'Ogre',
    maxHp: 320,
    speed: 0.9,
    damage: 45,
    attackCooldown: 1.6,
    reward: 15,
    threat: 5,
    weight: 1,
    minWave: 4,
    height: 1.6,
  },
};

export const WAVES = {
  budgetBase: 4,
  budgetPerWave: 4,
  budgetQuadratic: 0.4,
  hpGrowthPerWave: 0.1, // +10% enemy HP per wave
  bossEvery: 5, // every Nth wave adds elite Ogres
  bossHpMultiplier: 1.5,
};
