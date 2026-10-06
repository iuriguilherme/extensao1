/** City codes: `NAME-level-NNNN`, e.g. `RIO-3-4821`. Seed = nameIndex * 10000 + NNNN. */

import { randInt, type Rng } from './random';

export const CITY_NAMES = [
  'POA', 'VER', 'RIO', 'SAO', 'BSB', 'REC', 'SSA', 'FOR',
  'BEL', 'MAN', 'CWB', 'FLN', 'BHZ', 'GYN', 'CGR', 'NAT',
  'JPA', 'MCZ', 'AJU', 'THE', 'SLZ', 'PMW', 'BVB', 'MCP',
  'RBR', 'PVH', 'CGB', 'VIX', 'CXS', 'PEL', 'SMA', 'BGE',
] as const;

export const MAX_CITY_LEVEL = 99;
const DIGITS_RANGE = 10000;
export const SEEDS_PER_LEVEL = CITY_NAMES.length * DIGITS_RANGE;

export interface CityCode {
  level: number;
  seed: number;
}

export function encodeCityCode(level: number, seed: number): string {
  const name = CITY_NAMES[Math.floor(seed / DIGITS_RANGE)];
  const digits = String(seed % DIGITS_RANGE).padStart(4, '0');
  return `${name}-${level}-${digits}`;
}

/** Returns null for anything that is not a valid code. */
export function decodeCityCode(text: string): CityCode | null {
  const m = /^([A-Z]{3})-([1-9][0-9]?)-([0-9]{4})$/.exec(text.trim().toUpperCase());
  if (!m) return null;
  const index = (CITY_NAMES as readonly string[]).indexOf(m[1]);
  if (index < 0) return null;
  return { level: Number(m[2]), seed: index * DIGITS_RANGE + Number(m[3]) };
}

export function randomCitySeed(rng: Rng): number {
  return randInt(rng, 0, SEEDS_PER_LEVEL - 1);
}
