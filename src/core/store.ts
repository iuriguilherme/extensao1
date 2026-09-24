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
      if (parsed.version === 1) return { ...newGame(), ...parsed };
    }
  } catch {
    // Corrupt or unavailable storage: start fresh.
  }
  return newGame();
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
