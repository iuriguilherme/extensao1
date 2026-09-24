import { getLesson, LESSONS } from '../data/lessons';
import { NODES, HOME_NODE_ID, FINAL_NODE_ID, getNode, type NetNode } from '../data/nodes';
import { getPart, type Part, type Slot } from '../data/parts';
import { computeSpecs, type Installed, type Specs } from './hardware';
import type { NetConfig } from './ip';

export interface GameState {
  version: 1;
  money: number;
  inventory: string[];
  installed: Installed;
  lessonsCompleted: string[];
  /** Saved once the player enters a valid manual IP configuration. */
  netConfig: NetConfig | null;
  breached: string[];
}

export const STARTING_MONEY = 300;
export const SELL_RATIO = 0.5;
/** Fraction of a node's reward paid for breaching it again. */
export const REPLAY_RATIO = 0.2;

export function newGame(): GameState {
  return {
    version: 1,
    money: STARTING_MONEY,
    inventory: [],
    installed: {},
    lessonsCompleted: [],
    netConfig: null,
    breached: [],
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────

export function specsOf(state: GameState): Specs {
  return computeSpecs(state.installed);
}

export function hasLesson(state: GameState, id: string): boolean {
  return state.lessonsCompleted.includes(id);
}

export function isLessonOpen(state: GameState, id: string): boolean {
  return getLesson(id).requires.every((req) => hasLesson(state, req));
}

export function canBuy(state: GameState, part: Part): { ok: boolean; reason?: string } {
  if (!hasLesson(state, part.requiresLesson)) {
    return { ok: false, reason: `Study "${getLesson(part.requiresLesson).title}" first` };
  }
  if (state.money < part.price) return { ok: false, reason: 'Not enough money' };
  return { ok: true };
}

export function isOnline(state: GameState): boolean {
  return state.netConfig !== null && specsOf(state).networkReady;
}

export type Phase = 'build' | 'connect' | 'explore' | 'won';

export function phaseOf(state: GameState): Phase {
  if (state.breached.includes(FINAL_NODE_ID)) return 'won';
  if (isOnline(state)) return 'explore';
  if (specsOf(state).boots) return 'connect';
  return 'build';
}

/** A short hint telling the player what to do next. */
export function objective(state: GameState): string {
  const specs = specsOf(state);
  switch (phaseOf(state)) {
    case 'build': {
      const firstOpen = LESSONS.find((l) => l.track === 'Hardware' && !hasLesson(state, l.id) && isLessonOpen(state, l.id));
      if (firstOpen && state.lessonsCompleted.length < 2) return `Study "${firstOpen.title}" to learn what goes inside a computer.`;
      if (state.inventory.length > 0) return 'Install the parts in your inventory at the Workbench.';
      return `Get this PC to boot. ${specs.issues[0]?.message ?? ''}`;
    }
    case 'connect': {
      if (!hasLesson(state, 'network-basics')) return 'Your PC boots! Now study "Networks 101" to get online.';
      if (!specs.networkReady) return 'Buy and install a network card and a router.';
      if (!hasLesson(state, 'ip-addressing')) return 'Study "IP addresses & subnets" to configure your connection.';
      if (!hasLesson(state, 'dns')) return 'Study "DNS" so your PC can resolve names.';
      return 'Open Network Setup and configure your IP address.';
    }
    case 'explore':
      return 'You are online. Open the Net Map and breach your way to the Data Center Core.';
    case 'won':
      return 'You breached the Data Center Core. You are a certified root. Keep exploring!';
  }
}

export type NodeStatus = 'home' | 'breached' | 'reachable' | 'hidden';

export function nodeStatus(state: GameState, node: NetNode): NodeStatus {
  if (node.id === HOME_NODE_ID) return 'home';
  if (state.breached.includes(node.id)) return 'breached';
  const reachable = node.links.some((id) => id === HOME_NODE_ID || state.breached.includes(id));
  return reachable ? 'reachable' : 'hidden';
}

export interface RequirementCheck {
  label: string;
  met: boolean;
}

export function checkRequirements(state: GameState, node: NetNode): RequirementCheck[] {
  const specs = specsOf(state);
  const r = node.requires;
  const checks: RequirementCheck[] = [];
  if (r.lesson) checks.push({ label: `Knowledge: ${getLesson(r.lesson).title}`, met: hasLesson(state, r.lesson) });
  if (r.cpuPower) checks.push({ label: `CPU power ≥ ${r.cpuPower} (you: ${specs.cpuPower})`, met: specs.cpuPower >= r.cpuPower });
  if (r.ramGB) checks.push({ label: `RAM ≥ ${r.ramGB} GB (you: ${specs.ramGB})`, met: specs.ramGB >= r.ramGB });
  if (r.storageGB) checks.push({ label: `Storage ≥ ${r.storageGB} GB (you: ${specs.storageGB})`, met: specs.storageGB >= r.storageGB });
  if (r.linkMbps) checks.push({ label: `Link ≥ ${r.linkMbps} Mbps (you: ${specs.linkMbps})`, met: specs.linkMbps >= r.linkMbps });
  return checks;
}

export function canConnect(state: GameState, node: NetNode): boolean {
  return isOnline(state)
    && nodeStatus(state, node) !== 'hidden'
    && node.id !== HOME_NODE_ID
    && checkRequirements(state, node).every((c) => c.met);
}

export function allNodes(): NetNode[] {
  return NODES;
}

// ─── Mutations (return a result message, mutate state in place) ──────────

export function buy(state: GameState, partId: string): string {
  const part = getPart(partId);
  const check = canBuy(state, part);
  if (!check.ok) return check.reason!;
  state.money -= part.price;
  state.inventory.push(part.id);
  return `Bought ${part.name}.`;
}

export function sell(state: GameState, partId: string): string {
  const index = state.inventory.indexOf(partId);
  if (index < 0) return 'Not in inventory.';
  const part = getPart(partId);
  state.inventory.splice(index, 1);
  const value = Math.floor(part.price * SELL_RATIO);
  state.money += value;
  return `Sold ${part.name} for $${value}.`;
}

/** Moves a part from inventory into its slot; any previous part goes back to inventory. */
export function install(state: GameState, partId: string): string {
  const index = state.inventory.indexOf(partId);
  if (index < 0) return 'Not in inventory.';
  const part = getPart(partId);
  state.inventory.splice(index, 1);
  const previous = state.installed[part.slot];
  if (previous) state.inventory.push(previous);
  state.installed[part.slot] = part.id;
  return previous ? `Swapped ${getPart(previous).name} for ${part.name}.` : `Installed ${part.name}.`;
}

export function uninstall(state: GameState, slot: Slot): string {
  const id = state.installed[slot];
  if (!id) return 'Slot is empty.';
  delete state.installed[slot];
  state.inventory.push(id);
  return `Removed ${getPart(id).name}.`;
}

/** Records a passed quiz. Returns the cash awarded (0 on repeats). */
export function completeLesson(state: GameState, id: string): number {
  if (hasLesson(state, id)) return 0;
  state.lessonsCompleted.push(id);
  const reward = getLesson(id).reward;
  state.money += reward;
  return reward;
}

export function setNetConfig(state: GameState, config: NetConfig): void {
  state.netConfig = { ...config };
}

/** Records a successful breach. Returns the cash awarded. */
export function breach(state: GameState, nodeId: string): number {
  const node = getNode(nodeId);
  if (state.breached.includes(nodeId)) {
    const reward = Math.floor(node.reward * REPLAY_RATIO);
    state.money += reward;
    return reward;
  }
  state.breached.push(nodeId);
  state.money += node.reward;
  return node.reward;
}

export function earn(state: GameState, amount: number): void {
  state.money += amount;
}
