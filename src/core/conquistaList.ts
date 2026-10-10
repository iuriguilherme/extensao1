import { ACHIEVEMENTS, type Achievement } from '../data/achievements';
import { FINAL_NODE_ID, getNode } from '../data/nodes';
import { CASE_SLOTS, getPart } from '../data/parts';
import type { AchievementState } from './achievementStore';
import { RULES, TOP_PARTS } from './achievements';
import { isTierOpen } from './certificates';
import { isVisible } from './disclosure';
import { hasLesson, nodeStatus, type GameState } from './state';

/**
 * Which conquistas the Conquistas screen lists: the unlocked ones, plus the
 * locked ones the student can work toward with what the game has opened so
 * far. Locked secrets and goals that can no longer be earned stay hidden, and
 * of a tiered counter only the next tier shows. Kept apart from
 * achievements.ts because it reads the disclosure state, which itself reads
 * the achievement store.
 */

type Reachable = (state: GameState) => boolean;

const always: Reachable = () => true;
const never: Reachable = () => false;
/** An intrusion can be started from the Net Map or from a side job. */
const canIntrude: Reachable = (s) => isVisible(s, 'net-map') || isVisible(s, 'jobs');
/** Every lesson is open only once the last pós-graduação tier is. */
const everythingOpen: Reachable = (s) => isTierOpen(s, 'doutorado');

/** When each locked conquista becomes something the student can work toward. */
export const REACHABLE: Record<string, Reachable> = {
  'first-boot': (s) => isVisible(s, 'workbench'),
  'first-lesson': always,
  online: (s) => isVisible(s, 'net-setup'),
  'first-breach': (s) => isVisible(s, 'net-map'),
  swarm: (s) => isVisible(s, 'noc-tab'),
  noc: (s) => isVisible(s, 'noc-tab'),
  formatura: (s) => isVisible(s, 'net-map'),
  especializacao: (s) => isTierOpen(s, 'especializacao'),
  mestrado: (s) => isTierOpen(s, 'mestrado'),
  doutorado: (s) => isTierOpen(s, 'doutorado'),
  'first-city': (s) => isVisible(s, 'cities'),

  'all-lessons': everythingOpen,
  'area-max': (s) => isVisible(s, 'jobs'),
  'all-areas-max': (s) => isVisible(s, 'jobs') && everythingOpen(s),
  'top-rig': (s) => CASE_SLOTS.every((slot) => hasLesson(s, getPart(TOP_PARTS.get(slot)!).requiresLesson)),
  flawless: canIntrude,
  'on-the-edge': canIntrude,
  // Only the first Core breach counts, so once the Core falls it can no longer be earned.
  'core-flawless': (s) => nodeStatus(s, getNode(FINAL_NODE_ID)) === 'reachable',

  'rounds-100': canIntrude,
  'rounds-500': canIntrude,
  'rounds-1000': canIntrude,
  'correct-250': canIntrude,
  'runs-50': canIntrude,
  'cities-10': (s) => isVisible(s, 'cities'),

  // Secrets are never listed while locked.
  'last-gasp': never,
  'timeout-crash': never,
  broke: never,
  unplugged: never,
  'core-again': never,
  'fresh-start': never,
};

/** The metric a counter conquista counts, or null for other kinds. */
function counterMetric(id: string): string | null {
  const rule = RULES[id];
  return rule?.kind === 'counter' ? rule.metric : null;
}

/** The conquistas the screen lists, in catalogue order. */
export function listedConquistas(state: GameState, conquistas: AchievementState): Achievement[] {
  const unlocked = new Set(conquistas.unlocked);
  const nextTierShown = new Set<string>();
  return ACHIEVEMENTS.filter((a) => {
    if (unlocked.has(a.id)) return true;
    if (a.kind === 'secret' || !REACHABLE[a.id]?.(state)) return false;
    // Of locked counters sharing a metric, only the lowest target (the next tier) shows.
    const metric = counterMetric(a.id);
    if (metric === null) return true;
    const lowest = ACHIEVEMENTS
      .filter((b) => counterMetric(b.id) === metric && !unlocked.has(b.id))
      .reduce((x, y) => ((y.target ?? 0) < (x.target ?? 0) ? y : x));
    if (lowest.id !== a.id || nextTierShown.has(metric)) return false;
    nextTierShown.add(metric);
    return true;
  });
}
