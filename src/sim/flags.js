import { CONQUEST } from './config.js';

/**
 * Conquest's capturable flags (see CONQUEST.flags) and the territory the Town Halls and Flag Forts give (where a side
 * may build, CONQUEST.territory). Pure: no DOM, no three.js. `world.flags` holds each flag: { x, z, owner (null,
 * 'red' or 'blue'), hold (-1 blue's … 0 no one's … 1 red's), contested, fort (its Flag Fort's id, or null) }.
 */

/** The Flag Fort standing on `f`, or null. */
export const fortOf = (world, f) => (f.fort !== null && world.buildings.get(f.fort)) || null;

const SIGN = { red: 1, blue: -1 };

/** Each tick: men by a flag pull it towards their side; a flag that reaches a side is theirs (and pays). */
export function updateFlags(world, dt) {
  const { radius, capture, maxMen, heroWorth, income } = CONQUEST.flags;
  for (const f of world.flags) {
    if (f.fort !== null && !fortOf(world, f)) f.fort = null; // its fort has fallen: the flag can be taken again
    if (fortOf(world, f)) {
      // A fort holds its flag fast, and pays.
      f.contested = false;
      world.economyOf(f.owner).earn(income * dt, 'flag');
      continue;
    }
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
  }
}

/** Whether `team` may build at (x, z): within its Town Hall's reach (by its stage), or round one of its Flag Forts. */
export function inTerritory(world, team, x, z) {
  return territoryOf(world, team).some((t) => Math.hypot(t.x - x, t.z - z) <= t.r);
}

/** The places that give `team` territory: { x, z, r } for its Town Hall and each of its Flag Forts. */
export function territoryOf(world, team) {
  const { hall: byStage, flag } = CONQUEST.territory;
  const hall = team === 'blue' ? world.enemyHall : world.townHall;
  const out = world.buildings.get(hall.id) === hall ? [{ x: hall.cx, z: hall.cz, r: byStage[hall.stage - 1] }] : [];
  for (const f of world.flags) if (f.owner === team && fortOf(world, f)) out.push({ x: f.x, z: f.z, r: flag });
  return out;
}

/** How many Barracks `team` may have: CONQUEST.barracksCap's base, plus one a Flag Fort. */
export function barracksCap(world, team) {
  const { base, perFort } = CONQUEST.barracksCap;
  return base + perFort * world.flags.filter((f) => f.owner === team && fortOf(world, f)).length;
}

/** The flag a Flag Fort for `team` would stand on with its top-left tile at (x, z): one it holds, unfortified. */
export function flagForFort(world, team, x, z) {
  return world.flags.find((f) => f.x === x + 1 && f.z === z + 1 && f.owner === team && !fortOf(world, f)) ?? null;
}
