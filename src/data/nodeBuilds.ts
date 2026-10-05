import { getPart, type Slot } from './parts';
import type { NetNode } from './nodes';

/**
 * Hardware inside the machines on the network map. Each node is a kind of
 * machine at a tier (1-3); the kind and tier pick real parts from the catalog,
 * so a breached node is worth exactly what its parts are worth. Router and
 * switch kinds carry a router or switch, which gives the NOC more ports.
 */

export type NodeKind = 'workstation' | 'server' | 'edge-router' | 'distribution-switch' | 'datacenter';

export const NODE_KINDS: NodeKind[] = ['workstation', 'server', 'edge-router', 'distribution-switch', 'datacenter'];

export const NODE_KIND_LABELS: Record<NodeKind, string> = {
  workstation: 'Estação de trabalho',
  server: 'Servidor',
  'edge-router': 'Roteador de borda',
  'distribution-switch': 'Switch de distribuição',
  datacenter: 'Data center',
};

export type Tier = 1 | 2 | 3;

/** Part ids by slot. Only the parts that matter for the swarm are listed. */
export type NodeBuild = Partial<Record<Slot, string>>;

export interface NodeHardware {
  kind: NodeKind;
  tier: Tier;
  /** Replaces the kind/tier default for the slots it names. */
  overrides?: NodeBuild;
}

const BUILDS: Record<NodeKind, Record<Tier, NodeBuild>> = {
  workstation: {
    1: { cpu: 'cpu_s1_2c', ram: 'ram_4_ddr4', storage: 'hdd_500', nic: 'nic_100' },
    2: { cpu: 'cpu_s1_4c', ram: 'ram_16_ddr4', storage: 'ssd_512', nic: 'nic_1g' },
    3: { cpu: 'cpu_s2_8c', ram: 'ram_32_ddr5', storage: 'nvme_2tb', nic: 'nic_1g' },
  },
  server: {
    1: { cpu: 'cpu_s1_4c', ram: 'ram_16_ddr4', storage: 'hdd_500', nic: 'nic_1g' },
    2: { cpu: 'cpu_s2_8c', ram: 'ram_32_ddr5', storage: 'ssd_512', nic: 'nic_1g' },
    3: { cpu: 'cpu_s2_16c', ram: 'ram_64_ddr5', storage: 'nvme_2tb', nic: 'nic_10g' },
  },
  'edge-router': {
    1: { cpu: 'cpu_s1_2c', ram: 'ram_4_ddr4', storage: 'hdd_500', nic: 'nic_100', router: 'router_home' },
    2: { cpu: 'cpu_s1_4c', ram: 'ram_16_ddr4', storage: 'ssd_512', nic: 'nic_1g', router: 'router_gig' },
    3: { cpu: 'cpu_s2_8c', ram: 'ram_32_ddr5', storage: 'nvme_2tb', nic: 'nic_10g', router: 'router_10g' },
  },
  'distribution-switch': {
    1: { cpu: 'cpu_s1_2c', ram: 'ram_4_ddr4', storage: 'hdd_500', nic: 'nic_100', switch: 'sw_8_fast' },
    2: { cpu: 'cpu_s1_4c', ram: 'ram_16_ddr4', storage: 'ssd_512', nic: 'nic_1g', switch: 'sw_8_gig' },
    3: { cpu: 'cpu_s2_8c', ram: 'ram_32_ddr5', storage: 'nvme_2tb', nic: 'nic_10g', switch: 'sw_24_gig' },
  },
  datacenter: {
    1: { cpu: 'cpu_s2_8c', ram: 'ram_32_ddr5', storage: 'nvme_2tb', nic: 'nic_10g' },
    2: { cpu: 'cpu_s2_16c', ram: 'ram_64_ddr5', storage: 'nvme_2tb', nic: 'nic_10g' },
    3: { cpu: 'cpu_s2_16c', ram: 'ram_64_ddr5', storage: 'nvme_2tb', nic: 'nic_10g' },
  },
};

export function resolveBuild(hw: NodeHardware): NodeBuild {
  return { ...BUILDS[hw.kind][hw.tier], ...hw.overrides };
}

/** The parts inside a node; empty for the player's own PC, which has no node hardware. */
export function nodeBuild(node: NetNode): NodeBuild {
  return node.hardware ? resolveBuild(node.hardware) : {};
}

export interface Contribution {
  cpuPower: number;
  ramGB: number;
  storageGB: number;
  /** The node's own network card speed. */
  linkMbps: number;
  /** Ports from the router or switch inside the node; 0 for other kinds. */
  ports: number;
}

/** Names of the parts inside a node, for the breach result and the Net Map. */
export function nodePartNames(node: NetNode): string[] {
  return Object.values(nodeBuild(node)).map((id) => getPart(id).name);
}

export function buildContribution(build: NodeBuild): Contribution {
  const stats = (slot: Slot) => (build[slot] ? getPart(build[slot]!).stats : {});
  const cpu = stats('cpu');
  return {
    cpuPower: Math.round((cpu.cores ?? 0) * (cpu.ghz ?? 0) * 10) / 10,
    ramGB: stats('ram').gb ?? 0,
    storageGB: stats('storage').gb ?? 0,
    linkMbps: stats('nic').mbps ?? 0,
    ports: (stats('router').ports ?? 0) + (stats('switch').ports ?? 0),
  };
}
