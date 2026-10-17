import { describe, expect, it } from 'vitest';
import { SEASONS, seasonFor, weatherFor, weatherLook } from '../src/render/weather.js';

describe('seasons and weather', () => {
  it('every season turns up across maps, each map keeps its own', () => {
    const seen = new Set();
    for (let seed = 1; seed <= 200; seed++) seen.add(seasonFor(seed));
    expect([...seen].sort()).toEqual([...SEASONS].sort());
    expect(seasonFor(1234)).toBe(seasonFor(1234));
  });

  it('weather suits the season, changes between waves, and is the same on a replay', () => {
    const allowed = { summer: ['clear', 'rain'], autumn: ['clear', 'rain'], winter: ['clear', 'snow'] };
    for (const season of Object.keys(allowed)) {
      const seen = new Set();
      for (let wave = 0; wave < 40; wave++) seen.add(weatherFor(77, wave, season));
      expect([...seen].sort()).toEqual(allowed[season].sort());
    }
    expect(weatherFor(5, 3, 'summer')).toBe(weatherFor(5, 3, 'summer'));
  });

  it('winter always has snow lying; snowfall and rain follow the weather', () => {
    expect(weatherLook('winter', 'clear')).toMatchObject({ snowCover: 0.75, snowfall: 0, rain: 0 });
    expect(weatherLook('winter', 'snow')).toMatchObject({ snowCover: 1, snowfall: 1 });
    expect(weatherLook('autumn', 'rain')).toMatchObject({ autumn: 1, rain: 1, wet: 1, snowCover: 0 });
    expect(weatherLook('summer', 'clear')).toEqual({ autumn: 0, snowCover: 0, snowfall: 0, rain: 0, wet: 0 });
  });
});
