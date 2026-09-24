import { describe, expect, it } from 'vitest';
import { computeSpecs, mistakesAllowed, roundSeconds } from '../src/core/hardware';
import {
  broadcastAddress, formatIp, maskToPrefix, networkAddress, parseIp, usableHosts, validateNetConfig, type LanInfo,
} from '../src/core/ip';
import { buildRounds, roundCount, type Difficulty } from '../src/core/minigames';
import { createRng } from '../src/core/random';
import {
  breach, buy, canConnect, completeLesson, install, isOnline, newGame, nodeStatus, phaseOf, sell, setNetConfig,
} from '../src/core/state';
import { LESSONS, getLesson } from '../src/data/lessons';
import { NODES, getNode, type MinigameId } from '../src/data/nodes';
import { PARTS } from '../src/data/parts';

const STARTER = ['mb_b1', 'cpu_s1_2c', 'ram_4_ddr4', 'hdd_500', 'psu_250'];

describe('hardware', () => {
  it('reports every missing boot part on an empty case', () => {
    const specs = computeSpecs({});
    expect(specs.boots).toBe(false);
    expect(specs.issues.map((i) => i.slot)).toEqual(
      expect.arrayContaining(['motherboard', 'cpu', 'ram', 'storage', 'psu']),
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
    const text = specs.issues.map((i) => i.message).join('\n');
    expect(text).toMatch(/socket/);
    expect(text).toMatch(/DDR5/);
    expect(text).toMatch(/PSU only delivers 250 W/);
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

  it('explains conflicts, broadcast and wrong gateway', () => {
    expect(validateNetConfig({ ip: '192.168.0.10', mask: '255.255.255.0', gateway: '192.168.0.1', dns: '192.168.0.1' }, lan)[0]).toMatch(/Smart TV/);
    expect(validateNetConfig({ ip: '192.168.0.255', mask: '255.255.255.0', gateway: '192.168.0.1', dns: '192.168.0.1' }, lan)[0]).toMatch(/BROADCAST/);
    expect(validateNetConfig({ ip: '192.168.1.42', mask: '255.255.255.0', gateway: '192.168.0.1', dns: '192.168.0.1' }, lan)[0]).toMatch(/outside/);
    expect(validateNetConfig({ ip: '192.168.0.42', mask: '255.255.255.0', gateway: '192.168.0.10', dns: '192.168.0.1' }, lan)[0]).toMatch(/not your router/);
  });
});

describe('minigames', () => {
  const ids: MinigameId[] = ['binary', 'subnet', 'ports', 'http', 'dns'];
  for (const id of ids) {
    for (const d of [1, 2, 3] as Difficulty[]) {
      it(`${id} difficulty ${d} produces valid rounds`, () => {
        for (let seed = 1; seed <= 30; seed++) {
          const rounds = buildRounds(id, d, createRng(seed));
          expect(rounds.length).toBe(roundCount(d));
          for (const r of rounds) {
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
});

describe('content integrity', () => {
  it('every referenced lesson exists', () => {
    for (const p of PARTS) expect(() => getLesson(p.requiresLesson)).not.toThrow();
    for (const n of NODES) if (n.requires.lesson) expect(() => getLesson(n.requires.lesson!)).not.toThrow();
    for (const l of LESSONS) for (const r of l.requires) expect(() => getLesson(r)).not.toThrow();
  });

  it('quiz answers point at real options', () => {
    for (const l of LESSONS) for (const q of l.quiz) expect(q.options[q.answer]).toBeDefined();
  });

  it('node links are symmetric', () => {
    for (const n of NODES) for (const id of n.links) expect(getNode(id).links).toContain(n.id);
  });
});

describe('progression', () => {
  it('can go from an empty case to the network', () => {
    const s = newGame();
    expect(phaseOf(s)).toBe('build');
    expect(buy(s, 'mb_b1')).toMatch(/Study/);

    for (const id of ['computer-basics', 'power', 'cpu', 'memory', 'storage']) completeLesson(s, id);
    for (const id of STARTER) {
      expect(buy(s, id)).toMatch(/Bought/);
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
    expect(canConnect(s, isp)).toBe(true);
    const money = s.money;
    expect(breach(s, 'isp')).toBe(isp.reward);
    expect(s.money).toBe(money + isp.reward);
    expect(nodeStatus(s, getNode('resolver'))).toBe('reachable');
    expect(breach(s, 'isp')).toBeLessThan(isp.reward);
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
});
