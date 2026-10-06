import { describe, expect, it } from 'vitest';
import { generateCity, type City, type CityNode } from '../src/core/city';
import { MAX_CITY_LEVEL } from '../src/core/cityCode';
import { correctRoute } from '../src/core/routing';
import {
  breach, breachCityNode, canConnectCityNode, canStartCities, cityNodeStatus, newGame, nextCityLevel, objective, phaseOf,
  REPLAY_RATIO, startCity, submitRoute, type GameState,
} from '../src/core/state';
import { ETHICS_LESSON_ID, getLesson, ROUTING_LESSON_ID } from '../src/data/lessons';
import { FINAL_NODE_ID } from '../src/data/nodes';

const NET = { ip: '192.168.0.42', mask: '255.255.255.0', gateway: '192.168.0.1', dns: '192.168.0.1' };

/** A player who won the campaign with the end-game rig; the routing lesson is optional. */
function wonState(opts: { routing?: boolean } = {}): GameState {
  const s = newGame();
  s.installed = {
    motherboard: 'mb_x5', cpu: 'cpu_s2_16c', ram: 'ram_64_ddr5', storage: 'nvme_2tb', psu: 'psu_450',
    nic: 'nic_10g', router: 'router_10g',
  };
  s.netConfig = { ...NET };
  s.lessonsCompleted = ['network-basics', 'ip-addressing', 'dns', ETHICS_LESSON_ID];
  if (opts.routing !== false) s.lessonsCompleted.push(ROUTING_LESSON_ID);
  s.breached = ['isp', FINAL_NODE_ID];
  return s;
}

/** A city with at least two depths, so a router leads somewhere hidden. */
function deepCity(): City {
  for (let seed = 1; ; seed++) {
    const city = generateCity(1, seed);
    if (city.subnets.length >= 2) return city;
  }
}

function firstRouter(city: City): CityNode {
  return city.nodes.find((n) => n.role === 'router' && n.subnetId === 0)!;
}

function nodesIn(city: City, subnetId: number): CityNode[] {
  return city.nodes.filter((n) => n.subnetId === subnetId);
}

describe('city access', () => {
  it('AE4: a v1 save without cities keeps its campaign and gets an empty city list', () => {
    const won = wonState({ routing: false });
    const { cities: _dropped, ...oldSave } = JSON.parse(JSON.stringify(won)) as GameState;
    expect('cities' in oldSave).toBe(false);
    const loaded: GameState = { ...newGame(), ...oldSave };
    expect(loaded.cities).toEqual([]);
    expect(loaded.breached).toEqual(won.breached);
    expect(loaded.money).toBe(won.money);
    expect(loaded.installed).toEqual(won.installed);
    expect(phaseOf(loaded)).toBe('won');
    expect(canStartCities(loaded)).toBe(false);
    loaded.lessonsCompleted.push(ROUTING_LESSON_ID);
    expect(canStartCities(loaded)).toBe(true);
  });

  it('AE5: cities are not offered before the Data Center Core falls, even with the routing lesson', () => {
    const s = wonState();
    s.breached = ['isp'];
    expect(canStartCities(s)).toBe(false);
  });

  it('after the win, cities need the routing lesson', () => {
    expect(canStartCities(wonState({ routing: false }))).toBe(false);
    expect(canStartCities(wonState())).toBe(true);
  });
});

describe('objective after the win', () => {
  it('points to the routing lesson, then to the cities', () => {
    const title = getLesson(ROUTING_LESSON_ID).title;
    expect(objective(wonState({ routing: false }))).toContain(title);
    const ready = objective(wonState());
    expect(ready).not.toContain(title);
    expect(ready).toContain('Cidades');
  });
});

describe('starting cities', () => {
  it('starting the same level and seed twice keeps one entry and returns the same index', () => {
    const s = wonState();
    const a = startCity(s, 2, 4821);
    const b = startCity(s, 3, 4821);
    expect(startCity(s, 2, 4821)).toBe(a);
    expect(a).not.toBe(b);
    expect(s.cities).toHaveLength(2);
    expect(s.cities[a]).toEqual({ level: 2, seed: 4821, breached: [], opened: [], finished: false });
  });

  it('the next level is 1 plus finished cities, clamped to the highest code level', () => {
    const s = wonState();
    expect(nextCityLevel(s)).toBe(1);
    s.cities = Array.from({ length: 120 }, (_, i) => ({ level: 1, seed: i, breached: [], opened: [], finished: true }));
    expect(nextCityLevel(s)).toBe(MAX_CITY_LEVEL);
  });
});

describe('city map progress', () => {
  it('at the start only the home subnet is reachable and the router child subnet is hidden', () => {
    const s = wonState();
    const city = deepCity();
    const index = startCity(s, city.level, city.seed);
    for (const node of city.nodes) {
      expect(cityNodeStatus(s, index, city, node)).toBe(node.subnetId === 0 ? 'reachable' : 'hidden');
    }
    const child = firstRouter(city).childSubnetId!;
    for (const node of nodesIn(city, child)) expect(canConnectCityNode(s, index, city, node)).toBe(false);
    expect(canConnectCityNode(s, index, city, firstRouter(city))).toBe(true);
  });

  it('connecting needs the player online and the requirements met, ethics lesson included', () => {
    const city = deepCity();
    const router = firstRouter(city);
    const offline = wonState();
    offline.netConfig = null;
    expect(canConnectCityNode(offline, startCity(offline, city.level, city.seed), city, router)).toBe(false);
    const noEthics = wonState();
    noEthics.lessonsCompleted = noEthics.lessonsCompleted.filter((id) => id !== ETHICS_LESSON_ID);
    expect(canConnectCityNode(noEthics, startCity(noEthics, city.level, city.seed), city, router)).toBe(false);
    const weak = wonState();
    weak.installed.cpu = 'cpu_s1_2c';
    weak.installed.motherboard = 'mb_b1';
    weak.installed.ram = 'ram_4_ddr4';
    const hard = generateCity(12, 7);
    const hardNode = hard.nodes.find((n) => n.subnetId === 0)!;
    const weakIndex = startCity(weak, hard.level, hard.seed);
    expect(cityNodeStatus(weak, weakIndex, hard, hardNode)).toBe('reachable');
    expect(canConnectCityNode(weak, weakIndex, hard, hardNode)).toBe(false);
    const strong = wonState();
    expect(canConnectCityNode(strong, startCity(strong, hard.level, hard.seed), hard, hardNode)).toBe(true);
  });

  it('a wrong route keeps the child hidden, returns errors and keeps the router breached', () => {
    const s = wonState();
    const city = deepCity();
    const index = startCity(s, city.level, city.seed);
    const router = firstRouter(city);
    breachCityNode(s, index, city, router.id);
    const child = city.subnets[router.childSubnetId!];
    const issues = submitRoute(s, index, city, router.id, { ...correctRoute(city, router.id), destination: child.routerChildIp! });
    expect(issues.map((i) => i.code)).toEqual(['destination-host']);
    expect(s.cities[index].opened).toEqual([]);
    expect(cityNodeStatus(s, index, city, router)).toBe('breached');
    for (const node of nodesIn(city, child.id)) expect(cityNodeStatus(s, index, city, node)).toBe('hidden');
  });

  it('a correct route opens the child subnet and its nodes become reachable', () => {
    const s = wonState();
    const city = deepCity();
    const index = startCity(s, city.level, city.seed);
    const router = firstRouter(city);
    breachCityNode(s, index, city, router.id);
    expect(submitRoute(s, index, city, router.id, correctRoute(city, router.id))).toEqual([]);
    expect(submitRoute(s, index, city, router.id, correctRoute(city, router.id))).toEqual([]);
    expect(s.cities[index].opened).toEqual([router.childSubnetId]);
    for (const node of nodesIn(city, router.childSubnetId!)) {
      expect(cityNodeStatus(s, index, city, node)).toBe('reachable');
      expect(canConnectCityNode(s, index, city, node)).toBe(true);
    }
  });

  it('a route needs the router breached first', () => {
    const s = wonState();
    const city = deepCity();
    const index = startCity(s, city.level, city.seed);
    const router = firstRouter(city);
    expect(() => submitRoute(s, index, city, router.id, correctRoute(city, router.id))).toThrow();
    expect(s.cities[index].opened).toEqual([]);
  });

  it('routes through every depth open the whole city, down to the core', () => {
    const s = wonState();
    const city = generateCity(12, 7);
    const index = startCity(s, city.level, city.seed);
    for (const subnet of city.subnets.slice(1)) {
      const router = city.nodes.find((n) => n.id === subnet.routerId)!;
      expect(cityNodeStatus(s, index, city, router)).toBe('reachable');
      breachCityNode(s, index, city, router.id);
      expect(submitRoute(s, index, city, router.id, correctRoute(city, router.id))).toEqual([]);
    }
    const core = city.nodes.find((n) => n.id === city.coreId)!;
    expect(cityNodeStatus(s, index, city, core)).toBe('reachable');
  });
});

describe('finishing cities', () => {
  it('breaching the core finishes the city, and its nodes still pay the replay reward', () => {
    const s = wonState();
    const city = deepCity();
    const index = startCity(s, city.level, city.seed);
    const core = city.nodes.find((n) => n.id === city.coreId)!;
    const host = city.nodes.find((n) => n.subnetId === 0 && n.role === 'host')!;

    const before = s.money;
    expect(breachCityNode(s, index, city, host.id)).toBe(host.reward);
    expect(s.cities[index].finished).toBe(false);
    expect(breachCityNode(s, index, city, core.id)).toBe(core.reward);
    expect(s.cities[index].finished).toBe(true);
    expect(s.money).toBe(before + host.reward + core.reward);

    expect(breachCityNode(s, index, city, host.id)).toBe(Math.floor(host.reward * REPLAY_RATIO));
    expect(breachCityNode(s, index, city, core.id)).toBe(Math.floor(core.reward * REPLAY_RATIO));
    expect(s.cities[index].finished).toBe(true);
    expect(s.cities[index].breached).toEqual([host.id, core.id]);
  });

  it('AE3: finishing a level 5 code city after one finished city makes the next city level 3', () => {
    const s = wonState();
    const first = generateCity(1, 11);
    breachCityNode(s, startCity(s, first.level, first.seed), first, first.coreId);
    expect(nextCityLevel(s)).toBe(2);
    const code = generateCity(5, 4821);
    breachCityNode(s, startCity(s, code.level, code.seed), code, code.coreId);
    expect(nextCityLevel(s)).toBe(3);
  });

  it('city and campaign progress stay apart', () => {
    const s = wonState();
    const city = deepCity();
    const index = startCity(s, city.level, city.seed);
    const campaign = [...s.breached];
    const swarm = { ...s.swarm };
    breachCityNode(s, index, city, firstRouter(city).id);
    breachCityNode(s, index, city, city.coreId);
    expect(s.breached).toEqual(campaign);
    expect(s.swarm).toEqual(swarm);

    const progress = JSON.parse(JSON.stringify(s.cities));
    breach(s, 'museum');
    expect(s.cities).toEqual(progress);
  });
});
