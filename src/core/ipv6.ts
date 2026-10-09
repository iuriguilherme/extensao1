/**
 * Pure IPv6 helpers for the IPv6 cities and mini-game. Addresses are 128-bit
 * bigints; text follows RFC 5952 (lowercase, longest zero run folded to "::").
 */

const GROUPS = 8;
const ALL_ONES = (1n << 128n) - 1n;

/** Parses full or compressed notation; null for anything else. */
export function parseIpv6(text: string): bigint | null {
  const halves = text.trim().toLowerCase().split('::');
  if (halves.length > 2) return null;
  const groups = (half: string) => (half === '' ? [] : half.split(':'));
  const head = groups(halves[0]);
  const tail = halves.length === 2 ? groups(halves[1]) : [];
  const count = head.length + tail.length;
  if (halves.length === 1 ? count !== GROUPS : count > GROUPS - 1) return null;
  const all = [...head, ...Array<string>(GROUPS - count).fill('0'), ...tail];
  let value = 0n;
  for (const group of all) {
    if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
    value = (value << 16n) | BigInt(parseInt(group, 16));
  }
  return value;
}

function groupsOf(value: bigint): number[] {
  return Array.from({ length: GROUPS }, (_, i) => Number((value >> BigInt(16 * (GROUPS - 1 - i))) & 0xffffn));
}

/** RFC 5952: no leading zeros, and the longest run of two or more zero groups (leftmost on a tie) as "::". */
export function formatIpv6(value: bigint): string {
  const groups = groupsOf(value);
  let best = { start: -1, length: 1 };
  for (let i = 0; i < GROUPS; i++) {
    let j = i;
    while (j < GROUPS && groups[j] === 0) j++;
    if (j - i > best.length) best = { start: i, length: j - i };
    i = Math.max(i, j);
  }
  const hex = (gs: number[]) => gs.map((g) => g.toString(16)).join(':');
  if (best.start < 0) return hex(groups);
  return `${hex(groups.slice(0, best.start))}::${hex(groups.slice(best.start + best.length))}`;
}

/** Eight groups of four digits: 2001:0db8:0000:…. */
export function formatIpv6Full(value: bigint): string {
  return groupsOf(value).map((g) => g.toString(16).padStart(4, '0')).join(':');
}

/** The address with every bit after the prefix cleared. */
export function ipv6Network(value: bigint, prefix: number): bigint {
  const hostBits = BigInt(128 - prefix);
  return value & (ALL_ONES ^ ((1n << hostBits) - 1n));
}

export function inIpv6Prefix(value: bigint, network: bigint, prefix: number): boolean {
  return ipv6Network(value, prefix) === ipv6Network(network, prefix);
}
