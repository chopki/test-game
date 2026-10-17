import { describe, expect, it } from 'vitest';
import { createRng } from '../src/sim/rng.js';
import { ENEMIES } from '../src/sim/config.js';
import { generateWave, summarizeWave, WaveManager } from '../src/sim/WaveManager.js';

describe('waves', () => {
  it('grows in size and in number of attack sides', () => {
    const rng = createRng(1);
    const w1 = generateWave(1, rng);
    const w10 = generateWave(10, rng);
    expect(w1.sides).toHaveLength(1);
    expect(w10.sides).toHaveLength(4);
    expect(w10.entries.length).toBeGreaterThan(w1.entries.length);
    expect(w1.entries.every((e) => e.type === 'swordsman')).toBe(true);
  });

  it('adds a squad of elite knights on boss waves', () => {
    const w5 = generateWave(5, createRng(2));
    expect(w5.entries.filter((e) => e.elite)).toHaveLength(1);
    expect(w5.entries.filter((e) => e.elite).every((e) => e.type === 'knight')).toBe(true);
    const w10 = generateWave(10, createRng(2));
    expect(w10.entries.filter((e) => e.elite)).toHaveLength(2);
  });

  it('comes in squads of one type, siege engines with an escort, within the threat budget', () => {
    for (let n = 1; n <= 15; n++) {
      const plan = generateWave(n, createRng(n));
      const squads = Map.groupBy(plan.entries, (e) => e.squad);
      for (const members of squads.values()) {
        expect(new Set(members.map((e) => e.side)).size).toBe(1);
        const kinds = new Set(members.map((e) => e.type));
        const engine = [...kinds].find((t) => ENEMIES[t].siege);
        if (engine) {
          expect(members.filter((e) => e.type === engine)).toHaveLength(1);
          expect(members.filter((e) => e.type !== engine)).toHaveLength(ENEMIES[engine].escort.count);
        } else {
          expect(kinds.size).toBe(1);
          const def = ENEMIES[members[0].type];
          if (!members[0].elite) expect(members.length).toBeGreaterThanOrEqual(def.squad[0]);
          if (!members[0].elite) expect(members.length).toBeLessThanOrEqual(def.squad[1]);
        }
      }
      const threat = plan.entries.filter((e) => !e.elite).reduce((sum, e) => sum + ENEMIES[e.type].threat, 0);
      expect(threat).toBeLessThanOrEqual(Math.round(4 + 4 * n + 0.4 * n * n));
    }
  });

  it('brings in siege engines from the middle waves', () => {
    const types = new Set();
    for (let n = 1; n <= 12; n++) for (const e of generateWave(n, createRng(n * 7)).entries) types.add(e.type);
    expect(types.has('ram')).toBe(true);
    expect(types.has('mangonel')).toBe(true);
    expect(generateWave(3, createRng(1)).entries.some((e) => ENEMIES[e.type].siege)).toBe(false);
  });

  it('names the wave preview in plurals', () => {
    const plan = { entries: [{ type: 'swordsman' }, { type: 'swordsman' }, { type: 'ram' }] };
    expect(summarizeWave(plan).map((u) => `${u.count} ${u.name}`)).toEqual(['2 Swordsmen', '1 Battering Ram']);
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
