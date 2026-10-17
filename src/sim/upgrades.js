import { BUILDINGS, UPGRADES } from './config.js';

/**
 * Building stages (see UPGRADES in config.js). Pure: no DOM, no three.js.
 */

const cache = new Map();

/** How many stages `type` has: UPGRADES.maxStage for upgradeable buildings, else 1. */
export function stageCount(type) {
  return UPGRADES.stages[type]?.length ?? 1;
}

/**
 * The definition of `type` at `stage` (1-based): BUILDINGS[type] with each stage's changes laid over it in turn, plus
 * `stage`, `stageName` and `upgradeCost` (what the stage itself cost, 0 at stage 1). Cached, so callers can compare
 * definitions by identity.
 */
export function stageDef(type, stage = 1) {
  const key = `${type}:${stage}`;
  let def = cache.get(key);
  if (def) return def;
  const base = BUILDINGS[type];
  const stages = UPGRADES.stages[type] ?? [{ name: base.name }];
  def = { ...base, attack: base.attack && { ...base.attack } };
  for (let s = 1; s < Math.min(stage, stages.length); s++) {
    const { attack, ...rest } = stages[s];
    Object.assign(def, rest);
    if (attack) def.attack = { ...def.attack, ...attack };
  }
  def.stage = Math.min(stage, stages.length);
  def.stageName = stages[def.stage - 1].name;
  def.upgradeCost = def.stage > 1 ? stages[def.stage - 1].cost : 0;
  def.cost = base.cost; // the build cost; stage costs are `upgradeCost`
  def.name = base.name;
  def = Object.freeze(def);
  cache.set(key, def);
  return def;
}

/** The cost of upgrading a `type` from `stage` to the next, or null if it's at its last stage. */
export function nextUpgradeCost(type, stage) {
  const stages = UPGRADES.stages[type];
  return stages && stage < stages.length ? stages[stage].cost : null;
}
