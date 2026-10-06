/**
 * The side-job board: which jobs a student is offered, what each pays, and
 * when an area's side-job level goes up. The board is computed from the save
 * on every visit and never stored.
 */

import { AREA_LESSON, MINIGAME_AREAS, type MinigameId } from '../data/nodes';
import { CONCEPTS, MAX_LEVEL, type ConceptId } from './minigames';
import { earn, hasLesson, type GameState } from './state';

/** review: practice a weak concept; fresh: a job at the area's current level. */
export type Job =
  | { kind: 'review'; area: MinigameId; level: number; concept: ConceptId }
  | { kind: 'fresh'; area: MinigameId; level: number };

const BOARD_SIZE = 3;
const MAX_REVIEW_JOBS = 2;
/** A fresh job at the current level with at most this many mistakes raises the level. */
const LEVEL_UP_MISTAKES = 1;

const AREAS = Object.keys(MINIGAME_AREAS) as MinigameId[];

/** $25 at level 1, about 1.5x per level, rounded to the nearest 5. */
export function jobPay(level: number): number {
  return Math.round((25 * 1.5 ** (level - 1)) / 5) * 5;
}

function unlockedAreas(state: GameState): MinigameId[] {
  return AREAS.filter((area) => hasLesson(state, AREA_LESSON[area]));
}

/**
 * Up to two review jobs, for the weak concepts that have waited longest, then
 * fresh jobs (at least one, one per area) in the lowest-level areas.
 */
export function jobBoard(state: GameState): Job[] {
  const areas = unlockedAreas(state);
  const reviews: Job[] = (Object.entries(state.concepts) as [ConceptId, NonNullable<GameState['concepts'][ConceptId]>][])
    .filter(([concept, record]) => record.weak && areas.includes(CONCEPTS[concept].area))
    .sort(([, a], [, b]) => a.weakSince - b.weakSince)
    .slice(0, MAX_REVIEW_JOBS)
    .map(([concept, record]) => ({ kind: 'review', area: CONCEPTS[concept].area, level: record.missLevel, concept }));

  const freshCount = Math.max(1, BOARD_SIZE - reviews.length);
  const fresh: Job[] = [...areas]
    .sort((a, b) => state.areaLevels[a] - state.areaLevels[b])
    .slice(0, freshCount)
    .map((area) => ({ kind: 'fresh', area, level: state.areaLevels[area] }));

  return [...reviews, ...fresh];
}

/** Pays a finished job and raises the area level when a fresh job went well. */
export function completeJob(state: GameState, job: Job, mistakes: number, success: boolean): { pay: number; leveledUp: boolean } {
  if (!success) return { pay: 0, leveledUp: false };
  const pay = jobPay(job.level);
  earn(state, pay);
  const leveledUp = job.kind === 'fresh'
    && job.level === state.areaLevels[job.area]
    && mistakes <= LEVEL_UP_MISTAKES
    && job.level < MAX_LEVEL[job.area];
  if (leveledUp) state.areaLevels[job.area]++;
  return { pay, leveledUp };
}
