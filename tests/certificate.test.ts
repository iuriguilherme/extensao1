import { describe, expect, it } from 'vitest';
import {
  certificateRows, getCertificate, isCityTypeUnlocked, isTierOpen, issueCertificate, nextGoal, pendingCertificate,
  presentCertificate,
} from '../src/core/certificates';
import { breach, completeLesson, newGame, type GameState } from '../src/core/state';
import { recordAnswer } from '../src/core/stats';
import { FINAL_NODE_ID } from '../src/data/nodes';
import { getTier, TIERS } from '../src/data/tiers';

function answer(s: GameState, right: number, wrong: number) {
  for (let i = 0; i < right; i++) recordAnswer(s, 'subnet.networkAddress', true);
  for (let i = 0; i < wrong; i++) recordAnswer(s, 'subnet.networkAddress', false);
}

/** A save that just went through the formatura. */
function graduated(): GameState {
  const s = newGame();
  issueCertificate(s, 'conclusao');
  presentCertificate(s, 'conclusao', 'Ana Luíza');
  return s;
}

function passLessons(s: GameState, tier: 'especializacao' | 'mestrado' | 'doutorado') {
  for (const id of getTier(tier).lessons) s.lessonsCompleted.push(id);
}

/** Issues and presents a tier certificate, as a typed city core breach and its ceremony would. */
function earn(s: GameState, tier: 'especializacao' | 'mestrado' | 'doutorado') {
  issueCertificate(s, tier);
  presentCertificate(s, tier);
}

describe('certificates', () => {
  it('the first Core breach issues the conclusão certificate, unpresented', () => {
    const s = newGame();
    breach(s, FINAL_NODE_ID);
    expect(getCertificate(s, 'conclusao')).toMatchObject({ presented: false, name: null });
    expect(pendingCertificate(s)?.id).toBe('conclusao');
  });

  it('re-breaching the Core after the certificate exists issues nothing new', () => {
    const s = newGame();
    breach(s, FINAL_NODE_ID);
    presentCertificate(s, 'conclusao', 'Ana');
    breach(s, FINAL_NODE_ID);
    expect(s.certificates).toHaveLength(1);
    expect(pendingCertificate(s)).toBeNull();
    expect(issueCertificate(s, 'conclusao')).toBe(false);
  });

  it('presenting stores the name on the save and copies it into later certificates', () => {
    const s = graduated();
    expect(s.studentName).toBe('Ana Luíza');
    expect(getCertificate(s, 'conclusao')).toMatchObject({ presented: true, name: 'Ana Luíza' });
    passLessons(s, 'especializacao');
    earn(s, 'especializacao');
    expect(getCertificate(s, 'especializacao')?.name).toBe('Ana Luíza');
  });

  it('keeps the numbers it was earned with beside the current ones (AE1)', () => {
    const s = newGame();
    answer(s, 8, 2);
    issueCertificate(s, 'conclusao');
    answer(s, 10, 0);
    const [row] = certificateRows(s, getCertificate(s, 'conclusao')!);
    expect(row.area).toBe('subnet');
    expect(row.earned).toMatchObject({ answered: 10, correct: 8 });
    expect(row.current).toMatchObject({ answered: 20, correct: 18 });
  });

  it('leaves out areas with no answered rounds (AE6)', () => {
    const s = newGame();
    answer(s, 1, 0);
    issueCertificate(s, 'conclusao');
    expect(Object.keys(getCertificate(s, 'conclusao')!.snapshot.areas)).toEqual(['subnet']);
  });

  it('shows an area first played after issue with nothing on the earned side', () => {
    const s = newGame();
    answer(s, 1, 0);
    issueCertificate(s, 'conclusao');
    recordAnswer(s, 'dns.resolve', true);
    const rows = certificateRows(s, getCertificate(s, 'conclusao')!);
    expect(rows.map((r) => r.area)).toEqual(['subnet', 'dns']);
    expect(rows[1].earned).toBeNull();
    expect(rows[1].current).toMatchObject({ answered: 1, correct: 1 });
  });

  it('counts learned and weak concepts and copies the side-job level', () => {
    const s = newGame();
    recordAnswer(s, 'subnet.networkAddress', true);
    recordAnswer(s, 'subnet.broadcast', true);
    recordAnswer(s, 'subnet.sameNetwork', false);
    s.concepts['subnet.broadcast'] = { weak: true, recoveries: 0, missLevel: 1, weakSince: 0, lastMissLens: 'steps', seen: ['steps'] };
    s.concepts['subnet.sameNetwork'] = { weak: true, recoveries: 0, missLevel: 1, weakSince: 0, lastMissLens: 'steps', seen: ['steps'] };
    s.areaLevels.subnet = 3;
    issueCertificate(s, 'conclusao');
    expect(getCertificate(s, 'conclusao')!.snapshot.areas.subnet).toEqual({ answered: 3, correct: 2, learned: 1, weak: 2, level: 3 });
  });

  it('records the lessons completed at issue', () => {
    const s = newGame();
    completeLesson(s, 'computer-basics');
    issueCertificate(s, 'conclusao');
    completeLesson(s, 'power');
    expect(getCertificate(s, 'conclusao')!.snapshot.lessons).toEqual(['computer-basics']);
  });
});

describe('tier ladder', () => {
  it('lists the three tiers in order, one city type each', () => {
    expect(TIERS.map((t) => [t.id, t.cityType])).toEqual([['especializacao', 'nat'], ['mestrado', 'vlan'], ['doutorado', 'ipv6']]);
  });

  it('opens nothing before the formatura is presented', () => {
    const s = newGame();
    issueCertificate(s, 'conclusao');
    expect(isTierOpen(s, 'especializacao')).toBe(false);
  });

  it('opens Especialização with the conclusão certificate, and Mestrado not yet (AE2)', () => {
    const s = graduated();
    expect(isTierOpen(s, 'especializacao')).toBe(true);
    expect(isTierOpen(s, 'mestrado')).toBe(false);
    expect(isTierOpen(s, 'doutorado')).toBe(false);
  });

  it('unlocks a city type only when every lesson of its pack is complete', () => {
    const s = graduated();
    const [first, second] = getTier('especializacao').lessons;
    s.lessonsCompleted.push(first);
    expect(isCityTypeUnlocked(s, 'nat')).toBe(false);
    s.lessonsCompleted.push(second);
    expect(isCityTypeUnlocked(s, 'nat')).toBe(true);
    expect(isCityTypeUnlocked(s, 'vlan')).toBe(false);
  });

  it('never unlocks a type whose tier is closed, even with its lessons done', () => {
    const s = graduated();
    passLessons(s, 'mestrado');
    expect(isCityTypeUnlocked(s, 'vlan')).toBe(false);
  });

  it('issues a tier certificate only once', () => {
    const s = graduated();
    expect(issueCertificate(s, 'especializacao')).toBe(true);
    expect(issueCertificate(s, 'especializacao')).toBe(false);
  });

  it('points to one next goal at a time', () => {
    const s = newGame();
    expect(nextGoal(s)).toBeNull();
    issueCertificate(s, 'conclusao');
    expect(nextGoal(s)).toBeNull();
    presentCertificate(s, 'conclusao', 'Ana');
    expect(nextGoal(s)).toEqual({ kind: 'lectures', tier: getTier('especializacao') });
    passLessons(s, 'especializacao');
    expect(nextGoal(s)).toEqual({ kind: 'city', tier: getTier('especializacao') });
    issueCertificate(s, 'especializacao');
    expect(nextGoal(s)).toBeNull();
    presentCertificate(s, 'especializacao');
    expect(nextGoal(s)).toEqual({ kind: 'lectures', tier: getTier('mestrado') });
    passLessons(s, 'mestrado');
    earn(s, 'mestrado');
    passLessons(s, 'doutorado');
    expect(nextGoal(s)).toEqual({ kind: 'city', tier: getTier('doutorado') });
    earn(s, 'doutorado');
    expect(nextGoal(s)).toBeNull();
  });
});
