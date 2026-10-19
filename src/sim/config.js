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
  // Repairing a building to full costs this fraction of all it cost (build plus upgrades), scaled by the damage.
  repairCost: 0.4,
  hallRepairWorth: 400, // the Town Hall cost nothing to build; repairs reckon it at this
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
  // A way on from every ford: its band is cleared of woods and rock for at least `fordPath` tiles on each bank, and
  // on to open ground (at most `fordPathMax`).
  water: { streamChance: 0.8, lakeChance: 0.5, fords: [1, 2], fordWidth: 3, fordPath: 3, fordPathMax: 12 },
  // Coast: on this share of maps the sea lies along one edge (`depth` tiles of sea give or take `wobble`, then
  // `beach` tiles of sand). No enemies come from the sea.
  sea: { chance: 0.35, depth: [5, 7.5], wobble: 1.4, beach: [1.2, 2.4] },
  // Hills: on this share of maps, plateaus rise from a noise field (`scale`; level 1 above thresholds[0], level 2
  // above thresholds[1]), kept `flatMargin` tiles clear of the hall's clearing and `edgeFlat` of the map edge, no
  // smaller than `minPlateau` tiles, behind cliffs with 2-wide ramps (`ramps` per plateau, `rampSpacing` apart).
  // Each level is `levelHeight` high; towers gain `rangePerLevel` range per level up, and ramps slow enemies. Arrows
  // shot up at higher ground take `uphillReload` longer to reload per level up (+50%: two-thirds the rate of fire).
  hills: {
    chance: 0.6,
    scale: 0.085,
    thresholds: [0.56, 0.7],
    flatMargin: 2,
    edgeFlat: 3,
    minPlateau: 16,
    ramps: [1, 2],
    rampSpacing: 6,
    levelHeight: 0.85,
    rangePerLevel: 1,
    rampSpeed: 0.75,
    rampCost: 0.5,
    uphillReload: 0.5,
  },
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
  barracks: {
    name: 'Barracks',
    description: 'Trains soldiers in red who march out to meet the enemy near it and hold them up while your towers work.',
    size: 2,
    maxHp: 450,
    cost: 120,
    buildable: true,
    hotkey: '6',
    height: 1.4,
    // Trains one man every `every` seconds, in `roster` order, until `garrison` of its men are alive (see TROOPS).
    trains: { roster: ['swordsman', 'swordsman', 'archer'], garrison: 3, every: 8 },
    // Conquest: the men it adds to each wave's squad (CONQUEST.squad) and the extra health they march with.
    levy: { men: {}, hp: 0 },
  },
  flagFort: {
    name: 'Flag Fort',
    description: 'Conquest: a stockade round a flag you hold. Gives territory round it, pays gold, lets you have another Barracks, and the flag can\'t be taken while it stands.',
    size: 2,
    maxHp: 900,
    cost: 220,
    buildable: true,
    conquest: true, // Conquest only, and only on a flag you hold (see World.canPlace)
    hotkey: '7',
    height: 1.8,
    attack: {
      range: 6,
      damage: 12,
      cooldown: 1.2,
      projectile: 'arrow',
      projectileSpeed: 18,
      splash: 0,
      arc: 0.4,
    },
  },
  // Realm only (`realm: true`; see REALM and sim/realm/): guilds, whose heroes act on their own, and the smithy where
  // they buy their gear. A guild houses up to REALM.guildCap heroes of its class (REALM.classes), each hired for its cost.
  warriorsHall: {
    name: "Warriors' Hall",
    description: 'Realm: a guild of Men-at-arms. They defend the town, hunt raiders and raid lairs when they feel strong enough.',
    size: 2,
    maxHp: 600,
    cost: 80,
    buildable: true,
    realm: true,
    guild: 'manAtArms',
    hotkey: '7',
    height: 1.5,
  },
  rangersLodge: {
    name: "Rangers' Lodge",
    description: 'Realm: a lodge of Rangers. They explore the wilds, find the lairs and shoot beasts and outlaws from afar.',
    size: 2,
    maxHp: 320,
    cost: 70,
    buildable: true,
    realm: true,
    guild: 'ranger',
    hotkey: '8',
    height: 1.3,
  },
  roguesDen: {
    name: "Rogues' Den",
    description: 'Realm: a den of Rogues. Cheap, quick and greedy: first to any bounty, last to stand and fight, and they pay less tax.',
    size: 2,
    maxHp: 300,
    cost: 60,
    buildable: true,
    realm: true,
    guild: 'rogue',
    hotkey: '9',
    height: 1.2,
  },
  smithy: {
    name: 'Smithy',
    description: 'Realm: heroes buy better weapons and armour here with their own gold, and you take a tax on each sale. Forge a new tier to sell better gear.',
    size: 2,
    maxHp: 350,
    cost: 50,
    buildable: true,
    realm: true,
    shop: true,
    hotkey: '0',
    height: 1.3,
  },
  // Realm's lairs (see REALM.lairs): an outlaw camp in the wilds. Not built by anyone, and not on the grid.
  outlawCamp: {
    name: 'Outlaw Camp',
    description: 'A camp of outlaws in the wilds. Its men raid the town now and then, more often as it grows. Clear its guards and burn it down.',
    size: 2,
    maxHp: 420,
    cost: 0,
    buildable: false,
    realm: true,
    lair: true,
    height: 1.2,
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
 * Upgrades: every tower, wall and the Town Hall has five stages (after the reference's upgrade rows), the Barracks
 * three. `stages[type]` lists them from stage 1 (the building as built, BUILDINGS above) on; each later stage gives its upgrade `cost`
 * and only the stats it changes (`maxHp`, `height`, and `attack` fields), the rest carry on from the stage before.
 * No building may stand more than `aboveHall` stages above the Town Hall, so the hall's upgrades open the way.
 */
export const UPGRADES = {
  maxStage: 5,
  aboveHall: 1,
  stages: {
    townHall: [
      { name: 'Timber Hall' },
      { name: 'Stone Keep', height: 2.6, cost: 200, maxHp: 3200, attack: { damage: 11 } },
      { name: 'Fortified Keep', height: 2.7, cost: 350, maxHp: 4000, attack: { damage: 14, range: 5.5 } },
      { name: 'Castle', height: 2.9, cost: 550, maxHp: 5000, attack: { damage: 18 } },
      { name: 'Citadel', height: 3.3, cost: 800, maxHp: 6200, attack: { damage: 24, range: 6 } },
    ],
    wall: [
      { name: 'Wooden Palisade' },
      { name: 'Reinforced Palisade', cost: 8, maxHp: 600 },
      { name: 'Dry Stone Wall', height: 0.85, cost: 14, maxHp: 900 },
      { name: 'Stone Battlements', height: 1.3, cost: 22, maxHp: 1300 },
      { name: 'Citadel Wall', height: 1.6, cost: 34, maxHp: 1800 },
    ],
    archerTower: [
      { name: 'Watchtower' },
      { name: 'Guard Tower', cost: 60, maxHp: 380, attack: { damage: 18 } },
      { name: 'Stone Tower', height: 2.75, cost: 100, maxHp: 480, attack: { damage: 22, range: 7.5 } },
      { name: 'Arrow Keep', height: 2.8, cost: 150, maxHp: 600, attack: { damage: 28, cooldown: 0.7 } },
      { name: 'Royal Tower', height: 3.05, cost: 220, maxHp: 760, attack: { damage: 36, range: 8 } },
    ],
    cannonTower: [
      { name: 'Cannon Emplacement' },
      { name: 'Gun Platform', cost: 110, maxHp: 620, attack: { damage: 52 } },
      { name: 'Stone Battery', height: 1.25, cost: 170, maxHp: 760, attack: { damage: 64, range: 6.5, splash: 1.8 } },
      { name: 'Bombard Tower', height: 1.7, cost: 240, maxHp: 920, attack: { damage: 80, cooldown: 2.0 } },
      { name: 'Great Bastion', height: 1.4, cost: 320, maxHp: 1100, attack: { damage: 100, range: 7, splash: 2.1 } },
    ],
    magicSpire: [
      { name: 'Crystal Cairn' },
      { name: 'Rune Circle', cost: 90, maxHp: 430, attack: { damage: 15 } },
      { name: 'Mage Spire', height: 2.4, cost: 140, maxHp: 520, attack: { damage: 19, range: 4 } },
      { name: 'Arcane Tower', height: 2.7, cost: 200, maxHp: 620, attack: { damage: 24, slow: { factor: 0.5, duration: 1.8 } } },
      { name: 'Starfall Spire', height: 3.0, cost: 280, maxHp: 740, attack: { damage: 30, range: 4.5 } },
    ],
    // Barracks have three stages: more men (and in Conquest, bigger and tougher squads each wave).
    barracks: [
      { name: 'Barracks' },
      {
        name: 'Drill Yard',
        height: 1.5,
        cost: 140,
        maxHp: 600,
        trains: { roster: ['swordsman', 'swordsman', 'archer'], garrison: 4, every: 7 },
        levy: { men: { swordsman: 1, archer: 1 }, hp: 0.15 },
      },
      {
        name: 'Garrison Hall',
        height: 1.75,
        cost: 240,
        maxHp: 800,
        trains: { roster: ['swordsman', 'archer', 'knight'], garrison: 5, every: 6 },
        levy: { men: { swordsman: 2, archer: 1, knight: 1 }, hp: 0.3 },
      },
    ],
    catapult: [
      { name: 'Catapult' },
      { name: 'Reinforced Catapult', height: 1.4, cost: 130, maxHp: 370, attack: { damage: 70 } },
      { name: 'Mangonel', height: 1.65, cost: 200, maxHp: 450, attack: { damage: 88, range: 11 } },
      { name: 'Trebuchet', height: 1.65, cost: 280, maxHp: 540, attack: { damage: 110, splash: 2.1 } },
      { name: 'Great Trebuchet', height: 2.0, cost: 380, maxHp: 650, attack: { damage: 140, range: 12, cooldown: 3.1 } },
    ],
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
    speed: 0.88,
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
    speed: 0.76,
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
    speed: 0.84,
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
    speed: 0.44,
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
    speed: 0.72,
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
    speed: 0.4,
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

/**
 * The player's troops, trained at a Barracks (see `trains` there). They wear red; the enemy army wears blue. Each
 * Barracks has a post (its rally point, out from its door): its men go out to fight any enemy that comes within
 * `guardRadius` of the post, chase it no further than `leash` from it, and walk back when none are left, healing
 * `regen` health a second while they stand at the post. Enemy men stop to fight a soldier who comes within
 * `engage` of them (siege engines don't). Types use the enemy models of the same name, in red livery.
 *  reach     how close a man must be to strike (tiles)
 *  ranged    optional: { range, projectile, projectileSpeed, arc }: stops and shoots from up to `range`
 */
export const TROOPS = {
  guardRadius: 5,
  leash: 7,
  regen: 4,
  engage: 0.9,
  postDistance: 2, // tiles out from the Barracks' edge
  types: {
    swordsman: {
      name: 'Man-at-arms',
      plural: 'Men-at-arms',
      maxHp: 110,
      speed: 1.04,
      damage: 9,
      attackCooldown: 1.0,
      reach: 0.7,
      height: 0.95,
      reward: 6, // Conquest: gold to the other side when he falls
    },
    archer: {
      name: 'Bowman',
      plural: 'Bowmen',
      maxHp: 60,
      speed: 1.0,
      damage: 8,
      attackCooldown: 1.3,
      reach: 0.7,
      height: 0.9,
      reward: 5,
      ranged: { range: 4.5, projectile: 'arrow', projectileSpeed: 15, arc: 0.6 },
    },
    // Conquest only (they come in later waves; see CONQUEST.squad). Siege engines only attack buildings.
    knight: {
      name: 'Knight',
      plural: 'Knights',
      maxHp: 260,
      speed: 0.8,
      damage: 16,
      attackCooldown: 1.3,
      reach: 0.75,
      height: 1.1,
      reward: 14,
    },
    ram: {
      name: 'Battering Ram',
      plural: 'Battering Rams',
      maxHp: 480,
      speed: 0.48,
      damage: 80,
      attackCooldown: 2.2,
      reach: 0.8,
      height: 1.1,
      siege: true,
      reward: 20,
    },
    mangonel: {
      name: 'Siege Catapult',
      plural: 'Siege Catapults',
      maxHp: 220,
      speed: 0.44,
      damage: 65,
      attackCooldown: 5,
      reach: 0.8,
      height: 1.2,
      siege: true,
      reward: 20,
      ranged: { range: 8, projectile: 'boulder', projectileSpeed: 7, arc: 3 },
    },
  },
};

/**
 * Conquest: castle against castle on a long mirrored map (see sim/lanes.js and sim/conquest.js). Red (the player)
 * holds the south end, blue (the AI) the north; three lanes run between them. Both start with the same fort: the
 * Town Hall, a Barracks and two Archer Towers on each lane. Every `pushEvery` seconds (the "wave"; the first after
 * `firstPush`) each Barracks sends a squad down its lane (see `squad`), with `hpPerWave` more health each wave. Squads march to the enemy's Town
 * Hall, fighting enemy soldiers within `aggro` (chasing them up to `chase`) and enemy buildings near the lane, and
 * breaking through walls in their way. Win by destroying the enemy's Town Hall.
 *  territory    where a side may build: within `hall[stage - 1]` tiles of its Town Hall (growing as the hall goes up
 *               stages), and within `flag` of each of its Flag Forts (see `flags`)
 *  flags        three capturable flags in the middle of the map (sim/flags.js): a side takes one by having men (or its
 *               hero) within `radius` of it, alone, for `capture` seconds (a hero counts as `heroWorth` men; more men
 *               take it faster, up to `maxMen`); the other side must first bring it down to no one's, then take it.
 *               A flag held is only worth having with a Flag Fort built on it (BUILDINGS.flagFort): the fort gives
 *               territory round it, pays `income` gold a second, and locks the flag (it can't be taken while the
 *               fort stands)
 *  barracksCap  how many Barracks a side may have: `base`, plus `perFort` for each Flag Fort it owns
 *  income       gold a second to each side, besides bounties (a soldier's `reward`, `buildingBounty` a building)
 *  repairDelay  repairs can be made at any time, but not within this many seconds of a hit
 */
export const CONQUEST = {
  width: 72,
  height: 112,
  startingGold: 250,
  income: 1.5,
  buildingBounty: 40,
  firstPush: 25,
  pushEvery: 40,
  squad: {
    // Men: `base` of each, plus `per` × the waves since `from` (wave 1 unless given), up to `max` men in all.
    men: { swordsman: { base: 2, per: 1 / 3 }, archer: { base: 1, per: 1 / 4 }, knight: { base: 1, per: 1 / 4, from: 5 } },
    max: 8,
    // Siege engines (on top of the men): one in wave `from`, and every `every` waves after.
    siege: [
      { type: 'ram', from: 4, every: 3 },
      { type: 'mangonel', from: 7, every: 3 },
    ],
  },
  hpPerWave: 0.04,
  aggro: 4.5,
  chase: 7,
  territory: { hall: [12, 14, 16, 18, 20], flag: 7 },
  flags: { radius: 2.5, capture: 8, maxMen: 4, heroWorth: 3, income: 0.8 },
  barracksCap: { base: 3, perFort: 1 },
  repairDelay: 5,
  // Where each side's fort stands along each lane, as fractions of the lane's length from its own Town Hall.
  fort: { barracks: 0.1, towers: [0.17, 0.33] },
  // The AI: how often it thinks, the gold it keeps back, its Town Hall's stages (no sooner than `hallEvery` seconds
  // a stage), and its walls: across a lane once an enemy comes within `wallWhen` × the map's length of its hall,
  // `wallAt` of the way along the lane from it, with a gap of `wallGap` tiles in the middle.
  ai: { think: 2.5, reserve: 30, hallEvery: 120, wallWhen: 0.5, wallAt: 0.2, wallGap: 3 },
};

/**
 * Conquest heroes (sim/heroes.js): a champion each side, picked from `roster` (yours on the main menu, the AI's at
 * random), drawn as the crowned elite of its kind of soldier in its side's colours. Yours goes where you send it
 * (tap the ground) and fights whatever comes within `aggro` on the way and wherever it stands (chasing up to `leash`
 * from there), or attacks what you point it at. Blue's is the AI's: it follows its strongest squad and falls back to
 * its hall when hurt (below `retreatAt` of its health). Each hero has two `abilities` (see below), on Q and E.
 *  levels      XP needed for each level (level 1 at 0); each level adds `perLevel` of its base health and damage
 *  xpRange     a hero earns XP (the foe's gold reward) when a foe falls within this
 *  atHall      healing a second (fraction of its health) within `radius` of its own Town Hall
 *  respawn     seconds after it falls before it's back at its hall: `base` + `perLevel` × its level
 *  bounty      gold (and XP) to the other side when a hero falls
 */
export const HEROES = {
  roster: {
    knight: {
      title: 'Knight',
      type: 'knight',
      names: { red: 'Sir Aldric', blue: 'Lord Vane' },
      blurb: 'Heavy armour and a long sword: leads the charge and rallies the men round him.',
      stats: { maxHp: 650, speed: 1.16, damage: 26, attackCooldown: 1.0, reach: 0.8, height: 1.4 },
      abilities: ['warCry', 'charge'],
    },
    ranger: {
      title: 'Ranger',
      type: 'archer',
      names: { red: 'Mira', blue: 'Sable' },
      blurb: 'A longbow and light feet: strikes from afar and is gone before the enemy closes.',
      stats: { maxHp: 430, speed: 1.27, damage: 22, attackCooldown: 1.1, reach: 0.8, height: 1.3, ranged: { range: 6, projectile: 'arrow', projectileSpeed: 18, arc: 0.5 } },
      abilities: ['volley', 'fleetFoot'],
    },
    warden: {
      title: 'Warden',
      type: 'pikeman',
      names: { red: 'Captain Bram', blue: 'Captain Hask' },
      blurb: 'A great pike and a stout heart: holds the line and keeps the men about him alive.',
      stats: { maxHp: 820, speed: 1.04, damage: 20, attackCooldown: 1.1, reach: 1.1, height: 1.4 },
      abilities: ['shieldWall', 'rally'],
    },
  },
  default: 'knight',
  /**
   * What each ability does (and its `cooldown`, seconds):
   *  warCry      the hero and every ally within `radius` heal `heal` of their health and move and strike `haste`×
   *              as fast for `duration` s
   *  charge      at a foe within `range`: rushes it `haste`× as fast and strikes it for `damage`× (its next blow)
   *  volley      arrows on the foe it's fighting (or the nearest within `range`): `damage` to every foe within
   *              `radius` of it (bandits too)
   *  fleetFoot   the hero alone moves `haste`× as fast for `duration` s
   *  shieldWall  the hero and every ally within `radius` take `guard` less damage for `duration` s
   *  rally       the hero heals `heal` of its health
   */
  abilities: {
    warCry: { name: 'War Cry', radius: 4.5, heal: 0.25, haste: 1.35, duration: 6, cooldown: 30 },
    charge: { name: 'Charge', range: 6, haste: 3, duration: 1.5, damage: 3, cooldown: 18 },
    volley: { name: 'Volley', range: 7, radius: 2.2, damage: 70, cooldown: 16 },
    fleetFoot: { name: 'Fleet Foot', haste: 1.8, duration: 4, cooldown: 20 },
    shieldWall: { name: 'Shield Wall', radius: 4.5, guard: 0.5, duration: 6, cooldown: 28 },
    rally: { name: 'Rally', heal: 0.4, cooldown: 35 },
  },
  aggro: 5,
  leash: 6,
  levels: [0, 60, 150, 280, 450, 670, 950, 1300, 1720, 2200],
  perLevel: 0.12,
  xpRange: 7,
  atHall: { heal: 0.06, radius: 7 },
  respawn: { base: 20, perLevel: 4 },
  bounty: 120,
  retreatAt: 0.3,
};

/**
 * Conquest's neutral camps (sim/camps.js): bandits in grey in clearings in the woods, off the lanes. They keep to
 * their camp (chasing no further than `leash` from it, healing `regen` a second there) and fight anyone who comes
 * within `aggro` of it or strikes them; lane squads march past them, so it's heroes who clear them. Each is worth
 * `bounty` × his gold reward (and that in hero XP) to whichever side fells him. A cleared camp fills again after
 * `respawn` seconds, `growth` stronger for each minute of the battle.
 */
export const CAMPS = {
  guards: ['swordsman', 'swordsman', 'archer'],
  aggro: 3,
  leash: 6,
  regen: 12,
  bounty: 2.5,
  respawn: 90,
  growth: 0.05,
};

/**
 * Realm (sim/realm/): a kingdom in the wilds, after Majesty (see docs/research/). You don't command heroes: they act
 * on their own, by their class and traits, and you steer them with gold. Days (the build phase, `day` seconds;
 * `firstDay` before the first night) are for heroes and lairs; nights are Survival's waves against the walls.
 *  startingGold  the player's gold at the start (instead of ECONOMY.startingGold)
 *  guildCap      heroes each guild houses
 *  think         seconds between a hero's decisions (staggered)
 *  sight         how far a hero sees foes and lairs (tiles); also how far it explores the fog round it
 *  chunk         the fog of war is kept in chunks of this many tiles square; `startClear` tiles round the Town
 *                Hall start explored. Nothing can be built in a chunk no one has seen
 *  carryHome     a hero with this much gold heads home to pay tax and rest; `restBelow` of its health too
 *  heal          health a second (fraction of its most) while resting at home; `rest` seconds at least
 *  killGold      a foe's gold reward (ENEMIES / TROOPS `reward`) × this goes into the purse of the hero who fells it
 *  xp            XP a foe is worth: its reward × this. `levels`: XP needed for each level; each level adds
 *                `perLevel` of the class's base health and damage
 *  salesTax      share of each purchase that goes to the treasury (the rest is spent and gone)
 *  gear          the smithy's tiers: `cost` to forge (the player pays), `price` a hero pays, and the extra
 *                damage and health it gives (fractions of the class's base)
 *  bounty        flags: `base` gold when placed, `step` when topped up; an explore flag is claimed by the first
 *                hero within `reach` tiles of it; an attack bounty is shared by everyone who hurt the target
 *                (by damage), with at least `floor` of an equal share each. `seeAll`: heroes weigh flags this far
 *                away (tiles); a flag worth less than `tempt` to a hero (see bountyValue in realm/heroes.js) is ignored
 *  courage       a hero fights when its side's strength × its self-estimate beats the foes' × its enemy-estimate
 *                (strength = health × damage per second); allies within `group` tiles count with it
 *  traits        rolled at recruitment (`perHero` each): a name, words for the hero card, and what they change
 *  names         heroes' names, drawn in turn from a shuffled list
 *  classes       each class's guild building (BUILDINGS[…].guild), sprite `type` (TROOPS / ENEMIES models, in red),
 *                `cost`, `stats`, `greed` (1–26: how much a bounty's gold tempts it), `selfEst` / `enemyEst`
 *                (courage), `fleeAt` (share of health), `tax` (share of earnings paid at home), `likes` (bounty
 *                kinds it takes more readily) and `plan`: its ordered list of [activity, chance] (see heroes.js)
 *  lairs         `count` lairs per map, by its size; `minHall` / `minApart` tiles from the Town Hall / each
 *                other. Each has `guards` (refilled `refill` seconds after they all fall, until it's burnt), grows a
 *                level every `growEvery` seconds (up to `maxLevel`: `growth` more health a level), and every
 *                `raidEvery` seconds (less `raidFaster` a level) sends a raiding party of `raid` (+1 man per
 *                `raidPer` levels) at the nearest building. Burning it pays `loot` gold to the heroes there.
 */
export const REALM = {
  startingGold: 400,
  firstDay: 150,
  day: 110,
  guildCap: 4,
  think: 0.5,
  sight: 6.5,
  chunk: 4,
  startClear: 10,
  carryHome: 45,
  restBelow: 0.55,
  heal: 0.08,
  rest: 4,
  killGold: 1.5,
  xp: 2,
  levels: [0, 30, 80, 150, 240, 350, 480, 640, 830, 1050],
  perLevel: 0.15,
  salesTax: 0.6,
  gear: [
    { name: 'Iron', cost: 0, price: 0, damage: 0, hp: 0 },
    { name: 'Steel', cost: 40, price: 20, damage: 0.25, hp: 0.15 },
    { name: 'Fine steel', cost: 90, price: 45, damage: 0.5, hp: 0.3 },
    { name: 'Masterwork', cost: 160, price: 80, damage: 0.8, hp: 0.5 },
  ],
  bounty: { base: 25, step: 25, reach: 2, floor: 0.2, seeAll: 40, tempt: 8 },
  courage: { group: 3.5 },
  traits: {
    perHero: 1,
    list: {
      brave: { name: 'Brave', text: 'Stands against worse odds', selfEst: 1.25, fleeAt: -0.1 },
      craven: { name: 'Craven', text: 'Runs early from a fight', selfEst: 0.75, fleeAt: 0.15 },
      greedy: { name: 'Greedy', text: 'Bounties tempt them more', greed: 8 },
      frugal: { name: 'Frugal', text: 'Saves their gold; slow to buy gear', carry: 1.6 },
      tough: { name: 'Tough', text: 'More health', hp: 0.2 },
      quick: { name: 'Quick', text: 'Moves faster', speed: 0.15 },
      curious: { name: 'Curious', text: 'Loves to explore', explore: 1.5 },
      homebody: { name: 'Homebody', text: 'Never strays far from home', range: 0.6 },
    },
  },
  names: [
    'Aldric', 'Brenna', 'Cedric', 'Dunstan', 'Edith', 'Fenwick', 'Gwen', 'Hob', 'Isolde', 'Jory', 'Kester', 'Linnet',
    'Merrick', 'Nell', 'Osric', 'Piers', 'Rowan', 'Sabine', 'Tamsin', 'Ulric', 'Wynn', 'Yvaine', 'Godric', 'Maud',
  ],
  classes: {
    manAtArms: {
      name: 'Man-at-arms',
      plural: 'Men-at-arms',
      guild: 'warriorsHall',
      type: 'swordsman',
      cost: 45,
      stats: { maxHp: 150, speed: 0.95, damage: 10, attackCooldown: 1.0, reach: 0.7, height: 0.95 },
      greed: 12,
      selfEst: 1.0,
      enemyEst: 1.0,
      fleeAt: 0.3,
      tax: 0.4,
      likes: { attack: 1.4, explore: 0.7 },
      plan: [['defend', 0.95], ['hunt', 0.9], ['raid', 0.6], ['patrol', 0.6], ['explore', 0.25], ['home', 0.5]],
    },
    ranger: {
      name: 'Ranger',
      plural: 'Rangers',
      guild: 'rangersLodge',
      type: 'archer',
      cost: 35,
      stats: { maxHp: 90, speed: 1.15, damage: 9, attackCooldown: 1.2, reach: 0.7, height: 0.9, ranged: { range: 5, projectile: 'arrow', projectileSpeed: 15, arc: 0.6 } },
      greed: 6,
      selfEst: 1.0,
      enemyEst: 1.1,
      fleeAt: 0.35,
      tax: 0.4,
      likes: { explore: 2, attack: 0.9 },
      plan: [['explore', 0.95], ['hunt', 0.75], ['defend', 0.6], ['raid', 0.2], ['home', 0.15]],
    },
    rogue: {
      name: 'Rogue',
      plural: 'Rogues',
      guild: 'roguesDen',
      type: 'rogue',
      cost: 28,
      stats: { maxHp: 75, speed: 1.25, damage: 8, attackCooldown: 0.8, reach: 0.65, height: 0.9 },
      greed: 26,
      selfEst: 0.8,
      enemyEst: 1.25,
      fleeAt: 0.45,
      tax: 0.3,
      likes: { attack: 1, explore: 1.2 },
      plan: [['hunt', 0.55], ['explore', 0.3], ['defend', 0.3], ['raid', 0.15], ['home', 0.9]],
    },
  },
  lairs: {
    type: 'outlawCamp',
    count: { 40: 3, 52: 4, 64: 5 },
    minHall: 13,
    minApart: 10,
    guards: ['swordsman', 'swordsman', 'archer'],
    aggro: 3.5,
    leash: 6,
    refill: 70,
    growEvery: 200,
    maxLevel: 6,
    growth: 0.18,
    raidEvery: 130,
    raidFaster: 10,
    raid: ['swordsman', 'swordsman'],
    raidPer: 2,
    respawn: 240,
    loot: 60,
    lootPerLevel: 15,
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
