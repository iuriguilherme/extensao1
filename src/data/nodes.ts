/**
 * Machines on the network map. Each node belongs to a knowledge area; to
 * connect to it the player plays that area's mini-game. Nodes open up as their
 * neighbors are breached, so the map is explored outward from HOME.
 */

export type MinigameId = 'binary' | 'subnet' | 'ports' | 'http' | 'dns';

export const MINIGAME_AREAS: Record<MinigameId, string> = {
  binary: 'Dados e binário',
  subnet: 'Endereçamento IP',
  ports: 'Portas e firewalls',
  http: 'Web / HTTP',
  dns: 'DNS',
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
  /** 1 (easy) – 3 (hard). Affects rounds and question variety. */
  difficulty: 1 | 2 | 3;
  links: string[];
  requires: NodeRequirements;
  reward: number;
  flavor: string;
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
    flavor: 'O roteador de borda do seu provedor. Mapeie as sub-redes dele para achar uma passagem.',
  },
  {
    id: 'museum', name: 'Acervo do Museu do Computador', ip: '198.51.100.8', x: 470, y: 560,
    minigame: 'binary', difficulty: 1, links: ['isp', 'uni'],
    requires: { lesson: 'binary', ramGB: 4 }, reward: 150,
    flavor: 'Máquinas antigas, dados mais antigos ainda. Tudo aqui é despejo binário puro.',
  },
  {
    id: 'resolver', name: 'Resolvedor DNS Público', ip: '203.0.113.53', x: 520, y: 220,
    minigame: 'dns', difficulty: 1, links: ['isp', 'blog', 'uni'],
    requires: { lesson: 'dns' }, reward: 180,
    flavor: 'Responde "onde fica X?" para milhões. Fale a língua dos registros DNS.',
  },
  {
    id: 'blog', name: 'Servidor do Bloguinho', ip: '203.0.113.80', x: 730, y: 120,
    minigame: 'http', difficulty: 1, links: ['resolver', 'shop'],
    requires: { lesson: 'http', cpuPower: 4 }, reward: 220,
    flavor: 'Um servidor web de hobby. Leia as respostas dele para achar a entrada.',
  },
  {
    id: 'uni', name: 'Laboratório da Universidade', ip: '198.51.100.20', x: 720, y: 430,
    minigame: 'subnet', difficulty: 2, links: ['museum', 'resolver', 'corp-fw'],
    requires: { lesson: 'ip-addressing', ramGB: 16, cpuPower: 10 }, reward: 350,
    flavor: 'Dezenas de sub-redes de laboratório. Calcule seu caminho por elas.',
  },
  {
    id: 'shop', name: 'Loja Virtual', ip: '203.0.113.200', x: 940, y: 180,
    minigame: 'http', difficulty: 2, links: ['blog', 'corp-fw'],
    requires: { lesson: 'http', cpuPower: 12, linkMbps: 1000 }, reward: 450,
    flavor: 'Aplicação web movimentada. Precisa de um link rápido para acompanhar a API.',
  },
  {
    id: 'corp-fw', name: 'Firewall da MegaCorp', ip: '192.0.2.1', x: 950, y: 420,
    minigame: 'ports', difficulty: 2, links: ['uni', 'shop', 'mail', 'core'],
    requires: { lesson: 'ports', cpuPower: 12, ramGB: 16, linkMbps: 1000 }, reward: 600,
    flavor: 'Regras por todo lado. Saiba qual serviço mora em qual porta.',
  },
  {
    id: 'mail', name: 'E-mail da MegaCorp', ip: '192.0.2.25', x: 1000, y: 620,
    minigame: 'dns', difficulty: 3, links: ['corp-fw'],
    requires: { lesson: 'dns', cpuPower: 30, ramGB: 32 }, reward: 700,
    flavor: 'A entrega de e-mail depende do DNS. Domine todos os tipos de registro.',
  },
  {
    id: 'core', name: 'Núcleo do Data Center', ip: '192.0.2.254', x: 1170, y: 330,
    minigame: 'ports', difficulty: 3, links: ['corp-fw'],
    requires: { lesson: 'ports', cpuPower: 70, ramGB: 64, storageGB: 1000, linkMbps: 10000 }, reward: 2000,
    flavor: 'O coração da rede. Só uma máquina de ponta dá conta.',
  },
];

const NODE_INDEX = new Map(NODES.map((n) => [n.id, n]));

export function getNode(id: string): NetNode {
  const node = NODE_INDEX.get(id);
  if (!node) throw new Error(`Unknown node: ${id}`);
  return node;
}
