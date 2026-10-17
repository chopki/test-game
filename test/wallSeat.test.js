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
  it('a T-junction tower sits on the junction tile with a three-armed model', () => {
    // A west–east run along z = 8 with a branch south from x = 10; tower over (9..10, 8..9).
    const world = worldWithWalls([...[6, 7, 8, 9, 10, 11, 12].map((x) => [x, 8]), [10, 10], [10, 11]]);
    expect(wallSeat(world, 'archerTower', 9, 8)).toEqual({ shape: 'wes', dx: 0.5, dz: -0.5 });
  });

  it('a north–south run with a branch east is a T-junction too', () => {
    // Run down x = 8 (z 6..12), branch east along z = 9 from x = 10; tower over (8..9, 9..10).
    const world = worldWithWalls([...[6, 7, 8, 9, 10, 11, 12].map((z) => [8, z]), [10, 9], [11, 9]]);
    expect(wallSeat(world, 'archerTower', 8, 9)).toEqual({ shape: 'nse', dx: -0.5, dz: -0.5 });
  });

  it('a crossroads has no in-wall model (normal tower with joints)', () => {
    const world = worldWithWalls([...[6, 7, 8, 9, 10, 11, 12].map((x) => [x, 8]), [10, 6], [10, 7], [10, 10], [10, 11]]);
    expect(wallSeat(world, 'archerTower', 9, 8).shape).toBeNull();
  });

  it('a corner tower that covers only one arm still sits on the corner', () => {
    // Corner at (14, 24) with arms north and east; the tower covers the corner, the north arm's first tile and two
    // tiles outside the L.
    const world = worldWithWalls([...[20, 21, 22, 23, 24].map((z) => [14, z]), ...[15, 16, 17].map((x) => [x, 24])]);
    const seat = wallSeat(world, 'archerTower', 13, 23);
    expect(seat.shape).toBe('en');
    expect(13 + 1 + seat.dx).toBe(14.5);
    expect(23 + 1 + seat.dz).toBe(24.5);
  });

  it('a tower across a straight run is drawn half a tile towards the wall row', () => {
    const world = worldWithWalls([6, 7, 8, 9, 10, 11, 12].map((x) => [x, 8]));
    // Footprint (9..10, 8..9): the wall is its top row.
    expect(wallSeat(world, 'archerTower', 9, 8)).toEqual({ shape: 'we', dx: 0, dz: -0.5 });
    // Footprint (9..10, 7..8): the wall is its bottom row.
    expect(wallSeat(world, 'archerTower', 9, 7)).toEqual({ shape: 'we', dx: 0, dz: 0.5 });
    // A north–south run.
    const ns = worldWithWalls([6, 7, 8, 9, 10, 11, 12].map((z) => [8, z]));
    expect(wallSeat(ns, 'cannonTower', 8, 9)).toEqual({ shape: 'ns', dx: -0.5, dz: 0 });
  });

  it('a tower on a corner is drawn on the junction', () => {
    // L with the corner at (12, 8): arm west along z = 8 and arm south along x = 12.
    const world = worldWithWalls([...[6, 7, 8, 9, 10, 11, 12].map((x) => [x, 8]), ...[9, 10, 11, 12].map((z) => [12, z])]);
    const a = world.anchorFor('archerTower', 12, 8); // snaps onto the corner
    world.place('archerTower', a.x, a.z);
    const seat = wallSeat(world, 'archerTower', a.x, a.z);
    expect(seat.shape).toBe('ws'); // arms west and south
    // Drawn centred on the corner tile.
    expect(a.x + 1 + seat.dx).toBe(12.5);
    expect(a.z + 1 + seat.dz).toBe(8.5);
  });

  it('a tower beside a wall (not in it), or with no walls, is not moved', () => {
    const world = worldWithWalls([6, 7, 8, 9, 10, 11, 12].map((x) => [x, 8]));
    const none = { shape: null, dx: 0, dz: 0 };
    expect(wallSeat(world, 'archerTower', 9, 9)).toEqual(none); // wall runs along its north side
    expect(wallSeat(world, 'archerTower', 25, 25)).toEqual(none);
  });
});
