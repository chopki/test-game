import { CONQUEST } from './config.js';

/**
 * Conquest's capturable flags (see CONQUEST.flags) and the territory they and the Town Halls give (where a side may
 * build, CONQUEST.territory). Pure: no DOM, no three.js. `world.flags` holds each flag: { x, z, lane, owner (null,
 * 'red' or 'blue'), hold (-1 blue's … 0 no one's … 1 red's) }.
 */

const SIGN = { red: 1, blue: -1 };

/** Each tick: men by a flag pull it towards their side; a flag that reaches a side is theirs (and pays). */
export function updateFlags(world, dt) {
  const { radius, capture, maxMen, heroWorth, income } = CONQUEST.flags;
  for (const f of world.flags) {
    const men = { red: 0, blue: 0 };
    for (const t of world.troops) {
      if (!t.alive || t.delay > 0 || !(t.team in men) || Math.hypot(t.x - f.x, t.z - f.z) > radius) continue;
      men[t.team] += t.hero ? heroWorth : 1;
    }
    const side = men.red && !men.blue ? 'red' : men.blue && !men.red ? 'blue' : null;
    f.contested = Boolean(men.red && men.blue);
    if (side) {
      const pull = (SIGN[side] * Math.min(men[side], maxMen) * dt) / (capture * maxMen * 0.5);
      const before = f.hold;
      f.hold = Math.max(-1, Math.min(1, f.hold + pull));
      if (f.owner && f.owner !== side && Math.sign(f.hold) !== SIGN[f.owner]) {
        // Brought down: no one's, until the other side finishes taking it.
        world.events.emit('flagLost', { flag: f, owner: f.owner });
        f.owner = null;
      }
      if (!f.owner && Math.abs(f.hold) >= 1 && Math.abs(before) < 1) {
        f.owner = side;
        world.events.emit('flagCaptured', { flag: f, team: side });
      }
    }
    if (f.owner) world.economyOf(f.owner).earn(income * dt, 'flag');
  }
}

/** Whether `team` may build at (x, z): within its Town Hall's reach (by its stage), or by a flag it holds. */
export function inTerritory(world, team, x, z) {
  const { hall: byStage, flag } = CONQUEST.territory;
  const hall = team === 'blue' ? world.enemyHall : world.townHall;
  if (world.buildings.get(hall.id) === hall && Math.hypot(hall.cx - x, hall.cz - z) <= byStage[hall.stage - 1]) return true;
  return world.flags.some((f) => f.owner === team && Math.hypot(f.x - x, f.z - z) <= flag);
}

/** The places that give `team` territory: { x, z, r } for its Town Hall and each flag it holds (for the HUD). */
export function territoryOf(world, team) {
  const { hall: byStage, flag } = CONQUEST.territory;
  const hall = team === 'blue' ? world.enemyHall : world.townHall;
  const out = world.buildings.get(hall.id) === hall ? [{ x: hall.cx, z: hall.cz, r: byStage[hall.stage - 1] }] : [];
  for (const f of world.flags) if (f.owner === team) out.push({ x: f.x, z: f.z, r: flag });
  return out;
}
