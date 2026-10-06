import { describe, expect, it } from 'vitest';
import type { ConceptId } from '../src/core/minigames';
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
    expect(loaded.areaLevels).toEqual({ binary: 1, subnet: 1, ports: 1, http: 1, dns: 1 });
    expect(loaded.runCount).toBe(0);
  });
});
