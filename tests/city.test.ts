import { describe, expect, it } from 'vitest';
import { generateCity, type City } from '../src/core/city';
import { broadcastAddress, networkAddress, parseIp } from '../src/core/ip';
import { MAX_LEVEL } from '../src/core/minigames';
import { NODES, getNode } from '../src/data/nodes';

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
