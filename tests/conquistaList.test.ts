import { describe, expect, it } from 'vitest';
import { emptyAchievements, type AchievementState } from '../src/core/achievementStore';
import { REACHABLE, listedConquistas } from '../src/core/conquistaList';
import { issueCertificate, presentCertificate } from '../src/core/certificates';
import { knownDisclosure } from '../src/core/disclosure';
import { completeLesson, newGame, type GameState } from '../src/core/state';
import { ACHIEVEMENTS } from '../src/data/achievements';
import { FINAL_NODE_ID, getNode } from '../src/data/nodes';
import { PARTS } from '../src/data/parts';
import { TIERS } from '../src/data/tiers';

const NET = { ip: '192.168.0.42', mask: '255.255.255.0', gateway: '192.168.0.1', dns: '192.168.0.1' };

/** Treats everything the save can reach as introduced, the way an old save loads. */
function settle(state: GameState): GameState {
  state.disclosure = knownDisclosure(state);
  return state;
}

function conquistas(unlocked: string[] = [], answered = 0): AchievementState {
  const a = emptyAchievements();
  a.unlocked = unlocked;
  a.totals.answered = answered;
  return a;
}

const listed = (state: GameState, a = conquistas()) => listedConquistas(state, a).map((c) => c.id);

/** Online with the ethics lesson, so the Net Map and intrusions are open. */
function online(): GameState {
  const s = newGame();
  for (const id of ['computer-basics', 'power', 'cpu', 'memory', 'storage', 'binary', 'network-basics', 'ip-addressing', 'dns', 'ethics']) {
    completeLesson(s, id);
  }
  s.installed = { motherboard: 'mb_b1', cpu: 'cpu_s1_2c', ram: 'ram_4_ddr4', storage: 'hdd_500', psu: 'psu_250', nic: 'nic_100', router: 'router_home' };
  s.netConfig = { ...NET };
  return settle(s);
}

describe('conquista listing', () => {
  it('lists only Primeira aula and Primeiro boot early on (AE1)', () => {
    const s = newGame();
    completeLesson(s, 'computer-basics');
    s.inventory.push('mb_b1');
    settle(s);
    expect(listed(s, conquistas(['first-lesson']))).toEqual(['first-boot', 'first-lesson']);
  });

  it('shows only the next tier of the answer counters (AE2)', () => {
    const ids = listed(online(), conquistas(['rounds-100'], 120));
    expect(ids).toContain('rounds-100');
    expect(ids).toContain('rounds-500');
    expect(ids).not.toContain('rounds-1000');
  });

  it('lists Invasão perfeita while the Core is reachable and hides it once the Core was breached (AE3)', () => {
    const s = online();
    // Breaching one neighbor of the Core makes the Core reachable.
    s.breached.push(getNode(FINAL_NODE_ID).links[0]);
    settle(s);
    expect(listed(s)).toContain('core-flawless');
    s.breached.push(FINAL_NODE_ID);
    expect(listed(s)).not.toContain('core-flawless');
  });

  it('never lists a locked secret, and lists it once unlocked (AE4)', () => {
    const s = online();
    expect(listed(s)).not.toContain('last-gasp');
    expect(listed(s, conquistas(['last-gasp']))).toContain('last-gasp');
  });

  it('lists a degree only once its tier opens, and the all-lessons and all-areas goals only with the Doutorado', () => {
    const s = online();
    s.lessonsCompleted.push('routing');
    s.breached.push(FINAL_NODE_ID);
    expect(listed(s)).not.toContain('especializacao');
    issueCertificate(s, 'conclusao');
    presentCertificate(s, 'conclusao', 'Ana');
    settle(s);
    expect(listed(s)).toContain('especializacao');
    expect(listed(s)).not.toContain('mestrado');
    expect(listed(s)).not.toContain('all-lessons');
    for (const tier of TIERS.slice(0, 2)) {
      issueCertificate(s, tier.id);
      presentCertificate(s, tier.id);
    }
    settle(s);
    expect(listed(s)).toContain('doutorado');
    expect(listed(s)).toContain('all-lessons');
  });

  it('lists Máquina dos sonhos only once the Shop sells the top part of every slot', () => {
    const s = newGame();
    completeLesson(s, 'computer-basics');
    expect(listed(settle(s))).not.toContain('top-rig');
    for (const p of PARTS) if (!s.lessonsCompleted.includes(p.requiresLesson)) s.lessonsCompleted.push(p.requiresLesson);
    expect(listed(settle(s))).toContain('top-rig');
  });

  it('keeps every conquista in catalogue order and has a reachability rule for each', () => {
    expect(Object.keys(REACHABLE).sort()).toEqual(ACHIEVEMENTS.map((a) => a.id).sort());
    const ids = listed(online(), conquistas(['rounds-100', 'first-lesson']));
    const order = ACHIEVEMENTS.map((a) => a.id).filter((id) => ids.includes(id));
    expect(ids).toEqual(order);
  });
});
