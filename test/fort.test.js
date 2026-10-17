import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/World.js';
import { START_FORT } from '../src/sim/config.js';
import { wallSeat } from '../src/render/wallSeat.js';

const count = (world, type) => [...world.buildings.values()].filter((b) => b.type === type).length;

describe('starting fort', () => {
  it('is only built when asked for (tests and the open map start bare)', () => {
    const world = new World({ seed: 1 });
    expect(world.buildings.size).toBe(1);
  });

  it('puts walls, a gatehouse and an archer tower round the Town Hall, with gaps left open', () => {
    const world = new World({ seed: 1, fort: true });
    const { x: hx, z: hz } = world.townHall;
    const g = START_FORT.gatehouse;
    expect(world.buildingAt(hx + g.x, hz + g.z)?.type).toBe('gatehouse');
    const t = START_FORT.towers[0];
    expect(world.buildingAt(hx + t.x, hz + t.z)?.type).toBe('archerTower');
    expect(count(world, 'wall')).toBeGreaterThan(25);
    expect(world.buildingAt(hx + 6, hz - 4)).toBeNull(); // the north-east gap
    expect(world.buildingAt(hx + 7, hz - 1)).toBeNull();
    expect(world.buildingAt(hx - 2, hz + 7)).toBeNull(); // the gap by the south-west corner
  });

  it('draws the gatehouse and the tower built into their walls', () => {
    const world = new World({ seed: 1, fort: true });
    const { x: hx, z: hz } = world.townHall;
    const g = START_FORT.gatehouse;
    const t = START_FORT.towers[0];
    expect(wallSeat(world, 'gatehouse', hx + g.x, hz + g.z).shape).toBe('we');
    expect(wallSeat(world, 'archerTower', hx + t.x, hz + t.z).shape).toBe('ns');
  });

  it('lets enemies in through the gaps rather than through the gate', () => {
    const world = new World({ seed: 1, fort: true });
    const { x: hx, z: hz } = world.townHall;
    // From just outside the gate, the way in leads round to a gap, not through the gatehouse.
    let x = hx + 1;
    let z = hz + 9;
    const visited = new Set();
    for (let i = 0; i < 80 && !(x >= hx && x < hx + 3 && z >= hz && z < hz + 3); i++) {
      const b = world.buildingAt(x, z);
      if (b) visited.add(b.type);
      const step = world.flow.nextStep(x, z);
      if (!step) break;
      ({ x, z } = step);
    }
    expect(visited.has('gatehouse')).toBe(false);
    expect(visited.has('wall')).toBe(false);
  });

  it('starter buildings sell for nothing, and the gatehouse and Town Hall cannot be sold', () => {
    const world = new World({ seed: 1, fort: true });
    const { x: hx, z: hz } = world.townHall;
    const tower = world.buildingAt(hx + START_FORT.towers[0].x, hz + START_FORT.towers[0].z);
    const gate = world.buildingAt(hx + START_FORT.gatehouse.x, hz + START_FORT.gatehouse.z);
    expect(world.sellValue(tower)).toBe(0);
    expect(world.canSell(gate)).toBe(false);
    expect(world.sell(gate.id)).toBe(false);
    expect(world.sell(world.townHall.id)).toBe(false);
    const gold = world.economy.gold;
    expect(world.sell(tower.id)).toBe(true);
    expect(world.economy.gold).toBe(gold);
  });

  it('fits on generated maps too (the clearing round the Town Hall leaves room)', () => {
    for (const seed of [1, 2, 3, 8, 42, 1234]) {
      const world = new World({ seed, terrain: 'generate', fort: true });
      expect(count(world, 'gatehouse'), `seed ${seed}`).toBe(1);
      expect(count(world, 'archerTower'), `seed ${seed}`).toBe(1);
      expect(count(world, 'wall'), `seed ${seed}`).toBeGreaterThan(25);
    }
  });
});
