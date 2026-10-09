import { describe, expect, it } from 'vitest';
import type { ConceptId } from '../src/core/minigames';
import { completeJob, jobBoard, jobPay, type Job } from '../src/core/jobs';
import { commitRun, favoredLens, recordMiss } from '../src/core/reteach';
import { newGame, type GameState } from '../src/core/state';

const SUBNET: ConceptId = 'subnet.broadcast';

/** A finished mini-game: the concepts answered correctly and the ones missed. */
function run(s: GameState, correct: ConceptId[], missed: ConceptId[] = []) {
  commitRun(s, correct, missed);
}

describe('lens choice on a miss', () => {
  it('starts with step by step when the student has no credits (AE2)', () => {
    const s = newGame();
    expect(recordMiss(s, SUBNET, 2)).toBe('steps');
  });

  it('shows the favored lens first, then the unseen ones, then starts over (AE1)', () => {
    const s = newGame();
    s.lensCredits.analogy = 2;
    expect([1, 2, 3, 4].map(() => recordMiss(s, SUBNET, 2))).toEqual(['analogy', 'steps', 'realWorld', 'analogy']);
  });

  it('breaks ties in credits by the default order', () => {
    const s = newGame();
    s.lensCredits = { steps: 0, analogy: 1, realWorld: 1 };
    expect(favoredLens(s)).toBe('analogy');
  });

  it('rotates each concept on its own', () => {
    const s = newGame();
    expect(recordMiss(s, SUBNET, 2)).toBe('steps');
    expect(recordMiss(s, 'binary.toDecimal', 1)).toBe('steps');
    expect(recordMiss(s, SUBNET, 2)).toBe('analogy');
  });
});

describe('recovery', () => {
  it('marks a missed concept weak at the level it was missed', () => {
    const s = newGame();
    recordMiss(s, SUBNET, 3);
    expect(s.concepts[SUBNET]).toMatchObject({ weak: true, missLevel: 3, recoveries: 0 });
  });

  it('counts two correct answers in one mini-game once (AE3)', () => {
    const s = newGame();
    recordMiss(s, SUBNET, 2);
    run(s, [SUBNET, SUBNET]);
    expect(s.concepts[SUBNET]).toMatchObject({ weak: true, recoveries: 1 });
  });

  it('resets the count on a new miss (AE4)', () => {
    const s = newGame();
    recordMiss(s, SUBNET, 2);
    run(s, [SUBNET]);
    recordMiss(s, SUBNET, 2);
    expect(s.concepts[SUBNET]!.recoveries).toBe(0);
  });

  it('gives no recovery for a correct answer in the same mini-game as a miss', () => {
    const s = newGame();
    recordMiss(s, SUBNET, 2);
    run(s, [SUBNET], [SUBNET]);
    expect(s.concepts[SUBNET]!.recoveries).toBe(0);
  });

  it('clears the concept after two later mini-games and credits the lens of the last miss', () => {
    const s = newGame();
    recordMiss(s, SUBNET, 2);
    recordMiss(s, SUBNET, 2);
    run(s, [SUBNET]);
    run(s, [SUBNET]);
    expect(s.concepts[SUBNET]!.weak).toBe(false);
    expect(s.lensCredits).toEqual({ steps: 0, analogy: 1, realWorld: 0 });
  });

  it('keeps when a concept first became weak but updates its miss level', () => {
    const s = newGame();
    run(s, []);
    recordMiss(s, SUBNET, 2);
    run(s, []);
    recordMiss(s, SUBNET, 3);
    expect(s.concepts[SUBNET]).toMatchObject({ weakSince: 1, missLevel: 3 });
  });

  it('ignores correct answers on concepts that are not weak', () => {
    const s = newGame();
    run(s, ['dns.resolve']);
    expect(s.concepts['dns.resolve']).toBeUndefined();
  });
});

describe('old saves', () => {
  it('a version-1 save without reteach fields loads with empty history and level 1 everywhere (R16)', () => {
    const old = newGame() as Partial<GameState>;
    delete old.concepts;
    delete old.lensCredits;
    delete old.areaLevels;
    delete old.runCount;
    const loaded = { ...newGame(), ...JSON.parse(JSON.stringify(old)) } as GameState;
    expect(loaded.concepts).toEqual({});
    expect(loaded.lensCredits).toEqual({ steps: 0, analogy: 0, realWorld: 0 });
    expect(loaded.areaLevels).toEqual({ binary: 1, subnet: 1, ports: 1, http: 1, dns: 1, nat: 1, vlan: 1, ipv6: 1 });
    expect(loaded.runCount).toBe(0);
  });
});

const ALL_AREA_LESSONS = ['binary', 'ip-addressing', 'ports', 'http', 'dns'];

function withLessons(...ids: string[]): GameState {
  const s = newGame();
  s.lessonsCompleted.push('computer-basics', ...ids);
  return s;
}

/** Makes concepts weak one finished mini-game apart, so they wait in this order. */
function missInOrder(s: GameState, concepts: ConceptId[], level = 1) {
  for (const c of concepts) {
    recordMiss(s, c, level);
    run(s, []);
  }
}

describe('side-job board', () => {
  it('is empty until an area lesson is done (AE5)', () => {
    expect(jobBoard(withLessons())).toEqual([]);
  });

  it('offers one fresh job at level 1 with only the binary lesson', () => {
    expect(jobBoard(withLessons('binary'))).toEqual([{ kind: 'fresh', area: 'binary', level: 1 }]);
  });

  it('shows the two concepts that became weak first, plus one fresh job', () => {
    const s = withLessons(...ALL_AREA_LESSONS);
    missInOrder(s, ['dns.resolve', 'binary.toDecimal', 'http.method', 'subnet.broadcast']);
    const board = jobBoard(s);
    expect(board.map((j) => (j.kind === 'review' ? j.concept : j.kind))).toEqual(['dns.resolve', 'binary.toDecimal', 'fresh']);
  });

  it('fills the board with fresh jobs in the three lowest-level areas', () => {
    const s = withLessons(...ALL_AREA_LESSONS);
    s.areaLevels = { ...s.areaLevels, binary: 3, subnet: 1, ports: 2, http: 1, dns: 1 };
    expect(jobBoard(s)).toEqual([
      { kind: 'fresh', area: 'subnet', level: 1 },
      { kind: 'fresh', area: 'http', level: 1 },
      { kind: 'fresh', area: 'dns', level: 1 },
    ]);
  });

  it('offers areas that can still level up before areas at their maximum', () => {
    const s = withLessons(...ALL_AREA_LESSONS);
    s.areaLevels = { ...s.areaLevels, binary: 4, subnet: 4, ports: 3, http: 3, dns: 3 };
    expect(jobBoard(s)).toEqual([
      { kind: 'fresh', area: 'binary', level: 4 },
      { kind: 'fresh', area: 'subnet', level: 4 },
      { kind: 'fresh', area: 'ports', level: 3 },
    ]);
  });

  it('never offers a weak concept from an area whose lesson is not done', () => {
    const s = withLessons('binary');
    missInOrder(s, ['dns.resolve']);
    expect(jobBoard(s).some((j) => j.kind === 'review' && j.concept === 'dns.resolve')).toBe(false);
  });

  it('runs a review job at the level where its concept was missed', () => {
    const s = withLessons('ip-addressing');
    s.areaLevels.subnet = 4;
    missInOrder(s, ['subnet.broadcast'], 2);
    expect(jobBoard(s)[0]).toEqual({ kind: 'review', area: 'subnet', level: 2, concept: 'subnet.broadcast' });
  });
});

describe('side-job levels and pay', () => {
  const fresh = (area: Job['area'], level: number): Job => ({ kind: 'fresh', area, level });

  it('raises the level only with at most 1 mistake (AE6)', () => {
    const s = withLessons('ip-addressing');
    s.areaLevels.subnet = 2;
    expect(completeJob(s, fresh('subnet', 2), 2, true).leveledUp).toBe(false);
    expect(s.areaLevels.subnet).toBe(2);
    expect(completeJob(s, fresh('subnet', 2), 1, true).leveledUp).toBe(true);
    expect(s.areaLevels.subnet).toBe(3);
  });

  it('does not raise the level from a review job below it (AE7)', () => {
    const s = withLessons('binary');
    s.areaLevels.binary = 4;
    completeJob(s, { kind: 'review', area: 'binary', level: 2, concept: 'binary.toDecimal' }, 0, true);
    expect(s.areaLevels.binary).toBe(4);
  });

  it('stops ports at level 3 (AE8)', () => {
    const s = withLessons('ports');
    s.areaLevels.ports = 3;
    expect(completeJob(s, fresh('ports', 3), 0, true).leveledUp).toBe(false);
    expect(s.areaLevels.ports).toBe(3);
  });

  it('pays nothing and raises nothing for a crashed job', () => {
    const s = withLessons('binary');
    const before = s.money;
    expect(completeJob(s, fresh('binary', 1), 0, false)).toEqual({ pay: 0, leveledUp: false });
    expect(s.money).toBe(before);
    expect(s.areaLevels.binary).toBe(1);
  });

  it('pays about 1.5x more per level, the same for review and fresh jobs', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(jobPay)).toEqual([25, 40, 55, 85, 125, 190, 285]);
    const s = withLessons('binary');
    const before = s.money;
    completeJob(s, { kind: 'review', area: 'binary', level: 3, concept: 'binary.toBinary' }, 0, true);
    expect(s.money - before).toBe(jobPay(3));
  });
});
