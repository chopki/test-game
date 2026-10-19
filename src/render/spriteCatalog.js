import * as THREE from 'three';
import { BUILDINGS, CAMPS, ENEMIES, HEROES, REALM, TROOPS, UPGRADES, WAVES } from '../sim/config.js';
import { wavingPennant, withoutPennantCloth, withTeam } from './modelKit.js';
import { ANIMAL_KINDS, ANIMAL_POSES, createAnimal } from './animals.js';
import { createWallDecor, WALL_DECOR_KINDS } from './wallDecor.js';
import { createStagedModel, createStagedWallArm, STAGE_WALL_VARIANTS } from './stageModels.js';
import { BRIDGE_PARTS, CLIFF_PROFILES, CLIFF_VARIANTS, createBridgePiece, createCliffPiece, createBuildingModel, createFlagpole, createEnemyModel, createSceneryObject, createWallArm, ENEMY_ANIMS, IN_WALL_RADIUS, IN_WALL_TYPES, poseEnemy, SCENERY_TYPES, SCENERY_VARIANTS, WALL_VARIANTS } from './models.js';

export { ENEMY_ANIMS };

// Which sprites to bake, and how the renderer names them. Everything the battlefield shows (except
// projectiles and effects) is drawn from these.

export const TURRET_DIRECTIONS = 16;
export const ENEMY_DIRECTIONS = 8;
export const CATAPULT_ARM_FRAMES = 4; // 0 = just thrown … 3 = wound back and loaded
/** Frames of a waving pennant's ripple. */
export const FLAG_FRAMES = 6;

const WALL_DIRS = ['n', 'e', 's', 'w'];
/** All 16 wall connection keys, in the renderer's 'nesw' / '-' format. */
export const WALL_KEYS = Array.from({ length: 16 }, (_, mask) => WALL_DIRS.map((d, i) => (mask & (1 << i) ? d : '-')).join(''));

const angleIndex = (angle, steps) => ((Math.round((angle / (Math.PI * 2)) * steps) % steps) + steps) % steps;

/** The suffix stage-2+ sprites carry (stage 1 keeps the plain key). */
const st = (stage) => (stage > 1 ? `:s${stage}` : '');

export const spriteKeys = {
  /** A building's base at its upgrade `stage` (see stageModels.js). */
  building: (type, stage = 1) => `b:${type}${st(stage)}`,
  /**
   * A tower's base when built into a wall (`shape`: see IN_WALL_SHAPES in models.js): the bastion alone, the same
   * for every shape (the wall arms are sprites of their own), except that the gatehouse turns for north–south walls.
   * From stage 3 a tower's stone model stands on the wall by itself: its normal sprite.
   */
  inWall: (type, shape, stage = 1) => (stage >= 3 ? spriteKeys.building(type, stage) : type === 'gatehouse' && shape.startsWith('ns') ? `bw:${type}:ns` : `bw:${type}${st(stage)}`),
  /** A piece of a ford's footbridge ('mid', 'start' or 'end') running along `axis` ('x' or 'z'). */
  bridge: (part, axis) => `bridge:${axis}:${part}`,
  /** A wild animal (see animals.js) facing `heading`, in `pose`. */
  animal: (kind, heading, pose) => `a:${kind}:${angleIndex(heading, ENEMY_DIRECTIONS)}:${pose}`,
  /** A frame of a waving pennant cloth; `turn` 1 for one turned a quarter (see PENNANTS in models.js). */
  flag: (turn, frame) => `flag:${turn}:${frame}`,
  /** One wall arm of an in-wall tower (see createWallArm in models.js), at the stage of the wall it joins. */
  wallArm: (dir, from, straight, stage = 1) => `arm:${dir}:${from}:${straight ? 'run' : 'end'}${st(stage)}`,
  icon: (type, stage = 1) => `icon:${type}${st(stage)}`,
  /** A decoration on a straight wall: `axis` 'x' for an east–west wall, 'z' for north–south. */
  wallDecor: (kind, axis) => `decor:${kind}:${axis}`,
  /** A wall tile: its connection key, which of its stage's versions (STAGE_WALL_VARIANTS), and its stage. */
  wall: (connectionKey, variant = 0, stage = 1) => `wall:${connectionKey}:${variant}${st(stage)}`,
  /** The piece that ties a wall into a building's edge tile; `dir` points from the building to the wall. */
  wallJoint: (dir, stage = 1) => `join:${dir}${st(stage)}`,
  turret: (type, aim, frame = 0) => `t:${type}:${angleIndex(aim, TURRET_DIRECTIONS)}:${frame}`,
  crystal: () => 'crystal',
  /** A man's (or engine's) frame: `anim` is 'walk', 'attack' or 'death' (see ENEMY_ANIMS); `team` 'red' for the player's troops. */
  enemy: (type, heading, elite = false, anim = 'walk', frame = 0, team = 'blue') =>
    `e:${team === 'blue' ? '' : `${team}:`}${type}:${elite ? 'elite:' : ''}${angleIndex(heading, ENEMY_DIRECTIONS)}:${anim}:${frame}`,
  scenery: (kind, variant) => `s:${kind}:${variant}`,
  /** Conquest's capturable flag's pole (its cloth is a flag sprite). */
  flagpole: () => 's:flagpole:0',
  /** A tile's length of cliff face (see createCliffPiece), facing 's' (+z) or 'e' (+x). */
  cliff: (face, profile, variant) => `cliff:${face}:${profile}:${variant}`,
};

/** Height of a building's turret pivot above the ground (sprites are lifted by this much); `inWall`: a shape. */
export const turretHeight = (type, inWall, stage = 1) =>
  createStagedModel(type, stage, inWall ? { inWall } : undefined).userData.turret?.position.y ?? 0;
const crystalY = {};
/** Height of the Magic Spire's floating crystal above the ground at `stage`. */
export const crystalHeight = (stage = 1) => (crystalY[stage] ??= createStagedModel('magicSpire', stage).userData.crystal.position.y);

/** Which buildings have separately animated parts (and so extra sprites). */
const BUILDING_PARTS = {
  archerTower: { turret: true, occluded: true }, // the lookouts are partly hidden by the cabin and its roof
  cannonTower: { turret: true },
  catapult: { turret: true, arm: true },
  magicSpire: { crystal: true },
};

/** Options every bake uses (runtime and scripts/bake-sprites.mjs). */
export const BAKE_OPTIONS = { pxPerUnit: 72, supersample: 2 };

/**
 * The two pre-baked sprite sets. Phones use 'standard': even zoomed right in they show fewer screen pixels per
 * tile than it has. Desktops use 'hd', where zooming in would otherwise stretch the sprites: buildings, walls,
 * towers, scenery and icons at twice the resolution (enemies and catapult frames, which set their own resolution,
 * stay as they are, since they're small and always moving).
 */
export const SPRITE_SETS = {
  standard: { dir: 'sprites/', options: BAKE_OPTIONS },
  hd: { dir: 'sprites-hd/', options: { pxPerUnit: 144, supersample: 1.5 } },
};
/** Men and engines are small and always moving, so they're baked at a lower resolution (there are ~1000 frames). */
const ENEMY_PX_PER_UNIT = 56;

/** Pose the catapult arm for a reload frame. */
function poseArm(userData, frame) {
  const t = frame / (CATAPULT_ARM_FRAMES - 1); // 0 thrown → 1 loaded
  userData.arm.rotation.x = 1.9 + (-0.35 - 1.9) * t;
  userData.ammo.visible = frame === CATAPULT_ARM_FRAMES - 1;
}

/**
 * The full list of { key, make, shadow } to bake. `make()` builds the posed model; it's only called when
 * baking, so listing the keys (e.g. to check a pre-baked atlas is complete) is cheap.
 */
export function spriteSpecs() {
  const specs = [];
  const buildingTypes = Object.keys(BUILDINGS);

  for (const type of buildingTypes) {
    // UI portrait: the complete model.
    specs.push({ key: spriteKeys.icon(type), make: () => createBuildingModel(type), shadow: false });
    if (type === 'wall') continue;
    // Battlefield base: everything except the parts that move, which get sprites of their own.
    specs.push({
      key: spriteKeys.building(type),
      make: () => {
        const base = createBuildingModel(type);
        base.userData.turret?.removeFromParent();
        base.userData.crystal?.removeFromParent();
        return base;
      },
    });

    // The same base built into a wall: its bastion, without the wall arms (drawn separately, see below).
    if (IN_WALL_TYPES.includes(type)) {
      for (const shape of type === 'gatehouse' ? ['we', 'ns'] : ['we']) {
        specs.push({
          key: spriteKeys.inWall(type, shape),
          make: () => {
            const base = createBuildingModel(type, { inWall: shape, stubs: false });
            base.userData.turret?.removeFromParent();
            base.userData.crystal?.removeFromParent();
            return base;
          },
        });
      }
    }

    const parts = BUILDING_PARTS[type] ?? {};
    if (parts.turret) {
      const frames = parts.arm ? CATAPULT_ARM_FRAMES : 1;
      for (let d = 0; d < TURRET_DIRECTIONS; d++) {
        const angle = (d / TURRET_DIRECTIONS) * Math.PI * 2;
        for (let f = 0; f < frames; f++) {
          specs.push({
            key: spriteKeys.turret(type, angle, f),
            shadow: false,
            // The catapult has 64 aim × reload frames; a little lower resolution keeps them compact.
            pxPerUnit: parts.arm ? 60 : undefined,
            make: () => {
              const m = createBuildingModel(type);
              const turret = m.userData.turret;
              const pivot = turret.position.y;
              turret.removeFromParent();
              turret.position.set(0, 0, 0);
              turret.rotation.y = angle;
              if (m.userData.arm) poseArm(m.userData, f);
              if (!parts.occluded) return turret;
              // The rest of the building, invisible, in place round the turret: it masks what it would hide.
              const g = new THREE.Group();
              m.position.y = -pivot;
              m.userData.occluder = true;
              g.add(m, turret);
              return g;
            },
          });
        }
      }
    }
    if (parts.crystal) {
      specs.push({
        key: spriteKeys.crystal(),
        shadow: false,
        make: () => {
          const crystal = createBuildingModel(type).userData.crystal;
          crystal.removeFromParent();
          crystal.position.set(0, 0, 0);
          return crystal;
        },
      });
    }
  }

  for (const dir of WALL_DIRS) specs.push({ key: spriteKeys.wallJoint(dir), make: () => createBuildingModel('wallJoint', { dir }) });
  // Wall decorations, for walls running either way (always on the side the camera sees: +z, or +x once turned).
  for (const kind of WALL_DECOR_KINDS) {
    for (const axis of ['x', 'z']) {
      specs.push({
        key: spriteKeys.wallDecor(kind, axis),
        make: () => {
          const d = createWallDecor(kind);
          if (axis === 'z') d.rotation.y = Math.PI / 2;
          return d;
        },
      });
    }
  }

  for (const key of WALL_KEYS) {
    const connections = Object.fromEntries(WALL_DIRS.map((d, i) => [d, key[i] === d]));
    for (let v = 0; v < WALL_VARIANTS; v++) {
      specs.push({ key: spriteKeys.wall(key, v), make: () => createBuildingModel('wall', { connections, variant: v }) });
    }
  }

  // The enemy army in blue; the player's troops (the same men) in red; Conquest's bandits in grey. Elites (crowned,
  // 1.3× size): the enemy's warlords (Survival) and both sides' heroes (Conquest), one for each kind of hero.
  const heroTypes = new Set(Object.values(HEROES.roster).map((h) => h.type));
  const units = [
    ...Object.keys(ENEMIES).map((type) => ({ type, team: 'blue', elites: type === WAVES.bossType || heroTypes.has(type) ? [false, true] : [false] })),
    ...Object.keys(TROOPS.types).map((type) => ({ type, team: 'red', elites: heroTypes.has(type) ? [false, true] : [false] })),
    ...[...heroTypes].filter((type) => !TROOPS.types[type]).map((type) => ({ type, team: 'red', elites: [true] })),
    ...CAMPS.guards.filter((t, i, all) => all.indexOf(t) === i).map((type) => ({ type, team: 'neutral', elites: [false] })),
  ];
  // Realm's heroes: crowned men in red, one for each class (those not already baked as red elites above).
  for (const type of new Set(Object.values(REALM.classes).map((c) => c.type))) {
    const red = units.find((u) => u.type === type && u.team === 'red');
    if (!red) units.push({ type, team: 'red', elites: [true] });
    else if (!red.elites.includes(true)) red.elites.push(true);
  }
  // Realm's outlaws (lair guards and raiders) in grey.
  for (const type of new Set([...REALM.lairs.guards, ...REALM.lairs.raid])) {
    if (!units.some((u) => u.type === type && u.team === 'neutral')) units.push({ type, team: 'neutral', elites: [false] });
  }
  for (const { type, team, elites } of units) {
    for (const elite of elites) {
      for (let d = 0; d < ENEMY_DIRECTIONS; d++) {
        const heading = (d / ENEMY_DIRECTIONS) * Math.PI * 2;
        for (const [anim, frames] of Object.entries(ENEMY_ANIMS)) {
          for (let f = 0; f < frames; f++) {
            specs.push({
              key: spriteKeys.enemy(type, heading, elite, anim, f, team),
              shadow: false,
              // Elites are drawn 1.3× bigger; this keeps their frames the same size in pixels.
              pxPerUnit: elite ? ENEMY_PX_PER_UNIT / 1.3 : ENEMY_PX_PER_UNIT,
              make: () => {
                const m = poseEnemy(createEnemyModel(type, elite, team), anim, f);
                m.rotation.y = heading;
                return m;
              },
            });
          }
        }
      }
    }
  }

  // Wall arms for towers built into walls: each direction, for each bastion size, straight-run or corner length.
  for (const from of new Set(Object.values(IN_WALL_RADIUS))) {
    for (const dir of ['n', 'e', 's', 'w']) {
      for (const straight of [true, false]) specs.push({ key: spriteKeys.wallArm(dir, from, straight), make: () => createWallArm(dir, from, straight) });
    }
  }

  for (const kind of ANIMAL_KINDS) {
    for (let d = 0; d < ENEMY_DIRECTIONS; d++) {
      const heading = (d / ENEMY_DIRECTIONS) * Math.PI * 2;
      for (const pose of ANIMAL_POSES) {
        specs.push({
          key: spriteKeys.animal(kind, heading, pose),
          shadow: false,
          pxPerUnit: ENEMY_PX_PER_UNIT,
          make: () => {
            const m = createAnimal(kind, pose);
            m.rotation.y = heading;
            return m;
          },
        });
      }
    }
  }

  for (const axis of ['x', 'z']) {
    for (const part of BRIDGE_PARTS) specs.push({ key: spriteKeys.bridge(part, axis), make: () => createBridgePiece(part, axis) });
  }

  for (const kind of SCENERY_TYPES) {
    for (let v = 0; v < SCENERY_VARIANTS; v++) specs.push({ key: spriteKeys.scenery(kind, v), make: () => createSceneryObject(kind, v) });
  }
  specs.push({ key: spriteKeys.flagpole(), make: () => createFlagpole() });
  // Cliff faces on the hills, for the two sides the camera sees.
  for (const face of ['s', 'e']) {
    for (const profile of CLIFF_PROFILES) {
      for (let v = 0; v < CLIFF_VARIANTS[profile]; v++) {
        specs.push({
          key: spriteKeys.cliff(face, profile, v),
          make: () => {
            const m = createCliffPiece(profile, v);
            if (face === 'e') m.rotation.y = Math.PI / 2;
            return m;
          },
        });
      }
    }
  }
  // Upgrade stages 2 to 5 (stageModels.js): portraits and bases, stage-2 in-wall bastions, and the wall pieces.
  const withoutMoving = (m) => {
    m.userData.turret?.removeFromParent();
    m.userData.crystal?.removeFromParent();
    return m;
  };
  for (const type of Object.keys(UPGRADES.stages)) {
    for (let stage = 2; stage <= UPGRADES.stages[type].length; stage++) {
      const opts = type === 'wall' ? {} : undefined;
      specs.push({ key: spriteKeys.icon(type, stage), make: () => createStagedModel(type, stage, opts), shadow: false });
      if (type === 'wall') continue;
      specs.push({ key: spriteKeys.building(type, stage), make: () => withoutMoving(createStagedModel(type, stage)) });
      if (stage === 2 && IN_WALL_TYPES.includes(type)) {
        specs.push({ key: spriteKeys.inWall(type, 'we', stage), make: () => withoutMoving(createStagedModel(type, stage, { inWall: 'we', stubs: false })) });
      }
    }
  }
  for (let stage = 2; stage <= UPGRADES.stages.wall.length; stage++) {
    for (const key of WALL_KEYS) {
      const connections = Object.fromEntries(WALL_DIRS.map((d, i) => [d, key[i] === d]));
      for (let v = 0; v < STAGE_WALL_VARIANTS[stage - 1]; v++) specs.push({ key: spriteKeys.wall(key, v, stage), make: () => createStagedModel('wall', stage, { connections, variant: v }) });
    }
    for (const dir of WALL_DIRS) specs.push({ key: spriteKeys.wallJoint(dir, stage), make: () => createStagedModel('wallJoint', stage, { dir }) });
    for (const from of new Set(Object.values(IN_WALL_RADIUS))) {
      for (const dir of WALL_DIRS) for (const straight of [true, false]) specs.push({ key: spriteKeys.wallArm(dir, from, straight, stage), make: () => createStagedWallArm(dir, from, straight, stage) });
    }
  }

  // Waving pennant cloths (left out of every battlefield sprite; UI portraits keep theirs): FLAG_FRAMES frames of
  // the ripple, for cloths flying along x and turned a quarter.
  for (const s of specs) {
    if (s.key.startsWith('icon:')) continue;
    const make = s.make;
    s.make = () => withoutPennantCloth(make);
  }
  for (const turn of [0, 1]) {
    for (let f = 0; f < FLAG_FRAMES; f++) {
      specs.push({ key: spriteKeys.flag(turn, f), shadow: false, make: () => wavingPennant(f / FLAG_FRAMES, turn ? Math.PI / 2 : 0) });
    }
  }

  // The enemy castle's buildings in blue (banners, pennants, lookouts), for the types it starts with and builds;
  // and pale pennants for Conquest's flags while no one holds them.
  for (const s of specs.filter((s) => BLUE_KEY.test(s.key))) {
    const make = s.make;
    specs.push({ ...s, key: teamKey(s.key, 'blue'), make: () => withTeam('blue', make) });
    if (s.key.startsWith('flag:')) specs.push({ ...s, key: teamKey(s.key, 'neutral'), make: () => withTeam('neutral', make) });
  }
  return specs;
}

/**
 * Sprites with a blue version (see teamKey): the bases (every stage, as the AI upgrades) and lookouts of the
 * buildings the enemy castle has and builds, and pennants.
 */
const BLUE_KEY = /^(b:(townHall|archerTower|barracks|flagFort)(:s[2-5])?|t:archerTower:\d+:0|flag:\d:\d+)$/;

/** The key of `key`'s version in `team`'s colours: blue for the enemy castle, neutral pale, else the key itself (red). */
export const teamKey = (key, team) => (team === 'blue' || team === 'neutral' ? `${key}:${team}` : key);

