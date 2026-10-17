/**
 * Seasons and weather (cosmetic only: the sim never sees them; no three.js, unit-tested in test/weather.test.js).
 *
 * Each map has a season from its seed: summer (green), autumn (turning leaves, fallen leaves on the ground) or
 * winter (snow on the ground and on every roof and treetop). The weather can change when a wave starts: clear or
 * rain in summer and autumn, clear or snowfall in winter. `?season=` and `?weather=` in the URL override both.
 */
export const SEASONS = ['summer', 'autumn', 'winter'];
export const WEATHERS = ['clear', 'rain', 'snow'];

const mix = (n) => {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
};

export function seasonFor(seed) {
  const r = mix(seed) % 100;
  return r < 50 ? 'summer' : r < 75 ? 'autumn' : 'winter';
}

/** The weather during wave `wave` (0 = before the first) on the map with `seed`, in `season`. */
export function weatherFor(seed, wave, season) {
  const r = mix(seed * 7919 + wave * 104729 + 17) % 100;
  if (season === 'winter') return r < 45 ? 'snow' : 'clear';
  if (season === 'autumn') return r < 40 ? 'rain' : 'clear';
  return r < 25 ? 'rain' : 'clear';
}

/**
 * How strongly each part of the look applies (0..1), from the season and the weather: `autumn` (leaf colours),
 * `snowCover` (snow lying on the ground and on top edges), `snowfall`, `rain` (falling rain, ripples) and `wet`
 * (darker, cooler ground and light).
 */
export function weatherLook(season, weather) {
  return {
    autumn: season === 'autumn' ? 1 : 0,
    snowCover: season === 'winter' ? (weather === 'snow' ? 1 : 0.75) : 0,
    snowfall: weather === 'snow' ? 1 : 0,
    rain: weather === 'rain' ? 1 : 0,
    wet: weather === 'rain' ? 1 : 0,
  };
}
