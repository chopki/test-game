import { describe, expect, it } from 'vitest';
import { Grid } from '../src/sim/Grid.js';
import { T } from '../src/sim/terrain.js';
import { fordBridges } from '../src/render/bridges.js';
import { waterFlow } from '../src/render/waterFlow.js';
import { World } from '../src/sim/World.js';
import { TERRAIN } from '../src/sim/config.js';

describe('footbridges over fords', () => {
  it('crosses a stream running along z with a bridge along x, ramps on both banks', () => {
    const grid = new Grid(12, 12, 0);
    // A stream 2 tiles wide down x = 5..6, with a ford over z = 4..6.
    for (let z = 0; z < 12; z++) for (const x of [5, 6]) grid.terrain[z * 12 + x] = z >= 4 && z <= 6 ? T.ford : T.water;
    const pieces = fordBridges(grid, waterFlow(grid));
    expect(pieces).toEqual([
      { part: 'mid', axis: 'x', x: 5, z: 5 },
      { part: 'mid', axis: 'x', x: 6, z: 5 },
      { part: 'start', axis: 'x', x: 4, z: 5 },
      { part: 'end', axis: 'x', x: 7, z: 5 },
    ]);
  });

  it('crosses a stream running along x with a bridge along z', () => {
    const grid = new Grid(12, 12, 0);
    for (let x = 0; x < 12; x++) for (const z of [3, 4]) grid.terrain[z * 12 + x] = x >= 6 && x <= 8 ? T.ford : T.water;
    const pieces = fordBridges(grid, waterFlow(grid));
    expect(pieces.every((p) => p.axis === 'z' && p.x === 7)).toBe(true);
    expect(pieces.map((p) => p.part)).toEqual(['mid', 'mid', 'start', 'end']);
  });

  it('every ford on a generated map gets one bridge, over wet tiles with dry ends', () => {
    for (const seed of [8, 21, 33]) {
      const world = new World({ seed, terrain: 'generate' });
      const grid = world.grid;
      const pieces = fordBridges(grid, waterFlow(grid));
      for (const p of pieces) {
        const t = grid.terrain[p.z * grid.width + p.x];
        expect(p.part === 'mid' ? t === T.water || t === T.ford : t !== T.water && t !== T.ford, `seed ${seed} ${JSON.stringify(p)}`).toBe(true);
      }
      const hasFord = grid.terrain.includes(T.ford);
      expect(pieces.some((p) => p.part === 'mid')).toBe(hasFord);
    }
  });

  it('a bridge never runs straight into the woods: a path leads on from both ends', () => {
    let bridges = 0;
    for (let i = 0; i < 40; i++) {
      const seed = i * 7919 + 5;
      const world = new World({ seed, terrain: 'generate', river: true, hills: 'sometimes', sea: 'sometimes' });
      const grid = world.grid;
      const pieces = fordBridges(grid, waterFlow(grid));
      const mids = pieces.filter((p) => p.part === 'mid');
      for (const part of ['start', 'end']) {
        const ends = pieces.filter((p) => p.part === part);
        // Each bridge (a run of mids on one line) has both ends on dry, open ground.
        expect(ends.length, `seed ${seed}`).toBe(new Set(mids.map((p) => `${p.axis}${p.axis === 'x' ? p.z : p.x}`)).size);
        for (const p of ends) {
          const dir = part === 'start' ? -1 : 1;
          for (let k = 0; k < TERRAIN.water.fordPath; k++) {
            const x = p.axis === 'x' ? p.x + dir * k : p.x;
            const z = p.axis === 'z' ? p.z + dir * k : p.z;
            if (!grid.inBounds(x, z)) break;
            const t = grid.terrain[z * grid.width + x];
            if (t === T.water || t === T.sea || t === T.cliff) break;
            expect([T.forest, T.rock], `seed ${seed} at ${x},${z}`).not.toContain(t);
          }
        }
      }
      bridges += mids.length > 0;
    }
    expect(bridges).toBeGreaterThan(30);
  });
});
