import { describe, expect, it } from 'vitest';
import { createRng } from '../src/sim/rng.js';
import { generateWave, WaveManager } from '../src/sim/WaveManager.js';

describe('waves', () => {
  it('grows in size and in number of attack sides', () => {
    const rng = createRng(1);
    const w1 = generateWave(1, rng);
    const w10 = generateWave(10, rng);
    expect(w1.sides).toHaveLength(1);
    expect(w10.sides).toHaveLength(4);
    expect(w10.entries.length).toBeGreaterThan(w1.entries.length);
    expect(w1.entries.every((e) => e.type === 'grunt')).toBe(true);
  });

  it('adds elite ogres on boss waves', () => {
    const w5 = generateWave(5, createRng(2));
    expect(w5.entries.filter((e) => e.elite)).toHaveLength(1);
  });

  it('releases spawns over time', () => {
    const wm = new WaveManager(createRng(3));
    const plan = wm.start();
    let spawned = wm.update(0).length;
    expect(spawned).toBe(1);
    for (let i = 0; i < 1000 && !wm.isSpawningDone(); i++) spawned += wm.update(0.1).length;
    expect(spawned).toBe(plan.entries.length);
    expect(wm.next.wave).toBe(2);
  });
});
