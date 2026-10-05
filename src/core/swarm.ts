import { getNode } from '../data/nodes';
import { buildContribution, nodeBuild, type Contribution } from '../data/nodeBuilds';
import { getPart } from '../data/parts';
import type { Specs } from './hardware';
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

const round1 = (n: number) => Math.round(n * 10) / 10;

function nodeStats(nodeId: string): Contribution {
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

export function providerById(state: GameState, id: string): Provider | undefined {
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

/** A connected node's throughput: its own link, shared with everything plugged in below it. */
function nodeThroughput(state: GameState, nodeId: string): number {
  const link = nodeStats(nodeId).linkMbps;
  const below = attachedTo(state, nodeId).reduce((sum, child) => sum + nodeThroughput(state, child), 0);
  return Math.min(link, link + below);
}

function providerThroughput(state: GameState, provider: Provider): number {
  const sum = attachedTo(state, provider.id).reduce((total, child) => total + nodeThroughput(state, child), 0);
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
