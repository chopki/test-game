// Graphics quality presets and the player's saved choice. No three.js here, so it can be unit-tested.

export const PRESETS = {
  low: { resolution: 'auto', antialias: false, fpsCap: 30, scenery: 'low', effects: true, glow: false, weather: true, arrows: 'streak', healthBars: 'hit' },
  medium: { resolution: 'auto', antialias: false, fpsCap: 60, scenery: 'medium', effects: true, glow: false, weather: true, arrows: 'streak', healthBars: 'hit' },
  high: { resolution: 'native', antialias: true, fpsCap: 0, scenery: 'high', effects: true, glow: true, weather: true, arrows: 'streak', healthBars: 'hit' },
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
    [2.5, '250%'],
    [3, '300%'],
    // The screen's own pixel density (e.g. ~260% on a Pixel 7, 300% on many iPhones): every pixel drawn for real.
    ['native', 'Native'],
  ],
  antialias: [
    [false, 'Off'],
    [true, 'On'],
  ],
  fpsCap: [
    [30, '30'],
    [60, '60'],
    [120, '120'],
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
  glow: [
    [false, 'Off'],
    [true, 'On'],
  ],
  weather: [
    [false, 'Off'],
    [true, 'On'],
  ],
  // How arrows in flight are drawn: an ink streak with a fading trail, a volley of three streaks per shot, or the
  // original small 3D arrow with puffs.
  arrows: [
    ['streak', 'Ink streak'],
    ['volley', 'Volley'],
    ['classic', 'Classic'],
  ],
  // Health bars over enemies and buildings: for a moment after each hit, all the while they're hurt, or never.
  healthBars: [
    ['off', 'Off'],
    ['hit', 'On hit'],
    ['hurt', 'While hurt'],
  ],
  showFps: [
    [false, 'Off'],
    [true, 'On'],
  ],
  // How far the camera may zoom out (see ZOOM), and whether far out the small things are simplified (see LOD).
  zoomOut: [
    ['normal', 'Normal'],
    ['far', 'Far'],
    ['farthest', 'Farthest'],
  ],
  lod: [
    ['auto', 'Simplify when far'],
    ['full', 'Always full'],
  ],
};

/**
 * Camera zoom: how far in it may go (zoom factor), and how far out for each Zoom out setting, as a fraction of the
 * map's normal limit (the furthest out that keeps the painted ground's edge out of view on a Medium map).
 */
export const ZOOM = { in: 3.6, out: { normal: 1, far: 0.7, farthest: 0.5 } };

/**
 * Level of detail when zoomed out (with Detail when far on 'Simplify'): from `from` × the normal limit out to
 * `to` × it, soldiers get a ring in their side's colour (growing to `markerGrow` × its size), and past halfway the
 * clutter too small to make out is left out: wildlife and the health bars of ordinary soldiers. Cloud
 * shadows fade out too.
 */
export const LOD = { from: 1, to: 0.62, markerGrow: 2.4 };

/** 0 at normal zoom, rising to 1 by LOD.to (always 0 with lod 'full'). `zoom` relative to the normal limit. */
export function farness(relativeZoom, lod = 'auto') {
  if (lod === 'full') return 0;
  return Math.min(1, Math.max(0, (LOD.from - relativeZoom) / (LOD.from - LOD.to)));
}

/**
 * Bounds for automatic render scale ('auto' resolution). The upper bound is also capped at the
 * screen's real pixel ratio. Touch devices start lower and work up.
 */
export const AUTO_RESOLUTION = { min: 0.5, max: 2, startTouch: 0.75, startDesktop: 1 };

/**
 * Decorative trees placed in the woods outside the map, for each scenery setting. (Terrain on the map itself,
 * which blocks movement, is always drawn.)
 */
export const SCENERY_COUNT = { off: 0, low: 140, medium: 200, high: 300 };
/** Painted ground resolution (pixels per tile) and how many small details are stamped into it. */
export const GROUND_PX = { off: 12, low: 16, medium: 24, high: 32 };
export const GROUND_DETAIL = { off: 0, low: 0.6, medium: 1, high: 1.4 };

/** Settings that only take effect when the WebGL context is created (i.e. after a reload). */
export const RELOAD_REQUIRED = ['antialias'];

export function settingsForPreset(preset) {
  return { preset, ...PRESETS[preset], showFps: false, zoomOut: 'far', lod: 'auto' };
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

/** The preset every launch starts on (High works on current phones; a GPU crash steps it down live). */
export const STARTUP_PRESET = 'high';

// Graphics always start on STARTUP_PRESET: no settings are remembered between visits, so a setting that made the
// GPU crash can never be stuck on. The one exception is the settings menu's "Reload now" (needed to apply
// anti-aliasing): it carries the current settings through that single reload via sessionStorage.
const RELOAD_KEY = 'hold-the-hall:graphics-for-reload';

/** Settings for this launch: STARTUP_PRESET, or the settings carried over by "Reload now" (validated, used once). */
export function startupSettings(storage = safeSessionStorage()) {
  const start = settingsForPreset(STARTUP_PRESET);
  let carried = null;
  try {
    carried = JSON.parse(storage?.getItem(RELOAD_KEY) ?? 'null');
    storage?.removeItem(RELOAD_KEY);
  } catch {
    carried = null;
  }
  if (!carried || typeof carried !== 'object') return start;
  const out = { ...start };
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
    // Storage unavailable: the reload just starts on STARTUP_PRESET like any other launch.
  }
}

function safeSessionStorage() {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}
