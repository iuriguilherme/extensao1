import type { GameState } from './state';

/** Lines kept in the save; the desk shows only the newest few. */
export const LOG_CAP = 30;

/**
 * Adds a line to the desk's message log, dropping the oldest past the cap.
 * Kept free of other game modules so state rules can log without a cycle.
 */
export function appendLog(state: GameState, line: string): void {
  state.disclosure.log.push(line);
  if (state.disclosure.log.length > LOG_CAP) state.disclosure.log.splice(0, state.disclosure.log.length - LOG_CAP);
}
