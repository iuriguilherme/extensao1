import { ACHIEVEMENTS, FRESH_START_ID } from '../data/achievements';
import { COUNTER_METRICS, metricValue, satisfied, type CounterTotals, type RunSummary } from './achievements';
import type { GameState } from './state';

/**
 * Conquistas live apart from the game save, under their own key, so a game
 * reset can keep them. Stores only ids, counter totals and the pop-up switch.
 * store.ts runs a check after every game save; the pop-up scene listens.
 */

const ACHIEVEMENTS_KEY = 'rootkit-academy-conquistas-v1';

export interface AchievementState {
  version: 1;
  unlocked: string[];
  /** Lifetime counters; they keep growing across game resets. */
  totals: CounterTotals;
  /** Each metric's value in the game save at the last check. */
  last: CounterTotals;
  /** Whether unlocks show the corner pop-up. */
  popups: boolean;
}

const zero = (): CounterTotals => ({ answered: 0, correct: 0, runs: 0, cities: 0 });

export function emptyAchievements(): AchievementState {
  return { version: 1, unlocked: [], totals: zero(), last: zero(), popups: true };
}

const KNOWN = new Set(ACHIEVEMENTS.map((a) => a.id));

/** A stored achievement save, or null when it is missing or unreadable. */
export function parseAchievements(raw: string | null): AchievementState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AchievementState>;
    if (parsed.version !== 1 || !Array.isArray(parsed.unlocked)) return null;
    return {
      version: 1,
      unlocked: parsed.unlocked.filter((id) => KNOWN.has(id)),
      totals: { ...zero(), ...parsed.totals },
      last: { ...zero(), ...parsed.last },
      popups: parsed.popups !== false,
    };
  } catch {
    return null;
  }
}

export function serializeAchievements(state: AchievementState): string {
  return JSON.stringify(state);
}

export interface CheckResult {
  next: AchievementState;
  /** Ids unlocked by this check, in list order. */
  unlocked: string[];
}

/**
 * Updates the lifetime counters from the game save and unlocks every rule that
 * now holds. `seed` (first load) takes the save's numbers as the totals.
 */
export function checkAchievements(
  state: AchievementState, game: GameState, opts: { seed?: boolean; run?: RunSummary },
): CheckResult {
  const totals = { ...state.totals };
  const last = { ...state.last };
  for (const metric of COUNTER_METRICS) {
    const now = metricValue(game, metric);
    if (opts.seed) totals[metric] = now;
    else if (now > last[metric]) totals[metric] += now - last[metric];
    last[metric] = now;
  }
  const unlocked = satisfied(game, totals, opts.run, new Set(state.unlocked));
  const same = unlocked.length === 0
    && COUNTER_METRICS.every((m) => totals[m] === state.totals[m] && last[m] === state.last[m]);
  // Returning the same object tells the store there is nothing to write.
  if (same) return { next: state, unlocked };
  return { next: { ...state, totals, last, unlocked: [...state.unlocked, ...unlocked] }, unlocked };
}

/** After a game reset: erase everything but the pop-up switch, or keep it all and unlock fresh-start. */
export function resetAchievementState(state: AchievementState, erase: boolean): CheckResult {
  if (erase) return { next: { ...emptyAchievements(), popups: state.popups }, unlocked: [] };
  if (state.unlocked.includes(FRESH_START_ID)) return { next: state, unlocked: [] };
  return { next: { ...state, unlocked: [...state.unlocked, FRESH_START_ID] }, unlocked: [FRESH_START_ID] };
}

// ─── Persistent store ─────────────────────────────────────────────────────

let current: AchievementState = emptyAchievements();
const listeners: ((ids: string[]) => void)[] = [];

function read(): string | null {
  try {
    return globalThis.localStorage?.getItem(ACHIEVEMENTS_KEY) ?? null;
  } catch {
    return null;
  }
}

function write(): void {
  try {
    globalThis.localStorage?.setItem(ACHIEVEMENTS_KEY, serializeAchievements(current));
  } catch {
    // Storage unavailable: conquistas stay in memory.
  }
}

function apply(result: CheckResult, silent: boolean): void {
  if (result.next === current) return;
  current = result.next;
  write();
  if (!silent && result.unlocked.length > 0) for (const listener of listeners) listener(result.unlocked);
}

/** Loads the stored conquistas, then checks the loaded game without notifying. */
export function bootAchievements(game: GameState): void {
  const stored = parseAchievements(read());
  current = stored ?? emptyAchievements();
  // Nothing usable stored: take the save's numbers as the lifetime totals.
  apply(checkAchievements(current, game, { seed: stored === null }), true);
}

export function achievements(): AchievementState {
  return current;
}

/** Called with each batch of newly unlocked ids, whatever the pop-up switch says. */
export function onUnlock(listener: (ids: string[]) => void): void {
  listeners.push(listener);
}

export function syncAchievements(game: GameState, opts: { silent?: boolean } = {}): void {
  apply(checkAchievements(current, game, {}), opts.silent === true);
}

/** Reports a finished mini-game; call before the game save that follows it. */
export function recordRun(game: GameState, run: RunSummary): void {
  apply(checkAchievements(current, game, { run }), false);
}

export function resetAchievements(erase: boolean): void {
  apply(resetAchievementState(current, erase), false);
}

export function setPopups(on: boolean): void {
  current = { ...current, popups: on };
  write();
}
