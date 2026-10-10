import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RunSummary } from '../src/core/achievements';
import {
  achievements, bootAchievements, checkAchievements, emptyAchievements, onUnlock, parseAchievements, recordRun, resetAchievementState, serializeAchievements,
  syncAchievements, type AchievementState,
} from '../src/core/achievementStore';
import { issueCertificate, presentCertificate } from '../src/core/certificates';
import { newGame, type GameState } from '../src/core/state';
import { recordAnswer } from '../src/core/stats';

/** A save past the formatura with three finished cities and 120 answered rounds. */
function veteran(): GameState {
  const s = newGame();
  issueCertificate(s, 'conclusao');
  presentCertificate(s, 'conclusao', 'Ana');
  s.cities = [1, 2, 3].map((seed) => ({ level: seed, seed, breached: [], opened: [], finished: true }));
  for (let i = 0; i < 120; i++) recordAnswer(s, 'subnet.networkAddress', i % 2 === 0);
  return s;
}

const ach = (over: Partial<AchievementState> = {}): AchievementState => ({ ...emptyAchievements(), ...over });

describe('achievement store', () => {
  it('a first load unlocks what the save proves and seeds the counters', () => {
    const { next, unlocked } = checkAchievements(emptyAchievements(), veteran(), { seed: true });
    expect(unlocked).toEqual(expect.arrayContaining(['formatura', 'first-city']));
    expect(next.totals).toMatchObject({ answered: 120, correct: 60, cities: 3 });
    expect(next.last).toEqual(next.totals);
  });

  it('counters add each rise, and a drop from a reset only moves the last value', () => {
    const s = newGame();
    s.runCount = 25;
    let state = ach({ totals: { answered: 0, correct: 0, runs: 40, cities: 0 }, last: { answered: 0, correct: 0, runs: 10, cities: 0 } });
    state = checkAchievements(state, s, {}).next;
    expect(state.totals.runs).toBe(55);
    s.runCount = 0;
    state = checkAchievements(state, s, {}).next;
    expect(state.totals.runs).toBe(55);
    expect(state.last.runs).toBe(0);
    s.runCount = 5;
    expect(checkAchievements(state, s, {}).next.totals.runs).toBe(60);
  });

  it('never returns an already unlocked id again', () => {
    const s = veteran();
    const first = checkAchievements(emptyAchievements(), s, {});
    expect(checkAchievements(first.next, s, {}).unlocked).toEqual([]);
  });

  it('a run summary unlocks run achievements', () => {
    const run: RunSummary = { area: 'binary', success: true, mistakes: 0, allowed: 2, timeouts: 0, crashedOnLast: false, firstBreach: false };
    expect(checkAchievements(emptyAchievements(), newGame(), { run }).unlocked).toEqual(['flawless']);
  });

  it('keeping achievements on reset unlocks fresh-start and keeps everything else', () => {
    const kept = ach({ unlocked: ['formatura'], totals: { answered: 9, correct: 4, runs: 2, cities: 1 } });
    const { next, unlocked } = resetAchievementState(kept, false);
    expect(unlocked).toEqual(['fresh-start']);
    expect(next.unlocked).toEqual(['formatura', 'fresh-start']);
    expect(next.totals).toEqual(kept.totals);
  });

  it('erasing on reset clears unlocks and counters but keeps the pop-up switch', () => {
    const kept = ach({ unlocked: ['formatura'], totals: { answered: 9, correct: 4, runs: 2, cities: 1 }, popups: false });
    const { next, unlocked } = resetAchievementState(kept, true);
    expect(unlocked).toEqual([]);
    expect(next).toEqual({ ...emptyAchievements(), popups: false });
  });

  it('parses only a valid version-1 save and drops unknown ids', () => {
    expect(parseAchievements(null)).toBeNull();
    expect(parseAchievements('{oops')).toBeNull();
    expect(parseAchievements(JSON.stringify({ ...emptyAchievements(), version: 2 }))).toBeNull();
    const round = parseAchievements(serializeAchievements(ach({ unlocked: ['formatura', 'gone'], popups: false })));
    expect(round).toEqual(ach({ unlocked: ['formatura'], popups: false }));
  });

  it('notifies listeners once per check with the new ids in order, but not on silent checks', () => {
    const batches: string[][] = [];
    onUnlock((ids) => batches.push(ids));
    syncAchievements(veteran(), { silent: true });
    expect(batches).toEqual([]);
    const s = veteran();
    s.money = 0;
    recordRun(s, { area: 'binary', success: false, mistakes: 3, allowed: 2, timeouts: 3, crashedOnLast: true, firstBreach: false });
    expect(batches).toEqual([['last-gasp', 'timeout-crash', 'broke']]);
  });
});

describe('achievement boot', () => {
  function stubStorage(initial: Record<string, string> = {}) {
    const data = new Map(Object.entries(initial));
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => { data.set(k, v); },
    });
    return data;
  }

  afterEach(() => vi.unstubAllGlobals());

  it('seeds lifetime totals from the game save when nothing is stored, without notifying', () => {
    stubStorage();
    const batches: string[][] = [];
    onUnlock((ids) => batches.push(ids));
    bootAchievements(veteran());
    expect(achievements().totals).toMatchObject({ answered: 120, cities: 3 });
    expect(achievements().unlocked).toContain('formatura');
    expect(batches).toEqual([]);
  });

  it('keeps stored totals instead of reseeding them', () => {
    const stored = ach({ totals: { answered: 500, correct: 300, runs: 40, cities: 7 }, last: { answered: 120, correct: 60, runs: 0, cities: 3 } });
    stubStorage({ 'rootkit-academy-conquistas-v1': serializeAchievements(stored) });
    bootAchievements(veteran());
    expect(achievements().totals).toMatchObject({ answered: 500, cities: 7 });
  });

  it('treats unreadable storage like an empty store', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } });
    bootAchievements(veteran());
    expect(achievements().totals.answered).toBe(120);
  });
});
