import { BUILDINGS } from '../sim/config.js';

/**
 * Whether a tower sits in a wall, and how to draw it there (no three.js; unit tested in test/wallSeat.test.js).
 *
 * Walls are one tile thick and towers two, so a tower in a wall line covers the wall's row plus one more. When the
 * walls touching it form one of the shapes that have their own in-wall model (see IN_WALL_SHAPES in models.js),
 * the tower is drawn with that model, half a tile off its footprint centre, so the wall runs through it:
 *  - a straight run ('we' or 'ns'): one wall comes in on each of two opposite sides, on the same row/column;
 *  - a corner (e.g. 'ws'): one wall comes in on a west/east side and one on a north/south side; the tower is
 *    drawn centred on the corner tile. (Its model's stubs reach 1.5 tiles; where an arm is shorter they overlap
 *    the next wall tile's logs exactly, as both use the same log grid.)
 * Anything else (no walls, a wall alongside, a T-junction…) returns shape null: the normal model, with joints.
 *
 * Returns { shape, dx, dz }, with dx/dz in tiles (0 or ±0.5). Looks only at walls touching the footprint from
 * outside, so it gives the same answer for the build preview (before the walls under it go) as for the tower.
 */
export function wallSeat(world, type, x, z) {
  const none = { shape: null, dx: 0, dz: 0 };
  const size = BUILDINGS[type].size;
  if (type === 'wall' || size !== 2) return none;
  const isWall = (tx, tz) => world.buildingAt(tx, tz)?.type === 'wall';
  const joins = { n: [], s: [], w: [], e: [] }; // the row (w/e) or column (n/s) each wall comes in on
  for (let i = 0; i < size; i++) {
    if (isWall(x - 1, z + i)) joins.w.push(z + i);
    if (isWall(x + size, z + i)) joins.e.push(z + i);
    if (isWall(x + i, z - 1)) joins.n.push(x + i);
    if (isWall(x + i, z + size)) joins.s.push(x + i);
  }
  const count = (dirs) => dirs.reduce((n, d) => n + joins[d].length, 0);
  const centreX = x + size / 2;
  const centreZ = z + size / 2;

  if (count(['n', 's']) === 0 && joins.w.length === 1 && joins.e.length === 1 && joins.w[0] === joins.e[0]) {
    return { shape: 'we', dx: 0, dz: joins.w[0] + 0.5 - centreZ };
  }
  if (count(['w', 'e']) === 0 && joins.n.length === 1 && joins.s.length === 1 && joins.n[0] === joins.s[0]) {
    return { shape: 'ns', dx: joins.n[0] + 0.5 - centreX, dz: 0 };
  }
  if (count(['w', 'e']) === 1 && count(['n', 's']) === 1) {
    const h = joins.w.length ? 'w' : 'e';
    const v = joins.n.length ? 'n' : 's';
    const row = joins[h][0];
    const col = joins[v][0];
    return { shape: `${h}${v}`, dx: col + 0.5 - centreX, dz: row + 0.5 - centreZ };
  }
  return none;
}
