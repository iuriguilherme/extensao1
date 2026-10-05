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

  if (ip === null) fail('ip-invalid', `"${config.ip}" não é um IPv4 válido: são 4 octetos, cada um de 0 a 255.`);
  if (mask === null || maskToPrefix(mask) === null) {
    fail('mask-invalid', `"${config.mask}" não é uma máscara de sub-rede válida.`);
  } else if (maskToPrefix(mask) !== lanPrefix) {
    fail('mask-mismatch', `A máscara ${config.mask} é diferente da usada na LAN (${lan.mask}). Todos os hosts precisam da mesma máscara para saber até onde vai a rede.`);
  }

  if (ip !== null) {
    if (!sameSubnet(ip, routerIp, lanPrefix)) {
      fail('ip-outside', `${config.ip} não faz parte da LAN ${formatIp(networkAddress(routerIp, lanPrefix))}/${lanPrefix}, então o roteador não consegue falar direto com você.`);
    } else if (ip === networkAddress(routerIp, lanPrefix)) {
      fail('ip-network', `${config.ip} é o endereço de REDE desta sub-rede: nenhum host pode usar esse endereço.`);
    } else if (ip === broadcastAddress(routerIp, lanPrefix)) {
      fail('ip-broadcast', `${config.ip} é o endereço de BROADCAST desta sub-rede: nenhum host pode usar esse endereço.`);
    } else {
      for (const [name, taken] of Object.entries(lan.takenBy)) {
        if (parseIp(taken) === ip) fail('ip-conflict', `${config.ip} já pertence a outro aparelho (${name}). Dois hosts com o mesmo IP entram em conflito.`);
      }
    }
  }

  if (gateway === null) {
    fail('gateway-invalid', `"${config.gateway}" não é um IPv4 válido para o gateway.`);
  } else if (gateway !== routerIp) {
    fail('gateway-not-router', `O gateway ${config.gateway} não é o seu roteador: o que você mandar para outras redes não vai chegar a lugar nenhum.`);
  }

  if (dns === null) {
    fail('dns-invalid', `"${config.dns}" não é um IPv4 válido para o DNS.`);
  } else if (!lan.dnsServers.some((s) => parseIp(s) === dns)) {
    fail('dns-unknown', `${config.dns} não é um servidor DNS: nomes como example.com não vão ser traduzidos em IP.`);
  }

  return errors;
}
