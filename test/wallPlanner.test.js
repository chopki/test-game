import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/World.js';
import { lPath } from '../src/sim/wallPlanner.js';

// Town Hall covers tiles 18–20 on both axes.

describe('wall planner', () => {
  it('plans a straight line and an L shape with orthogonally connected tiles', () => {
    expect(lPath({ x: 5, z: 5 }, { x: 9, z: 5 })).toHaveLength(5);
    const l = lPath({ x: 5, z: 5 }, { x: 9, z: 7 });
    expect(l).toHaveLength(7);
    expect(l.at(-1)).toEqual({ x: 9, z: 7 });
    for (let i = 1; i < l.length; i++) {
      expect(Math.abs(l[i].x - l[i - 1].x) + Math.abs(l[i].z - l[i - 1].z)).toBe(1);
    }
    expect(lPath({ x: 3, z: 3 }, { x: 3, z: 3 })).toEqual([{ x: 3, z: 3 }]);
  });

  it('costs one wall per free tile and builds them all', () => {
    const world = new World({ seed: 1 });
    const plan = world.planWall({ x: 5, z: 8 }, { x: 14, z: 8 });
    expect(plan.count).toBe(10);
    expect(plan.cost).toBe(100);
    expect(world.buildWall(plan)).toEqual({ built: 10, planned: 10 });
    expect(world.buildingAt(14, 8).type).toBe('wall');
  });

  it('snaps the end to the side of a tower it is dragged onto', () => {
    const world = new World({ seed: 1 });
    world.place('archerTower', 10, 10); // covers 10–11
    const plan = world.planWall({ x: 4, z: 10 }, { x: 11, z: 11 });
    expect(plan.snapped).toBe(true);
    expect(plan.to).toEqual({ x: 9, z: 10 }); // west side of the tower, in line with the start
    world.buildWall(plan);
    expect(world.buildingAt(9, 10).type).toBe('wall');
    expect(world.buildingAt(10, 10).type).toBe('archerTower');
  });

  it('snaps to the nearest side when coming from another direction, and works from the Town Hall too', () => {
    const world = new World({ seed: 1 });
    world.economy.earn(1000);
    world.place('archerTower', 10, 10);
    expect(world.planWall({ x: 10, z: 4 }, { x: 10, z: 10 }).to).toEqual({ x: 10, z: 9 }); // north side
    const fromHall = world.planWall({ x: 19, z: 19 }, { x: 19, z: 10 });
    expect(fromHall.from).toEqual({ x: 19, z: 17 }); // starts just north of the hall
    expect(fromHall.tiles.every((t) => t.ok)).toBe(true);
  });

  it('skips existing walls for free and marks blocked tiles', () => {
    const world = new World({ seed: 1 });
    world.place('wall', 8, 8);
    const plan = world.planWall({ x: 6, z: 8 }, { x: 10, z: 8 });
    expect(plan.tiles.find((t) => t.x === 8).existing).toBe(true);
    expect(plan.count).toBe(4);
    const edge = world.planWall({ x: 0, z: 8 }, { x: 4, z: 8 });
    expect(edge.tiles.filter((t) => t.reason === 'Too close to the edge')).toHaveLength(2);
    expect(edge.count).toBe(3);
  });

  it('only plans as many walls as the player can afford', () => {
    const world = new World({ seed: 1 });
    world.economy.spend(world.economy.gold - 35); // 35 gold left = 3 walls
    const plan = world.planWall({ x: 5, z: 8 }, { x: 14, z: 8 });
    expect(plan.count).toBe(3);
    expect(plan.affordable).toBe(false);
    expect(world.buildWall(plan)).toEqual({ built: 3, planned: 3 });
  });
});
