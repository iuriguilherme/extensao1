/**
 * Answer stats: every mini-game round answered, per area, across campaign
 * nodes, side jobs and cities (lesson quizzes do not count). Certificates read
 * accuracy from here; reteach.ts keeps the miss history apart.
 */

import type { MinigameId } from '../data/nodes';
import { CONCEPTS, type ConceptId } from './minigames';
import type { GameState } from './state';

export interface AreaStats {
  answered: number;
  correct: number;
}

/** Counts one resolved round. A timeout is a wrong answer. */
export function recordAnswer(state: GameState, concept: ConceptId, correct: boolean): void {
  const stats = state.stats[CONCEPTS[concept].area] ??= { answered: 0, correct: 0 };
  stats.answered++;
  if (!correct) return;
  stats.correct++;
  if (!state.correctConcepts.includes(concept)) state.correctConcepts.push(concept);
}

/** The area's counts, or null when no round of it was answered yet. */
export function areaStats(state: GameState, area: MinigameId): AreaStats | null {
  const stats = state.stats[area];
  return stats && stats.answered > 0 ? { ...stats } : null;
}
