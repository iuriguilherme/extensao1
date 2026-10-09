import { ACHIEVEMENTS } from '../data/achievements';
import { LESSONS } from '../data/lessons';
import { FINAL_NODE_ID, HOME_NODE_ID, MINIGAME_AREAS, type MinigameId } from '../data/nodes';
import { CASE_SLOTS, PARTS } from '../data/parts';
import { getCertificate, type CertificateId } from './certificates';
import { computeSpecs } from './hardware';
import { MAX_LEVEL } from './minigames';
import { isOnline, type GameState } from './state';

/**
 * Unlock rules for the conquistas in src/data/achievements.ts, keyed by id.
 * Pure: the achievement store decides what is new, persists it and notifies.
 */

/** What one finished mini-game reports; nothing about a run is saved in GameState. */
export interface RunSummary {
  area: MinigameId;
  success: boolean;
  mistakes: number;
  allowed: number;
  /** Mistakes that were rounds left to time out. */
  timeouts: number;
  crashedOnLast: boolean;
  /** Campaign node id; absent for side jobs and city nodes. */
  nodeId?: string;
  /** Whether this run breached its campaign node for the first time. */
  firstBreach: boolean;
}

/** Lifetime counters kept by the achievement store across game resets. */
export type CounterMetric = 'answered' | 'correct' | 'runs' | 'cities';
export type CounterTotals = Record<CounterMetric, number>;

export const COUNTER_METRICS: CounterMetric[] = ['answered', 'correct', 'runs', 'cities'];

type Rule =
  | { kind: 'state'; test: (state: GameState) => boolean }
  | { kind: 'counter'; metric: CounterMetric }
  | { kind: 'run'; test: (run: RunSummary) => boolean };

const AREAS = Object.keys(MINIGAME_AREAS) as MinigameId[];

const TOP_PARTS = new Map(
  CASE_SLOTS.map((slot) => [slot, PARTS.filter((p) => p.slot === slot).reduce((a, b) => (b.price > a.price ? b : a)).id]),
);

const presented = (state: GameState, id: CertificateId) => getCertificate(state, id)?.presented === true;
const stateRule = (test: (state: GameState) => boolean): Rule => ({ kind: 'state', test });
const counterRule = (metric: CounterMetric): Rule => ({ kind: 'counter', metric });
const runRule = (test: (run: RunSummary) => boolean): Rule => ({ kind: 'run', test });

/** Every achievement but fresh-start, which only the reset path unlocks. */
export const RULES: Record<string, Rule> = {
  'first-boot': stateRule((s) => computeSpecs(s.installed).boots),
  'first-lesson': stateRule((s) => s.lessonsCompleted.length > 0),
  online: stateRule(isOnline),
  'first-breach': stateRule((s) => s.breached.some((id) => id !== HOME_NODE_ID)),
  swarm: stateRule((s) => Object.keys(s.swarm).length > 0),
  noc: stateRule((s) => s.noc.length > 0),
  formatura: stateRule((s) => presented(s, 'conclusao')),
  especializacao: stateRule((s) => presented(s, 'especializacao')),
  mestrado: stateRule((s) => presented(s, 'mestrado')),
  doutorado: stateRule((s) => presented(s, 'doutorado')),
  'first-city': stateRule((s) => s.cities.some((c) => c.finished)),

  'all-lessons': stateRule((s) => LESSONS.every((l) => s.lessonsCompleted.includes(l.id))),
  'area-max': stateRule((s) => AREAS.some((a) => s.areaLevels[a] >= MAX_LEVEL[a])),
  'all-areas-max': stateRule((s) => AREAS.every((a) => s.areaLevels[a] >= MAX_LEVEL[a])),
  'top-rig': stateRule((s) => CASE_SLOTS.every((slot) => s.installed[slot] === TOP_PARTS.get(slot))),
  flawless: runRule((r) => r.success && r.mistakes === 0),
  'on-the-edge': runRule((r) => r.success && r.allowed > 0 && r.mistakes === r.allowed),
  'core-flawless': runRule((r) => r.success && r.nodeId === FINAL_NODE_ID && r.firstBreach && r.mistakes === 0),

  'rounds-100': counterRule('answered'),
  'rounds-500': counterRule('answered'),
  'rounds-1000': counterRule('answered'),
  'correct-250': counterRule('correct'),
  'runs-50': counterRule('runs'),
  'cities-10': counterRule('cities'),

  'last-gasp': runRule((r) => !r.success && r.crashedOnLast),
  'timeout-crash': runRule((r) => !r.success && r.mistakes > 0 && r.timeouts === r.mistakes),
  broke: stateRule((s) => s.money === 0),
  unplugged: stateRule((s) => s.netConfig !== null && !computeSpecs(s.installed).boots),
  'core-again': runRule((r) => r.success && r.nodeId === FINAL_NODE_ID && !r.firstBreach),
};

function sumStats(state: GameState, field: 'answered' | 'correct'): number {
  return Object.values(state.stats).reduce((sum, a) => sum + (a?.[field] ?? 0), 0);
}

/** The current value of a lifetime metric as the game save sees it. */
export function metricValue(state: GameState, metric: CounterMetric): number {
  switch (metric) {
    case 'answered': return sumStats(state, 'answered');
    case 'correct': return sumStats(state, 'correct');
    case 'runs': return state.runCount;
    case 'cities': return state.cities.filter((c) => c.finished).length;
  }
}

/** Ids whose rule holds now, in list order, leaving out the `skip` ids without testing them. */
export function satisfied(state: GameState, totals: CounterTotals, summary?: RunSummary, skip: ReadonlySet<string> = new Set()): string[] {
  return ACHIEVEMENTS.filter((a) => {
    const rule = RULES[a.id];
    // fresh-start has no rule: only the reset path unlocks it.
    if (!rule || skip.has(a.id)) return false;
    if (rule.kind === 'state') return rule.test(state);
    if (rule.kind === 'counter') return totals[rule.metric] >= (a.target ?? Infinity);
    return summary !== undefined && rule.test(summary);
  }).map((a) => a.id);
}

/** A counter achievement's progress toward its target; null for other kinds. */
export function counterProgress(id: string, totals: CounterTotals): { value: number; target: number } | null {
  const rule = RULES[id];
  const target = ACHIEVEMENTS.find((a) => a.id === id)?.target;
  if (rule?.kind !== 'counter' || target === undefined) return null;
  return { value: Math.min(totals[rule.metric], target), target };
}
