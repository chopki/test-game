import { describe, expect, it } from 'vitest';
import {
  OPTIONS,
  PRESETS,
  STARTUP_PRESET,
  carrySettingsThroughReload,
  matchPreset,
  settingsForPreset,
  startupSettings,
  stepDown,
  withPreset,
  withSetting,
} from '../src/render/graphicsSettings.js';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => (data[k] = v), removeItem: (k) => delete data[k], data };
}

describe('graphics settings', () => {
  it('every preset value is a selectable option', () => {
    for (const preset of Object.values(PRESETS)) {
      for (const [key, value] of Object.entries(preset)) {
        expect(OPTIONS[key].map(([v]) => v)).toContain(value);
      }
    }
  });

  it('always starts on High when nothing was carried over', () => {
    expect(STARTUP_PRESET).toBe('high');
    expect(startupSettings(memoryStorage())).toMatchObject({ preset: 'high', ...PRESETS.high });
    expect(startupSettings(null).preset).toBe('high');
  });

  it('changing one setting makes it Custom; choosing a preset resets the values', () => {
    const low = settingsForPreset('low');
    const custom = withSetting(low, 'scenery', 'high');
    expect(custom.preset).toBe('custom');
    expect(custom.scenery).toBe('high');
    expect(withSetting(custom, 'scenery', PRESETS.low.scenery).preset).toBe('low'); // back to matching Low
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

  it('carries settings through exactly one reload, then starts on High again', () => {
    const storage = memoryStorage();
    carrySettingsThroughReload(withSetting(settingsForPreset('low'), 'fpsCap', 60), storage);
    expect(startupSettings(storage)).toMatchObject({ preset: 'custom', fpsCap: 60, antialias: false });
    expect(startupSettings(storage).preset).toBe('high'); // used up
  });

  it('ignores invalid carried-over values', () => {
    const bad = memoryStorage({ 'hold-the-hall:graphics-for-reload': JSON.stringify({ resolution: 7, scenery: 'ultra', fpsCap: 60 }) });
    const fixed = startupSettings(bad);
    expect(fixed.resolution).toBe(PRESETS.high.resolution);
    expect(fixed.scenery).toBe(PRESETS.high.scenery);
    expect(fixed.fpsCap).toBe(60);
    expect(matchPreset(fixed)).toBe(fixed.preset);
    expect(startupSettings(memoryStorage({ 'hold-the-hall:graphics-for-reload': '{not json' })).preset).toBe('high');
  });
});
