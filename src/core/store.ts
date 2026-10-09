import { bootAchievements, syncAchievements } from './achievementStore';
import { newGame, type GameState } from './state';

/**
 * Single shared game state for all scenes, persisted to localStorage so
 * progress survives page reloads.
 */

const SAVE_KEY = 'rootkit-academy-save-v1';

let current: GameState = load();
bootAchievements(current);

function load(): GameState {
  try {
    const raw = globalThis.localStorage?.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GameState;
      if (parsed.version === 1) {
        const fresh = newGame();
        // Areas added later start at level 1 in saves made before them.
        return { ...fresh, ...parsed, areaLevels: { ...fresh.areaLevels, ...parsed.areaLevels } };
      }
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
  // Every state change ends in a save, so this is where conquistas are checked.
  syncAchievements(current);
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
