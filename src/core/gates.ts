/**
 * Router gates of typed cities. After a breach, a router opens the subnet
 * behind it once the student writes the right entry: a route in plain cities
 * and inside NAT sites, a port forward out of a NAT city's public subnet, a
 * VLAN ID and port mode in VLAN cities, and an IPv6 route in IPv6 cities.
 *
 * Every gate works like the plain route form: a pick-with-arrows form whose
 * options hold the right value and wrong ones that each trip a teaching
 * error, and a validator whose messages name the mistake, never the answer.
 */

import { cityNode, type City, type CityNode, type CitySubnet } from './city';
import { broadcastAddress, formatIp, parseIp, sameSubnet } from './ip';
import { formatIpv6Full, inIpv6Prefix, parseIpv6 } from './ipv6';
import { privateRangeOf, PUBLISHED_SERVICES, vlanIdVerdict, type Vlan } from './minigames';
import { createRng, pick, shuffle, type Rng } from './random';
import { correctRoute, routeChoices, validateRoute, type RouteChoices, type RouteEntry, type RouteIssueCode } from './routing';

export type GateKind = 'route' | 'nat' | 'vlan' | 'ipv6';

/** A port forward: what reaches the public address and port goes to the private ones. */
export interface NatEntry {
  publicAddress: string;
  publicPort: number;
  privateAddress: string;
  privatePort: number;
}

export type PortMode = 'access' | 'trunk';

export interface VlanEntry {
  vlanId: number;
  mode: PortMode;
}

/** An IPv6 route; addresses are accepted in compressed or full form. */
export interface Ipv6Entry {
  destination: string;
  prefix: number;
  nextHop: string;
}

export type GateEntry =
  | ({ kind: 'route' } & RouteEntry)
  | ({ kind: 'nat' } & NatEntry)
  | ({ kind: 'vlan' } & VlanEntry)
  | ({ kind: 'ipv6' } & Ipv6Entry);

/** Field options for a gate form; each list holds the correct value. */
export type GateChoices =
  | ({ kind: 'route' } & RouteChoices)
  | { kind: 'nat'; publicAddress: string[]; publicPort: number[]; privateAddress: string[]; privatePort: number[] }
  | { kind: 'vlan'; vlanId: number[]; mode: PortMode[] }
  | { kind: 'ipv6'; destination: string[]; prefix: number[]; nextHop: string[] };

/** Stable problem codes: tests and logic check these, never the message wording. */
export type GateIssueCode = RouteIssueCode
  | 'nat-swapped' | 'nat-public-not-router' | 'nat-network' | 'nat-broadcast' | 'nat-wrong-host' | 'nat-private-outside'
  | 'nat-wrong-port'
  | 'vlan-default' | 'vlan-reserved' | 'vlan-invalid' | 'vlan-wrong-id' | 'vlan-wrong-mode'
  | 'ipv6-not-prefix' | 'ipv6-other-network' | 'ipv6-prefix-length' | 'ipv6-next-hop-outside' | 'ipv6-next-hop-not-router';

export interface GateIssue {
  code: GateIssueCode;
  message: string;
}

function routerOf(city: City, routerId: string): CityNode {
  const router = cityNode(city, routerId);
  if (router.role !== 'router' || router.childSubnetId === null) throw new Error(`Not a city router: ${routerId}`);
  return router;
}

/** Only the routers out of a NAT city's public subnet translate; the sites behind them route as usual. */
export function gateKind(city: City, routerId: string): GateKind {
  const router = routerOf(city, routerId);
  switch (city.type) {
    case 'nat': return city.subnets[router.subnetId].depth === 0 ? 'nat' : 'route';
    case 'vlan': return 'vlan';
    case 'ipv6': return 'ipv6';
    default: return 'route';
  }
}

/** What a VLAN gate's panel shows: the hidden segment, every VLAN its link carries, and the switch table. */
export function vlanGate(city: City, routerId: string): { segment: Vlan; carried: Vlan[]; table: Vlan[] } {
  const child = city.subnets[routerOf(city, routerId).childSubnetId!];
  const below = (subnet: CitySubnet): CitySubnet[] => [subnet, ...city.subnets.filter((s) => s.parentId === subnet.id).flatMap(below)];
  return {
    segment: child.vlan!,
    carried: below(child).map((s) => s.vlan!),
    table: city.subnets.map((s) => s.vlan!).sort((a, b) => a.id - b.id),
  };
}

/** The entry that opens the subnet behind this router. */
export function correctGate(city: City, routerId: string): GateEntry {
  const router = routerOf(city, routerId);
  const child = city.subnets[router.childSubnetId!];
  switch (gateKind(city, routerId)) {
    case 'route': return { kind: 'route', ...correctRoute(city, routerId) };
    case 'nat': {
      const { service, host } = child.publish!;
      return { kind: 'nat', publicAddress: router.ip, publicPort: service.port, privateAddress: host, privatePort: service.port };
    }
    case 'vlan': return { kind: 'vlan', vlanId: child.vlan!.id, mode: vlanGate(city, routerId).carried.length > 1 ? 'trunk' : 'access' };
    case 'ipv6': return { kind: 'ipv6', destination: child.network, prefix: child.prefix, nextHop: router.ip };
  }
}

/** Checks a gate entry, returning one teaching problem per wrong field (empty when it is right). */
export function validateGate(city: City, routerId: string, entry: GateEntry): GateIssue[] {
  if (entry.kind !== gateKind(city, routerId)) throw new Error(`Wrong gate kind for ${routerId}: ${entry.kind}`);
  const router = routerOf(city, routerId);
  switch (entry.kind) {
    case 'route': {
      const { kind: _kind, ...route } = entry;
      return validateRoute(route, city, routerId);
    }
    case 'nat': return validateNat(city, router, entry);
    case 'vlan': return validateVlan(city, routerId, entry);
    case 'ipv6': return validateIpv6(city, router, entry);
  }
}

function validateNat(city: City, router: CityNode, entry: NatEntry): GateIssue[] {
  const site = city.subnets[router.childSubnetId!];
  const { service, host } = site.publish!;
  const issues: GateIssue[] = [];
  const fail = (code: GateIssueCode, message: string) => issues.push({ code, message });
  const outside = parseIp(entry.publicAddress);
  const inside = parseIp(entry.privateAddress);
  if (outside === null || inside === null) throw new Error(`Malformed port forward: ${JSON.stringify(entry)}`);

  // Outside: what the internet reaches is the router's public address.
  if (privateRangeOf(outside) !== null) {
    fail('nat-swapped', `${entry.publicAddress} é um endereço privado, e a internet não chega nele. Do lado de fora, a regra usa o endereço público deste roteador.`);
  } else if (outside !== parseIp(router.ip)) {
    fail('nat-public-not-router', `${entry.publicAddress} não é o endereço público deste roteador: o que chegar nele não passa por aqui. Use o endereço que o roteador tem na rede pública.`);
  }
  if (entry.publicPort !== service.port) {
    fail('nat-wrong-port', `A porta pública ${entry.publicPort} não é a do serviço publicado. Quem vem de fora procura o serviço na porta padrão dele.`);
  }

  // Inside: the host that runs the published service.
  const network = parseIp(site.network)!;
  if (privateRangeOf(inside) === null) {
    fail('nat-swapped', `${entry.privateAddress} é um endereço público. Do lado de dentro, a regra aponta para o host privado que roda o serviço.`);
  } else if (!sameSubnet(inside, network, site.prefix)) {
    fail('nat-private-outside', `${entry.privateAddress} não fica na rede que está atrás deste roteador. O host do serviço está na rede do outro lado dele.`);
  } else if (inside === network) {
    fail('nat-network', `${entry.privateAddress} é o endereço de rede, não um host. A regra precisa apontar para a máquina que roda o serviço.`);
  } else if (inside === broadcastAddress(network, site.prefix)) {
    fail('nat-broadcast', `${entry.privateAddress} é o endereço de broadcast da rede, não um host. A regra precisa apontar para a máquina que roda o serviço.`);
  } else if (inside !== parseIp(host)) {
    fail('nat-wrong-host', `${entry.privateAddress} fica na rede certa, mas não é o host que roda o serviço publicado. Confira no painel o final do endereço dele.`);
  }
  if (entry.privatePort !== service.port) {
    fail('nat-wrong-port', `A porta ${entry.privatePort} não é a que o serviço escuta no host. Confira no painel qual serviço está publicado.`);
  }
  return issues;
}

function validateVlan(city: City, routerId: string, entry: VlanEntry): GateIssue[] {
  const gate = vlanGate(city, routerId);
  const issues: GateIssue[] = [];
  const fail = (code: GateIssueCode, message: string) => issues.push({ code, message });
  const look = 'Procure na tabela o ID do segmento que fica atrás deste roteador.';

  switch (vlanIdVerdict(entry.vlanId)) {
    case 'default':
      fail('vlan-default', `A VLAN 1 é a padrão do switch, onde toda porta começa, e não separa nenhum segmento. ${look}`);
      break;
    case 'reserved':
      fail('vlan-reserved', `O ID ${entry.vlanId} é reservado (de 1002 a 1005) e não pode ser usado. ${look}`);
      break;
    case 'range':
      fail('vlan-invalid', `O ID ${entry.vlanId} não existe: os IDs de VLAN vão de 1 a 4094. ${look}`);
      break;
    case 'ok':
      if (entry.vlanId !== gate.segment.id) {
        const other = gate.table.find((v) => v.id === entry.vlanId);
        fail('vlan-wrong-id', other
          ? `A VLAN ${entry.vlanId} é do segmento ${other.name}, não do que fica atrás deste roteador. Ache na tabela o nome certo.`
          : `A VLAN ${entry.vlanId} não está na tabela deste switch. ${look}`);
      }
  }

  const several = gate.carried.length > 1;
  if (entry.mode === 'access' && several) {
    fail('vlan-wrong-mode', 'Este link leva mais de uma VLAN, e uma porta de acesso só leva uma. Conte as VLANs que passam por ele.');
  } else if (entry.mode === 'trunk' && !several) {
    fail('vlan-wrong-mode', 'Este link leva uma VLAN só, e tronco é para links que levam várias. Conte as VLANs que passam por ele.');
  }
  return issues;
}

function validateIpv6(city: City, router: CityNode, entry: Ipv6Entry): GateIssue[] {
  const child = city.subnets[router.childSubnetId!];
  const parent = city.subnets[router.subnetId];
  const issues: GateIssue[] = [];
  const fail = (code: GateIssueCode, message: string) => issues.push({ code, message });
  const destination = parseIpv6(entry.destination);
  const nextHop = parseIpv6(entry.nextHop);
  if (destination === null || nextHop === null || !Number.isInteger(entry.prefix)) {
    throw new Error(`Malformed IPv6 route: ${JSON.stringify(entry)}`);
  }

  const childNet = parseIpv6(child.network)!;
  if (!inIpv6Prefix(destination, childNet, child.prefix)) {
    fail('ipv6-other-network', `${entry.destination} não é a rede que fica atrás deste roteador. Pegue o endereço da interface do outro lado e fique só com o prefixo.`);
  } else if (destination !== childNet) {
    fail('ipv6-not-prefix', `${entry.destination} é o endereço de um host, não o prefixo da rede. O destino da rota é a rede inteira: zere a parte do host.`);
  }
  if (entry.prefix !== child.prefix) {
    fail('ipv6-prefix-length', `O prefixo /${entry.prefix} não é o da rede que fica atrás deste roteador. Confira o prefixo da interface do outro lado: a rota usa o mesmo.`);
  }
  if (!inIpv6Prefix(nextHop, parseIpv6(parent.network)!, parent.prefix)) {
    fail('ipv6-next-hop-outside', `${entry.nextHop} não fica na rede deste lado do roteador, então você não alcança esse endereço direto. O próximo salto é um endereço da rede onde você já está.`);
  } else if (nextHop !== parseIpv6(router.ip)) {
    fail('ipv6-next-hop-not-router', `${entry.nextHop} fica na rede deste lado, mas não é este roteador. O próximo salto é o endereço que o roteador usa deste lado.`);
  }
  return issues;
}

/**
 * The form's options for one gate: the correct value plus wrong ones that
 * each trip a different check. Seeded from the city and the router, so they
 * stay the same on every visit. IPv6 lists show the right value in both its
 * compressed and its full form.
 */
export function gateChoices(city: City, routerId: string): GateChoices {
  const router = routerOf(city, routerId);
  const child = city.subnets[router.childSubnetId!];
  const right = correctGate(city, routerId);
  const rng = createRng((Math.imul(city.seed >>> 0, 0x6c8e9cf5) ^ Math.imul(city.level, 0x7feb352d) ^ hash(routerId)) >>> 0);
  const peers = city.nodes.filter((n) => n.subnetId === router.subnetId && n.id !== router.id).map((n) => n.ip);
  const list = <T>(items: T[]) => shuffle(rng, [...new Set(items)]);

  switch (right.kind) {
    case 'route': return { kind: 'route', ...routeChoices(city, routerId) };
    case 'nat': {
      const { service } = child.publish!;
      const network = parseIp(child.network)!;
      const otherPorts = PUBLISHED_SERVICES.filter((s) => s !== service).map((s) => s.port);
      return {
        kind: 'nat',
        publicAddress: list([right.publicAddress, right.privateAddress, ...pickSome(rng, peers, 1)]),
        publicPort: list([right.publicPort, service.altPort, ...pickSome(rng, otherPorts, 1)]),
        privateAddress: list([
          right.privateAddress, formatIp(broadcastAddress(network, child.prefix)), child.network, right.publicAddress, child.routerChildIp!,
        ]),
        privatePort: list([right.privatePort, ...pickSome(rng, otherPorts, 2)]),
      };
    }
    case 'vlan': {
      const neighbor = city.subnets[child.parentId!].vlan!.id;
      return {
        kind: 'vlan',
        vlanId: list([right.vlanId, 1, 4095, pick(rng, [1002, 1003, 1004, 1005]), neighbor]),
        mode: list<PortMode>(['access', 'trunk']),
      };
    }
    case 'ipv6': {
      const full = (text: string) => formatIpv6Full(parseIpv6(text)!);
      const parent = city.subnets[router.subnetId];
      const others = city.subnets.filter((s) => s.id !== child.id && s.id !== parent.id).map((s) => s.network);
      const outside = city.nodes.filter((n) => n.subnetId !== router.subnetId).map((n) => n.ip);
      return {
        kind: 'ipv6',
        destination: list([right.destination, full(right.destination), child.routerChildIp!, parent.network, ...pickSome(rng, others, 1)]),
        prefix: list([right.prefix, 48, 56, 128]),
        nextHop: list([right.nextHop, full(right.nextHop), child.routerChildIp!, ...pickSome(rng, peers, 1), ...pickSome(rng, outside, 1)]),
      };
    }
  }
}

function pickSome<T>(rng: Rng, items: readonly T[], count: number): T[] {
  return shuffle(rng, items).slice(0, count);
}

/** FNV-1a over the router id, mixed into the choice seed. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}
