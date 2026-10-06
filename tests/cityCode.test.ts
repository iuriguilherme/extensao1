import { describe, expect, it } from 'vitest';
import {
  CITY_NAMES,
  MAX_CITY_LEVEL,
  SEEDS_PER_LEVEL,
  decodeCityCode,
  encodeCityCode,
  randomCitySeed,
} from '../src/core/cityCode';
import { createRng, randInt } from '../src/core/random';

describe('city code', () => {
  it('has 32 distinct three-letter uppercase names', () => {
    expect(CITY_NAMES).toHaveLength(32);
    expect(new Set(CITY_NAMES).size).toBe(32);
    for (const n of CITY_NAMES) expect(n).toMatch(/^[A-Z]{3}$/);
    expect(MAX_CITY_LEVEL).toBe(99);
    expect(SEEDS_PER_LEVEL).toBe(320000);
  });

  it('encodes with zero-padded digits', () => {
    const code = encodeCityCode(3, CITY_NAMES.indexOf('RIO') * 10000 + 21);
    expect(code).toBe('RIO-3-0021');
  });

  it('round-trips 1000 random pairs', () => {
    const rng = createRng(42);
    for (let i = 0; i < 1000; i++) {
      const level = randInt(rng, 1, MAX_CITY_LEVEL);
      const seed = randInt(rng, 0, SEEDS_PER_LEVEL - 1);
      expect(decodeCityCode(encodeCityCode(level, seed))).toEqual({ level, seed });
    }
  });

  it('ignores case and surrounding whitespace', () => {
    const expected = decodeCityCode('RIO-3-4821');
    expect(expected).not.toBeNull();
    expect(decodeCityCode('rio-3-4821')).toEqual(expected);
    expect(decodeCityCode(' RIO-3-4821 ')).toEqual(expected);
  });

  it('returns null for invalid forms', () => {
    for (const bad of [
      'XXX-3-4821', // unknown name
      'RIO-0-4821', // level 0
      'RIO-100-4821', // level 100
      'RIO-03-4821', // leading zero
      'RIO-+3-4821', // junk before level
      'RIO-x3-4821',
      'RIO-3-482', // three digits
      'RIO-3-48211', // five digits
      'RIO-3-48a1',
      'RIO3-4821', // missing dash
      'RIO-34821',
      'RIO-3-4821-1', // extra part
      'RIO-3-4821 x',
      '-3-4821',
      '',
      '   ',
    ]) {
      expect(decodeCityCode(bad), bad).toBeNull();
    }
  });

  it('draws seeds in range from an Rng', () => {
    const rng = createRng(7);
    for (let i = 0; i < 200; i++) {
      const s = randomCitySeed(rng);
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(SEEDS_PER_LEVEL);
    }
  });
});
