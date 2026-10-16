import { describe, expect, it } from 'vitest';
import { Grid } from '../src/sim/Grid.js';
import { FlowField } from '../src/sim/FlowField.js';

function walk(field, grid, start, maxSteps = 200) {
  const path = [start];
  let cur = start;
  for (let i = 0; i < maxSteps; i++) {
    const next = field.nextStep(cur.x, cur.z);
    if (!next) break;
    path.push(next);
    if (field.goal[grid.index(next.x, next.z)]) break;
    if (grid.get(next.x, next.z) !== null) break; // would attack
    cur = next;
  }
  return path;
}

describe('FlowField', () => {
  it('leads straight to the goal on an empty map', () => {
    const grid = new Grid(10, 10);
    const field = new FlowField(grid);
    field.compute([[5, 5]], () => 0);
    expect(field.distanceAt(5, 5)).toBe(0);
    expect(field.distanceAt(5, 0)).toBe(5);
    const path = walk(field, grid, { x: 5, z: 0 });
    expect(path.at(-1)).toEqual({ x: 5, z: 5 });
    expect(path.length).toBe(6);
  });

  it('walks around a short wall when the detour is cheap', () => {
    const grid = new Grid(11, 11);
    for (const x of [4, 5, 6]) grid.cells[grid.index(x, 3)] = 99; // wall
    const field = new FlowField(grid);
    field.compute([[5, 8]], () => 20);
    const path = walk(field, grid, { x: 5, z: 0 });
    expect(path.at(-1)).toEqual({ x: 5, z: 8 });
    for (const p of path) expect(grid.get(p.x, p.z)).toBeNull();
  });

  it('targets the wall when the goal is fully enclosed', () => {
    const grid = new Grid(11, 11);
    for (let x = 3; x <= 7; x++) {
      for (let z = 3; z <= 7; z++) {
        if (x === 3 || x === 7 || z === 3 || z === 7) grid.cells[grid.index(x, z)] = 99;
      }
    }
    const field = new FlowField(grid);
    field.compute([[5, 5]], () => 10);
    const path = walk(field, grid, { x: 5, z: 0 });
    const last = path.at(-1);
    expect(grid.get(last.x, last.z)).toBe(99);
  });

  it('never cuts diagonally between two blocked tiles', () => {
    const grid = new Grid(5, 5);
    grid.cells[grid.index(2, 1)] = 1;
    grid.cells[grid.index(1, 2)] = 1;
    const field = new FlowField(grid);
    expect(field.canStep(1, 1, 2, 2)).toBe(false);
    expect(field.canStep(3, 3, 2, 2)).toBe(true);
  });
});
