import type { NetNode } from '../data/nodes';
import { PARTS, SLOTS, type Part, type Slot } from '../data/parts';
import { TIERS } from '../data/tiers';
import { ELEMENT_TEXT } from '../data/intros';
import { isTierOpen } from './certificates';
import { jobBoard } from './jobs';
import { appendLog } from './log';
import { canStartCities, hasLesson, isLessonOpen, isOnline, nodeStatus, objective, specsOf, type Disclosure, type GameState } from './state';

/**
 * Incremental disclosure: which parts of the interface exist for the player,
 * and the queue that introduces them one at a time. Each element is hidden,
 * current (drawn, pulsing, log line written) or introduced. Scenes ask here
 * whether to draw an element; they never test progression themselves.
 */

export type ElementId = keyof typeof ELEMENT_TEXT;

export interface UiElement {
  id: ElementId;
  /**
   * Cannot be opened (or must not be pressed to advance), so it counts as
   * introduced once the desk has shown it for a moment.
   */
  passive?: boolean;
  available(state: GameState): boolean;
}

const anyLesson = (state: GameState) => state.lessonsCompleted.length > 0;

/** Every element, in the order the queue introduces them. */
export const ELEMENTS: UiElement[] = [
  { id: 'study', available: () => true },
  { id: 'money', passive: true, available: anyLesson },
  { id: 'shop', available: (s) => PARTS.some((p) => hasLesson(s, p.requiresLesson)) },
  { id: 'reset', passive: true, available: anyLesson },
  { id: 'workbench', available: (s) => s.inventory.length > 0 || Object.keys(s.installed).length > 0 },
  { id: 'jobs', available: (s) => jobBoard(s).length > 0 },
  { id: 'net-setup', available: (s) => specsOf(s).networkReady && hasLesson(s, 'ip-addressing') && hasLesson(s, 'dns') },
  { id: 'net-map', available: isOnline },
  {
    id: 'noc-tab',
    available: (s) => s.breached.length > 0 || s.noc.length > 0 || s.inventory.some((id) => PARTS.find((p) => p.id === id)?.slot === 'switch'),
  },
  { id: 'cities', available: canStartCities },
  { id: 'certificates', available: (s) => s.certificates.some((c) => c.presented) },
  { id: 'pos-tab', available: (s) => isTierOpen(s, TIERS[0].id) },
];

function element(id: ElementId): UiElement {
  return ELEMENTS.find((e) => e.id === id)!;
}

export function isAvailable(state: GameState, id: ElementId): boolean {
  return element(id).available(state);
}

export function isPassive(id: ElementId): boolean {
  return !!element(id).passive;
}

export function isCurrent(state: GameState, id: ElementId): boolean {
  return state.disclosure.current === id;
}

/** Drawn only while available and either introduced or being introduced. */
export function isVisible(state: GameState, id: ElementId): boolean {
  return isAvailable(state, id) && (isCurrent(state, id) || state.disclosure.introduced.includes(id));
}

/**
 * With nothing being introduced, promotes the first available element not yet
 * introduced and logs what it is for. A current element stays current even
 * while unavailable, so it is never logged twice.
 */
export function advance(state: GameState): void {
  if (state.disclosure.current) return;
  const next = ELEMENTS.find((e) => !state.disclosure.introduced.includes(e.id) && e.available(state));
  if (!next) return;
  state.disclosure.current = next.id;
  appendLog(state, ELEMENT_TEXT[next.id].log);
}

/** The player used (or, for a passive element, saw) the current element; the next one may appear. */
export function acknowledge(state: GameState, id: ElementId): void {
  if (state.disclosure.current !== id) return;
  state.disclosure.introduced.push(id);
  state.disclosure.current = null;
  advance(state);
}

/** The element being introduced names the next step; otherwise the usual objective does. */
export function goalLine(state: GameState): string {
  const current = state.disclosure.current as ElementId | null;
  if (current && isAvailable(state, current)) return ELEMENT_TEXT[current].goal;
  return objective(state);
}

/**
 * Each screen's first-open card, with the elements that lead to the screen.
 * A tab arriving later on a known screen (NOC, Pós-graduação) has its own card.
 */
export const CARDS = [
  { id: 'study', via: ['study'] },
  { id: 'lesson', via: ['study'] },
  { id: 'shop', via: ['shop'] },
  { id: 'workbench', via: ['workbench'] },
  { id: 'noc', via: ['noc-tab'] },
  { id: 'net-setup', via: ['net-setup'] },
  { id: 'net-map', via: ['net-map'] },
  { id: 'minigame', via: ['net-map', 'jobs'] },
  { id: 'jobs', via: ['jobs'] },
  { id: 'cities', via: ['cities'] },
  { id: 'city-map', via: ['cities'] },
  { id: 'route', via: ['cities'] },
  { id: 'formatura', via: ['certificates'] },
  { id: 'certificate', via: ['certificates'] },
  { id: 'pos', via: ['pos-tab'] },
] as const satisfies readonly { id: string; via: readonly ElementId[] }[];

export type CardId = (typeof CARDS)[number]['id'];

export function isCardSeen(state: GameState, id: CardId): boolean {
  return state.disclosure.cards.includes(id);
}

export function markCardSeen(state: GameState, id: CardId): void {
  if (!isCardSeen(state, id)) state.disclosure.cards.push(id);
}

/**
 * Disclosure for a save made before introductions existed: everything it can
 * already reach counts as introduced, and the screens behind it as seen, with
 * no log flood. Screens it cannot reach yet are introduced normally later.
 */
export function knownDisclosure(state: GameState): Disclosure {
  const introduced = ELEMENTS.filter((e) => e.available(state)).map((e) => e.id);
  return {
    introduced,
    current: null,
    cards: CARDS.filter((c) => c.via.some((id) => introduced.includes(id))).map((c) => c.id),
    log: [],
  };
}

// ─── Lists inside screens ────────────────────────────────────────────────
// Entries appear as soon as their rule allows, with no queue: one lesson can
// open many parts at once.

/** Study lists completed lessons and the ones open now. */
export function isLessonListed(state: GameState, id: string): boolean {
  return hasLesson(state, id) || isLessonOpen(state, id);
}

/** The Shop lists a part once its lesson is done, even when it is not affordable yet. */
export function isPartListed(state: GameState, part: Part): boolean {
  return hasLesson(state, part.requiresLesson);
}

/** Shop tabs: only the slots that have a listed part. */
export function listedSlots(state: GameState): Slot[] {
  return SLOTS.filter((slot) => PARTS.some((p) => p.slot === slot && isPartListed(state, p)));
}

/** The Net Map draws the player's PC, breached machines and the ones they reach. */
export function isNodeListed(state: GameState, node: NetNode): boolean {
  return nodeStatus(state, node) !== 'hidden';
}
