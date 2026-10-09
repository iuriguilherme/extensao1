/**
 * Pós-graduação: optional tiers after the formatura, in a fixed order. Each
 * pairs a lecture pack with a city type. A tier opens when the previous
 * certificate (the conclusão one, for the first) is presented; tier state is
 * derived from certificates and never stored apart (src/core/certificates.ts).
 */

import type { Gender } from '../core/fmt';
import type { MinigameId } from './nodes';

export type TierId = 'especializacao' | 'mestrado' | 'doutorado';

/** City types the tiers unlock; plain cities need none. */
export type TierCityType = 'nat' | 'vlan' | 'ipv6';

export interface Tier {
  id: TierId;
  /** Printed on the certificate and used in the Hub's goals. */
  title: string;
  /** For agreeing words: "da Especialização", "do Mestrado". */
  gender: Gender;
  /** What the tier teaches, as a short subtitle. */
  topic: string;
  cityType: TierCityType;
  /** The mini-game area its city nodes and side jobs add. */
  area: MinigameId;
  /** The lecture pack; each lesson requires the one before it. */
  lessons: string[];
}

export const TIERS: Tier[] = [
  {
    id: 'especializacao', title: 'Especialização', gender: 'f', topic: 'NAT e redirecionamento de porta',
    cityType: 'nat', area: 'nat', lessons: ['nat-basics', 'port-forwarding'],
  },
  {
    id: 'mestrado', title: 'Mestrado', gender: 'm', topic: 'VLANs',
    cityType: 'vlan', area: 'vlan', lessons: ['vlan-basics', 'vlan-trunks'],
  },
  {
    id: 'doutorado', title: 'Doutorado', gender: 'm', topic: 'IPv6',
    cityType: 'ipv6', area: 'ipv6', lessons: ['ipv6-basics', 'ipv6-routing'],
  },
];

export function getTier(id: TierId): Tier {
  const tier = TIERS.find((t) => t.id === id);
  if (!tier) throw new Error(`Unknown tier: ${id}`);
  return tier;
}

export function tierOfCityType(type: TierCityType): Tier {
  const tier = TIERS.find((t) => t.cityType === type);
  if (!tier) throw new Error(`No tier for city type: ${type}`);
  return tier;
}
