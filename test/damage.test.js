import { describe, expect, it } from 'vitest';
import { damageAmount, damageStage } from '../src/render/damage.js';

describe('damage stages (how battered a building looks)', () => {
  it('steps from sound to damaged to badly damaged by thirds of health', () => {
    expect(damageStage(400, 400)).toBe(0);
    expect(damageStage(270, 400)).toBe(0);
    expect(damageStage(260, 400)).toBe(1);
    expect(damageStage(140, 400)).toBe(1);
    expect(damageStage(130, 400)).toBe(2);
    expect(damageStage(1, 400)).toBe(2);
  });

  it('maps stages to the shader amount', () => {
    expect([0, 1, 2].map(damageAmount)).toEqual([0, 0.5, 1]);
  });
});
