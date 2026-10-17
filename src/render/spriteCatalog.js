import { BUILDINGS, ENEMIES } from '../sim/config.js';
import { createBuildingModel, createEnemyModel, createSceneryObject, ENEMY_ANIMS, IN_WALL_SHAPES, poseEnemy, SCENERY_TYPES, SCENERY_VARIANTS, WALL_VARIANTS } from './models.js';

export { ENEMY_ANIMS };

// Which sprites to bake, and how the renderer names them. Everything the battlefield shows (except
// projectiles and effects) is drawn from these.

export const TURRET_DIRECTIONS = 16;
export const ENEMY_DIRECTIONS = 8;
export const CATAPULT_ARM_FRAMES = 4; // 0 = just thrown … 3 = wound back and loaded

const WALL_DIRS = ['n', 'e', 's', 'w'];
/** All 16 wall connection keys, in the renderer's 'nesw' / '-' format. */
export const WALL_KEYS = Array.from({ length: 16 }, (_, mask) => WALL_DIRS.map((d, i) => (mask & (1 << i) ? d : '-')).join(''));

const angleIndex = (angle, steps) => ((Math.round((angle / (Math.PI * 2)) * steps) % steps) + steps) % steps;

export const spriteKeys = {
  building: (type) => `b:${type}`,
  /** A tower's base when built into a wall (`shape`: see IN_WALL_SHAPES in models.js). */
  inWall: (type, shape) => `bw:${type}:${shape}`,
  icon: (type) => `icon:${type}`,
  /** A wall tile: its connection key, and which of the WALL_VARIANTS versions. */
  wall: (connectionKey, variant = 0) => `wall:${connectionKey}:${variant}`,
  /** The piece that ties a wall into a building's edge tile; `dir` points from the building to the wall. */
  wallJoint: (dir) => `join:${dir}`,
  turret: (type, aim, frame = 0) => `t:${type}:${angleIndex(aim, TURRET_DIRECTIONS)}:${frame}`,
  crystal: () => 'crystal',
  /** An enemy frame: `anim` is 'walk', 'attack' or 'death' (see ENEMY_ANIMS). */
  enemy: (type, heading, elite = false, anim = 'walk', frame = 0) =>
    `e:${type}:${elite ? 'elite:' : ''}${angleIndex(heading, ENEMY_DIRECTIONS)}:${anim}:${frame}`,
  scenery: (kind, variant) => `s:${kind}:${variant}`,
};

/** Height of a building's turret pivot above the ground (sprites are lifted by this much); `inWall`: a shape. */
export const turretHeight = (type, inWall) =>
  createBuildingModel(type, inWall ? { inWall } : undefined).userData.turret?.position.y ?? 0;
let crystalY = null;
/** Height of the Magic Spire's floating crystal above the ground. */
export const crystalHeight = () => (crystalY ??= createBuildingModel('magicSpire').userData.crystal.position.y);

/** Which buildings have separately animated parts (and so extra sprites). */
const BUILDING_PARTS = {
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
/** Enemies are small and always moving, so they're baked at a lower resolution (there are ~560 frames). */
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

    // The same base built into a wall, for each wall shape.
    if (BUILDINGS[type].buildable) {
      for (const shape of IN_WALL_SHAPES) {
        specs.push({
          key: spriteKeys.inWall(type, shape),
          make: () => {
            const base = createBuildingModel(type, { inWall: shape });
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
              turret.removeFromParent();
              turret.position.set(0, 0, 0);
              turret.rotation.y = angle;
              if (m.userData.arm) poseArm(m.userData, f);
              return turret;
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

  for (const key of WALL_KEYS) {
    const connections = Object.fromEntries(WALL_DIRS.map((d, i) => [d, key[i] === d]));
    for (let v = 0; v < WALL_VARIANTS; v++) {
      specs.push({ key: spriteKeys.wall(key, v), make: () => createBuildingModel('wall', { connections, variant: v }) });
    }
  }

  for (const type of Object.keys(ENEMIES)) {
    const variants = type === 'brute' ? [false, true] : [false];
    for (const elite of variants) {
      for (let d = 0; d < ENEMY_DIRECTIONS; d++) {
        const heading = (d / ENEMY_DIRECTIONS) * Math.PI * 2;
        for (const [anim, frames] of Object.entries(ENEMY_ANIMS)) {
          for (let f = 0; f < frames; f++) {
            specs.push({
              key: spriteKeys.enemy(type, heading, elite, anim, f),
              shadow: false,
              // Elites are drawn 1.3× bigger; this keeps their frames the same size in pixels.
              pxPerUnit: elite ? ENEMY_PX_PER_UNIT / 1.3 : ENEMY_PX_PER_UNIT,
              make: () => {
                const m = poseEnemy(createEnemyModel(type, elite), anim, f);
                m.rotation.y = heading;
                return m;
              },
            });
          }
        }
      }
    }
  }

  for (const kind of SCENERY_TYPES) {
    for (let v = 0; v < SCENERY_VARIANTS; v++) specs.push({ key: spriteKeys.scenery(kind, v), make: () => createSceneryObject(kind, v) });
  }
  return specs;
}
