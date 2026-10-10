import type { GameState, LogEntry } from './state';

/** Lines kept in the save; the desk shows only the newest few. */
export const LOG_CAP = 30;

/**
 * Adds an entry to the desk's message log, dropping the oldest past the cap.
 * Entries hold ids, not text (disclosure.ts renders them), and this module
 * stays free of other game modules so state rules can log without a cycle.
 */
export function appendLog(state: GameState, entry: LogEntry): void {
  state.disclosure.log.push(entry);
  if (state.disclosure.log.length > LOG_CAP) state.disclosure.log.splice(0, state.disclosure.log.length - LOG_CAP);
}
