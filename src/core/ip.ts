/** Pure IPv4 helpers used by network setup and the subnet mini-game. */

export function parseIp(text: string): number | null {
  const parts = text.trim().split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value >>> 0;
}

export function formatIp(value: number): string {
  return [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join('.');
}

export function prefixToMask(prefix: number): number {
  return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
}

/** Returns the prefix length for a valid (contiguous) mask, otherwise null. */
export function maskToPrefix(mask: number): number | null {
  const inverted = ~mask >>> 0;
  // A valid mask's inverse is 2^k - 1.
  if ((inverted & (inverted + 1)) !== 0) return null;
  return 32 - Math.log2(inverted + 1);
}

export function networkAddress(ip: number, prefix: number): number {
  return (ip & prefixToMask(prefix)) >>> 0;
}

export function broadcastAddress(ip: number, prefix: number): number {
  return (networkAddress(ip, prefix) | (~prefixToMask(prefix) >>> 0)) >>> 0;
}

export function sameSubnet(a: number, b: number, prefix: number): boolean {
  return networkAddress(a, prefix) === networkAddress(b, prefix);
}

export function usableHosts(prefix: number): number {
  if (prefix >= 31) return 0;
  return 2 ** (32 - prefix) - 2;
}

export interface LanInfo {
  routerIp: string;
  mask: string;
  /** Hosts already using an address on the LAN, name → IP. */
  takenBy: Record<string, string>;
  dnsServers: string[];
}

export interface NetConfig {
  ip: string;
  mask: string;
  gateway: string;
  dns: string;
}

/** Stable problem codes: tests and logic check these, never the message wording. */
export type NetIssueCode =
  | 'ip-invalid' | 'mask-invalid' | 'mask-mismatch' | 'ip-outside' | 'ip-network' | 'ip-broadcast'
  | 'ip-conflict' | 'gateway-invalid' | 'gateway-not-router' | 'dns-invalid' | 'dns-unknown';

export interface NetIssue {
  code: NetIssueCode;
  message: string;
}

/**
 * Validates a manual IPv4 configuration against the LAN, returning a list of
 * teaching-oriented problems (empty when the configuration works).
 */
export function validateNetConfig(config: NetConfig, lan: LanInfo): NetIssue[] {
  const errors: NetIssue[] = [];
  const fail = (code: NetIssueCode, message: string) => errors.push({ code, message });
  const ip = parseIp(config.ip);
  const mask = parseIp(config.mask);
  const gateway = parseIp(config.gateway);
  const dns = parseIp(config.dns);
  const routerIp = parseIp(lan.routerIp)!;
  const lanPrefix = maskToPrefix(parseIp(lan.mask)!)!;

  if (ip === null) fail('ip-invalid', `IP "${config.ip}" is not a valid IPv4 address (4 octets, 0–255).`);
  if (mask === null || maskToPrefix(mask) === null) {
    fail('mask-invalid', `"${config.mask}" is not a valid subnet mask.`);
  } else if (maskToPrefix(mask) !== lanPrefix) {
    fail('mask-mismatch', `Mask ${config.mask} does not match the LAN (${lan.mask}). Hosts must agree on where the network ends.`);
  }

  if (ip !== null) {
    if (!sameSubnet(ip, routerIp, lanPrefix)) {
      fail('ip-outside', `${config.ip} is outside the LAN ${formatIp(networkAddress(routerIp, lanPrefix))}/${lanPrefix}. The router cannot reach you directly.`);
    } else if (ip === networkAddress(routerIp, lanPrefix)) {
      fail('ip-network', `${config.ip} is the NETWORK address of this subnet; hosts cannot use it.`);
    } else if (ip === broadcastAddress(routerIp, lanPrefix)) {
      fail('ip-broadcast', `${config.ip} is the BROADCAST address of this subnet; hosts cannot use it.`);
    } else {
      for (const [name, taken] of Object.entries(lan.takenBy)) {
        if (parseIp(taken) === ip) fail('ip-conflict', `${config.ip} is already used by ${name}. Two hosts with the same IP cause a conflict.`);
      }
    }
  }

  if (gateway === null) {
    fail('gateway-invalid', `Gateway "${config.gateway}" is not a valid IPv4 address.`);
  } else if (gateway !== routerIp) {
    fail('gateway-not-router', `Gateway ${config.gateway} is not your router. Traffic to other networks would go nowhere.`);
  }

  if (dns === null) {
    fail('dns-invalid', `DNS "${config.dns}" is not a valid IPv4 address.`);
  } else if (!lan.dnsServers.some((s) => parseIp(s) === dns)) {
    fail('dns-unknown', `${config.dns} is not a DNS server. Names like example.com would not resolve.`);
  }

  return errors;
}
