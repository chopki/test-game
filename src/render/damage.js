/**
 * How battered a building or wall looks (no three.js; unit tested in test/damage.test.js). Three stages by health,
 * so the look changes in steps (not every hit): 0 = sound (above 2/3), 1 = damaged (cracks and scorching),
 * 2 = badly damaged (below 1/3: pieces knocked out, smoke and small fires). Repairs put a building back up the stages.
 */
export const DAMAGE_STAGES = [2 / 3, 1 / 3];

export function damageStage(hp, maxHp) {
  const f = hp / maxHp;
  return f > DAMAGE_STAGES[0] ? 0 : f > DAMAGE_STAGES[1] ? 1 : 2;
}

/** The value the sprite shader takes for a stage (0 sound, 0.5 damaged, 1 badly damaged). */
export const damageAmount = (stage) => stage / 2;
