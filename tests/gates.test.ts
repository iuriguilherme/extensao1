import { describe, expect, it } from 'vitest';
import { getCertificate, issueCertificate, presentCertificate } from '../src/core/certificates';
import { cityNode, generateCity, type City, type CityNode } from '../src/core/city';
import { correctGate, gateChoices, gateKind, validateGate, vlanGate, type GateEntry } from '../src/core/gates';
import { formatIpv6Full, parseIpv6 } from '../src/core/ipv6';
import { correctRoute } from '../src/core/routing';
import { breachCityNode, newGame, startCity, submitGate, type GameState } from '../src/core/state';
import { getTier } from '../src/data/tiers';

/** Cities of a type that have at least one gate of the kind asked. */
function citiesWith(type: 'nat' | 'vlan' | 'ipv6', count: number): City[] {
  const cities: City[] = [];
  for (let seed = 1; cities.length < count; seed++) {
    const city = generateCity(1 + (seed % 12), seed, type);
    if (city.subnets.length >= 2) cities.push(city);
  }
  return cities;
}

function routersOf(city: City, kind: GateEntry['kind']): CityNode[] {
  return city.nodes.filter((n) => n.childSubnetId !== null && gateKind(city, n.id) === kind);
}

function codes(city: City, router: CityNode, change: Partial<GateEntry>): string[] {
  const entry = { ...correctGate(city, router.id), ...change } as GateEntry;
  return validateGate(city, router.id, entry).map((i) => i.code);
}

const NAT = citiesWith('nat', 50);
const VLAN = citiesWith('vlan', 50);
const IPV6 = citiesWith('ipv6', 50);

/** A graduated save with the given tiers' lessons passed; earlier tiers earned. */
function student(...tiers: ('especializacao' | 'mestrado' | 'doutorado')[]): GameState {
  const s = newGame();
  issueCertificate(s, 'conclusao');
  presentCertificate(s, 'conclusao', 'Ana');
  tiers.forEach((id, i) => {
    s.lessonsCompleted.push(...getTier(id).lessons);
    if (i < tiers.length - 1) {
      issueCertificate(s, id);
      presentCertificate(s, id);
    }
  });
  return s;
}

describe('gate kinds', () => {
  it('asks for a port forward only out of the NAT student subnet, and for a route inside the sites', () => {
    for (const city of NAT) {
      for (const router of city.nodes.filter((n) => n.childSubnetId !== null)) {
        expect(gateKind(city, router.id)).toBe(city.subnets[router.subnetId].depth === 0 ? 'nat' : 'route');
      }
    }
    const plain = generateCity(3, 3);
    expect(plain.nodes.filter((n) => n.childSubnetId !== null).every((r) => gateKind(plain, r.id) === 'route')).toBe(true);
    expect(routersOf(VLAN[0], 'vlan').length).toBeGreaterThan(0);
    expect(routersOf(IPV6[0], 'ipv6').length).toBeGreaterThan(0);
  });

  it('accepts the correct entry at every gate', () => {
    for (const city of [...NAT, ...VLAN, ...IPV6]) {
      for (const router of city.nodes.filter((n) => n.childSubnetId !== null)) {
        expect(validateGate(city, router.id, correctGate(city, router.id))).toEqual([]);
      }
    }
  });
});

describe('NAT gates', () => {
  it('AE4: mapping to the site broadcast is a broadcast error, the subnet stays hidden, and a retry works', () => {
    const s = student('especializacao');
    const city = NAT[0];
    const index = startCity(s, city.level, city.seed, 'nat');
    const router = routersOf(city, 'nat')[0];
    breachCityNode(s, index, city, router.id);
    const site = city.subnets[router.childSubnetId!];
    const broadcast = site.network.replace(/\.0$/, '.255');
    const issues = submitGate(s, index, city, router.id, { ...correctGate(city, router.id), privateAddress: broadcast } as GateEntry);
    expect(issues.map((i) => i.code)).toEqual(['nat-broadcast']);
    expect(issues[0].message).toContain(broadcast);
    expect(s.cities[index].opened).toEqual([]);
    expect(submitGate(s, index, city, router.id, correctGate(city, router.id))).toEqual([]);
    expect(s.cities[index].opened).toEqual([site.id]);
  });

  it('swapping the public and private addresses is a swap error', () => {
    for (const city of NAT) {
      for (const router of routersOf(city, 'nat')) {
        const right = correctGate(city, router.id);
        if (right.kind !== 'nat') throw new Error('not a NAT gate');
        const swapped = codes(city, router, { publicAddress: right.privateAddress, privateAddress: right.publicAddress } as Partial<GateEntry>);
        expect(swapped).toContain('nat-swapped');
      }
    }
  });

  it('a port other than the published service port is a port error', () => {
    const city = NAT[0];
    const router = routersOf(city, 'nat')[0];
    expect(codes(city, router, { publicPort: 1 } as Partial<GateEntry>)).toEqual(['nat-wrong-port']);
    expect(codes(city, router, { privatePort: 1 } as Partial<GateEntry>)).toEqual(['nat-wrong-port']);
  });
});

describe('VLAN gates', () => {
  it('asks for trunk exactly when the link carries more than one VLAN', () => {
    for (const city of VLAN) {
      for (const router of routersOf(city, 'vlan')) {
        const right = correctGate(city, router.id);
        const carried = vlanGate(city, router.id).carried;
        expect(right.kind === 'vlan' && right.mode).toBe(carried.length > 1 ? 'trunk' : 'access');
        const child = city.subnets[router.childSubnetId!];
        expect(carried[0]).toEqual(child.vlan);
        expect(carried.length > 1).toBe(city.subnets.some((s) => s.parentId === child.id));
      }
    }
  });

  it('the wrong mode is a mode error, and the reserved and default IDs are their own errors', () => {
    const city = VLAN.find((c) => routersOf(c, 'vlan').some((r) => vlanGate(c, r.id).carried.length > 1))!;
    const router = routersOf(city, 'vlan').find((r) => vlanGate(city, r.id).carried.length > 1)!;
    expect(codes(city, router, { mode: 'access' } as Partial<GateEntry>)).toEqual(['vlan-wrong-mode']);
    expect(codes(city, router, { vlanId: 1002 } as Partial<GateEntry>)).toEqual(['vlan-reserved']);
    expect(codes(city, router, { vlanId: 1 } as Partial<GateEntry>)).toEqual(['vlan-default']);
    expect(codes(city, router, { vlanId: 4095 } as Partial<GateEntry>)).toEqual(['vlan-invalid']);
    const other = city.subnets.find((s) => s.id !== router.childSubnetId)!.vlan!.id;
    expect(codes(city, router, { vlanId: other } as Partial<GateEntry>)).toEqual(['vlan-wrong-id']);
  });
});

describe('IPv6 gates', () => {
  it('a host address as the destination is not a prefix', () => {
    const city = IPV6[0];
    const router = routersOf(city, 'ipv6')[0];
    const child = city.subnets[router.childSubnetId!];
    expect(codes(city, router, { destination: child.routerChildIp! } as Partial<GateEntry>)).toEqual(['ipv6-not-prefix']);
  });

  it('accepts the next hop and the destination in compressed or full form', () => {
    for (const city of IPV6) {
      for (const router of routersOf(city, 'ipv6')) {
        const right = correctGate(city, router.id);
        if (right.kind !== 'ipv6') throw new Error('not an IPv6 gate');
        const full = (text: string) => formatIpv6Full(parseIpv6(text)!);
        expect(codes(city, router, { nextHop: full(right.nextHop), destination: full(right.destination) } as Partial<GateEntry>)).toEqual([]);
      }
    }
  });

  it('a next hop on the far side of the router is outside the reachable subnet', () => {
    const city = IPV6[0];
    const router = routersOf(city, 'ipv6')[0];
    const child = city.subnets[router.childSubnetId!];
    expect(codes(city, router, { nextHop: child.routerChildIp! } as Partial<GateEntry>)).toEqual(['ipv6-next-hop-outside']);
  });
});

describe('gate choices', () => {
  const sameValue = (a: string | number, b: string | number) => {
    if (typeof a === 'number' || typeof b === 'number') return a === b;
    const v6a = parseIpv6(a);
    return v6a !== null ? v6a === parseIpv6(b) : a === b;
  };

  it('are the same on every visit', () => {
    const router = routersOf(NAT[3], 'nat')[0];
    expect(gateChoices(NAT[3], router.id)).toEqual(gateChoices(NAT[3], router.id));
  });

  it('hold the correct value of every field, and every other option fails with an error that never prints the right value', () => {
    for (const [kind, cities] of [['nat', NAT], ['vlan', VLAN], ['ipv6', IPV6]] as const) {
      for (const city of cities) {
        for (const router of routersOf(city, kind)) {
          const right = correctGate(city, router.id) as unknown as Record<string, string | number>;
          const choices = gateChoices(city, router.id) as unknown as Record<string, (string | number)[]>;
          for (const [field, options] of Object.entries(choices)) {
            if (field === 'kind') continue;
            expect(options.some((o) => o === right[field]), `${kind} ${field}`).toBe(true);
            expect(new Set(options).size).toBe(options.length);
            for (const option of options) {
              const issues = validateGate(city, router.id, { ...right, [field]: option } as unknown as GateEntry);
              if (sameValue(option, right[field])) {
                expect(issues, `${kind} ${field} ${option}`).toEqual([]);
                continue;
              }
              expect(issues.length, `${kind} ${field} ${option}`).toBeGreaterThan(0);
              const value = String(right[field]);
              const exact = new RegExp(`(^|[^\\w.:])${value.replace(/[.:]/g, '\\$&')}($|[^\\w.:])`);
              for (const issue of issues) expect(exact.test(issue.message), `${issue.code}: ${issue.message}`).toBe(false);
            }
          }
        }
      }
    }
  });

  it('offer VLAN 1, 4095, a reserved ID and another segment ID', () => {
    const city = VLAN[0];
    const router = routersOf(city, 'vlan')[0];
    const choices = gateChoices(city, router.id);
    if (choices.kind !== 'vlan') throw new Error('not a VLAN gate');
    expect(choices.vlanId).toEqual(expect.arrayContaining([1, 4095]));
    expect(choices.vlanId.some((id) => id >= 1002 && id <= 1005)).toBe(true);
    const others = city.subnets.filter((s) => s.id !== router.childSubnetId).map((s) => s.vlan!.id);
    expect(choices.vlanId.some((id) => others.includes(id))).toBe(true);
  });
});

describe('tier certificates', () => {
  it('breaching a NAT city core issues Especialização once, unpresented', () => {
    const s = student('especializacao');
    const [first, second] = NAT;
    breachCityNode(s, startCity(s, first.level, first.seed, 'nat'), first, first.coreId);
    expect(getCertificate(s, 'especializacao')).toMatchObject({ presented: false });
    presentCertificate(s, 'especializacao');
    breachCityNode(s, startCity(s, second.level, second.seed, 'nat'), second, second.coreId);
    expect(s.certificates.filter((c) => c.id === 'especializacao')).toHaveLength(1);
    expect(s.cities.every((c) => c.finished)).toBe(true);
  });

  it('issues nothing without the conclusão certificate, or for a plain city', () => {
    const s = newGame();
    const city = NAT[0];
    s.cities.push({ level: city.level, seed: city.seed, type: 'nat', breached: [], opened: [], finished: false });
    breachCityNode(s, 0, city, city.coreId);
    expect(s.certificates).toEqual([]);

    const graduated = student('especializacao');
    const plain = generateCity(2, 2);
    breachCityNode(graduated, startCity(graduated, plain.level, plain.seed), plain, plain.coreId);
    expect(getCertificate(graduated, 'especializacao')).toBeUndefined();
  });

  it('keeps the plain route gate working through the same submission', () => {
    const s = student();
    const city = generateCity(3, 5);
    const router = city.nodes.find((n) => n.childSubnetId !== null)!;
    const index = startCity(s, city.level, city.seed);
    breachCityNode(s, index, city, router.id);
    expect(submitGate(s, index, city, router.id, { kind: 'route', ...correctRoute(city, router.id) })).toEqual([]);
    expect(cityNode(city, router.id).childSubnetId).toBe(s.cities[index].opened[0]);
  });
});
