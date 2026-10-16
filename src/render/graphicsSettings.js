// Graphics quality presets and the player's saved choice. No three.js here, so it can be unit-tested.

export const PRESETS = {
  low: { resolution: 'auto', antialias: false, shadows: 'low', fpsCap: 30, scenery: 'low', effects: true },
  medium: { resolution: 'auto', antialias: false, shadows: 'low', fpsCap: 60, scenery: 'medium', effects: true },
  high: { resolution: 1.5, antialias: true, shadows: 'high', fpsCap: 0, scenery: 'high', effects: true },
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
  shadows: [
    ['off', 'Off'],
    ['low', 'Low'],
    ['high', 'High'],
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

/** Shadow-map resolution for each shadow setting (0 = shadows disabled). */
export const SHADOW_MAP_SIZE = { off: 0, low: 1024, high: 2048 };

/** Number of trees/rocks placed around the map for each scenery setting. */
export const SCENERY_COUNT = { off: 0, low: 60, medium: 120, high: 220 };

/** Settings that only take effect when the WebGL context is created (i.e. after a reload). */
export const RELOAD_REQUIRED = ['antialias'];

const STORAGE_KEY = 'hold-the-hall:graphics';

/** Phones and tablets get Low by default: their GPUs drop the WebGL context when overloaded. */
export function defaultPreset(isTouch = detectTouch()) {
  return isTouch ? 'low' : 'high';
}

function detectTouch() {
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}

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

/** Saved settings, validated against OPTIONS; falls back to the device default. */
export function loadSettings(storage = safeStorage(), isTouch = detectTouch()) {
  const fallback = settingsForPreset(defaultPreset(isTouch));
  let saved;
  try {
    saved = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null');
  } catch {
    saved = null;
  }
  if (!saved || typeof saved !== 'object') return fallback;
  const out = { ...fallback };
  for (const [key, options] of Object.entries(OPTIONS)) {
    if (options.some(([v]) => v === saved[key])) out[key] = saved[key];
  }
  out.preset = matchPreset(out);
  return out;
}

export function saveSettings(settings, storage = safeStorage()) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable (private mode etc.): settings just won't persist.
  }
}

function safeStorage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
