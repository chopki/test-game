import { BUILDINGS } from '../sim/config.js';

/**
 * How far to draw a tower off its footprint centre so it sits on the wall it's built into (no three.js; unit
 * tested in test/wallSeat.test.js).
 *
 * Walls are one tile thick and towers two, so a tower in a wall line covers the wall's row plus one more; drawn
 * at its footprint centre, the wall would run along one half of it. Shifting it half a tile towards the wall puts
 * the wall through its middle (a straight run), or the tower right on the junction (a corner).
 *
 * Returns { dx, dz } in tiles (0 or ±0.5). Looks only at walls touching the footprint from outside, so it gives
 * the same answer for the build preview (before the walls under it are replaced) as for the built tower.
 */
export function wallSeat(world, type, x, z) {
  const size = BUILDINGS[type].size;
  if (type === 'wall' || size % 2) return { dx: 0, dz: 0 }; // odd sizes already centre on a wall row
  const isWall = (tx, tz) => world.buildingAt(tx, tz)?.type === 'wall';
  const rows = new Set(); // rows where walls come in from the west or east
  const cols = new Set(); // columns where walls come in from the north or south
  for (let i = 0; i < size; i++) {
    if (isWall(x - 1, z + i) || isWall(x + size, z + i)) rows.add(z + i);
    if (isWall(x + i, z - 1) || isWall(x + i, z + size)) cols.add(x + i);
  }
  const centre = size / 2;
  // Only shift when the walls on that axis agree on one row (or column).
  const dz = rows.size === 1 ? [...rows][0] + 0.5 - (z + centre) : 0;
  const dx = cols.size === 1 ? [...cols][0] + 0.5 - (x + centre) : 0;
  return { dx, dz };
}
