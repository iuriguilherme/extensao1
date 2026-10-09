/**
 * Generated cities: a tree of subnets joined by routers, rebuilt on demand
 * from (level, seed) and never saved. Every plain city is a correct IPv4 plan
 * inside one /16 of 10.0.0.0/8, laid out in depth columns for the city map.
 *
 * Typed cities (unlocked by the pós-graduação tiers) keep the plain city's
 * tree and nodes, then change its addresses or labels with a second rng, so
 * plain cities never change: NAT puts private sites behind a public subnet,
 * VLAN labels every subnet with a VLAN, and IPv6 readdresses the whole plan.
 */

import type { MinigameId, NetNode, NodeRequirements } from '../data/nodes';
import { getNode, FINAL_NODE_ID } from '../data/nodes';
import { tierOfCityType, type TierCityType } from '../data/tiers';
import { formatIp, parseIp } from './ip';
import { formatIpv6, parseIpv6 } from './ipv6';
import {
  MAX_LEVEL, PUBLIC_NETWORKS, PUBLISHED_SERVICES, VLAN_NAMES, type PublishedService, type RoundContext, type TypedContext, type Vlan,
} from './minigames';
import { createRng, pick, randInt, shuffle, type Rng } from './random';

export type CityType = 'plain' | TierCityType;

/** How a city type reads in "uma cidade NAT". */
export const CITY_TYPE_LABELS: Record<CityType, string> = { plain: 'comum', nat: 'NAT', vlan: 'VLAN', ipv6: 'IPv6' };

/** Depth, branching and prefix spread stop growing at this level. */
export const STRUCTURE_MAX_LEVEL = 12;
/** A depth never holds more subnets than this, so a column fits the canvas. */
export const MAX_SUBNETS_PER_DEPTH = 3;

/** Column layout of the city map (the map scrolls sideways past 1280 px). */
export const CITY_COLUMN_X = 60;
export const CITY_COLUMN_WIDTH = 270;
const BOX_WIDTH = 200;
const BOX_HEIGHT = 160;
const AREA_TOP = 64;
const AREA_BOTTOM = 676;
const ROW_FIRST = 48;
const ROW_STEP = 48;

export interface CitySubnet {
  /** Index in `City.subnets`; 0 is the player's own subnet at depth 0. */
  id: number;
  network: string;
  prefix: number;
  depth: number;
  parentId: number | null;
  /** The router node in the parent subnet that leads here (null at depth 0). */
  routerId: string | null;
  /** That router's address inside this subnet (null at depth 0). */
  routerChildIp: string | null;
  /** Box drawn on the city map, in map coordinates. */
  box: { x: number; y: number; width: number; height: number };
  /** VLAN cities only: the segment's VLAN. */
  vlan?: Vlan;
  /** NAT cities only, on each private site's entry (depth 1): the service its router publishes. */
  publish?: { service: PublishedService; host: string };
}

export type CityNodeRole = 'host' | 'router' | 'core';

/** A NetNode placed in a city subnet. `ip` is the address in its own subnet. */
export interface CityNode extends NetNode {
  subnetId: number;
  role: CityNodeRole;
  /** For routers, the single subnet behind them; null otherwise. */
  childSubnetId: number | null;
}

export interface City {
  level: number;
  seed: number;
  /**
   * The block every subnet is carved from: a /16 such as `10.37.0.0`, the
   * private `192.168.0.0` behind a NAT city's public subnet, or an IPv6 /48.
   */
  network: string;
  subnets: CitySubnet[];
  nodes: CityNode[];
  coreId: string;
  /** Absent on plain cities, so their form (and the pinned hash) stays as it was. */
  type?: TierCityType;
}

/** The city's type, plain when it has none. */
export function cityType(city: { type?: TierCityType }): CityType {
  return city.type ?? 'plain';
}

export function generateCity(level: number, seed: number, type: CityType = 'plain'): City {
  const rng = createRng((Math.imul(seed >>> 0, 0x9e3779b1) ^ Math.imul(level, 0x85ebca6b)) >>> 0);
  const growth = Math.min(Math.max(level, 1), STRUCTURE_MAX_LEVEL);

  const tree = buildTree(rng, growth);
  const base = (10 * 2 ** 24 + randInt(rng, 1, 254) * 2 ** 16) >>> 0;
  const prefixes = tree.map(() => pickPrefix(rng, growth));
  const networks = carve(rng, base, prefixes);

  const subnets: CitySubnet[] = tree.map((t, id) => ({
    id,
    network: formatIp(networks[id]),
    prefix: prefixes[id],
    depth: t.depth,
    parentId: t.parentId,
    routerId: null,
    routerChildIp: null,
    box: { x: 0, y: 0, width: BOX_WIDTH, height: BOX_HEIGHT },
  }));

  // Hosts and routers per subnet. The incoming router takes the first usable
  // address of the child subnet, the default-gateway convention.
  const taken = subnets.map((s) => new Set<number>(s.parentId === null ? [] : [1]));
  const freeAddress = (subnet: CitySubnet): string => {
    const span = 2 ** (32 - subnet.prefix);
    let offset: number;
    do offset = randInt(rng, 1, span - 2);
    while (taken[subnet.id].has(offset));
    taken[subnet.id].add(offset);
    return formatIp(networks[subnet.id] + offset);
  };

  // A typed city gives its tier's area to the core and to every other node in
  // turn (at least half of them); the plain area draw still happens, so the
  // rest of the city is the plain one.
  const tierArea = type === 'plain' ? null : tierOfCityType(type).area;
  let turn = 0;
  const areaOf = (role: CityNodeRole, area: MinigameId): MinigameId => {
    if (!tierArea) return area;
    if (role === 'core') return tierArea;
    return turn++ % 2 === 0 ? tierArea : area;
  };

  const deepest = Math.max(...subnets.map((s) => s.depth));
  const coreSubnet = pick(rng, subnets.filter((s) => s.depth === deepest));
  const names = new Map<string, number>();
  const nodes: CityNode[] = [];

  for (const subnet of subnets) {
    const hostCount = randInt(rng, 1, growth >= 6 ? 3 : 2);
    const coreIndex = subnet === coreSubnet ? randInt(rng, 0, hostCount - 1) : -1;
    for (let k = 0; k < hostCount; k++) {
      const role: CityNodeRole = k === coreIndex ? 'core' : 'host';
      const area = pick(rng, AREAS);
      nodes.push(makeNode(`s${subnet.id}-h${k + 1}`, role, areaOf(role, area), subnet, freeAddress(subnet), level, growth, names));
    }
    for (const child of subnets.filter((s) => s.parentId === subnet.id)) {
      const router = makeNode(`r${child.id}`, 'router', areaOf('router', 'subnet'), subnet, freeAddress(subnet), level, growth, names);
      router.childSubnetId = child.id;
      nodes.push(router);
      child.routerId = router.id;
      child.routerChildIp = formatIp(networks[child.id] + 1);
    }
  }

  linkNodes(nodes);
  layout(subnets, nodes);
  const core = nodes.find((n) => n.role === 'core')!;
  const city: City = { level, seed, network: formatIp(base), subnets, nodes, coreId: core.id };
  if (type !== 'plain') {
    const typed = createRng((Math.imul(seed >>> 0, 0x2c1b3c6d) ^ Math.imul(level, 0x297a2d39) ^ TYPE_SALT[type]) >>> 0);
    TYPE_PASSES[type](city, typed);
    city.type = type;
  }
  return city;
}

const TYPE_SALT: Record<TierCityType, number> = { nat: 0x4e4154, vlan: 0x564c414e, ipv6: 0x495036 };

const TYPE_PASSES: Record<TierCityType, (city: City, rng: Rng) => void> = { nat: addressNat, vlan: labelVlans, ipv6: addressIpv6 };

/** Gives each subnet's nodes distinct addresses; the incoming router keeps the first usable one. */
function readdress(city: City, rng: Rng, address: (subnet: CitySubnet, offset: number) => string, maxOffset: number): void {
  for (const subnet of city.subnets) {
    const taken = new Set<number>([1]);
    subnet.routerChildIp = subnet.depth === 0 ? null : address(subnet, 1);
    for (const node of city.nodes.filter((n) => n.subnetId === subnet.id)) {
      let offset: number;
      do offset = randInt(rng, 2, maxOffset);
      while (taken.has(offset));
      taken.add(offset);
      node.ip = address(subnet, offset);
    }
  }
}

/**
 * NAT: the student subnet becomes a public /24, so each router out of it has
 * its public address there, and everything behind it is a private /24 of
 * 192.168.0.0/16. Each site entry publishes one service on one of its hosts.
 */
function addressNat(city: City, rng: Rng): void {
  const thirds = shuffle(rng, Array.from({ length: 255 }, (_, i) => i));
  const networks = city.subnets.map((s) => (s.depth === 0 ? parseIp(pick(rng, PUBLIC_NETWORKS))! : parseIp(`192.168.${thirds[s.id]}.0`)!));
  for (const subnet of city.subnets) {
    subnet.network = formatIp(networks[subnet.id]);
    subnet.prefix = 24;
  }
  readdress(city, rng, (subnet, offset) => formatIp(networks[subnet.id] + offset), 254);
  for (const subnet of city.subnets.filter((s) => s.depth === 1)) {
    const hosts = city.nodes.filter((n) => n.subnetId === subnet.id && n.role !== 'router');
    subnet.publish = { service: pick(rng, PUBLISHED_SERVICES), host: pick(rng, hosts).ip };
  }
  city.network = '192.168.0.0';
}

/** VLAN: every subnet is a segment with its own VLAN ID (in tens, never reserved) and name. */
function labelVlans(city: City, rng: Rng): void {
  const ids = shuffle(rng, Array.from({ length: 99 }, (_, i) => (i + 1) * 10));
  const names = shuffle(rng, VLAN_NAMES);
  city.subnets.forEach((subnet, i) => { subnet.vlan = { id: ids[i], name: names[i] }; });
}

/** IPv6: the city is a /48 of 2001:db8::/32 and every subnet a /64 inside it. */
function addressIpv6(city: City, rng: Rng): void {
  const site = (0x20010db8n << 96n) | (BigInt(randInt(rng, 1, 0xffff)) << 80n);
  const ids = shuffle(rng, Array.from({ length: 0xfff }, (_, i) => i + 1));
  const networks = city.subnets.map((s) => site | (BigInt(ids[s.id]) << 64n));
  for (const subnet of city.subnets) {
    subnet.network = formatIpv6(networks[subnet.id]);
    subnet.prefix = 64;
  }
  readdress(city, rng, (subnet, offset) => formatIpv6(networks[subnet.id] + BigInt(offset)), 0xfff);
  city.network = formatIpv6(site);
}

/** The node with this id in the city; throws when it does not exist. */
export function cityNode(city: City, id: string): CityNode {
  const node = city.nodes.find((n) => n.id === id);
  if (!node) throw new Error(`Unknown city node: ${id}`);
  return node;
}

/**
 * The addresses a city node's mini-game rounds are built from: its own subnet
 * and IP. IPv6 cities have no IPv4 addresses, so their rounds get none.
 */
export function roundContext(city: City, nodeId: string): RoundContext | undefined {
  if (city.type === 'ipv6') return undefined;
  const node = cityNode(city, nodeId);
  const subnet = city.subnets[node.subnetId];
  return { network: parseIp(subnet.network)!, prefix: subnet.prefix, host: parseIp(node.ip)! };
}

/**
 * What a typed city adds to its nodes' rounds: the node's VLAN, its IPv6
 * address, or its NAT site (its own, or the first site for nodes on the
 * public side). Plain cities add nothing.
 */
export function typedContext(city: City, nodeId: string): TypedContext | undefined {
  const node = cityNode(city, nodeId);
  const subnet = city.subnets[node.subnetId];
  switch (city.type) {
    case undefined: return undefined;
    case 'vlan': return { vlan: subnet.vlan };
    case 'ipv6': return { ipv6: { host: parseIpv6(node.ip)! } };
    case 'nat': {
      const inside = subnet.depth > 0;
      let site = inside ? subnet : city.subnets.find((s) => s.depth === 1)!;
      while (site.depth > 1) site = city.subnets[site.parentId!];
      return {
        nat: {
          publicIp: parseIp(cityNode(city, site.routerId!).ip)!,
          privateNetwork: parseIp((inside ? subnet : site).network)!,
          privatePrefix: 24,
          privateHost: parseIp(inside ? node.ip : site.publish!.host)!,
        },
      };
    }
  }
}

/**
 * City node difficulty: 1-3 at low levels, rising with level and depth, but
 * never past what the area's mini-game supports (only binary and subnet go
 * above 3).
 */
export function cityDifficulty(area: MinigameId, growth: number, depth: number): number {
  const computed = 1 + Math.floor((growth - 1 + depth) / 4);
  return Math.min(computed, MAX_LEVEL[area]);
}

const AREAS: readonly MinigameId[] = ['binary', 'subnet', 'ports', 'http', 'dns'];

interface TreeEntry {
  depth: number;
  parentId: number | null;
}

/** Subnets in breadth-first order, children grouped under their parents. */
function buildTree(rng: Rng, growth: number): TreeEntry[] {
  const maxDepth = 1 + Math.floor((growth - 1) / 2);
  const maxWidth = Math.min(MAX_SUBNETS_PER_DEPTH, 1 + Math.floor(growth / 4));
  const tree: TreeEntry[] = [{ depth: 0, parentId: null }];
  let previous = [0];
  for (let depth = 1; depth <= maxDepth; depth++) {
    const count = randInt(rng, 1, maxWidth);
    const parents = Array.from({ length: count }, () => pick(rng, previous)).sort((a, b) => a - b);
    previous = parents.map((parentId) => tree.push({ depth, parentId }) - 1);
  }
  return tree;
}

/** Only /24 at level 1; the spread widens to /21-/28 by the growth cap. */
function pickPrefix(rng: Rng, growth: number): number {
  const spread = Math.min(4, Math.floor(growth / 3));
  return randInt(rng, Math.max(21, 24 - spread), Math.min(28, 24 + spread));
}

/**
 * Aligned, non-overlapping blocks inside the /16. Largest blocks go first, so
 * the free space always splits into aligned slots of the current size and a
 * slot is always found (the largest city uses well under the /16).
 */
function carve(rng: Rng, base: number, prefixes: number[]): number[] {
  const UNIT = 16; // smallest block, a /28
  const used = new Uint8Array(2 ** 16 / UNIT);
  const order = prefixes.map((_, i) => i).sort((a, b) => prefixes[a] - prefixes[b] || a - b);
  const networks: number[] = new Array(prefixes.length);
  for (const i of order) {
    const units = 2 ** (32 - prefixes[i]) / UNIT;
    const free: number[] = [];
    for (let start = 0; start < used.length; start += units) {
      if (used[start] === 0) free.push(start);
    }
    const start = pick(rng, free);
    used.fill(1, start, start + units);
    networks[i] = (base + start * UNIT) >>> 0;
  }
  return networks;
}

/** What a city node is shown as: its area for hosts, or its role. */
type CityKind = MinigameId | 'router' | 'core';

const NAMES: Record<CityKind, string> = {
  binary: 'Estação',
  subnet: 'Servidor DHCP',
  ports: 'Firewall',
  http: 'Servidor Web',
  dns: 'Servidor DNS',
  nat: 'Gateway NAT',
  vlan: 'Switch de Acesso',
  ipv6: 'Servidor IPv6',
  router: 'Roteador',
  core: 'Núcleo da Cidade',
};

const FLAVORS: Record<CityKind, string> = {
  binary: 'Uma estação de trabalho comum. Tudo o que ela guarda está em binário.',
  subnet: 'Entrega os endereços desta rede. Faça as contas da sub-rede para entrar.',
  ports: 'Filtra o tráfego desta rede pelas portas. Saiba qual serviço usa cada uma.',
  http: 'Hospeda os sites internos. Leia as respostas dele para achar a brecha.',
  dns: 'Resolve os nomes da rede interna. Domine os tipos de registro.',
  nat: 'Traduz os endereços privados desta rede para o endereço público. Entenda o NAT para entrar.',
  vlan: 'Separa as máquinas desta rede em VLANs. Saiba ler as VLANs e as portas para entrar.',
  ipv6: 'Só fala IPv6. Domine a notação e os prefixos para entrar.',
  router: 'Liga esta sub-rede à próxima. Depois de invadir, escreva a rota até lá.',
  core: 'O centro da rede da cidade. Invada aqui para concluir o exercício.',
};

function makeNode(
  id: string, role: CityNodeRole, area: MinigameId, subnet: CitySubnet, ip: string,
  level: number, growth: number, names: Map<string, number>,
): CityNode {
  const kind: CityKind = role === 'host' ? area : role;
  let name = NAMES[kind];
  if (role !== 'core') {
    const n = (names.get(kind) ?? 0) + 1;
    names.set(kind, n);
    name = `${name} ${n}`;
  }
  const depth = subnet.depth + (role === 'core' ? 1 : 0);
  const baseReward = 100 + 40 * level + 60 * subnet.depth;
  return {
    id, name, ip, x: 0, y: 0,
    minigame: area,
    difficulty: cityDifficulty(area, growth, depth),
    links: [],
    requires: requirements(growth, depth),
    reward: role === 'core' ? baseReward * 3 : baseReward,
    flavor: FLAVORS[kind],
    subnetId: subnet.id,
    role,
    childSubnetId: null,
  };
}

/** Scales toward the Data Center Core's requirements and never exceeds them. */
function requirements(growth: number, depth: number): NodeRequirements {
  const cap = getNode(FINAL_NODE_ID).requires;
  const share = Math.min(1, (growth + depth) / (STRUCTURE_MAX_LEVEL + 7));
  const ram = cap.ramGB! * share;
  return {
    cpuPower: Math.max(1, Math.floor(cap.cpuPower! * share)),
    ramGB: Math.min(cap.ramGB!, 2 ** Math.max(2, Math.floor(Math.log2(ram)))),
    storageGB: Math.max(50, Math.floor((cap.storageGB! * share) / 50) * 50),
    linkMbps: share < 0.35 ? 100 : share < 0.8 ? 1000 : cap.linkMbps!,
  };
}

/** Hosts on a subnet see each other; a router also links to its child subnet. */
function linkNodes(nodes: CityNode[]): void {
  const link = (a: CityNode, b: CityNode) => {
    if (!a.links.includes(b.id)) a.links.push(b.id);
    if (!b.links.includes(a.id)) b.links.push(a.id);
  };
  for (const a of nodes) {
    for (const b of nodes) {
      if (a !== b && a.subnetId === b.subnetId) link(a, b);
    }
    if (a.childSubnetId !== null) {
      for (const b of nodes) if (b.subnetId === a.childSubnetId) link(a, b);
    }
  }
}

/** Depth columns of subnet boxes; hosts on the left, routers on the right. */
function layout(subnets: CitySubnet[], nodes: CityNode[]): void {
  const byDepth = new Map<number, CitySubnet[]>();
  for (const s of subnets) byDepth.set(s.depth, [...(byDepth.get(s.depth) ?? []), s]);
  for (const [depth, column] of byDepth) {
    const band = (AREA_BOTTOM - AREA_TOP) / column.length;
    column.forEach((s, i) => {
      s.box.x = CITY_COLUMN_X + depth * CITY_COLUMN_WIDTH;
      s.box.y = Math.round(AREA_TOP + i * band + (band - BOX_HEIGHT) / 2);
    });
  }
  for (const s of subnets) {
    const members = nodes.filter((n) => n.subnetId === s.id);
    const hosts = members.filter((n) => n.role !== 'router');
    const routers = members.filter((n) => n.role === 'router');
    hosts.forEach((n, row) => place(n, s, 0.25, row));
    routers.forEach((n, row) => place(n, s, 0.75, row));
  }
}

function place(node: CityNode, subnet: CitySubnet, across: number, row: number): void {
  node.x = Math.round(subnet.box.x + subnet.box.width * across);
  node.y = subnet.box.y + ROW_FIRST + row * ROW_STEP;
}
