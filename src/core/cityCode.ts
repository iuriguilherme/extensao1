/**
 * City codes: `NAME-level-NNNN`, e.g. `RIO-3-4821`. Seed = nameIndex * 10000 + NNNN.
 * Typed cities add a prefix: `NAT-RIO-3-4821`, `VLAN-…`, `IP6-…`.
 */

import type { TierCityType } from '../data/tiers';
import type { CityType } from './city';
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

export const TYPE_PREFIXES: Record<TierCityType, string> = { nat: 'NAT', vlan: 'VLAN', ipv6: 'IP6' };

export interface CityCode {
  level: number;
  seed: number;
  type: CityType;
}

export function encodeCityCode(level: number, seed: number, type: CityType = 'plain'): string {
  const name = CITY_NAMES[Math.floor(seed / DIGITS_RANGE)];
  const digits = String(seed % DIGITS_RANGE).padStart(4, '0');
  const prefix = type === 'plain' ? '' : `${TYPE_PREFIXES[type]}-`;
  return `${prefix}${name}-${level}-${digits}`;
}

/**
 * Returns null for anything that is not a valid code. `NAT-3-0012` is the
 * plain city named NAT (Natal); its NAT city is `NAT-NAT-3-0012`.
 */
export function decodeCityCode(text: string): CityCode | null {
  const m = /^(?:(NAT|VLAN|IP6)-)?([A-Z]{3})-([1-9][0-9]?)-([0-9]{4})$/.exec(text.trim().toUpperCase());
  if (!m) return null;
  const index = (CITY_NAMES as readonly string[]).indexOf(m[2]);
  if (index < 0) return null;
  const type = (Object.keys(TYPE_PREFIXES) as TierCityType[]).find((t) => TYPE_PREFIXES[t] === m[1]) ?? 'plain';
  return { level: Number(m[3]), seed: index * DIGITS_RANGE + Number(m[4]), type };
}

export function randomCitySeed(rng: Rng): number {
  return randInt(rng, 0, SEEDS_PER_LEVEL - 1);
}
