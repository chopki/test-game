// Graphics quality presets and the player's saved choice. No three.js here, so it can be unit-tested.

export const PRESETS = {
  low: { resolution: 'auto', antialias: false, fpsCap: 30, scenery: 'low', effects: true },
  medium: { resolution: 'auto', antialias: false, fpsCap: 60, scenery: 'medium', effects: true },
  high: { resolution: 1.5, antialias: true, fpsCap: 0, scenery: 'high', effects: true },
};

export const PRESET_ORDER = ['low', 'medium', 'high'];

/** Allowed values for each setting, with labels, in display order. Used by the settings menu. */
export const OPTIONS = {
  resolution: [
    ['auto', 'Auto'],
    [0.5, '50%'],
    [0.75, '75%'],
    [1, '100%'],
    [1.5, '150%'],
    [2, '200%'],
  ],
  antialias: [
    [false, 'Off'],
    [true, 'On'],
  ],
  fpsCap: [
    [30, '30'],
    [60, '60'],
    [0, 'Unlimited'],
  ],
  scenery: [
    ['off', 'Off'],
    ['low', 'Low'],
    ['medium', 'Medium'],
    ['high', 'High'],
  ],
  effects: [
    [false, 'Off'],
    [true, 'On'],
  ],
  showFps: [
    [false, 'Off'],
    [true, 'On'],
  ],
};

/**
 * Bounds for automatic render scale ('auto' resolution). The upper bound is also capped at the
 * screen's real pixel ratio. Touch devices start lower and work up.
 */
export const AUTO_RESOLUTION = { min: 0.5, max: 1.5, startTouch: 0.75, startDesktop: 1 };

/** Number of trees/rocks placed around the map for each scenery setting. */
export const SCENERY_COUNT = { off: 0, low: 60, medium: 120, high: 220 };

/** Settings that only take effect when the WebGL context is created (i.e. after a reload). */
export const RELOAD_REQUIRED = ['antialias'];

export function settingsForPreset(preset) {
  return { preset, ...PRESETS[preset], showFps: false };
}

/** The preset whose values all match `settings`, or 'custom'. */
export function matchPreset(settings) {
  for (const name of PRESET_ORDER) {
    if (Object.entries(PRESETS[name]).every(([k, v]) => settings[k] === v)) return name;
  }
  return 'custom';
}

/** Change one setting; the preset label follows (usually becoming 'custom'). */
export function withSetting(settings, key, value) {
  const next = { ...settings, [key]: value };
  next.preset = matchPreset(next);
  return next;
}

/** Switch to a preset, keeping display-only preferences such as the FPS counter. */
export function withPreset(settings, preset) {
  return { ...settings, ...PRESETS[preset], preset };
}

/**
 * Safer settings after a GPU crash: one preset lower (custom settings go to Low, since they
 * can't be ranked), or null if already at Low.
 */
export function stepDown(settings) {
  if (settings.preset === 'custom') return withPreset(settings, 'low');
  const i = PRESET_ORDER.indexOf(settings.preset);
  return i <= 0 ? null : withPreset(settings, PRESET_ORDER[i - 1]);
}

// Graphics always start on Low: no settings are remembered between visits, so a setting that made the GPU
// crash can never be stuck on. The one exception is the settings menu's "Reload now" (needed to apply
// anti-aliasing): it carries the current settings through that single reload via sessionStorage.
const RELOAD_KEY = 'hold-the-hall:graphics-for-reload';

/** Settings for this launch: Low, or the settings carried over by "Reload now" (validated, used once). */
export function startupSettings(storage = safeSessionStorage()) {
  const low = settingsForPreset('low');
  let carried = null;
  try {
    carried = JSON.parse(storage?.getItem(RELOAD_KEY) ?? 'null');
    storage?.removeItem(RELOAD_KEY);
  } catch {
    carried = null;
  }
  if (!carried || typeof carried !== 'object') return low;
  const out = { ...low };
  for (const [key, options] of Object.entries(OPTIONS)) {
    if (options.some(([v]) => v === carried[key])) out[key] = carried[key];
  }
  out.preset = matchPreset(out);
  return out;
}

/** Keep `settings` for the next page load only (the settings menu's "Reload now"). */
export function carrySettingsThroughReload(settings, storage = safeSessionStorage()) {
  try {
    storage?.setItem(RELOAD_KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable: the reload just starts on Low like any other launch.
  }
}

function safeSessionStorage() {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}
