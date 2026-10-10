import { knownDisclosure } from './disclosure';
import { newGame, type GameState } from './state';

/**
 * Single shared game state for all scenes, persisted to localStorage so
 * progress survives page reloads.
 */

const SAVE_KEY = 'rootkit-academy-save-v1';

let current: GameState = load();

function load(): GameState {
  try {
    const raw = globalThis.localStorage?.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GameState;
      if (parsed.version === 1) return restore(parsed);
    }
  } catch {
    // Corrupt or unavailable storage: start fresh.
  }
  return newGame();
}

/** Merges a version 1 save over a new game, filling in fields added since it was made. */
export function restore(parsed: GameState): GameState {
  const fresh = newGame();
  // Areas added later start at level 1 in saves made before them.
  const state = { ...fresh, ...parsed, areaLevels: { ...fresh.areaLevels, ...parsed.areaLevels } };
  // A save from before introductions existed already knows what it reached.
  if (!parsed.disclosure) state.disclosure = knownDisclosure(state);
  return state;
}

export function game(): GameState {
  return current;
}

export function save(): void {
  try {
    globalThis.localStorage?.setItem(SAVE_KEY, JSON.stringify(current));
  } catch {
    // Storage unavailable (private mode, quota): progress stays in memory.
  }
}

export function hasSave(): boolean {
  try {
    return !!globalThis.localStorage?.getItem(SAVE_KEY);
  } catch {
    return false;
  }
}

export function resetGame(): void {
  current = newGame();
  save();
}
