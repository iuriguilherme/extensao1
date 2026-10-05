import { getNode } from '../data/nodes';
import { buildContribution, nodeBuild, type Contribution } from '../data/nodeBuilds';
import { getPart } from '../data/parts';
import { agree, listJoin, plural } from './fmt';
import { round1, type Specs } from './hardware';
import { isOnline, specsOf, type GameState } from './state';

/**
 * Swarm math: which port providers exist, where nodes are plugged in, how much
 * bandwidth the swarm has and how much of its power is usable. Pure functions
 * of GameState.
 *
 * Port providers are the player's router (built-in LAN ports), the switches in
 * the NOC and connected nodes that carry a router or switch. Every connected
 * node is attached to exactly one provider.
 */

export const ROUTER_PROVIDER = 'router';

/** Usable CPU power per Gbps of swarm bandwidth: coordinating nodes costs bandwidth. */
export const CPU_PER_GBPS = 60;
/** Usable GB of RAM per Gbps of swarm bandwidth. */
export const RAM_PER_GBPS = 160;

export type ProviderKind = 'router' | 'switch' | 'node';

export interface Provider {
  id: string;
  kind: ProviderKind;
  ports: number;
  uplinkMbps: number;
}

/** What a node's hardware adds to the swarm. */
export function nodeStats(nodeId: string): Contribution {
  return buildContribution(nodeBuild(getNode(nodeId)));
}

export function connectedNodes(state: GameState): string[] {
  return Object.keys(state.swarm);
}

/** Providers in tie-break order: router, NOC switches by install order, port nodes by connect order. */
export function providers(state: GameState): Provider[] {
  const out: Provider[] = [];
  const router = state.installed.router ? getPart(state.installed.router) : undefined;
  if (router) out.push({ id: ROUTER_PROVIDER, kind: 'router', ports: router.stats.ports ?? 0, uplinkMbps: router.stats.mbps ?? 0 });
  for (const entry of state.noc) {
    const part = getPart(entry.partId);
    out.push({ id: entry.id, kind: 'switch', ports: part.stats.ports ?? 0, uplinkMbps: part.stats.uplinkMbps ?? 0 });
  }
  for (const nodeId of connectedNodes(state)) {
    const stats = nodeStats(nodeId);
    if (stats.ports > 0) out.push({ id: nodeId, kind: 'node', ports: stats.ports, uplinkMbps: stats.linkMbps });
  }
  return out;
}

function providerById(state: GameState, id: string): Provider | undefined {
  return providers(state).find((p) => p.id === id);
}

export function attachedTo(state: GameState, providerId: string): string[] {
  return connectedNodes(state).filter((n) => state.swarm[n] === providerId);
}

export function freePorts(state: GameState, providerId: string): number {
  const provider = providerById(state, providerId);
  return provider ? provider.ports - attachedTo(state, providerId).length : 0;
}

/** Every node plugged in below a provider, at any depth. */
export function dependents(state: GameState, providerId: string): string[] {
  const out: string[] = [];
  for (const child of attachedTo(state, providerId)) out.push(child, ...dependents(state, child));
  return out;
}

/**
 * What a router or NOC switch carries: the links of the nodes on its ports,
 * capped by its uplink. A port node's own link caps its whole subtree, so
 * nodes plugged into it add nothing beyond that link.
 */
function providerThroughput(state: GameState, provider: Provider): number {
  const sum = attachedTo(state, provider.id).reduce((total, child) => total + nodeStats(child).linkMbps, 0);
  return Math.min(provider.uplinkMbps, sum);
}

/** Swarm bandwidth: what the router and the NOC switches carry from their nodes. */
export function swarmBandwidth(state: GameState): number {
  return providers(state)
    .filter((p) => p.kind !== 'node')
    .reduce((sum, p) => sum + providerThroughput(state, p), 0);
}

export interface SwarmPower {
  cpuPower: number;
  ramGB: number;
  storageGB: number;
}

export interface SwarmReport {
  bandwidthMbps: number;
  raw: SwarmPower;
  usable: SwarmPower;
  /** True when bandwidth, not the nodes' hardware, limits CPU power or RAM. */
  limited: boolean;
}

export function swarmReport(state: GameState): SwarmReport {
  const raw = connectedNodes(state).reduce<SwarmPower>((sum, nodeId) => {
    const s = nodeStats(nodeId);
    return { cpuPower: sum.cpuPower + s.cpuPower, ramGB: sum.ramGB + s.ramGB, storageGB: sum.storageGB + s.storageGB };
  }, { cpuPower: 0, ramGB: 0, storageGB: 0 });
  raw.cpuPower = round1(raw.cpuPower);
  const bandwidthMbps = swarmBandwidth(state);
  const gbps = bandwidthMbps / 1000;
  const usable: SwarmPower = {
    cpuPower: round1(Math.min(raw.cpuPower, gbps * CPU_PER_GBPS)),
    ramGB: Math.floor(Math.min(raw.ramGB, gbps * RAM_PER_GBPS)),
    storageGB: raw.storageGB,
  };
  return { bandwidthMbps, raw, usable, limited: usable.cpuPower < raw.cpuPower || usable.ramGB < raw.ramGB };
}

/**
 * The player's own rig plus the usable swarm, when the rig is online. The own
 * link, boot state and issues never change: the swarm only adds power.
 */
export function totalSpecs(state: GameState): Specs {
  const own = specsOf(state);
  if (!isOnline(state)) return own;
  const { usable } = swarmReport(state);
  return {
    ...own,
    cpuPower: round1(own.cpuPower + usable.cpuPower),
    ramGB: own.ramGB + usable.ramGB,
    storageGB: own.storageGB + usable.storageGB,
  };
}

/**
 * The provider with a free port where the node adds the most bandwidth; ties
 * follow provider order. `exclude` lists providers the node must not use (itself
 * and its own subtree). Null when no port is free.
 */
export function pickProvider(state: GameState, nodeId: string, exclude: string[] = []): string | null {
  const banned = new Set([nodeId, ...dependents(state, nodeId), ...exclude]);
  const before = swarmBandwidth(state);
  let best: string | null = null;
  let bestGain = -1;
  for (const p of providers(state)) {
    if (banned.has(p.id) || freePorts(state, p.id) <= 0) continue;
    const trial: GameState = { ...state, swarm: { ...state.swarm, [nodeId]: p.id } };
    const gain = swarmBandwidth(trial) - before;
    if (gain > bestGain) {
      best = p.id;
      bestGain = gain;
    }
  }
  return best;
}

// ─── Actions (mutate state in place; stable codes, PT-BR messages) ────────

/** Stable result codes: tests and scenes branch on these, never on the wording. */
export type SwarmCode =
  | 'joined' | 'no-free-port' | 'not-breached' | 'already-connected' | 'left' | 'not-connected'
  | 'blocked-dependents' | 'switch-installed' | 'switch-removed' | 'not-a-switch' | 'not-in-inventory'
  | 'unknown-switch' | 'router-changed';

export interface SwarmResult {
  ok: boolean;
  code: SwarmCode;
  message: string;
}

const result = (ok: boolean, code: SwarmCode, message: string): SwarmResult => ({ ok, code, message });

const nodeName = (id: string) => getNode(id).name;

/** How the player sees a provider: the router or switch model, or the node's name. */
export function providerLabel(state: GameState, providerId: string): string {
  if (providerId === ROUTER_PROVIDER) return state.installed.router ? getPart(state.installed.router).name : 'roteador';
  const entry = state.noc.find((e) => e.id === providerId);
  return entry ? getPart(entry.partId).name : nodeName(providerId);
}

/**
 * Moves `nodes` (each with its own subtree) to other providers on `trial`,
 * never into `exclude`. Returns the nodes that found no free port.
 */
function relocate(trial: GameState, nodes: string[], exclude: string[]): string[] {
  const stuck: string[] = [];
  for (const node of nodes) {
    const target = pickProvider(trial, node, exclude);
    if (target) trial.swarm[node] = target;
    else stuck.push(node);
  }
  return stuck;
}

function cloneSwarm(state: GameState): GameState {
  return { ...state, swarm: { ...state.swarm }, noc: [...state.noc], installed: { ...state.installed } };
}

function blockedMessage(state: GameState, action: string, stuck: string[]): string {
  const names = stuck.flatMap((n) => [n, ...dependents(state, n)]).map(nodeName);
  const one = names.length === 1;
  return `Não dá para ${action}: ${listJoin(names)} ${one ? 'ficaria' : 'ficariam'} sem porta. Desconecte ${one ? 'esse nó' : 'esses nós'} antes ou instale mais um switch.`;
}

const movedNote = (moved: number) => (moved > 0 ? ` ${plural(moved, 'nó mudou', 'nós mudaram')} de porta.` : '');

/** Connects a breached node to the free port where it adds the most bandwidth. */
export function joinSwarm(state: GameState, nodeId: string): SwarmResult {
  const name = nodeName(nodeId);
  if (!state.breached.includes(nodeId)) return result(false, 'not-breached', `Você ainda não invadiu o nó ${name}.`);
  if (state.swarm[nodeId]) return result(false, 'already-connected', `O nó ${name} já faz parte do enxame.`);
  const target = pickProvider(state, nodeId);
  if (!target) {
    return result(false, 'no-free-port', `Não sobrou porta livre para o nó ${name}: instale um switch no NOC ou desconecte outro nó.`);
  }
  state.swarm[nodeId] = target;
  return result(true, 'joined', `O nó ${name} entrou no enxame, conectado via ${providerLabel(state, target)}.`);
}

/** Disconnects a node; nodes plugged into it move elsewhere first, or nothing changes. */
export function leaveSwarm(state: GameState, nodeId: string): SwarmResult {
  const name = nodeName(nodeId);
  if (!state.swarm[nodeId]) return result(false, 'not-connected', `O nó ${name} não está no enxame.`);
  const children = attachedTo(state, nodeId);
  const trial = cloneSwarm(state);
  delete trial.swarm[nodeId];
  const stuck = relocate(trial, children, dependents(state, nodeId));
  if (stuck.length) return result(false, 'blocked-dependents', blockedMessage(state, `desconectar o nó ${name}`, stuck));
  state.swarm = trial.swarm;
  return result(true, 'left', `O nó ${name} saiu do enxame.${movedNote(children.length)}`);
}

/** Moves a switch from the inventory into the NOC. */
export function installSwitch(state: GameState, partId: string): SwarmResult {
  const part = getPart(partId);
  if (part.slot !== 'switch') return result(false, 'not-a-switch', `${part.name} não é um switch.`);
  const index = state.inventory.indexOf(partId);
  if (index < 0) return result(false, 'not-in-inventory', 'Não está no inventário.');
  state.inventory.splice(index, 1);
  const used = new Set(state.noc.map((e) => e.id));
  let n = 1;
  while (used.has(`sw${n}`)) n++;
  state.noc.push({ id: `sw${n}`, partId });
  return result(true, 'switch-installed', `${part.name} ${agree(part.gender, 'instalado', 'instalada')} no NOC: mais ${plural(part.stats.ports ?? 0, 'porta', 'portas')} para o enxame.`);
}

/** Takes a switch out of the NOC; its nodes move to other ports first, or nothing changes. */
export function removeSwitch(state: GameState, nocId: string): SwarmResult {
  const entry = state.noc.find((e) => e.id === nocId);
  if (!entry) return result(false, 'unknown-switch', 'Esse switch não está no NOC.');
  const part = getPart(entry.partId);
  const children = attachedTo(state, nocId);
  const trial = cloneSwarm(state);
  trial.noc = trial.noc.filter((e) => e.id !== nocId);
  const stuck = relocate(trial, children, dependents(state, nocId));
  if (stuck.length) return result(false, 'blocked-dependents', blockedMessage(state, `remover ${agree(part.gender, 'o', 'a')} ${part.name}`, stuck));
  state.swarm = trial.swarm;
  state.noc = trial.noc;
  state.inventory.push(entry.partId);
  return result(true, 'switch-removed', `${part.name} ${agree(part.gender, 'removido', 'removida')} do NOC.${movedNote(children.length)}`);
}

/**
 * Checks a router swap or removal against the nodes on its LAN ports. On
 * success the swarm is updated; the caller then changes the installed router.
 */
export function rehomeForRouter(state: GameState, newRouterId: string | undefined): SwarmResult {
  const children = attachedTo(state, ROUTER_PROVIDER);
  const trial = cloneSwarm(state);
  let moving: string[];
  let exclude: string[];
  if (newRouterId) {
    trial.installed.router = newRouterId;
    moving = children.slice(getPart(newRouterId).stats.ports ?? 0);
    exclude = [ROUTER_PROVIDER];
  } else {
    delete trial.installed.router;
    moving = children;
    exclude = dependents(state, ROUTER_PROVIDER);
  }
  const action = newRouterId ? 'trocar o roteador' : 'remover o roteador';
  const stuck = relocate(trial, moving, exclude);
  if (stuck.length) return result(false, 'blocked-dependents', blockedMessage(state, action, stuck));
  state.swarm = trial.swarm;
  return result(true, 'router-changed', movedNote(moving.length).trim());
}
