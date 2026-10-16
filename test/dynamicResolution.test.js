import { describe, expect, it } from 'vitest';
import { DynamicResolution } from '../src/render/dynamicResolution.js';

/** Feed one second of frames at `frameMs` each; return the last scale change (or null). */
function second(dr, frameMs, targetMs = 1000 / 30) {
  let changed = null;
  for (let t = 0; t < 1000; t += frameMs) {
    const s = dr.sample(frameMs, targetMs);
    if (s !== null) changed = s;
  }
  return changed;
}

describe('DynamicResolution', () => {
  it('steps down straight away when frames are too slow, down to the minimum', () => {
    const dr = new DynamicResolution({ min: 0.5, max: 1.5, start: 1 });
    expect(second(dr, 60)).toBe(0.9);
    for (let i = 0; i < 10; i++) second(dr, 60);
    expect(dr.scale).toBe(0.5);
  });

  it('steps up only after several smooth seconds, up to the maximum', () => {
    const dr = new DynamicResolution({ min: 0.5, max: 1.2, start: 1 });
    expect(second(dr, 33.3)).toBeNull();
    expect(second(dr, 33.3)).toBeNull();
    expect(second(dr, 33.3)).toBe(1.1);
    for (let i = 0; i < 20; i++) second(dr, 33.3);
    expect(dr.scale).toBe(1.2);
  });

  it('remembers a level that was too slow and stops trying it', () => {
    const dr = new DynamicResolution({ min: 0.5, max: 1.5, start: 1 });
    for (let i = 0; i < 3; i++) second(dr, 33.3); // → 1.1
    expect(dr.scale).toBe(1.1);
    expect(second(dr, 50)).toBe(1); // 1.1 was too slow
    expect(dr.ceiling).toBe(1);
    for (let i = 0; i < 12; i++) second(dr, 33.3);
    expect(dr.scale).toBe(1); // doesn't oscillate back up
  });

  it('ignores huge gaps such as a backgrounded tab', () => {
    const dr = new DynamicResolution({ start: 1 });
    for (let i = 0; i < 20; i++) expect(dr.sample(5000, 33)).toBeNull();
    expect(dr.scale).toBe(1);
  });
});
