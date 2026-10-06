import { ETHICS_LESSON_ID, getLesson, LESSONS } from '../data/lessons';
import { NODES, HOME_NODE_ID, FINAL_NODE_ID, getNode, type NetNode } from '../data/nodes';
import { getPart, type Part, type Slot } from '../data/parts';
import { agree, decimal, linkSpeed, money } from './fmt';
import { computeSpecs, type Installed, type Specs } from './hardware';
import type { NetConfig } from './ip';
import { installSwitch, rehomeForRouter, totalSpecs } from './swarm';

export interface GameState {
  version: 1;
  money: number;
  inventory: string[];
  installed: Installed;
  lessonsCompleted: string[];
  /** Saved once the player enters a valid manual IP configuration. */
  netConfig: NetConfig | null;
  breached: string[];
  /** Switches installed in the NOC; ids are stable so attachments survive reordering. */
  noc: NocEntry[];
  /** Connected nodes (the swarm): node id -> id of the port provider it is plugged into. */
  swarm: Record<string, string>;
}

export interface NocEntry {
  id: string;
  partId: string;
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
    noc: [],
    swarm: {},
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

export type BuyIssueCode = 'needs-lesson' | 'no-money';

export function canBuy(state: GameState, part: Part): { ok: boolean; code?: BuyIssueCode; reason?: string } {
  if (!hasLesson(state, part.requiresLesson)) {
    return { ok: false, code: 'needs-lesson', reason: `Requer a aula: ${getLesson(part.requiresLesson).title}` };
  }
  if (state.money < part.price) return { ok: false, code: 'no-money', reason: 'Dinheiro insuficiente' };
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
      const firstOpen = LESSONS.find((l) => l.track === 'hardware' && !hasLesson(state, l.id) && isLessonOpen(state, l.id));
      if (firstOpen && state.lessonsCompleted.length < 2) return `Faça a aula "${firstOpen.title}" para descobrir o que tem dentro de um computador.`;
      if (state.inventory.length > 0) return 'Vá até a Bancada e instale as peças que você comprou.';
      return `Faça o PC dar boot. ${specs.issues[0]?.message ?? ''}`;
    }
    case 'connect': {
      if (!hasLesson(state, 'network-basics')) return `Seu PC deu boot! Agora faça a aula "${getLesson('network-basics').title}" para colocá-lo na internet.`;
      if (!specs.networkReady) return 'Compre e instale uma placa de rede e um roteador.';
      if (!hasLesson(state, 'ip-addressing')) return `Faça a aula "${getLesson('ip-addressing').title}" para aprender a configurar a sua conexão.`;
      if (!hasLesson(state, 'dns')) return `Faça a aula "${getLesson('dns').title}" para entender como o PC acha os sites pelo nome.`;
      return 'Abra a Configuração de Rede e defina o seu endereço IP.';
    }
    case 'explore':
      if (!hasLesson(state, ETHICS_LESSON_ID)) return `Você está online! Antes da primeira invasão, faça a aula "${getLesson(ETHICS_LESSON_ID).title}".`;
      return `Você está online! Abra o Mapa da Rede e vá invadindo nó por nó até chegar ao ${getNode(FINAL_NODE_ID).name}.`;
    case 'won':
      return `Você invadiu o ${getNode(FINAL_NODE_ID).name}! Agora você é root de verdade. Pode continuar explorando à vontade.`;
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

/**
 * What a node demands and whether the player meets it. CPU power, RAM and
 * storage count the usable swarm; the link is always the player's own.
 */
export function checkRequirements(state: GameState, node: NetNode): RequirementCheck[] {
  const specs = totalSpecs(state);
  const own = specsOf(state);
  const swarmNote = (total: number, mine: number) => (total > mine ? ', contando o swarm' : '');
  const r = node.requires;
  const checks: RequirementCheck[] = [];
  // Every breach waits for the ethics lesson, so nodes never list it themselves.
  if (node.id !== HOME_NODE_ID) {
    checks.push({ label: `Aula: ${getLesson(ETHICS_LESSON_ID).title}`, met: hasLesson(state, ETHICS_LESSON_ID) });
  }
  if (r.lesson) checks.push({ label: `Aula: ${getLesson(r.lesson).title}`, met: hasLesson(state, r.lesson) });
  if (r.cpuPower) {
    checks.push({
      label: `Processamento ≥ ${decimal(r.cpuPower)} (você tem ${decimal(specs.cpuPower)}${swarmNote(specs.cpuPower, own.cpuPower)})`,
      met: specs.cpuPower >= r.cpuPower,
    });
  }
  if (r.ramGB) {
    checks.push({
      label: `RAM ≥ ${r.ramGB} GB (você tem ${specs.ramGB} GB${swarmNote(specs.ramGB, own.ramGB)})`,
      met: specs.ramGB >= r.ramGB,
    });
  }
  if (r.storageGB) {
    checks.push({
      label: `Armazenamento ≥ ${r.storageGB} GB (você tem ${specs.storageGB} GB${swarmNote(specs.storageGB, own.storageGB)})`,
      met: specs.storageGB >= r.storageGB,
    });
  }
  if (r.linkMbps) checks.push({ label: `Link ≥ ${linkSpeed(r.linkMbps)} (você tem ${linkSpeed(specs.linkMbps)})`, met: specs.linkMbps >= r.linkMbps });
  return checks;
}

export function canConnect(state: GameState, node: NetNode): boolean {
  return isOnline(state)
    && nodeStatus(state, node) !== 'hidden'
    && node.id !== HOME_NODE_ID
    && checkRequirements(state, node).every((c) => c.met);
}

/** How many of a part the player has: in the inventory, in the case and in the NOC. */
export function ownedCount(state: GameState, partId: string): number {
  return state.inventory.filter((id) => id === partId).length
    + Object.values(state.installed).filter((id) => id === partId).length
    + state.noc.filter((e) => e.partId === partId).length;
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
  return `${part.name} ${agree(part.gender, 'comprado', 'comprada')}!`;
}

export function sell(state: GameState, partId: string): string {
  const index = state.inventory.indexOf(partId);
  if (index < 0) return 'Não está no inventário.';
  const part = getPart(partId);
  state.inventory.splice(index, 1);
  const value = Math.floor(part.price * SELL_RATIO);
  state.money += value;
  return `${part.name} ${agree(part.gender, 'vendido', 'vendida')} por ${money(value)}.`;
}

/**
 * Moves a part from inventory into its slot; any previous part goes back to
 * inventory. Switches go to the NOC instead. A router swap first checks that
 * the nodes on its LAN ports still have somewhere to go.
 */
export function install(state: GameState, partId: string): string {
  const index = state.inventory.indexOf(partId);
  if (index < 0) return 'Não está no inventário.';
  const part = getPart(partId);
  if (part.slot === 'switch') return installSwitch(state, partId).message;
  if (part.slot === 'router' && state.installed.router) {
    const check = rehomeForRouter(state, partId);
    if (!check.ok) return check.message;
  }
  state.inventory.splice(index, 1);
  const previous = state.installed[part.slot];
  if (previous) state.inventory.push(previous);
  state.installed[part.slot] = part.id;
  return previous
    ? `Você trocou ${agree(getPart(previous).gender, 'o', 'a')} ${getPart(previous).name} ${agree(part.gender, 'pelo', 'pela')} ${part.name}.`
    : `${part.name} ${agree(part.gender, 'instalado', 'instalada')}!`;
}

export function uninstall(state: GameState, slot: Slot): string {
  const id = state.installed[slot];
  if (!id) return 'Não há nada instalado aí.';
  if (slot === 'router') {
    const check = rehomeForRouter(state, undefined);
    if (!check.ok) return check.message;
  }
  delete state.installed[slot];
  state.inventory.push(id);
  return `${getPart(id).name} ${agree(getPart(id).gender, 'removido', 'removida')}.`;
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
