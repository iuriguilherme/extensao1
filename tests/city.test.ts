import { describe, expect, it } from 'vitest';
import { cityDifficulty, generateCity, roundContext, typedContext, type City, type CityType } from '../src/core/city';
import { broadcastAddress, networkAddress, parseIp } from '../src/core/ip';
import { inIpv6Prefix, ipv6Network, parseIpv6 } from '../src/core/ipv6';
import { MAX_LEVEL, privateRangeOf, PUBLISHED_SERVICES, vlanIdVerdict } from '../src/core/minigames';
import { NODES, getNode } from '../src/data/nodes';
import { tierOfCityType, type TierCityType } from '../src/data/tiers';

/** Levels 1-30 with seeds 1-50, and levels 31-99 with seeds 1-5. */
function sampleCities(): City[] {
  const cities: City[] = [];
  for (let level = 1; level <= 30; level++) {
    for (let seed = 1; seed <= 50; seed++) cities.push(generateCity(level, seed));
  }
  for (let level = 31; level <= 99; level++) {
    for (let seed = 1; seed <= 5; seed++) cities.push(generateCity(level, seed));
  }
  return cities;
}

const CITIES = sampleCities();

const CAMPAIGN_IDS = new Set(NODES.map((n) => n.id));

function tag(city: City): string {
  return `L${city.level}/S${city.seed}:`;
}

/** Collects broken properties so thousands of cities cost one assertion. */
function collector() {
  const problems: string[] = [];
  return {
    check: (ok: boolean, what: string) => { if (!ok && problems.length < 20) problems.push(what); },
    done: () => expect(problems).toEqual([]),
  };
}

function ip(text: string): number {
  const value = parseIp(text);
  if (value === null) throw new Error(`bad ip ${text}`);
  return value;
}

function size(prefix: number): number {
  return 2 ** (32 - prefix);
}

function subnetHolds(network: string, prefix: number, address: string): boolean {
  return networkAddress(ip(address), prefix) === ip(network);
}

function maxDepth(city: City): number {
  return Math.max(...city.subnets.map((s) => s.depth));
}

describe('city generator', () => {
  it('rebuilds the same city from the same level and seed (AE1)', () => {
    expect(generateCity(3, 4821)).toEqual(generateCity(3, 4821));
    expect(generateCity(12, 77)).toEqual(generateCity(12, 77));
  });

  it('builds a different city from the same seed at another level', () => {
    expect(generateCity(2, 4821)).not.toEqual(generateCity(3, 4821));
  });

  it('gives every subnet an aligned network address and no overlaps', () => {
    const { check, done } = collector();
    for (const city of CITIES) {
      const blocks = city.subnets.map((s) => {
        check(networkAddress(ip(s.network), s.prefix) === ip(s.network), `${tag(city)} networkAddress(ip(s.network), s.prefix) === ip(s.network)`);
        // Every subnet lives inside the city's /16 in 10.0.0.0/8.
        check(subnetHolds(city.network, 16, s.network), `${tag(city)} subnetHolds(city.network, 16, s.network)`);
        check(subnetHolds('10.0.0.0', 8, s.network), `${tag(city)} subnetHolds('10.0.0.0', 8, s.network)`);
        return { start: ip(s.network), end: ip(s.network) + size(s.prefix) - 1 };
      });
      for (let i = 0; i < blocks.length; i++) {
        for (let j = i + 1; j < blocks.length; j++) {
          const apart = blocks[i].end < blocks[j].start || blocks[j].end < blocks[i].start;
          check(apart, `${tag(city)} apart`);
        }
      }
    }
    done();
  });

  it('puts every address inside its subnet, never network or broadcast, and never twice', () => {
    const { check, done } = collector();
    for (const city of CITIES) {
      const seen = new Set<string>();
      const use = (address: string, subnetId: number) => {
        const subnet = city.subnets[subnetId];
        const value = ip(address);
        check(subnetHolds(subnet.network, subnet.prefix, address), `${tag(city)} subnetHolds(subnet.network, subnet.prefix, address)`);
        check(value !== networkAddress(value, subnet.prefix), `${tag(city)} value !== networkAddress(value, subnet.prefix)`);
        check(value !== broadcastAddress(value, subnet.prefix), `${tag(city)} value !== broadcastAddress(value, subnet.prefix)`);
        check(!(seen.has(address)), `${tag(city)} !seen.has(address)`);
        seen.add(address);
      };
      for (const node of city.nodes) use(node.ip, node.subnetId);
      for (const subnet of city.subnets) {
        if (subnet.routerChildIp !== null) use(subnet.routerChildIp, subnet.id);
      }
    }
    done();
  });

  it('gives every router one address in its parent subnet and one in its single child', () => {
    const { check, done } = collector();
    for (const city of CITIES) {
      const routers = city.nodes.filter((n) => n.childSubnetId !== null);
      // One router per non-root subnet, and each router serves exactly one child.
      check(routers.length === city.subnets.length - 1, `${tag(city)} routers.length === city.subnets.length - 1`);
      for (const router of routers) {
        const child = city.subnets[router.childSubnetId!];
        const parent = city.subnets[router.subnetId];
        check(child.parentId === parent.id, `${tag(city)} child.parentId === parent.id`);
        check(child.depth === parent.depth + 1, `${tag(city)} child.depth === parent.depth + 1`);
        check(child.routerId === router.id, `${tag(city)} child.routerId === router.id`);
        check(subnetHolds(parent.network, parent.prefix, router.ip), `${tag(city)} subnetHolds(parent.network, parent.prefix, router.ip)`);
        check(child.routerChildIp !== null, `${tag(city)} child.routerChildIp !== null`);
        check(subnetHolds(child.network, child.prefix, child.routerChildIp!), `${tag(city)} subnetHolds(child.network, child.prefix, child.routerChildIp!)`);
      }
      const root = city.subnets.filter((s) => s.parentId === null);
      check(root.length === 1, `${tag(city)} root.length === 1`);
      check(root[0].depth === 0, `${tag(city)} root[0].depth === 0`);
      check(root[0].routerId === null, `${tag(city)} root[0].routerId === null`);
      check(root[0].routerChildIp === null, `${tag(city)} root[0].routerChildIp === null`);
    }
    done();
  });

  it('has exactly one core, in a subnet at the greatest depth', () => {
    const { check, done } = collector();
    for (const city of CITIES) {
      const cores = city.nodes.filter((n) => n.id === city.coreId);
      check(cores.length === 1, `${tag(city)} cores.length === 1`);
      check(cores[0].childSubnetId === null, `${tag(city)} cores[0].childSubnetId === null`);
      check(city.subnets[cores[0].subnetId].depth === maxDepth(city), `${tag(city)} city.subnets[cores[0].subnetId].depth === maxDepth(city)`);
      check(city.nodes.filter((n) => n.role === 'core').length === 1, `${tag(city)} city.nodes.filter((n) => n.role === 'core').length === 1`);
    }
    done();
  });

  it('keeps at most three subnets per depth and every node on screen below the header', () => {
    const { check, done } = collector();
    for (const city of CITIES) {
      const perDepth = new Map<number, number>();
      for (const s of city.subnets) perDepth.set(s.depth, (perDepth.get(s.depth) ?? 0) + 1);
      for (const count of perDepth.values()) check(count <= 3, `${tag(city)} count <= 3`);
      for (const node of city.nodes) {
        check(node.y >= 80, `${tag(city)} node.y >= 80`);
        check(node.y <= 660, `${tag(city)} node.y <= 660`);
        check(node.x > 0, `${tag(city)} node.x > 0`);
      }
      for (const s of city.subnets) {
        check(s.box.y >= 64, `${tag(city)} s.box.y >= 64`);
        check(s.box.y + s.box.height <= 676, `${tag(city)} s.box.y + s.box.height <= 676`);
      }
    }
    done();
  });

  it('never asks more than the Data Center Core does', () => {
    const { check, done } = collector();
    const cap = getNode('core').requires;
    const keys = ['cpuPower', 'ramGB', 'storageGB', 'linkMbps'] as const;
    for (const city of CITIES) {
      for (const node of city.nodes) {
        check(node.requires.lesson === undefined, `${tag(city)} node.requires.lesson === undefined`);
        for (const key of keys) {
          const value = node.requires[key];
          if (value !== undefined) check(value <= cap[key]!, `${tag(city)} ${node.id} ${key} above the core`);
        }
      }
    }
    done();
  });

  it('plays like campaign nodes: clamped difficulty, integer cash reward, no swarm hardware', () => {
    const { check, done } = collector();
    for (const city of CITIES) {
      for (const node of city.nodes) {
        check(node.difficulty >= 1, `${tag(city)} node.difficulty >= 1`);
        check(node.difficulty <= MAX_LEVEL[node.minigame], `${tag(city)} node.difficulty <= MAX_LEVEL[node.minigame]`);
        check(Number.isInteger(node.difficulty), `${tag(city)} Number.isInteger(node.difficulty)`);
        check(Number.isInteger(node.reward), `${tag(city)} Number.isInteger(node.reward)`);
        check(node.reward > 0, `${tag(city)} node.reward > 0`);
        check(node.hardware === undefined, `${tag(city)} node.hardware === undefined`);
        check(node.name.length > 0, `${tag(city)} node.name.length > 0`);
        check(node.flavor.length > 0, `${tag(city)} node.flavor.length > 0`);
      }
    }
    done();
  });

  it('uses unique node ids that never clash with campaign ids', () => {
    const { check, done } = collector();
    for (const city of CITIES) {
      const ids = city.nodes.map((n) => n.id);
      check(new Set(ids).size === ids.length, `${tag(city)} new Set(ids).size === ids.length`);
      for (const id of ids) {
        check(!CAMPAIGN_IDS.has(id), `${tag(city)} ${id} clashes with the campaign`);
      }
    }
    done();
  });

  it('reaches every subnet from depth 0 through node links', () => {
    const { check, done } = collector();
    for (const city of CITIES) {
      const byId = new Map(city.nodes.map((n) => [n.id, n]));
      const start = city.nodes.filter((n) => city.subnets[n.subnetId].depth === 0);
      const seen = new Set(start.map((n) => n.id));
      const queue = [...start];
      while (queue.length > 0) {
        const node = queue.shift()!;
        for (const link of node.links) {
          check(byId.has(link), `${tag(city)} byId.has(link)`);
          if (!seen.has(link)) {
            seen.add(link);
            queue.push(byId.get(link)!);
          }
        }
      }
      check(seen.size === city.nodes.length, `${tag(city)} seen.size === city.nodes.length`);
      // Every subnet holds at least one node, so reaching all nodes reaches all subnets.
      for (const s of city.subnets) check(city.nodes.some((n) => n.subnetId === s.id), `${tag(city)} city.nodes.some((n) => n.subnetId === s.id)`);
    }
    done();
  });

  it('uses only /24 subnets at level 1', () => {
    for (const city of CITIES.filter((c) => c.level === 1)) {
      for (const s of city.subnets) expect(s.prefix).toBe(24);
    }
  });

  it('grows deeper, wider and less obvious with level', () => {
    const at = (level: number) => CITIES.filter((c) => c.level === level);
    const avg = (cities: City[], f: (c: City) => number) => cities.reduce((sum, c) => sum + f(c), 0) / cities.length;
    expect(avg(at(10), maxDepth)).toBeGreaterThan(avg(at(1), maxDepth));
    expect(avg(at(10), (c) => c.subnets.length)).toBeGreaterThan(avg(at(1), (c) => c.subnets.length));
    const prefixes = new Set(at(12).flatMap((c) => c.subnets.map((s) => s.prefix)));
    expect(prefixes.size).toBeGreaterThan(3);
  });

  it('stops structural growth at level 12', () => {
    const depths = (level: number) => Math.max(...CITIES.filter((c) => c.level === level).map(maxDepth));
    expect(depths(99)).toBe(depths(12));
  });
});

/** 32-bit FNV-1a over the UTF-16 code units of a string, as 8 hex digits. */
function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Shared city codes and saved city progress (node ids, opened subnet ids) both
 * rely on (level, seed) building the same city forever. If the structure hash
 * changes, old codes now build other cities and saved progress points at other
 * nodes: never update it. The full hash also covers node difficulty, which may
 * change on purpose (difficulty draws no random numbers, so it never moves ids).
 */
const PINNED_CITIES_HASH = 'c20cbf97';
const PINNED_STRUCTURE_HASH = 'b738fc07';

function pinnedSample(): City[] {
  const cities: City[] = [];
  for (const level of [1, 2, 5, 12, 40, 99]) for (const seed of [0, 1, 4821, 319999]) cities.push(generateCity(level, seed));
  return cities;
}

describe('city stability', () => {
  it('builds exactly the pinned cities for sample levels and seeds', () => {
    expect(fnv1a(JSON.stringify(pinnedSample()))).toBe(PINNED_CITIES_HASH);
  });

  it('keeps the pinned structure of plain and typed cities, difficulty aside', () => {
    const cities = [...pinnedSample()];
    for (const type of ['nat', 'vlan', 'ipv6'] as const) for (const level of [1, 12, 40, 99]) cities.push(generateCity(level, 4821, type));
    const structure = cities.map((city) => ({ ...city, nodes: city.nodes.map(({ difficulty: _d, ...node }) => node) }));
    expect(fnv1a(JSON.stringify(structure))).toBe(PINNED_STRUCTURE_HASH);
  });
});

describe('city difficulty', () => {
  /** The structure-capped formula cities used before difficulty followed the level. */
  const capped = (city: City, node: City['nodes'][number]) => {
    const depth = city.subnets[node.subnetId].depth + (node.role === 'core' ? 1 : 0);
    return Math.min(1 + Math.floor((Math.min(city.level, 12) - 1 + depth) / 4), MAX_LEVEL[node.minigame]);
  };

  it('keeps every node difficulty of cities up to level 12', () => {
    const changed = CITIES.filter((c) => c.level <= 12)
      .flatMap((city) => city.nodes.filter((n) => n.difficulty !== capped(city, n)).map((n) => `${tag(city)} ${n.id}`));
    expect(changed).toEqual([]);
  });

  it('keeps rising past level 12, up to each area maximum', () => {
    const highest = (level: number, area: 'binary' | 'subnet') => Math.max(...[1, 2, 3, 4, 5]
      .flatMap((seed) => generateCity(level, seed).nodes.filter((n) => n.minigame === area).map((n) => n.difficulty)));
    expect(highest(40, 'binary')).toBeGreaterThan(highest(12, 'binary'));
    for (let seed = 1; seed <= 5; seed++) {
      for (const node of generateCity(99, seed).nodes) expect(node.difficulty).toBe(MAX_LEVEL[node.minigame]);
    }
  });

  it('never lowers as the level rises, for every area and depth', () => {
    // Each level seeds a different city, so the rule is checked on the formula, not on node ids.
    for (const area of Object.keys(MAX_LEVEL) as (keyof typeof MAX_LEVEL)[]) {
      for (let depth = 0; depth <= 8; depth++) {
        for (let level = 2; level <= 99; level++) {
          expect(cityDifficulty(area, level, depth)).toBeGreaterThanOrEqual(cityDifficulty(area, level - 1, depth));
        }
      }
    }
  });
});

describe('roundContext', () => {
  it('is the node subnet and the node address', () => {
    for (const city of [generateCity(1, 3), generateCity(12, 7)]) {
      for (const node of city.nodes) {
        const subnet = city.subnets[node.subnetId];
        expect(roundContext(city, node.id)).toEqual({ network: parseIp(subnet.network), prefix: subnet.prefix, host: parseIp(node.ip) });
      }
    }
  });
});

/** 200 cities of a type, over levels 1-20. */
function typedCities(type: TierCityType): City[] {
  return Array.from({ length: 200 }, (_, i) => generateCity(1 + (i % 20), 1000 + i, type));
}

const NAT_CITIES = typedCities('nat');
const VLAN_CITIES = typedCities('vlan');
const IPV6_CITIES = typedCities('ipv6');

const v6 = (text: string) => {
  const value = parseIpv6(text);
  if (value === null) throw new Error(`bad ipv6 ${text}`);
  return value;
};

/** The first usable address of a dotted /24 network. */
function firstHost(network: string): string {
  const [a, b, c, d] = network.split('.').map(Number);
  return `${a}.${b}.${c}.${d + 1}`;
}

describe('typed cities', () => {
  it('rebuilds the same city from the same type, level and seed', () => {
    for (const type of ['nat', 'vlan', 'ipv6'] as const) expect(generateCity(4, 4821, type)).toEqual(generateCity(4, 4821, type));
  });

  it('builds a plain city when no type is given, with no type field', () => {
    expect(generateCity(5, 9, 'plain')).toEqual(generateCity(5, 9));
    expect('type' in generateCity(5, 9)).toBe(false);
    expect(generateCity(5, 9, 'nat').type).toBe('nat');
  });

  it('keeps the tree of the plain city with the same level and seed', () => {
    for (const type of ['nat', 'vlan', 'ipv6'] as const) {
      const plain = generateCity(7, 31);
      const typed = generateCity(7, 31, type);
      expect(typed.subnets.map((s) => [s.depth, s.parentId])).toEqual(plain.subnets.map((s) => [s.depth, s.parentId]));
      expect(typed.nodes.map((n) => n.id)).toEqual(plain.nodes.map((n) => n.id));
    }
  });

  it('NAT: the student subnet is a public /24 and every site behind it is private', () => {
    const { check, done } = collector();
    for (const city of NAT_CITIES) {
      const home = city.subnets[0];
      check(['203.0.113.0', '198.51.100.0'].includes(home.network) && home.prefix === 24, `${tag(city)} public home ${home.network}/${home.prefix}`);
      for (const subnet of city.subnets.slice(1)) {
        check(privateRangeOf(ip(subnet.network)) === '192.168.0.0/16' && subnet.prefix === 24, `${tag(city)} private ${subnet.network}/${subnet.prefix}`);
      }
      for (const node of city.nodes) {
        const own = city.subnets[node.subnetId];
        check(subnetHolds(own.network, own.prefix, node.ip), `${tag(city)} ${node.id} in own subnet`);
        if (own.depth > 0) check(privateRangeOf(ip(node.ip)) === '192.168.0.0/16', `${tag(city)} ${node.id} private`);
        // A router out of the student subnet has its public address there.
        if (node.role === 'router' && own.depth === 0) check(subnetHolds(home.network, 24, node.ip), `${tag(city)} ${node.id} public`);
      }
    }
    done();
  });

  it('NAT: each site entry publishes one service on one of its hosts', () => {
    const { check, done } = collector();
    for (const city of NAT_CITIES) {
      for (const subnet of city.subnets) {
        if (subnet.depth !== 1) {
          check(subnet.publish === undefined, `${tag(city)} only depth 1 publishes`);
          continue;
        }
        const hosts = city.nodes.filter((n) => n.subnetId === subnet.id && n.role !== 'router').map((n) => n.ip);
        check(subnet.publish !== undefined && hosts.includes(subnet.publish.host), `${tag(city)} published host`);
        check(subnet.publish !== undefined && PUBLISHED_SERVICES.includes(subnet.publish.service), `${tag(city)} service`);
      }
    }
    done();
  });

  it('NAT cities keep the router-address rule: one address in the parent, the first usable one in the child', () => {
    const { check, done } = collector();
    for (const city of NAT_CITIES) {
      const seen = new Set<string>();
      for (const node of city.nodes) {
        check(!seen.has(node.ip), `${tag(city)} unique ${node.ip}`);
        seen.add(node.ip);
        const own = city.subnets[node.subnetId];
        const value = ip(node.ip);
        check(value !== networkAddress(value, own.prefix) && value !== broadcastAddress(value, own.prefix), `${tag(city)} host address`);
        if (node.childSubnetId === null) continue;
        const child = city.subnets[node.childSubnetId];
        check(child.parentId === own.id && child.routerId === node.id, `${tag(city)} ${node.id} one child`);
        check(child.routerChildIp === firstHost(child.network), `${tag(city)} ${node.id} child side`);
      }
      for (const subnet of city.subnets) {
        if (subnet.routerChildIp) check(!city.nodes.some((n) => n.ip === subnet.routerChildIp), `${tag(city)} child side unique`);
      }
    }
    done();
  });

  it('VLAN: every subnet has a valid, unreserved and unique VLAN with its own name', () => {
    const { check, done } = collector();
    for (const city of VLAN_CITIES) {
      const ids = city.subnets.map((s) => s.vlan?.id);
      const names = city.subnets.map((s) => s.vlan?.name);
      check(ids.every((id) => id !== undefined && vlanIdVerdict(id) === 'ok'), `${tag(city)} valid ids ${ids}`);
      check(new Set(ids).size === ids.length && new Set(names).size === names.length, `${tag(city)} unique`);
    }
    done();
  });

  it('IPv6: every subnet is a /64 inside the city /48, and every address in its own /64', () => {
    const { check, done } = collector();
    for (const city of IPV6_CITIES) {
      const site = v6(city.network);
      check(site === ipv6Network(site, 48) && inIpv6Prefix(site, v6('2001:db8::'), 32), `${tag(city)} /48 ${city.network}`);
      for (const subnet of city.subnets) {
        check(subnet.prefix === 64 && inIpv6Prefix(v6(subnet.network), site, 48), `${tag(city)} /64 ${subnet.network}`);
        if (subnet.routerChildIp) check(v6(subnet.routerChildIp) === v6(subnet.network) + 1n, `${tag(city)} child side ::1`);
      }
      for (const node of city.nodes) {
        const own = city.subnets[node.subnetId];
        check(inIpv6Prefix(v6(node.ip), v6(own.network), 64) && v6(node.ip) !== v6(own.network), `${tag(city)} ${node.ip} in ${own.network}`);
      }
      const all = [...city.nodes.map((n) => n.ip), ...city.subnets.map((s) => s.network), ...city.subnets.map((s) => s.routerChildIp).filter(Boolean)];
      check(new Set(all).size === all.length, `${tag(city)} unique addresses`);
    }
    done();
  });

  it('puts the tier area on the core and on at least half the other nodes', () => {
    const { check, done } = collector();
    for (const [type, cities] of [['nat', NAT_CITIES], ['vlan', VLAN_CITIES], ['ipv6', IPV6_CITIES]] as const) {
      const area = tierOfCityType(type).area;
      for (const city of cities) {
        const core = city.nodes.find((n) => n.id === city.coreId)!;
        check(core.minigame === area, `${tag(city)} core area`);
        const others = city.nodes.filter((n) => n.id !== city.coreId);
        check(others.filter((n) => n.minigame === area).length * 2 >= others.length, `${tag(city)} half`);
        check(city.nodes.every((n) => n.difficulty <= MAX_LEVEL[n.minigame]), `${tag(city)} difficulty`);
      }
    }
    done();
  });

  it('feeds typed rounds with the node site, VLAN or address', () => {
    const nat = NAT_CITIES.find((c) => c.subnets.length >= 2)!;
    const siteHost = nat.nodes.find((n) => n.role !== 'router' && nat.subnets[n.subnetId].depth === 1)!;
    const entry = nat.nodes.find((n) => n.childSubnetId === siteHost.subnetId)!;
    expect(typedContext(nat, siteHost.id)?.nat).toEqual({
      publicIp: ip(entry.ip), privateNetwork: ip(nat.subnets[siteHost.subnetId].network), privatePrefix: 24, privateHost: ip(siteHost.ip),
    });
    const vlan = VLAN_CITIES[0];
    expect(typedContext(vlan, vlan.nodes[0].id)?.vlan).toEqual(vlan.subnets[vlan.nodes[0].subnetId].vlan);
    const ipv6 = IPV6_CITIES[0];
    expect(typedContext(ipv6, ipv6.nodes[0].id)?.ipv6).toEqual({ host: v6(ipv6.nodes[0].ip) });
    expect(roundContext(ipv6, ipv6.nodes[0].id)).toBeUndefined();
    const plain = generateCity(3, 3);
    expect(typedContext(plain, plain.nodes[0].id)).toBeUndefined();
  });

  it('labels subnets with VLANs only in VLAN cities', () => {
    const types: CityType[] = ['plain', 'nat', 'vlan', 'ipv6'];
    for (const type of types) {
      const city = generateCity(6, 12, type);
      expect(city.subnets.every((s) => (s.vlan !== undefined) === (type === 'vlan')), type).toBe(true);
    }
  });
});
