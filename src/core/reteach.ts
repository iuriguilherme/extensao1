/**
 * Reteaching: which concepts a student keeps missing, which explanation lens
 * to show on a miss, and when a missed concept counts as learned again.
 *
 * A miss is recorded as it happens. Correct answers count once per finished
 * mini-game (commitRun), so recovery needs separate games, not one lucky run.
 */

import { LENSES, type Lens } from './explanations';
import type { ConceptId } from './minigames';
import type { GameState } from './state';

/** Correct answers in this many later mini-games make a weak concept learned again. */
const RECOVERY_RUNS = 2;

/** The lens with the most credits; ties follow the default order. */
export function favoredLens(state: GameState): Lens {
  return LENSES.reduce((best, lens) => (state.lensCredits[lens] > state.lensCredits[best] ? lens : best));
}

/**
 * Records a miss (wrong answer or timeout) and returns the lens to explain it
 * with: one not yet seen in this concept's rotation, the favored lens first.
 */
export function recordMiss(state: GameState, concept: ConceptId, level: number): Lens {
  const record = state.concepts[concept] ??= {
    weak: false, recoveries: 0, missLevel: level, weakSince: 0, lastMissLens: 'steps', seen: [],
  };
  if (record.seen.length === LENSES.length) record.seen = [];
  const eligible = LENSES.filter((l) => !record.seen.includes(l));
  const favored = favoredLens(state);
  const lens = eligible.includes(favored) ? favored : eligible[0];

  record.seen.push(lens);
  record.lastMissLens = lens;
  record.missLevel = level;
  record.recoveries = 0;
  if (!record.weak) {
    record.weak = true;
    record.weakSince = state.runCount;
  }
  return lens;
}

/**
 * Closes a finished mini-game (success or crash). Each weak concept answered
 * correctly, and not also missed in this game, moves one step toward learned.
 */
export function commitRun(state: GameState, correct: Iterable<ConceptId>, missed: Iterable<ConceptId>): void {
  const missedHere = new Set(missed);
  for (const concept of new Set(correct)) {
    const record = state.concepts[concept];
    if (!record?.weak || missedHere.has(concept)) continue;
    record.recoveries++;
    if (record.recoveries >= RECOVERY_RUNS) {
      record.weak = false;
      record.recoveries = 0;
      state.lensCredits[record.lastMissLens]++;
    }
  }
  state.runCount++;
}
