import { describe, expect, it } from 'vitest';
import { computeSpecs, mistakesAllowed, roundSeconds } from '../src/core/hardware';
import {
  broadcastAddress, formatIp, maskToPrefix, networkAddress, parseIp, usableHosts, validateNetConfig, type LanInfo,
} from '../src/core/ip';
import { LENSES } from '../src/core/explanations';
import { buildRounds, CONCEPTS, MAX_LEVEL, roundCount, STATUSES, type ConceptId } from '../src/core/minigames';
import { createRng } from '../src/core/random';
import { issueCertificate, presentCertificate } from '../src/core/certificates';
import {
  breach, buy, canBuy, canConnect, checkRequirements, completeLesson, install, isLessonOpen, isLessonVisible, isOnline, newGame, nodeStatus, objective, phaseOf, sell, setNetConfig,
  ownedCount, specsOf, STARTING_MONEY, uninstall, type GameState,
} from '../src/core/state';
import {
  dependents, freePorts, joinSwarm, leaveSwarm, pickProvider, removeSwitch, swarmReport, totalSpecs,
} from '../src/core/swarm';
import { ETHICS_LESSON_ID, LESSONS, ROUTING_LESSON_ID, TRACK_LABELS, getLesson } from '../src/data/lessons';
import { AREA_LESSON, NODES, getNode, type MinigameId } from '../src/data/nodes';
import { NODE_KINDS, NODE_KIND_LABELS, buildContribution, nodeBuild, resolveBuild } from '../src/data/nodeBuilds';
import { CASE_SLOTS, PARTS, SLOTS, SLOT_GENDER, SLOT_LABELS, describeStats, getPart } from '../src/data/parts';
import { TIERS } from '../src/data/tiers';

const STARTER = ['mb_b1', 'cpu_s1_2c', 'ram_4_ddr4', 'hdd_500', 'psu_250'];

describe('hardware', () => {
  it('reports every missing boot part on an empty case', () => {
    const specs = computeSpecs({});
    expect(specs.boots).toBe(false);
    expect(specs.issues.map((i) => i.slot)).toEqual(
      expect.arrayContaining(['motherboard', 'cpu', 'ram', 'storage', 'psu']),
    );
    expect(specs.issues.map((i) => i.code)).toEqual(
      expect.arrayContaining(['missing-motherboard', 'missing-cpu', 'missing-ram', 'missing-storage', 'missing-psu']),
    );
  });

  it('boots the starter build', () => {
    const specs = computeSpecs({ motherboard: 'mb_b1', cpu: 'cpu_s1_2c', ram: 'ram_4_ddr4', storage: 'hdd_500', psu: 'psu_250' });
    expect(specs.boots).toBe(true);
    expect(specs.networkReady).toBe(false);
    expect(specs.cpuPower).toBe(4.8);
  });

  it('rejects mismatched socket, RAM generation and weak PSU', () => {
    const specs = computeSpecs({ motherboard: 'mb_b1', cpu: 'cpu_s2_16c', ram: 'ram_32_ddr5', storage: 'hdd_500', psu: 'psu_250' });
    expect(specs.boots).toBe(false);
    expect(specs.issues.map((i) => i.code)).toEqual(
      expect.arrayContaining(['socket-mismatch', 'ram-mismatch', 'psu-overload']),
    );
  });

  it('link speed is the slowest end', () => {
    const specs = computeSpecs({
      motherboard: 'mb_b1', cpu: 'cpu_s1_2c', ram: 'ram_4_ddr4', storage: 'hdd_500', psu: 'psu_250',
      nic: 'nic_1g', router: 'router_home',
    });
    expect(specs.networkReady).toBe(true);
    expect(specs.linkMbps).toBe(100);
  });

  it('better hardware means more time and more mistakes allowed', () => {
    expect(roundSeconds(76.8)).toBeGreaterThan(roundSeconds(4.8));
    expect(mistakesAllowed(64)).toBeGreaterThan(mistakesAllowed(4));
  });

  it('the end-game rig boots and meets the final node', () => {
    const specs = computeSpecs({
      motherboard: 'mb_x5', cpu: 'cpu_s2_16c', ram: 'ram_64_ddr5', storage: 'nvme_2tb', psu: 'psu_450',
      nic: 'nic_10g', router: 'router_10g',
    });
    expect(specs.boots).toBe(true);
    const core = getNode('core').requires;
    expect(specs.cpuPower).toBeGreaterThanOrEqual(core.cpuPower!);
    expect(specs.linkMbps).toBeGreaterThanOrEqual(core.linkMbps!);
  });
});

describe('ip', () => {
  it('parses and formats', () => {
    expect(parseIp('192.168.0.42')).not.toBeNull();
    expect(formatIp(parseIp('192.168.0.42')!)).toBe('192.168.0.42');
    expect(parseIp('192.168.0.256')).toBeNull();
    expect(parseIp('1.2.3')).toBeNull();
  });

  it('computes subnet boundaries', () => {
    const ip = parseIp('10.1.2.77')!;
    expect(formatIp(networkAddress(ip, 26))).toBe('10.1.2.64');
    expect(formatIp(broadcastAddress(ip, 26))).toBe('10.1.2.127');
    expect(usableHosts(24)).toBe(254);
    expect(maskToPrefix(parseIp('255.255.255.0')!)).toBe(24);
    expect(maskToPrefix(parseIp('255.0.255.0')!)).toBeNull();
  });

  const lan: LanInfo = {
    routerIp: '192.168.0.1',
    mask: '255.255.255.0',
    takenBy: { 'Smart TV': '192.168.0.10' },
    dnsServers: ['192.168.0.1', '203.0.113.53'],
  };

  it('accepts a correct config', () => {
    expect(validateNetConfig({ ip: '192.168.0.42', mask: '255.255.255.0', gateway: '192.168.0.1', dns: '203.0.113.53' }, lan)).toEqual([]);
  });

  const good = { ip: '192.168.0.42', mask: '255.255.255.0', gateway: '192.168.0.1', dns: '192.168.0.1' };
  const firstCode = (config: Partial<typeof good>) => validateNetConfig({ ...good, ...config }, lan)[0]?.code;

  it('reports conflicts, broadcast, outside-LAN and wrong gateway by code', () => {
    expect(firstCode({ ip: '192.168.0.10' })).toBe('ip-conflict');
    expect(firstCode({ ip: '192.168.0.255' })).toBe('ip-broadcast');
    expect(firstCode({ ip: '192.168.1.42' })).toBe('ip-outside');
    expect(firstCode({ gateway: '192.168.0.10' })).toBe('gateway-not-router');
  });

  it('reports every other configuration problem by code', () => {
    expect(firstCode({ ip: '192.168.0' })).toBe('ip-invalid');
    expect(firstCode({ mask: '255.0.255.0' })).toBe('mask-invalid');
    expect(firstCode({ mask: '255.255.0.0' })).toBe('mask-mismatch');
    expect(firstCode({ ip: '192.168.0.0' })).toBe('ip-network');
    expect(firstCode({ gateway: 'router' })).toBe('gateway-invalid');
    expect(firstCode({ dns: '8.8.8' })).toBe('dns-invalid');
    expect(firstCode({ dns: '8.8.8.8' })).toBe('dns-unknown');
  });
});

describe('minigames', () => {
  const ids: MinigameId[] = ['binary', 'subnet', 'ports', 'http', 'dns'];
  const levels = (id: MinigameId) => Array.from({ length: MAX_LEVEL[id] }, (_, i) => i + 1);

  for (const id of ids) {
    for (const d of levels(id)) {
      it(`${id} level ${d} produces valid rounds`, () => {
        for (let seed = 1; seed <= 30; seed++) {
          const rounds = buildRounds(id, d, createRng(seed));
          expect(rounds.length).toBe(roundCount(d));
          for (const r of rounds) {
            expect(CONCEPTS[r.concept].area).toBe(id);
            if (r.kind === 'choice') {
              expect(r.options.length).toBeGreaterThanOrEqual(2);
              expect(new Set(r.options).size).toBe(r.options.length);
              expect(r.answer).toBeGreaterThanOrEqual(0);
              expect(r.answer).toBeLessThan(r.options.length);
            } else {
              expect(r.target).toBeGreaterThan(0);
              expect(r.target).toBeLessThan(2 ** r.bits);
            }
          }
        }
      });
    }
  }

  it('levels 1-3 keep 5, 7 and 9 rounds, and higher levels stay at 9', () => {
    expect([1, 2, 3, 4, 5, 7].map(roundCount)).toEqual([5, 7, 9, 9, 9, 9]);
  });

  it('only binary and subnets go above level 3', () => {
    expect(MAX_LEVEL).toEqual({ binary: 7, subnet: 5, ports: 3, http: 3, dns: 3 });
  });

  it('binary bits grow by 2 per level above 3, up to 16', () => {
    const bitsAt = (level: number) => {
      const sizes = new Set<number>();
      for (let seed = 1; seed <= 30; seed++) {
        for (const r of buildRounds('binary', level, createRng(seed))) if (r.kind === 'bits') sizes.add(r.bits);
      }
      return [...sizes];
    };
    expect(bitsAt(4)).toEqual([10]);
    expect(bitsAt(7)).toEqual([16]);
  });

  it('subnet level 5 networks stay inside private ranges', () => {
    const inBlock = (net: number, base: string, prefix: number) => networkAddress(net, prefix) === parseIp(base);
    let checked = 0;
    for (let seed = 1; seed <= 30; seed++) {
      for (const r of buildRounds('subnet', 5, createRng(seed))) {
        const cidr = /(\d+\.\d+\.\d+\.\d+)\/(\d+)/.exec(r.prompt);
        if (!cidr) continue;
        const prefix = Number(cidr[2]);
        expect(prefix).toBeGreaterThanOrEqual(9);
        expect(prefix).toBeLessThanOrEqual(15);
        const net = networkAddress(parseIp(cidr[1])!, prefix);
        expect(inBlock(net, '10.0.0.0', 8) || inBlock(net, '172.16.0.0', 12)).toBe(true);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('every concept shows up from its first level', () => {
    for (const [concept, { area, fromLevel }] of Object.entries(CONCEPTS)) {
      const seen = new Set<string>();
      for (let seed = 1; seed <= 30; seed++) for (const r of buildRounds(area, fromLevel, createRng(seed))) seen.add(r.concept);
      expect(seen, concept).toContain(concept);
    }
  });

  it('every round explains itself through three different lenses that fit the result panel', () => {
    for (const id of ids) {
      for (const d of levels(id)) {
        for (let seed = 1; seed <= 30; seed++) {
          for (const r of buildRounds(id, d, createRng(seed))) {
            const texts = LENSES.map((lens) => r.explain[lens]);
            for (const t of texts) {
              expect(t.length, `${r.concept}: ${t}`).toBeGreaterThan(0);
              expect(t.length, `${r.concept}: ${t}`).toBeLessThanOrEqual(220);
            }
            expect(new Set(texts).size, r.concept).toBe(3);
          }
        }
      }
    }
  });

  it('explanations use the numbers of the round that was missed', () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const r of buildRounds('binary', 3, createRng(seed), 'binary.toDecimal')) {
        if (r.concept !== 'binary.toDecimal') continue;
        const bin = /[01]{8}/.exec(r.prompt)![0];
        for (const lens of LENSES) expect(r.explain[lens]).toContain(bin);
      }
      for (const r of buildRounds('subnet', 2, createRng(seed), 'subnet.broadcast')) {
        if (r.kind !== 'choice' || r.concept !== 'subnet.broadcast') continue;
        const bcast = r.options[r.answer];
        expect(bcast).toMatch(/^(\d{1,3}\.){3}\d{1,3}$/);
        for (const lens of LENSES) expect(r.explain[lens]).toContain(bcast);
      }
    }
  });

  it('a focused build spends at least two thirds of its rounds on the concept, at every level', () => {
    for (const [concept, { area, fromLevel }] of Object.entries(CONCEPTS) as [ConceptId, (typeof CONCEPTS)[ConceptId]][]) {
      for (let level = fromLevel; level <= MAX_LEVEL[area]; level++) {
        for (let seed = 1; seed <= 10; seed++) {
          const rounds = buildRounds(area, level, createRng(seed), concept);
          expect(rounds.length, `${concept} level ${level}`).toBe(roundCount(level));
          const focused = rounds.filter((r) => r.concept === concept).length;
          expect(focused, `${concept} level ${level}`).toBeGreaterThanOrEqual(Math.ceil((roundCount(level) * 2) / 3));
        }
      }
    }
  });
});

describe('minigame notation', () => {
  it('HTTP reason phrases stay in English protocol notation', () => {
    expect(STATUSES.find((s) => s.code === 404)!.meaning).toBe('Not Found');
    expect(STATUSES.find((s) => s.code === 403)!.meaning).toBe('Forbidden');
  });

  it('subnet rounds keep CIDR and dotted addresses in standard form', () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const r of buildRounds('subnet', 2, createRng(seed))) {
        if (r.kind !== 'choice') continue;
        for (const o of r.options) expect(o).toMatch(/^(\d{1,3}\.){3}\d{1,3}$|^\d+$/);
      }
    }
  });
});

describe('content integrity', () => {
  it('every referenced lesson exists', () => {
    for (const p of PARTS) expect(() => getLesson(p.requiresLesson)).not.toThrow();
    for (const n of NODES) if (n.requires.lesson) expect(() => getLesson(n.requires.lesson!)).not.toThrow();
    for (const l of LESSONS) for (const r of l.requires) expect(() => getLesson(r)).not.toThrow();
    for (const id of Object.values(AREA_LESSON)) expect(() => getLesson(id)).not.toThrow();
  });

  it('quiz answers point at real options', () => {
    for (const l of LESSONS) for (const q of l.quiz) expect(q.options[q.answer]).toBeDefined();
  });

  it('the ethics lesson opens right after Networks 101, first in its track', () => {
    const s = newGame();
    expect(isLessonOpen(s, ETHICS_LESSON_ID)).toBe(false);
    for (const id of ['computer-basics', 'power', 'cpu', 'memory', 'storage', 'network-basics']) completeLesson(s, id);
    expect(isLessonOpen(s, ETHICS_LESSON_ID)).toBe(true);
    const lesson = getLesson(ETHICS_LESSON_ID);
    expect(LESSONS.filter((l) => l.track === lesson.track)[0].id).toBe(ETHICS_LESSON_ID);
    expect(lesson.quiz.length).toBeGreaterThanOrEqual(3);
  });

  it('the routing lesson opens once IP addressing is passed', () => {
    const s = newGame();
    for (const id of ['computer-basics', 'power', 'cpu', 'memory', 'storage', 'binary', 'network-basics']) completeLesson(s, id);
    expect(isLessonOpen(s, ROUTING_LESSON_ID)).toBe(false);
    completeLesson(s, 'ip-addressing');
    expect(isLessonOpen(s, ROUTING_LESSON_ID)).toBe(true);
    expect(getLesson(ROUTING_LESSON_ID).track).toBe('networking');
  });

  it('every tier lesson exists, belongs to its tier and requires only lessons of its own pack', () => {
    for (const tier of TIERS) {
      expect(tier.lessons.length).toBeGreaterThanOrEqual(1);
      tier.lessons.forEach((id, i) => {
        const lesson = getLesson(id);
        expect(lesson.tier, id).toBe(tier.id);
        expect(lesson.requires, id).toEqual(i === 0 ? [] : [tier.lessons[i - 1]]);
        expect(lesson.quiz.length, id).toBeGreaterThanOrEqual(3);
      });
    }
    const tierLessons = LESSONS.filter((l) => l.tier).map((l) => l.id);
    expect(tierLessons.sort()).toEqual(TIERS.flatMap((t) => t.lessons).sort());
  });

  it('shows only the lessons of the open tier after the formatura (AE2)', () => {
    const s = newGame();
    const visible = () => LESSONS.filter((l) => l.tier && isLessonVisible(s, l.id)).map((l) => l.id);
    expect(visible()).toEqual([]);
    issueCertificate(s, 'conclusao');
    expect(visible()).toEqual([]);
    presentCertificate(s, 'conclusao', 'Ana');
    expect(visible()).toEqual(['nat-basics', 'port-forwarding']);
    expect(isLessonVisible(s, 'computer-basics')).toBe(true);
  });

  it('never opens a tier lesson while its tier is closed, even with its requirements met', () => {
    const s = newGame();
    issueCertificate(s, 'conclusao');
    presentCertificate(s, 'conclusao', 'Ana');
    expect(isLessonOpen(s, 'nat-basics')).toBe(true);
    expect(isLessonOpen(s, 'port-forwarding')).toBe(false);
    expect(isLessonOpen(s, 'vlan-basics')).toBe(false);
    s.lessonsCompleted.push('vlan-basics');
    expect(isLessonOpen(s, 'vlan-trunks')).toBe(false);
  });

  it('every part, slot and track has what PT-BR text needs', () => {
    for (const p of PARTS) expect(['m', 'f']).toContain(p.gender);
    for (const slot of SLOTS) {
      expect(SLOT_LABELS[slot]).toBeTruthy();
      expect(['m', 'f']).toContain(SLOT_GENDER[slot]);
    }
    for (const l of LESSONS) expect(TRACK_LABELS[l.track]).toBeTruthy();
  });

  it('switches and routers carry the ports and uplink the NOC needs', () => {
    const switches = PARTS.filter((p) => p.slot === 'switch');
    expect(switches.length).toBeGreaterThan(0);
    expect(switches.length).toBeLessThanOrEqual(4);
    for (const p of switches) {
      expect(p.stats.ports).toBeGreaterThan(0);
      expect(p.stats.uplinkMbps).toBeGreaterThan(0);
      expect(p.draw).toBe(0);
    }
    for (const p of PARTS.filter((p) => p.slot === 'router')) expect(p.stats.ports).toBeGreaterThan(0);
    expect(getPart('router_home').stats.ports).toBe(4);
  });

  it('switches never count as a case part', () => {
    expect(CASE_SLOTS).not.toContain('switch');
    const specs = computeSpecs({ motherboard: 'mb_b1', cpu: 'cpu_s1_2c', ram: 'ram_4_ddr4', storage: 'hdd_500', psu: 'psu_250' });
    expect(specs.issues.map((i) => i.code)).not.toContain('missing-switch');
  });

  it('every node but home resolves to real hardware with a network card', () => {
    for (const n of NODES) {
      if (n.id === 'home') {
        expect(n.hardware).toBeUndefined();
        continue;
      }
      expect(n.hardware).toBeDefined();
      const build = nodeBuild(n);
      for (const [slot, id] of Object.entries(build)) expect(getPart(id).slot).toBe(slot);
      expect(build.nic).toBeDefined();
      expect(NODE_KIND_LABELS[n.hardware!.kind]).toBeTruthy();
    }
  });

  it('only router and switch kinds provide ports', () => {
    for (const kind of NODE_KINDS) {
      for (const tier of [1, 2, 3] as const) {
        const ports = buildContribution(resolveBuild({ kind, tier })).ports;
        if (kind === 'edge-router' || kind === 'distribution-switch') expect(ports).toBeGreaterThan(0);
        else expect(ports).toBe(0);
      }
    }
  });

  it('an override replaces only the overridden part', () => {
    const base = resolveBuild({ kind: 'server', tier: 1 });
    const custom = resolveBuild({ kind: 'server', tier: 1, overrides: { ram: 'ram_64_ddr5' } });
    expect(custom.ram).toBe('ram_64_ddr5');
    expect({ ...custom, ram: base.ram }).toEqual(base);
  });

  it('a build contributes the stats of its parts', () => {
    const c = buildContribution({ cpu: 'cpu_s1_4c', ram: 'ram_16_ddr4', storage: 'ssd_512', nic: 'nic_1g', switch: 'sw_8_gig' });
    expect(c).toEqual({ cpuPower: 12.8, ramGB: 16, storageGB: 512, linkMbps: 1000, ports: 8 });
  });

  it('node links are symmetric', () => {
    for (const n of NODES) for (const id of n.links) expect(getNode(id).links).toContain(n.id);
  });
});

const NET = { ip: '192.168.0.42', mask: '255.255.255.0', gateway: '192.168.0.1', dns: '192.168.0.1' };

/** An online player rig; the S2 option swaps in a 32 CPU-power octa-core build. */
function onlineRig(opts: { octa?: boolean; router?: string } = {}): GameState {
  const s = newGame();
  s.installed = opts.octa
    ? { motherboard: 'mb_x5', cpu: 'cpu_s2_8c', ram: 'ram_32_ddr5', storage: 'ssd_512', psu: 'psu_450' }
    : { motherboard: 'mb_b1', cpu: 'cpu_s1_2c', ram: 'ram_4_ddr4', storage: 'hdd_500', psu: 'psu_250' };
  s.installed.nic = 'nic_1g';
  s.installed.router = opts.router ?? 'router_gig';
  s.netConfig = { ...NET };
  return s;
}

/** Marks nodes breached and attaches them, bypassing the mutators. */
function attach(s: GameState, links: Record<string, string>) {
  for (const [node, provider] of Object.entries(links)) {
    if (!s.breached.includes(node)) s.breached.push(node);
    s.swarm[node] = provider;
  }
}

describe('swarm math', () => {
  it('starts empty, so old saves load with no NOC and nothing connected', () => {
    const s = newGame();
    expect(s.noc).toEqual([]);
    expect(s.swarm).toEqual({});
  });

  it('uplink caps usable power behind a switch (AE1)', () => {
    const s = onlineRig();
    s.noc = [{ id: 'sw1', partId: 'sw_8_gig' }];
    attach(s, { shop: 'sw1', mail: 'sw1', uni: 'sw1' });
    const r = swarmReport(s);
    expect(r.bandwidthMbps).toBe(1000);
    expect(r.usable.cpuPower).toBeLessThan(r.raw.cpuPower);
  });

  it('intrusion stats stay capped however big the swarm is (AE5)', () => {
    const s = onlineRig({ octa: true, router: 'router_10g' });
    s.noc = [{ id: 'sw1', partId: 'sw_48_10g' }];
    attach(s, { core: 'sw1', shop: 'sw1', mail: 'sw1', blog: 'sw1', resolver: 'sw1' });
    const t = totalSpecs(s);
    expect(t.cpuPower).toBeGreaterThan(88);
    expect(t.ramGB).toBeGreaterThan(64);
    expect(roundSeconds(t.cpuPower)).toBe(30);
    expect(mistakesAllowed(t.ramGB)).toBe(4);
  });

  it('a 32 CPU-power rig plus the swarm passes the core CPU requirement (AE6)', () => {
    const s = onlineRig({ octa: true });
    expect(specsOf(s).cpuPower).toBe(32);
    s.noc = [{ id: 'sw1', partId: 'sw_8_gig' }];
    attach(s, { shop: 'sw1', mail: 'router' });
    expect(totalSpecs(s).cpuPower).toBeGreaterThanOrEqual(getNode('core').requires.cpuPower!);
  });

  it('fast node links never change the player link (AE7)', () => {
    const s = onlineRig({ router: 'router_home' });
    s.installed.nic = 'nic_100';
    s.noc = [{ id: 'sw1', partId: 'sw_48_10g' }];
    attach(s, { core: 'sw1' });
    expect(totalSpecs(s).linkMbps).toBe(100);
  });

  it('the swarm counts only while the own rig is online (AE9)', () => {
    const s = onlineRig();
    attach(s, { resolver: 'router' });
    expect(totalSpecs(s).cpuPower).toBeGreaterThan(specsOf(s).cpuPower);
    delete s.installed.nic;
    expect(totalSpecs(s)).toEqual(specsOf(s));
    expect(s.swarm.resolver).toBe('router');
  });

  it('storage adds in full even when bandwidth caps CPU and RAM', () => {
    const s = onlineRig({ router: 'router_home' });
    attach(s, { core: 'router', shop: 'router' });
    const r = swarmReport(s);
    expect(r.usable.cpuPower).toBeLessThan(r.raw.cpuPower);
    expect(totalSpecs(s).storageGB).toBe(specsOf(s).storageGB + r.raw.storageGB);
  });

  it('connecting another node never lowers usable power', () => {
    const order = ['museum', 'resolver', 'blog', 'shop', 'mail', 'core'];
    for (const router of ['router_home', 'router_gig']) {
      const s = onlineRig({ router });
      let prev = swarmReport(s).usable;
      for (const node of order.slice(0, 4)) {
        attach(s, { [node]: 'router' });
        const next = swarmReport(s).usable;
        expect(next.cpuPower).toBeGreaterThanOrEqual(prev.cpuPower);
        expect(next.ramGB).toBeGreaterThanOrEqual(prev.ramGB);
        expect(next.storageGB).toBeGreaterThanOrEqual(prev.storageGB);
        prev = next;
      }
    }
  });

  it('a port-providing node uses one parent port and adds its own', () => {
    const s = onlineRig();
    const before = freePorts(s, 'router');
    attach(s, { isp: 'router' });
    expect(freePorts(s, 'router')).toBe(before - 1);
    expect(freePorts(s, 'isp')).toBe(4);
  });

  it('a switch-type node caps its subtree at its own link', () => {
    const s = onlineRig({ router: 'router_10g' });
    attach(s, { uni: 'router' });
    expect(swarmReport(s).bandwidthMbps).toBe(1000);
    attach(s, { shop: 'uni', mail: 'uni' });
    expect(swarmReport(s).bandwidthMbps).toBe(1000);
  });

  it('dependents include nested descendants', () => {
    const s = onlineRig();
    attach(s, { isp: 'router', uni: 'isp', shop: 'uni' });
    expect(dependents(s, 'isp').sort()).toEqual(['shop', 'uni']);
  });

  it('a new node goes where it adds the most bandwidth', () => {
    const s = onlineRig({ router: 'router_home' });
    s.noc = [{ id: 'sw1', partId: 'sw_8_gig' }];
    attach(s, { museum: 'router' });
    expect(pickProvider(s, 'shop')).toBe('sw1');
  });
});

describe('swarm actions', () => {
  it('a breach with every port taken leaves the node waiting (AE2)', () => {
    const s = onlineRig({ router: 'router_home' });
    attach(s, { museum: 'router', resolver: 'router', blog: 'router', shop: 'router' });
    breach(s, 'mail');
    const r = joinSwarm(s, 'mail');
    expect(r.code).toBe('no-free-port');
    expect(s.breached).toContain('mail');
    expect(s.swarm.mail).toBeUndefined();
  });

  it('joins a breached node to the best free port', () => {
    const s = onlineRig();
    breach(s, 'isp');
    const r = joinSwarm(s, 'isp');
    expect(r.ok).toBe(true);
    expect(r.code).toBe('joined');
    expect(s.swarm.isp).toBe('router');
  });

  it('refuses nodes that are not breached or already connected', () => {
    const s = onlineRig();
    expect(joinSwarm(s, 'isp').code).toBe('not-breached');
    attach(s, { isp: 'router' });
    expect(joinSwarm(s, 'isp').code).toBe('already-connected');
    expect(leaveSwarm(s, 'mail').code).toBe('not-connected');
  });

  it('blocks disconnecting a switch node whose dependents cannot move, and names them (AE3)', () => {
    const s = onlineRig({ router: 'router_home' });
    attach(s, { uni: 'router', museum: 'router', resolver: 'router', blog: 'router' });
    attach(s, { shop: 'uni', mail: 'uni', isp: 'uni' });
    const before = structuredClone(s.swarm);
    const r = leaveSwarm(s, 'uni');
    expect(r.ok).toBe(false);
    expect(r.code).toBe('blocked-dependents');
    expect(s.swarm).toEqual(before);
    const stuck = ['shop', 'mail', 'isp'].filter((id) => r.message.includes(getNode(id).name));
    expect(stuck.length).toBeGreaterThanOrEqual(2);
  });

  it('re-homes dependents when they fit elsewhere', () => {
    const s = onlineRig();
    s.noc = [{ id: 'sw1', partId: 'sw_8_gig' }];
    attach(s, { shop: 'sw1', mail: 'sw1' });
    const r = removeSwitch(s, 'sw1');
    expect(r.ok).toBe(true);
    expect(s.noc).toEqual([]);
    expect(s.inventory).toContain('sw_8_gig');
    expect(s.swarm.shop).toBe('router');
    expect(s.swarm.mail).toBe('router');
  });

  it('moves a switch node together with the nodes below it', () => {
    const s = onlineRig();
    s.noc = [{ id: 'sw1', partId: 'sw_8_fast' }];
    attach(s, { museum: 'router', resolver: 'router', blog: 'router', shop: 'router', isp: 'router', mail: 'router', core: 'router' });
    attach(s, { uni: 'sw1' });
    attach(s, { 'corp-fw': 'uni' });
    s.noc.push({ id: 'sw2', partId: 'sw_8_gig' });
    expect(removeSwitch(s, 'sw1').ok).toBe(true);
    expect(s.swarm.uni).toBe('sw2');
    expect(s.swarm['corp-fw']).toBe('uni');
  });

  it('blocks swapping to a router with fewer ports unless nodes can move (AE8)', () => {
    const s = onlineRig();
    attach(s, { museum: 'router', resolver: 'router', blog: 'router', shop: 'router', mail: 'router' });
    s.inventory.push('router_home');
    const blocked = install(s, 'router_home');
    expect(s.installed.router).toBe('router_gig');
    expect(blocked).toContain(getNode('mail').name);
    s.noc = [{ id: 'sw1', partId: 'sw_8_gig' }];
    install(s, 'router_home');
    expect(s.installed.router).toBe('router_home');
    expect(Object.values(s.swarm).filter((p) => p === 'router').length).toBe(4);
    expect(Object.values(s.swarm).filter((p) => p === 'sw1').length).toBe(1);
  });

  it('blocks removing a switch whose nodes cannot move, and changes nothing', () => {
    const s = onlineRig({ router: 'router_home' });
    s.noc = [{ id: 'sw1', partId: 'sw_8_gig' }];
    attach(s, { museum: 'router', resolver: 'router', blog: 'router', shop: 'router', mail: 'sw1' });
    const before = structuredClone({ noc: s.noc, swarm: s.swarm, inventory: s.inventory });
    const r = removeSwitch(s, 'sw1');
    expect(r.ok).toBe(false);
    expect(r.code).toBe('blocked-dependents');
    expect(r.message).toContain(getNode('mail').name);
    expect({ noc: s.noc, swarm: s.swarm, inventory: s.inventory }).toEqual(before);
  });

  it('blocks removing the router while nodes use its ports, and changes nothing', () => {
    const s = onlineRig();
    attach(s, { resolver: 'router' });
    const before = structuredClone({ installed: s.installed, swarm: s.swarm, inventory: s.inventory });
    const message = uninstall(s, 'router');
    expect(message).toContain(getNode('resolver').name);
    expect({ installed: s.installed, swarm: s.swarm, inventory: s.inventory }).toEqual(before);
  });

  it('removing the player NIC never blocks and keeps the swarm', () => {
    const s = onlineRig();
    attach(s, { resolver: 'router' });
    uninstall(s, 'nic');
    expect(s.installed.nic).toBeUndefined();
    expect(s.swarm.resolver).toBe('router');
  });

  it('re-breaching leaves the connection state alone (AE10)', () => {
    const s = onlineRig({ router: 'router_home' });
    attach(s, { museum: 'router', resolver: 'router', blog: 'router', shop: 'router' });
    breach(s, 'mail');
    leaveSwarm(s, 'shop');
    breach(s, 'mail');
    expect(s.swarm.mail).toBeUndefined();
  });

  it('installing a switch puts it in the NOC, and owned counts include it', () => {
    const s = onlineRig();
    s.inventory.push('sw_8_gig');
    const msg = install(s, 'sw_8_gig');
    expect(s.noc.map((e) => e.partId)).toEqual(['sw_8_gig']);
    expect(s.installed.switch).toBeUndefined();
    expect(msg).toContain('8 portas');
    expect(ownedCount(s, 'sw_8_gig')).toBe(1);
    expect(freePorts(s, s.noc[0].id)).toBe(8);
  });
});

describe('swarm in requirements', () => {
  const met = (s: GameState, id: string, prefix: string) =>
    checkRequirements(s, getNode(id)).find((c) => c.label.startsWith(prefix))!.met;

  it('connected nodes help meet CPU and RAM requirements while online', () => {
    const s = onlineRig();
    expect(met(s, 'uni', 'Processamento')).toBe(false);
    expect(met(s, 'uni', 'RAM')).toBe(false);
    attach(s, { resolver: 'router' });
    expect(met(s, 'uni', 'Processamento')).toBe(true);
    expect(met(s, 'uni', 'RAM')).toBe(true);
    s.netConfig = null;
    expect(met(s, 'uni', 'Processamento')).toBe(false);
  });

  it('the link requirement ignores the swarm', () => {
    const s = onlineRig({ router: 'router_home' });
    s.installed.nic = 'nic_100';
    s.noc = [{ id: 'sw1', partId: 'sw_48_10g' }];
    attach(s, { core: 'sw1' });
    expect(met(s, 'shop', 'Link')).toBe(false);
  });

  it('online state and game phase do not depend on the swarm', () => {
    const s = onlineRig();
    const before = [isOnline(s), phaseOf(s)];
    attach(s, { resolver: 'router', shop: 'router' });
    expect([isOnline(s), phaseOf(s)]).toEqual(before);
  });
});

describe('swarm balance', () => {
  const coreNeeds = getNode('core').requires;

  it('a mid-tier rig plus a realistic swarm meets the core CPU, RAM and storage', () => {
    const s = onlineRig({ octa: true });
    s.noc = [{ id: 'sw1', partId: 'sw_8_gig' }];
    attach(s, { shop: 'sw1', mail: 'router' });
    const t = totalSpecs(s);
    expect(t.cpuPower).toBeGreaterThanOrEqual(coreNeeds.cpuPower!);
    expect(t.ramGB).toBeGreaterThanOrEqual(coreNeeds.ramGB!);
    expect(t.storageGB).toBeGreaterThanOrEqual(coreNeeds.storageGB!);
    expect(specsOf(s).cpuPower).toBeLessThan(coreNeeds.cpuPower!);
  });

  it('the starter rig plus its first two breaches meets a CPU requirement it could not alone', () => {
    const s = onlineRig({ router: 'router_home' });
    s.installed.nic = 'nic_100';
    const uniCpu = getNode('uni').requires.cpuPower!;
    expect(specsOf(s).cpuPower).toBeLessThan(uniCpu);
    attach(s, { isp: 'router', museum: 'router' });
    expect(totalSpecs(s).cpuPower).toBeGreaterThanOrEqual(uniCpu);
  });

  it('a 10 Gbps switch lets the end-game swarm use all its power', () => {
    const s = onlineRig({ octa: true, router: 'router_10g' });
    s.noc = [{ id: 'sw1', partId: 'sw_48_10g' }];
    attach(s, { core: 'sw1', shop: 'sw1', mail: 'sw1' });
    const r = swarmReport(s);
    expect(r.limited).toBe(false);
    expect(r.usable).toEqual(r.raw);
  });
});

describe('progression', () => {
  it('can go from an empty case to the network', () => {
    const s = newGame();
    expect(phaseOf(s)).toBe('build');
    expect(canBuy(s, getPart('mb_b1')).code).toBe('needs-lesson');
    buy(s, 'mb_b1');
    expect(s.inventory).toEqual([]);
    expect(s.money).toBe(STARTING_MONEY);

    for (const id of ['computer-basics', 'power', 'cpu', 'memory', 'storage']) completeLesson(s, id);
    for (const id of STARTER) {
      const before = s.money;
      buy(s, id);
      expect(s.inventory).toContain(id);
      expect(s.money).toBe(before - getPart(id).price);
      install(s, id);
    }
    expect(phaseOf(s)).toBe('connect');

    for (const id of ['binary', 'network-basics', 'ip-addressing', 'dns']) completeLesson(s, id);
    for (const id of ['nic_100', 'router_home']) {
      buy(s, id);
      install(s, id);
    }
    expect(isOnline(s)).toBe(false);
    setNetConfig(s, { ip: '192.168.0.42', mask: '255.255.255.0', gateway: '192.168.0.1', dns: '192.168.0.1' });
    expect(phaseOf(s)).toBe('explore');

    const isp = getNode('isp');
    expect(nodeStatus(s, isp)).toBe('reachable');
    expect(nodeStatus(s, getNode('resolver'))).toBe('hidden');
    expect(canConnect(s, isp)).toBe(false);
    completeLesson(s, ETHICS_LESSON_ID);
    expect(canConnect(s, isp)).toBe(true);
    const money = s.money;
    expect(breach(s, 'isp')).toBe(isp.reward);
    expect(s.money).toBe(money + isp.reward);
    expect(nodeStatus(s, getNode('resolver'))).toBe('reachable');
    expect(breach(s, 'isp')).toBeLessThan(isp.reward);
  });

  it('the ISP waits for the ethics lesson, which is listed first (AE1)', () => {
    const s = onlineRig();
    s.lessonsCompleted = ['ip-addressing'];
    const isp = getNode('isp');
    const first = checkRequirements(s, isp)[0];
    expect(first.label).toContain(getLesson(ETHICS_LESSON_ID).title);
    expect(first.met).toBe(false);
    expect(canConnect(s, isp)).toBe(false);
    completeLesson(s, ETHICS_LESSON_ID);
    expect(canConnect(s, isp)).toBe(true);
  });

  it('every node but home waits for the ethics lesson and nothing else (R10)', () => {
    const others = LESSONS.map((l) => l.id).filter((id) => id !== ETHICS_LESSON_ID);
    for (const node of NODES.filter((n) => n.id !== 'home')) {
      const s = newGame();
      s.installed = {
        motherboard: 'mb_x5', cpu: 'cpu_s2_16c', ram: 'ram_64_ddr5', storage: 'nvme_2tb', psu: 'psu_450',
        nic: 'nic_10g', router: 'router_10g',
      };
      s.netConfig = { ...NET };
      s.lessonsCompleted = [...others];
      s.breached = node.links.filter((id) => id !== 'home');
      expect(canConnect(s, node), node.id).toBe(false);
      completeLesson(s, ETHICS_LESSON_ID);
      expect(canConnect(s, node), node.id).toBe(true);
    }
  });

  it('old saves keep breached nodes but wait for the lesson to breach again (AE2)', () => {
    const s = onlineRig();
    s.lessonsCompleted = LESSONS.map((l) => l.id).filter((id) => id !== ETHICS_LESSON_ID);
    s.breached = ['isp', 'resolver', 'museum'];
    for (const id of s.breached) expect(nodeStatus(s, getNode(id))).toBe('breached');
    expect(canConnect(s, getNode('isp'))).toBe(false);
    expect(nodeStatus(s, getNode('blog'))).toBe('reachable');
    expect(canConnect(s, getNode('blog'))).toBe(false);
    completeLesson(s, ETHICS_LESSON_ID);
    expect(canConnect(s, getNode('isp'))).toBe(true);
    expect(s.breached).toEqual(['isp', 'resolver', 'museum']);
  });

  it('home has no lesson check', () => {
    expect(checkRequirements(newGame(), getNode('home'))).toEqual([]);
  });

  it('the explore hint points at the ethics lesson until it is passed', () => {
    const s = onlineRig();
    const title = getLesson(ETHICS_LESSON_ID).title;
    expect(phaseOf(s)).toBe('explore');
    expect(objective(s)).toContain(title);
    completeLesson(s, ETHICS_LESSON_ID);
    expect(objective(s)).not.toContain(title);
  });

  it('lesson rewards pay once and swaps return parts to inventory', () => {
    const s = newGame();
    expect(completeLesson(s, 'computer-basics')).toBeGreaterThan(0);
    expect(completeLesson(s, 'computer-basics')).toBe(0);
    completeLesson(s, 'cpu');
    buy(s, 'cpu_s1_2c');
    buy(s, 'cpu_s1_4c');
    install(s, 'cpu_s1_2c');
    install(s, 'cpu_s1_4c');
    expect(s.installed.cpu).toBe('cpu_s1_4c');
    expect(s.inventory).toEqual(['cpu_s1_2c']);
    const before = s.money;
    sell(s, 'cpu_s1_2c');
    expect(s.money).toBe(before + 45);
  });

  it('install, sell and stat text agree in gender and use pt-BR numbers', () => {
    const s = newGame();
    for (const id of ['computer-basics', 'cpu']) completeLesson(s, id);
    buy(s, 'mb_b1');
    buy(s, 'cpu_s1_2c');
    expect(install(s, 'mb_b1')).toContain('instalada');
    expect(install(s, 'cpu_s1_2c')).toContain('instalado');
    buy(s, 'cpu_s1_2c');
    expect(sell(s, 'cpu_s1_2c')).toContain('R$ 45');
    expect(describeStats(getPart('cpu_s1_2c'))).toContain('2,4 GHz');
    expect(describeStats(getPart('cpu_s1_2c'))).toContain('2 núcleos');
  });

  it('refuses purchases the player cannot afford', () => {
    const s = newGame();
    completeLesson(s, 'computer-basics');
    s.money = 10;
    expect(canBuy(s, getPart('mb_b1')).code).toBe('no-money');
    buy(s, 'mb_b1');
    expect(s.inventory).toEqual([]);
    expect(s.money).toBe(10);
  });
});
