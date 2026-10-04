import { decimal, linkSpeed, plural, type Gender } from '../core/fmt';

/**
 * Hardware catalog.
 *
 * Every part is gated behind a lesson: the player must study what a part does
 * before the shop will sell it. Descriptions are written to teach, not just to
 * sell. Brand names are fictional on purpose.
 */

export type Slot = 'motherboard' | 'cpu' | 'ram' | 'storage' | 'psu' | 'nic' | 'router';

export const SLOTS: Slot[] = ['motherboard', 'cpu', 'ram', 'storage', 'psu', 'nic', 'router'];

export const SLOT_LABELS: Record<Slot, string> = {
  motherboard: 'Placa-mãe',
  cpu: 'Processador',
  ram: 'Memória RAM',
  storage: 'Armazenamento',
  psu: 'Fonte',
  nic: 'Placa de rede',
  router: 'Roteador',
};

/** Grammatical gender of each slot's PT-BR label, for agreeing messages. */
export const SLOT_GENDER: Record<Slot, Gender> = {
  motherboard: 'f', // placa-mãe
  cpu: 'm', // processador
  ram: 'f', // memória
  storage: 'm', // armazenamento
  psu: 'f', // fonte
  nic: 'f', // placa de rede
  router: 'm', // roteador
};

export type Socket = 'S1' | 'S2';
export type RamType = 'DDR4' | 'DDR5';

export interface PartStats {
  /** Motherboard + CPU: physical CPU socket. They must match. */
  socket?: Socket;
  /** Motherboard + RAM: memory generation. They must match. */
  ramType?: RamType;
  /** CPU */
  cores?: number;
  ghz?: number;
  /** RAM / storage capacity */
  gb?: number;
  /** Storage */
  storageKind?: 'HDD' | 'SATA SSD' | 'NVMe SSD';
  readMBs?: number;
  /** PSU capacity */
  watts?: number;
  /** NIC / router link speed */
  mbps?: number;
}

export interface Part {
  id: string;
  name: string;
  slot: Slot;
  /** Grammatical gender of the PT-BR name's head noun, for agreeing messages. */
  gender: Gender;
  price: number;
  /** Power the part draws from the PSU, in watts. Routers are powered separately. */
  draw: number;
  requiresLesson: string;
  description: string;
  stats: PartStats;
}

export const PARTS: Part[] = [
  // Motherboards
  {
    id: 'mb_b1', name: 'Placa-mãe Básica B1', slot: 'motherboard', gender: 'f', price: 80, draw: 20,
    requiresLesson: 'computer-basics',
    description: 'Placa de entrada. Processadores socket S1, memória DDR4. Todas as outras peças se conectam nela.',
    stats: { socket: 'S1', ramType: 'DDR4' },
  },
  {
    id: 'mb_x5', name: 'Placa-mãe ProBoard X5', slot: 'motherboard', gender: 'f', price: 240, draw: 30,
    requiresLesson: 'cpu',
    description: 'Placa moderna. Processadores socket S2, memória DDR5. Necessária para processadores e memórias de ponta.',
    stats: { socket: 'S2', ramType: 'DDR5' },
  },

  // CPUs
  {
    id: 'cpu_s1_2c', name: 'Processador Duo 2,4 GHz', slot: 'cpu', gender: 'm', price: 90, draw: 45,
    requiresLesson: 'cpu',
    description: '2 núcleos a 2,4 GHz. Socket S1. Lento, mas funciona.',
    stats: { socket: 'S1', cores: 2, ghz: 2.4 },
  },
  {
    id: 'cpu_s1_4c', name: 'Processador Quad 3,2 GHz', slot: 'cpu', gender: 'm', price: 180, draw: 95,
    requiresLesson: 'cpu',
    description: '4 núcleos a 3,2 GHz. Socket S1. Mais núcleos, mais trabalho em paralelo.',
    stats: { socket: 'S1', cores: 4, ghz: 3.2 },
  },
  {
    id: 'cpu_s2_8c', name: 'Processador Octa 4 GHz', slot: 'cpu', gender: 'm', price: 420, draw: 150,
    requiresLesson: 'cpu',
    description: '8 núcleos a 4 GHz. Socket S2: não encaixa em placa S1.',
    stats: { socket: 'S2', cores: 8, ghz: 4.0 },
  },
  {
    id: 'cpu_s2_16c', name: 'Processador Hexadeca 4,8 GHz', slot: 'cpu', gender: 'm', price: 900, draw: 280,
    requiresLesson: 'cpu',
    description: '16 núcleos a 4,8 GHz. Socket S2. Consome muita energia: confira sua fonte.',
    stats: { socket: 'S2', cores: 16, ghz: 4.8 },
  },

  // RAM
  {
    id: 'ram_4_ddr4', name: 'Memória 4 GB DDR4', slot: 'ram', gender: 'f', price: 30, draw: 3,
    requiresLesson: 'memory',
    description: '4 GB de DDR4. Suficiente para dar boot, e pouco mais.',
    stats: { ramType: 'DDR4', gb: 4 },
  },
  {
    id: 'ram_16_ddr4', name: 'Memória 16 GB DDR4', slot: 'ram', gender: 'f', price: 90, draw: 5,
    requiresLesson: 'memory',
    description: '16 GB de DDR4. Espaço para muitos programas ao mesmo tempo.',
    stats: { ramType: 'DDR4', gb: 16 },
  },
  {
    id: 'ram_32_ddr5', name: 'Memória 32 GB DDR5', slot: 'ram', gender: 'f', price: 210, draw: 6,
    requiresLesson: 'memory',
    description: '32 GB de DDR5, mais rápida. DDR5 não encaixa em slots DDR4.',
    stats: { ramType: 'DDR5', gb: 32 },
  },
  {
    id: 'ram_64_ddr5', name: 'Memória 64 GB DDR5', slot: 'ram', gender: 'f', price: 420, draw: 8,
    requiresLesson: 'memory',
    description: '64 GB de DDR5. Nível de estação de trabalho.',
    stats: { ramType: 'DDR5', gb: 64 },
  },

  // Storage
  {
    id: 'hdd_500', name: 'HD 500 GB', slot: 'storage', gender: 'm', price: 40, draw: 8,
    requiresLesson: 'storage',
    description: 'Disco magnético que gira. Barato por GB, mas ~120 MB/s e com partes móveis.',
    stats: { storageKind: 'HDD', gb: 500, readMBs: 120 },
  },
  {
    id: 'ssd_512', name: 'SSD SATA 512 GB', slot: 'storage', gender: 'm', price: 70, draw: 4,
    requiresLesson: 'storage',
    description: 'Memória flash via SATA. Sem partes móveis, ~550 MB/s.',
    stats: { storageKind: 'SATA SSD', gb: 512, readMBs: 550 },
  },
  {
    id: 'nvme_2tb', name: 'SSD NVMe 2 TB', slot: 'storage', gender: 'm', price: 160, draw: 6,
    requiresLesson: 'storage',
    description: 'Memória flash direto nas linhas PCIe. ~3500 MB/s.',
    stats: { storageKind: 'NVMe SSD', gb: 2000, readMBs: 3500 },
  },

  // PSUs
  {
    id: 'psu_250', name: 'Fonte 250 W', slot: 'psu', gender: 'f', price: 35, draw: 0,
    requiresLesson: 'power',
    description: 'Converte a corrente alternada da tomada nas tensões contínuas que as peças usam. Máx. 250 W.',
    stats: { watts: 250 },
  },
  {
    id: 'psu_450', name: 'Fonte 450 W', slot: 'psu', gender: 'f', price: 70, draw: 0,
    requiresLesson: 'power',
    description: 'Máx. 450 W. Dá folga para uma máquina intermediária.',
    stats: { watts: 450 },
  },
  {
    id: 'psu_750', name: 'Fonte 750 W', slot: 'psu', gender: 'f', price: 140, draw: 0,
    requiresLesson: 'power',
    description: 'Máx. 750 W. Para processadores que consomem muito.',
    stats: { watts: 750 },
  },

  // NICs
  {
    id: 'nic_100', name: 'Placa de rede Fast Ethernet', slot: 'nic', gender: 'f', price: 15, draw: 2,
    requiresLesson: 'network-basics',
    description: 'Placa de rede de 100 Mbps. Dá ao seu PC um endereço MAC e uma porta Ethernet.',
    stats: { mbps: 100 },
  },
  {
    id: 'nic_1g', name: 'Placa de rede Gigabit', slot: 'nic', gender: 'f', price: 40, draw: 3,
    requiresLesson: 'network-basics',
    description: 'Placa de rede de 1000 Mbps (1 Gbps).',
    stats: { mbps: 1000 },
  },
  {
    id: 'nic_10g', name: 'Placa de rede 10 Gigabit', slot: 'nic', gender: 'f', price: 180, draw: 8,
    requiresLesson: 'network-basics',
    description: 'Placa de rede de 10 Gbps. Nível de data center.',
    stats: { mbps: 10000 },
  },

  // Routers
  {
    id: 'router_home', name: 'Roteador Doméstico', slot: 'router', gender: 'm', price: 50, draw: 0,
    requiresLesson: 'network-basics',
    description: 'Liga sua LAN ao provedor (a WAN). Portas de 100 Mbps.',
    stats: { mbps: 100 },
  },
  {
    id: 'router_gig', name: 'Roteador Gigabit', slot: 'router', gender: 'm', price: 130, draw: 0,
    requiresLesson: 'network-basics',
    description: 'Portas Gigabit. Um link só é tão rápido quanto sua ponta mais lenta.',
    stats: { mbps: 1000 },
  },
  {
    id: 'router_10g', name: 'Roteador de Borda Fibra', slot: 'router', gender: 'm', price: 600, draw: 0,
    requiresLesson: 'network-basics',
    description: 'Uplink de fibra de 10 Gbps. Largura de banda de verdade.',
    stats: { mbps: 10000 },
  },
];

const PART_INDEX = new Map(PARTS.map((p) => [p.id, p]));

export function getPart(id: string): Part {
  const part = PART_INDEX.get(id);
  if (!part) throw new Error(`Unknown part: ${id}`);
  return part;
}

export function describeStats(part: Part): string {
  const s = part.stats;
  switch (part.slot) {
    case 'motherboard': return `Socket ${s.socket} · ${s.ramType}`;
    case 'cpu': return `${plural(s.cores ?? 0, 'núcleo', 'núcleos')} @ ${decimal(s.ghz ?? 0)} GHz · Socket ${s.socket} · ${part.draw} W`;
    case 'ram': return `${s.gb} GB ${s.ramType}`;
    case 'storage': return `${s.gb} GB ${s.storageKind} · ${s.readMBs} MB/s`;
    case 'psu': return `capacidade de ${s.watts} W`;
    case 'nic':
    case 'router': return linkSpeed(s.mbps ?? 0);
  }
}
