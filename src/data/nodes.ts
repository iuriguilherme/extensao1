/**
 * Machines on the network map. Each node belongs to a knowledge area; to
 * connect to it the player plays that area's mini-game. Nodes open up as their
 * neighbors are breached, so the map is explored outward from HOME.
 */

import type { NodeHardware } from './nodeBuilds';

export type MinigameId = 'binary' | 'subnet' | 'ports' | 'http' | 'dns' | 'nat' | 'vlan' | 'ipv6';

export const MINIGAME_AREAS: Record<MinigameId, string> = {
  binary: 'Dados e binário',
  subnet: 'Endereçamento IP',
  ports: 'Portas e firewalls',
  http: 'Web / HTTP',
  dns: 'DNS',
  nat: 'NAT',
  vlan: 'VLANs',
  ipv6: 'IPv6',
};

/** The lesson that teaches each area; side jobs in an area open with it. */
export const AREA_LESSON: Record<MinigameId, string> = {
  binary: 'binary',
  subnet: 'ip-addressing',
  ports: 'ports',
  http: 'http',
  dns: 'dns',
  // A pack's second lesson requires its first, so the whole pack must be done.
  nat: 'port-forwarding',
  vlan: 'vlan-trunks',
  ipv6: 'ipv6-routing',
};

export interface NodeRequirements {
  lesson?: string;
  cpuPower?: number;
  ramGB?: number;
  storageGB?: number;
  linkMbps?: number;
}

export interface NetNode {
  id: string;
  name: string;
  ip: string;
  /** Map position in a 1280×720 canvas. */
  x: number;
  y: number;
  minigame: MinigameId;
  /** Affects rounds and question variety. Campaign nodes use 1-3; city nodes may go higher in areas with MAX_LEVEL above 3. */
  difficulty: number;
  links: string[];
  requires: NodeRequirements;
  reward: number;
  flavor: string;
  /** What the machine is made of; absent only for the player's own PC. */
  hardware?: NodeHardware;
}

export const HOME_NODE_ID = 'home';
export const FINAL_NODE_ID = 'core';

export const NODES: NetNode[] = [
  {
    id: 'home', name: 'Seu PC', ip: '192.168.0.42', x: 140, y: 380,
    minigame: 'binary', difficulty: 1, links: ['isp'], requires: {}, reward: 0,
    flavor: 'Lar, doce lar.',
  },
  {
    id: 'isp', name: 'Roteador de Borda do Provedor', ip: '100.64.0.1', x: 330, y: 380,
    minigame: 'subnet', difficulty: 1, links: ['home', 'resolver', 'museum'],
    requires: { lesson: 'ip-addressing' }, reward: 120,
    flavor: 'O roteador de borda do seu provedor. Descubra as sub-redes dele para achar uma brecha.',
    hardware: { kind: 'edge-router', tier: 1 },
  },
  {
    id: 'museum', name: 'Acervo do Museu do Computador', ip: '198.51.100.8', x: 470, y: 560,
    minigame: 'binary', difficulty: 1, links: ['isp', 'uni'],
    requires: { lesson: 'binary', ramGB: 4 }, reward: 150,
    flavor: 'Máquinas velhas, dados mais velhos ainda. Aqui tudo está guardado em binário puro.',
    hardware: { kind: 'workstation', tier: 1 },
  },
  {
    id: 'resolver', name: 'Servidor DNS Público', ip: '203.0.113.53', x: 520, y: 220,
    minigame: 'dns', difficulty: 1, links: ['isp', 'blog', 'uni'],
    requires: { lesson: 'dns' }, reward: 180,
    flavor: 'Diz a milhões de pessoas onde fica cada site. Para entrar, domine os tipos de registro DNS.',
    hardware: { kind: 'server', tier: 1 },
  },
  {
    id: 'blog', name: 'Servidor do Bloguinho', ip: '203.0.113.80', x: 730, y: 120,
    minigame: 'http', difficulty: 1, links: ['resolver', 'shop'],
    requires: { lesson: 'http', cpuPower: 4 }, reward: 220,
    flavor: 'Um servidor web caseiro. Leia as respostas dele para descobrir por onde entrar.',
    hardware: { kind: 'workstation', tier: 2 },
  },
  {
    id: 'uni', name: 'Laboratório da Universidade', ip: '198.51.100.20', x: 720, y: 430,
    minigame: 'subnet', difficulty: 2, links: ['museum', 'resolver', 'corp-fw'],
    requires: { lesson: 'ip-addressing', ramGB: 16, cpuPower: 10 }, reward: 350,
    flavor: 'Dezenas de sub-redes nos laboratórios. Faça as contas certas para passar por elas.',
    hardware: { kind: 'distribution-switch', tier: 2 },
  },
  {
    id: 'shop', name: 'Loja Virtual', ip: '203.0.113.200', x: 940, y: 180,
    minigame: 'http', difficulty: 2, links: ['blog', 'corp-fw'],
    requires: { lesson: 'http', cpuPower: 12, linkMbps: 1000 }, reward: 450,
    flavor: 'Uma loja virtual sempre lotada. Sem um link rápido, você não acompanha as respostas dela.',
    hardware: { kind: 'server', tier: 2 },
  },
  {
    id: 'corp-fw', name: 'Firewall da MegaCorp', ip: '192.0.2.1', x: 950, y: 420,
    minigame: 'ports', difficulty: 2, links: ['uni', 'shop', 'mail', 'core'],
    requires: { lesson: 'ports', cpuPower: 12, ramGB: 16, linkMbps: 1000 }, reward: 600,
    flavor: 'Cheio de regras. Você precisa saber qual serviço usa cada porta.',
    hardware: { kind: 'edge-router', tier: 2 },
  },
  {
    id: 'mail', name: 'E-mail da MegaCorp', ip: '192.0.2.25', x: 1000, y: 620,
    minigame: 'dns', difficulty: 3, links: ['corp-fw'],
    requires: { lesson: 'dns', cpuPower: 30, ramGB: 32 }, reward: 700,
    flavor: 'Para o e-mail chegar ao destino, o DNS precisa estar certo. Domine todos os tipos de registro.',
    hardware: { kind: 'server', tier: 2 },
  },
  {
    id: 'core', name: 'Núcleo do Data Center', ip: '192.0.2.254', x: 1170, y: 330,
    minigame: 'ports', difficulty: 3, links: ['corp-fw'],
    requires: { lesson: 'ports', cpuPower: 70, ramGB: 64, storageGB: 1000, linkMbps: 10000 }, reward: 2000,
    flavor: 'O coração da rede. Só uma máquina de ponta dá conta.',
    hardware: { kind: 'datacenter', tier: 3 },
  },
];

const NODE_INDEX = new Map(NODES.map((n) => [n.id, n]));

export function getNode(id: string): NetNode {
  const node = NODE_INDEX.get(id);
  if (!node) throw new Error(`Unknown node: ${id}`);
  return node;
}
