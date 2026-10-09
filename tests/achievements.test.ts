import { describe, expect, it } from 'vitest';
import { RULES, satisfied, type CounterTotals, type RunSummary } from '../src/core/achievements';
import { issueCertificate, presentCertificate } from '../src/core/certificates';
import { MAX_LEVEL } from '../src/core/minigames';
import { newGame, type GameState } from '../src/core/state';
import { ACHIEVEMENTS } from '../src/data/achievements';
import { LESSONS } from '../src/data/lessons';
import { FINAL_NODE_ID, MINIGAME_AREAS, type MinigameId } from '../src/data/nodes';
import { CASE_SLOTS, PARTS } from '../src/data/parts';

const ZERO: CounterTotals = { answered: 0, correct: 0, runs: 0, cities: 0 };
const NET = { ip: '192.168.0.42', mask: '255.255.255.0', gateway: '192.168.0.1', dns: '192.168.0.1' };

/** A booting, online player rig. */
function onlineRig(): GameState {
  const s = newGame();
  s.installed = {
    motherboard: 'mb_b1', cpu: 'cpu_s1_2c', ram: 'ram_4_ddr4', storage: 'hdd_500', psu: 'psu_250', nic: 'nic_1g', router: 'router_gig',
  };
  s.netConfig = { ...NET };
  return s;
}

function run(over: Partial<RunSummary> = {}): RunSummary {
  return { area: 'binary', success: true, mistakes: 1, allowed: 2, timeouts: 0, crashedOnLast: false, firstBreach: false, ...over };
}

const ids = (state: GameState, totals: CounterTotals = ZERO, summary?: RunSummary) => satisfied(state, totals, summary);

describe('achievement content', () => {
  it('has 30 unique kebab-case ids, every kind, and a rule for each but fresh-start', () => {
    expect(ACHIEVEMENTS).toHaveLength(30);
    const all = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(all).size).toBe(30);
    for (const id of all) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(new Set(ACHIEVEMENTS.map((a) => a.kind))).toEqual(new Set(['story', 'skill', 'counter', 'secret']));
    expect(Object.keys(RULES).sort()).toEqual(all.filter((id) => id !== 'fresh-start').sort());
  });

  it('gives every counter a positive target and a counter rule', () => {
    for (const a of ACHIEVEMENTS.filter((x) => x.kind === 'counter')) {
      expect(a.target).toBeGreaterThan(0);
      expect(RULES[a.id].kind).toBe('counter');
    }
  });
});

describe('achievement rules', () => {
  it('a new game satisfies nothing', () => {
    expect(ids(newGame())).toEqual([]);
  });

  it('an online rig satisfies first-boot and online, and first-lesson once a lesson is done', () => {
    const s = onlineRig();
    expect(ids(s).sort()).toEqual(['first-boot', 'online']);
    s.lessonsCompleted.push('computer-basics');
    expect(ids(s)).toContain('first-lesson');
  });

  it('formatura needs the conclusão certificate presented, not just issued', () => {
    const s = newGame();
    issueCertificate(s, 'conclusao');
    expect(ids(s)).not.toContain('formatura');
    presentCertificate(s, 'conclusao', 'Ana');
    expect(ids(s)).toContain('formatura');
  });

  it('each tier certificate satisfies only its own achievement', () => {
    const s = newGame();
    issueCertificate(s, 'mestrado');
    presentCertificate(s, 'mestrado');
    const got = ids(s);
    expect(got).toContain('mestrado');
    expect(got).not.toContain('especializacao');
    expect(got).not.toContain('doutorado');
  });

  it('area-max needs one area at max, all-areas-max needs every area', () => {
    const s = newGame();
    s.areaLevels.ports = MAX_LEVEL.ports;
    expect(ids(s)).toContain('area-max');
    expect(ids(s)).not.toContain('all-areas-max');
    for (const id of Object.keys(MINIGAME_AREAS) as MinigameId[]) s.areaLevels[id] = MAX_LEVEL[id];
    expect(ids(s)).toEqual(expect.arrayContaining(['area-max', 'all-areas-max']));
  });

  it('all-lessons needs every lesson', () => {
    const s = newGame();
    s.lessonsCompleted = LESSONS.slice(1).map((l) => l.id);
    expect(ids(s)).not.toContain('all-lessons');
    s.lessonsCompleted.push(LESSONS[0].id);
    expect(ids(s)).toContain('all-lessons');
  });

  it('top-rig needs the priciest part in every workbench slot', () => {
    const s = newGame();
    for (const slot of CASE_SLOTS) {
      const best = PARTS.filter((p) => p.slot === slot).sort((a, b) => b.price - a.price)[0];
      s.installed[slot] = best.id;
    }
    expect(ids(s)).toContain('top-rig');
    s.installed.ram = 'ram_32_ddr5';
    expect(ids(s)).not.toContain('top-rig');
  });

  it('broke is exactly zero money', () => {
    const s = newGame();
    s.money = 1;
    expect(ids(s)).not.toContain('broke');
    s.money = 0;
    expect(ids(s)).toContain('broke');
  });

  it('unplugged is a configured network on a PC that no longer boots', () => {
    const s = onlineRig();
    expect(ids(s)).not.toContain('unplugged');
    delete s.installed.cpu;
    expect(ids(s)).toContain('unplugged');
  });

  it('swarm, noc and first-city read the save', () => {
    const s = newGame();
    s.swarm = { museum: 'router' };
    s.noc = [{ id: 'n1', partId: 'sw_8_fast' }];
    s.cities = [{ level: 1, seed: 1, breached: [], opened: [], finished: true }];
    expect(ids(s)).toEqual(expect.arrayContaining(['swarm', 'noc', 'first-city']));
  });

  it('first-breach ignores the home node', () => {
    const s = newGame();
    s.breached = ['home'];
    expect(ids(s)).not.toContain('first-breach');
    s.breached.push('isp');
    expect(ids(s)).toContain('first-breach');
  });

  it('counters unlock at their target', () => {
    const s = newGame();
    expect(ids(s, { ...ZERO, answered: 99 })).not.toContain('rounds-100');
    expect(ids(s, { ...ZERO, answered: 100 })).toContain('rounds-100');
    expect(ids(s, { ...ZERO, answered: 100 })).not.toContain('rounds-500');
    expect(ids(s, { ...ZERO, correct: 250, runs: 50, cities: 10 })).toEqual(
      expect.arrayContaining(['correct-250', 'runs-50', 'cities-10']),
    );
  });

  describe('run summaries', () => {
    const s = newGame();
    it('flawless is a success with no mistakes', () => {
      expect(ids(s, ZERO, run({ mistakes: 0 }))).toContain('flawless');
      expect(ids(s, ZERO, run({ mistakes: 0, success: false }))).not.toContain('flawless');
    });
    it('on-the-edge is a success using every allowed mistake', () => {
      expect(ids(s, ZERO, run({ mistakes: 2, allowed: 2 }))).toContain('on-the-edge');
      expect(ids(s, ZERO, run({ mistakes: 0, allowed: 0 }))).not.toContain('on-the-edge');
    });
    it('last-gasp is a crash on the final round', () => {
      expect(ids(s, ZERO, run({ success: false, crashedOnLast: true }))).toContain('last-gasp');
      expect(ids(s, ZERO, run({ success: false }))).not.toContain('last-gasp');
    });
    it('timeout-crash is a failure where every mistake timed out', () => {
      expect(ids(s, ZERO, run({ success: false, mistakes: 3, timeouts: 3 }))).toContain('timeout-crash');
      expect(ids(s, ZERO, run({ success: false, mistakes: 3, timeouts: 2 }))).not.toContain('timeout-crash');
    });
    it('core-flawless is a first Core breach with no mistakes, core-again a repeat', () => {
      expect(ids(s, ZERO, run({ nodeId: FINAL_NODE_ID, firstBreach: true, mistakes: 0 }))).toContain('core-flawless');
      expect(ids(s, ZERO, run({ nodeId: FINAL_NODE_ID, firstBreach: true, mistakes: 1 }))).not.toContain('core-flawless');
      expect(ids(s, ZERO, run({ nodeId: FINAL_NODE_ID, firstBreach: false }))).toContain('core-again');
      expect(ids(s, ZERO, run({ nodeId: FINAL_NODE_ID, firstBreach: false, success: false }))).not.toContain('core-again');
    });
  });
});
