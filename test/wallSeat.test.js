import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/World.js';
import { wallSeat } from '../src/render/wallSeat.js';

function worldWithWalls(tiles) {
  const world = new World({ seed: 1 });
  world.economy.earn(5000);
  for (const [x, z] of tiles) world.place('wall', x, z);
  return world;
}

describe('wallSeat (drawing towers on the walls they are built into)', () => {
  it('a tower across a straight run is drawn half a tile towards the wall row', () => {
    const world = worldWithWalls([6, 7, 8, 9, 10, 11, 12].map((x) => [x, 8]));
    // Footprint (9..10, 8..9): the wall is its top row.
    expect(wallSeat(world, 'archerTower', 9, 8)).toEqual({ dx: 0, dz: -0.5 });
    // Footprint (9..10, 7..8): the wall is its bottom row.
    expect(wallSeat(world, 'archerTower', 9, 7)).toEqual({ dx: 0, dz: 0.5 });
  });

  it('a tower on a corner is drawn on the junction', () => {
    // L with the corner at (12, 8): arm west along z = 8 and arm south along x = 12.
    const world = worldWithWalls([...[6, 7, 8, 9, 10, 11, 12].map((x) => [x, 8]), ...[9, 10, 11, 12].map((z) => [12, z])]);
    const a = world.anchorFor('archerTower', 12, 8); // snaps onto the corner
    world.place('archerTower', a.x, a.z);
    const seat = wallSeat(world, 'archerTower', a.x, a.z);
    // Drawn centred on the corner tile.
    expect(a.x + 1 + seat.dx).toBe(12.5);
    expect(a.z + 1 + seat.dz).toBe(8.5);
  });

  it('a tower beside a wall (not in it), or with no walls, is not moved', () => {
    const world = worldWithWalls([6, 7, 8, 9, 10, 11, 12].map((x) => [x, 8]));
    expect(wallSeat(world, 'archerTower', 9, 9)).toEqual({ dx: 0, dz: 0 }); // wall runs along its north side
    expect(wallSeat(world, 'archerTower', 25, 25)).toEqual({ dx: 0, dz: 0 });
  });
});
