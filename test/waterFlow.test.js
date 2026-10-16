import { describe, expect, it } from 'vitest';
import { Grid } from '../src/sim/Grid.js';
import { T } from '../src/sim/terrain.js';
import { waterFlow } from '../src/render/waterFlow.js';

function gridWith(paint) {
  const grid = new Grid(20, 20, 2);
  paint((x, z, t) => (grid.terrain[z * 20 + x] = t));
  return grid;
}
const at = (flow, x, z) => [flow[(z * 20 + x) * 2], flow[(z * 20 + x) * 2 + 1]];

describe('water flow', () => {
  it('a stream across the map flows from one edge to the other, along the stream', () => {
    // A west–east stream, 2 tiles wide, with a ford in the middle.
    const grid = gridWith((set) => {
      for (let x = 0; x < 20; x++) for (const z of [9, 10]) set(x, z, x >= 9 && x <= 10 ? T.ford : T.water);
    });
    const flow = waterFlow(grid);
    for (const x of [2, 9, 15]) {
      const [fx, fz] = at(flow, x, 9);
      expect(fx).toBeGreaterThan(0.9); // eastwards
      expect(Math.abs(fz)).toBeLessThan(0.4);
    }
  });

  it('follows the stream round a bend', () => {
    // Down from the north edge at x = 5, then east along z = 12 to the east edge.
    const grid = gridWith((set) => {
      for (let z = 0; z <= 12; z++) set(5, z, T.water);
      for (let x = 5; x < 20; x++) set(x, 12, T.water);
    });
    const flow = waterFlow(grid);
    expect(at(flow, 5, 3)[1]).toBeGreaterThan(0.9); // southwards before the bend
    expect(at(flow, 14, 12)[0]).toBeGreaterThan(0.9); // eastwards after it
  });

  it('lakes and dry land are still', () => {
    const grid = gridWith((set) => {
      for (let z = 8; z <= 11; z++) for (let x = 8; x <= 11; x++) set(x, z, T.water);
    });
    const flow = waterFlow(grid);
    expect(at(flow, 9, 9)).toEqual([0, 0]);
    expect(at(flow, 2, 2)).toEqual([0, 0]);
  });
});
