import { describe, expect, it } from 'vitest';
import { generateCity, type City, type CityNode } from '../src/core/city';
import { broadcastAddress, formatIp, networkAddress, parseIp } from '../src/core/ip';
import { correctRoute, routeChoices, validateRoute, type RouteEntry, type RouteIssueCode } from '../src/core/routing';

function ip(text: string): number {
  const value = parseIp(text);
  if (value === null) throw new Error(`bad ip ${text}`);
  return value;
}

/** Routers from levels 1-12 x seeds 1-20, each with its city. */
function sampleRouters(): { city: City; router: CityNode }[] {
  const out: { city: City; router: CityNode }[] = [];
  for (let level = 1; level <= 12; level++) {
    for (let seed = 1; seed <= 20; seed++) {
      const city = generateCity(level, seed);
      for (const router of city.nodes.filter((n) => n.role === 'router')) out.push({ city, router });
    }
  }
  return out;
}

const ROUTERS = sampleRouters();

/** A level 1 city router with a /24 child, like the AE2 example. */
const SAMPLE = ROUTERS.find(({ city, router }) => city.subnets[router.childSubnetId!].prefix === 24)!;

function codes(entry: RouteEntry, city: City, routerId: string): RouteIssueCode[] {
  return validateRoute(entry, city, routerId).map((i) => i.code);
}

/** Whether a message names this exact address or text (not as part of a longer number). */
function mentions(message: string, value: string): boolean {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const before = /^\d/.test(value) ? '(^|[^\\d.])' : '';
  return new RegExp(`${before}${escaped}($|[^\\d])`).test(message);
}

function childOf(city: City, router: CityNode) {
  return city.subnets[router.childSubnetId!];
}

function parentOf(city: City, router: CityNode) {
  return city.subnets[router.subnetId];
}

describe('correctRoute', () => {
  it('is the child network and prefix through the router parent-side address', () => {
    const { city, router } = SAMPLE;
    const child = childOf(city, router);
    expect(correctRoute(city, router.id)).toEqual({ destination: child.network, prefix: child.prefix, nextHop: router.ip });
  });
});

describe('validateRoute', () => {
  it('accepts the correct destination, prefix and next hop for every sampled router', () => {
    const wrong = ROUTERS.filter(({ city, router }) => validateRoute(correctRoute(city, router.id), city, router.id).length > 0);
    expect(ROUTERS.length).toBeGreaterThan(100);
    expect(wrong.map(({ city, router }) => `L${city.level}/S${city.seed}/${router.id}`)).toEqual([]);
  });

  it('AE2: a host address as the destination is not a network address', () => {
    const { city, router } = SAMPLE;
    const child = childOf(city, router);
    const host = formatIp(ip(child.network) + 7);
    const issues = validateRoute({ ...correctRoute(city, router.id), destination: host }, city, router.id);
    expect(issues.map((i) => i.code)).toEqual(['destination-host']);
    expect(issues[0].message).toContain(host);
    expect(issues[0].message).toContain('endereço de rede');
    expect(mentions(issues[0].message, child.network)).toBe(false);
  });

  it('the child broadcast address as the destination is a broadcast error', () => {
    const { city, router } = SAMPLE;
    const child = childOf(city, router);
    const broadcast = formatIp(broadcastAddress(ip(child.network), child.prefix));
    const issues = validateRoute({ ...correctRoute(city, router.id), destination: broadcast }, city, router.id);
    expect(issues.map((i) => i.code)).toEqual(['destination-broadcast']);
    expect(issues[0].message).toContain('broadcast');
    expect(mentions(issues[0].message, child.network)).toBe(false);
  });

  it('a /25 for a /24 child is a prefix error that never prints the correct network or prefix', () => {
    const { city, router } = SAMPLE;
    const child = childOf(city, router);
    const issues = validateRoute({ ...correctRoute(city, router.id), prefix: 25 }, city, router.id);
    expect(issues.map((i) => i.code)).toEqual(['prefix-mismatch']);
    expect(issues[0].message).toContain('/25');
    expect(mentions(issues[0].message, child.network)).toBe(false);
    expect(mentions(issues[0].message, '/24')).toBe(false);
  });

  it('the correct destination with any wrong prefix is only a prefix error', () => {
    for (const { city, router } of ROUTERS) {
      const right = correctRoute(city, router.id);
      for (const prefix of routeChoices(city, router.id).prefix.filter((p) => p !== right.prefix)) {
        expect(codes({ ...right, prefix }, city, router.id)).toEqual(['prefix-mismatch']);
      }
    }
  });

  it('a sibling or parent network with the correct prefix and next hop is a wrong-network error', () => {
    let checked = 0;
    for (const { city, router } of ROUTERS) {
      const child = childOf(city, router);
      const others = city.subnets.filter((s) => s.id !== child.id);
      for (const other of others) {
        // Only networks that are still network addresses under the child prefix.
        if (networkAddress(ip(other.network), child.prefix) !== ip(other.network)) continue;
        const issues = validateRoute({ ...correctRoute(city, router.id), destination: other.network }, city, router.id);
        expect(issues.map((i) => i.code)).toEqual(['destination-other-network']);
        expect(mentions(issues[0].message, child.network)).toBe(false);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(50);
  });

  it('the router child-side address as the next hop is outside the reachable subnet', () => {
    const { city, router } = SAMPLE;
    const child = childOf(city, router);
    const issues = validateRoute({ ...correctRoute(city, router.id), nextHop: child.routerChildIp! }, city, router.id);
    expect(issues.map((i) => i.code)).toEqual(['next-hop-outside']);
    expect(issues[0].message).toContain(child.routerChildIp!);
    expect(mentions(issues[0].message, router.ip)).toBe(false);
  });

  it('another host in the parent subnet as the next hop is not the router for that network', () => {
    const { city, router } = SAMPLE;
    const other = city.nodes.find((n) => n.subnetId === router.subnetId && n.id !== router.id)!;
    const issues = validateRoute({ ...correctRoute(city, router.id), nextHop: other.ip }, city, router.id);
    expect(issues.map((i) => i.code)).toEqual(['next-hop-not-router']);
    expect(mentions(issues[0].message, router.ip)).toBe(false);
  });

  it('reports one issue per wrong field when several are wrong', () => {
    const { city, router } = SAMPLE;
    const child = childOf(city, router);
    const entry = { destination: child.routerChildIp!, prefix: 25, nextHop: child.routerChildIp! };
    expect(codes(entry, city, router.id)).toEqual(['destination-host', 'prefix-mismatch', 'next-hop-outside']);
  });

  it('no message ever prints the correct value of a field it rejects', () => {
    const leaked: string[] = [];
    for (const { city, router } of ROUTERS.slice(0, 200)) {
      const right = correctRoute(city, router.id);
      const choices = routeChoices(city, router.id);
      const entries: RouteEntry[] = [
        ...choices.destination.map((destination) => ({ ...right, destination })),
        ...choices.prefix.map((prefix) => ({ ...right, prefix })),
        ...choices.nextHop.map((nextHop) => ({ ...right, nextHop })),
      ];
      for (const entry of entries) {
        // Echoing what the player entered is fine; a right value they did not enter is a leak.
        for (const issue of validateRoute(entry, city, router.id)) {
          const leaks = (value: string) => { if (mentions(issue.message, value)) leaked.push(`${issue.code}: ${issue.message}`); };
          if (entry.destination !== right.destination) leaks(right.destination);
          if (entry.prefix !== right.prefix) leaks(`/${right.prefix}`);
          if (entry.nextHop !== right.nextHop) leaks(right.nextHop);
        }
      }
    }
    expect(leaked).toEqual([]);
  });

  it('rejects ids that are not routers of the city', () => {
    const { city } = SAMPLE;
    const host = city.nodes.find((n) => n.role !== 'router')!;
    expect(() => validateRoute(correctRoute(SAMPLE.city, SAMPLE.router.id), city, host.id)).toThrow();
  });
});

describe('routeChoices', () => {
  it('is identical across calls for the same router', () => {
    const { city, router } = SAMPLE;
    expect(routeChoices(city, router.id)).toEqual(routeChoices(city, router.id));
    expect(routeChoices(generateCity(city.level, city.seed), router.id)).toEqual(routeChoices(city, router.id));
  });

  it('every field contains its correct value, with no repeats, for every sampled router', () => {
    for (const { city, router } of ROUTERS) {
      const right = correctRoute(city, router.id);
      const choices = routeChoices(city, router.id);
      expect(choices.destination).toContain(right.destination);
      expect(choices.prefix).toContain(right.prefix);
      expect(choices.nextHop).toContain(right.nextHop);
      for (const list of [choices.destination, choices.prefix, choices.nextHop] as unknown[][]) {
        expect(new Set(list).size).toBe(list.length);
        expect(list.length).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('every distractor triggers at least one error, and together they cover every issue code', () => {
    const seen = new Set<RouteIssueCode>();
    const silent: string[] = [];
    for (const { city, router } of ROUTERS) {
      const right = correctRoute(city, router.id);
      const choices = routeChoices(city, router.id);
      const tag = `L${city.level}/S${city.seed}/${router.id}`;
      const tryEntry = (entry: RouteEntry, label: string) => {
        const found = codes(entry, city, router.id);
        if (found.length === 0) silent.push(`${tag} ${label}`);
        found.forEach((c) => seen.add(c));
      };
      for (const d of choices.destination) if (d !== right.destination) tryEntry({ ...right, destination: d }, d);
      for (const p of choices.prefix) if (p !== right.prefix) tryEntry({ ...right, prefix: p }, `/${p}`);
      for (const h of choices.nextHop) if (h !== right.nextHop) tryEntry({ ...right, nextHop: h }, h);
    }
    expect(silent).toEqual([]);
    expect([...seen].sort()).toEqual([
      'destination-broadcast', 'destination-host', 'destination-other-network',
      'next-hop-not-router', 'next-hop-outside', 'prefix-mismatch',
    ]);
  });

  it('the destination distractors include a child host, the child broadcast and another network', () => {
    for (const { city, router } of ROUTERS.slice(0, 100)) {
      const right = correctRoute(city, router.id);
      const found = new Set(routeChoices(city, router.id).destination
        .filter((d) => d !== right.destination)
        .flatMap((d) => codes({ ...right, destination: d }, city, router.id)));
      expect(found.has('destination-host')).toBe(true);
      expect(found.has('destination-broadcast')).toBe(true);
    }
  });

  it('the next-hop distractors include an outside address and another parent-subnet host', () => {
    for (const { city, router } of ROUTERS.slice(0, 100)) {
      const right = correctRoute(city, router.id);
      const choices = routeChoices(city, router.id).nextHop;
      const parent = parentOf(city, router);
      expect(choices).toContain(childOf(city, router).routerChildIp!);
      const insideOthers = choices.filter((h) => h !== right.nextHop
        && networkAddress(ip(h), parent.prefix) === ip(parent.network));
      expect(insideOthers.length).toBeGreaterThan(0);
    }
  });
});
