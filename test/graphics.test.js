import { describe, expect, it } from 'vitest';
import {
  OPTIONS,
  PRESETS,
  loadSettings,
  matchPreset,
  saveSettings,
  settingsForPreset,
  stepDown,
  withPreset,
  withSetting,
} from '../src/render/graphicsSettings.js';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => (data[k] = v), data };
}

describe('graphics settings', () => {
  it('every preset value is a selectable option', () => {
    for (const preset of Object.values(PRESETS)) {
      for (const [key, value] of Object.entries(preset)) {
        expect(OPTIONS[key].map(([v]) => v)).toContain(value);
      }
    }
  });

  it('defaults to Low on touch devices and High otherwise', () => {
    expect(loadSettings(memoryStorage(), true).preset).toBe('low');
    expect(loadSettings(memoryStorage(), false).preset).toBe('high');
  });

  it('changing one setting makes it Custom; choosing a preset resets the values', () => {
    const low = settingsForPreset('low');
    const custom = withSetting(low, 'shadows', 'high');
    expect(custom.preset).toBe('custom');
    expect(custom.shadows).toBe('high');
    expect(withSetting(custom, 'shadows', PRESETS.low.shadows).preset).toBe('low'); // back to matching Low
    expect(withPreset(custom, 'medium')).toMatchObject({ preset: 'medium', ...PRESETS.medium });
  });

  it('the FPS counter does not affect which preset matches', () => {
    const s = withSetting(settingsForPreset('high'), 'showFps', true);
    expect(s.preset).toBe('high');
    expect(withPreset(s, 'low').showFps).toBe(true);
  });

  it('steps down one preset after a crash, and stops at Low', () => {
    expect(stepDown(settingsForPreset('high')).preset).toBe('medium');
    expect(stepDown(settingsForPreset('medium')).preset).toBe('low');
    expect(stepDown(settingsForPreset('low'))).toBeNull();
    expect(stepDown(withSetting(settingsForPreset('high'), 'fpsCap', 30)).preset).toBe('low'); // custom → Low
  });

  it('round-trips through storage and ignores invalid saved values', () => {
    const storage = memoryStorage();
    saveSettings(withSetting(settingsForPreset('medium'), 'fpsCap', 30), storage);
    const loaded = loadSettings(storage, false);
    expect(loaded).toMatchObject({ preset: 'custom', fpsCap: 30, shadows: 'low' });

    const bad = memoryStorage({ 'hold-the-hall:graphics': JSON.stringify({ resolution: 7, shadows: 'ultra', fpsCap: 60 }) });
    // (Low uses 'auto' resolution and low shadows, so the invalid values fall back to those.)
    const fixed = loadSettings(bad, true);
    expect(fixed.resolution).toBe(PRESETS.low.resolution); // 7 isn't an option
    expect(fixed.shadows).toBe(PRESETS.low.shadows);
    expect(fixed.fpsCap).toBe(60);
    expect(matchPreset(fixed)).toBe(fixed.preset);

    expect(loadSettings(memoryStorage({ 'hold-the-hall:graphics': '{not json' }), true).preset).toBe('low');
  });
});
