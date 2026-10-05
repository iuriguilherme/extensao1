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
    description: 'Placa simples, para começar. Aceita processador socket S1 e memória DDR4. Todas as outras peças são encaixadas nela.',
    stats: { socket: 'S1', ramType: 'DDR4' },
  },
  {
    id: 'mb_x5', name: 'Placa-mãe ProBoard X5', slot: 'motherboard', gender: 'f', price: 240, draw: 30,
    requiresLesson: 'cpu',
    description: 'Placa moderna: aceita processador socket S2 e memória DDR5. É obrigatória para os processadores e memórias mais potentes.',
    stats: { socket: 'S2', ramType: 'DDR5' },
  },

  // CPUs
  {
    id: 'cpu_s1_2c', name: 'Processador Duo 2,4 GHz', slot: 'cpu', gender: 'm', price: 90, draw: 45,
    requiresLesson: 'cpu',
    description: '2 núcleos de 2,4 GHz, socket S1. É fraquinho, mas roda.',
    stats: { socket: 'S1', cores: 2, ghz: 2.4 },
  },
  {
    id: 'cpu_s1_4c', name: 'Processador Quad 3,2 GHz', slot: 'cpu', gender: 'm', price: 180, draw: 95,
    requiresLesson: 'cpu',
    description: '4 núcleos de 3,2 GHz, socket S1. Com mais núcleos, ele faz mais tarefas ao mesmo tempo.',
    stats: { socket: 'S1', cores: 4, ghz: 3.2 },
  },
  {
    id: 'cpu_s2_8c', name: 'Processador Octa 4 GHz', slot: 'cpu', gender: 'm', price: 420, draw: 150,
    requiresLesson: 'cpu',
    description: '8 núcleos de 4 GHz, socket S2: não encaixa em placa-mãe S1.',
    stats: { socket: 'S2', cores: 8, ghz: 4.0 },
  },
  {
    id: 'cpu_s2_16c', name: 'Processador Hexadeca 4,8 GHz', slot: 'cpu', gender: 'm', price: 900, draw: 280,
    requiresLesson: 'cpu',
    description: '16 núcleos de 4,8 GHz, socket S2. Gasta muita energia: veja se a sua fonte aguenta.',
    stats: { socket: 'S2', cores: 16, ghz: 4.8 },
  },

  // RAM
  {
    id: 'ram_4_ddr4', name: 'Memória 4 GB DDR4', slot: 'ram', gender: 'f', price: 30, draw: 3,
    requiresLesson: 'memory',
    description: '4 GB de DDR4. Dá para dar boot, e só.',
    stats: { ramType: 'DDR4', gb: 4 },
  },
  {
    id: 'ram_16_ddr4', name: 'Memória 16 GB DDR4', slot: 'ram', gender: 'f', price: 90, draw: 5,
    requiresLesson: 'memory',
    description: '16 GB de DDR4. Dá para rodar vários programas ao mesmo tempo.',
    stats: { ramType: 'DDR4', gb: 16 },
  },
  {
    id: 'ram_32_ddr5', name: 'Memória 32 GB DDR5', slot: 'ram', gender: 'f', price: 210, draw: 6,
    requiresLesson: 'memory',
    description: '32 GB de DDR5, que é mais rápida. Não encaixa em slot DDR4.',
    stats: { ramType: 'DDR5', gb: 32 },
  },
  {
    id: 'ram_64_ddr5', name: 'Memória 64 GB DDR5', slot: 'ram', gender: 'f', price: 420, draw: 8,
    requiresLesson: 'memory',
    description: '64 GB de DDR5. Memória de máquina profissional.',
    stats: { ramType: 'DDR5', gb: 64 },
  },

  // Storage
  {
    id: 'hdd_500', name: 'HD 500 GB', slot: 'storage', gender: 'm', price: 40, draw: 8,
    requiresLesson: 'storage',
    description: 'Disco magnético giratório. Cada GB sai barato, mas ele lê só ~120 MB/s e tem peças móveis.',
    stats: { storageKind: 'HDD', gb: 500, readMBs: 120 },
  },
  {
    id: 'ssd_512', name: 'SSD SATA 512 GB', slot: 'storage', gender: 'm', price: 70, draw: 4,
    requiresLesson: 'storage',
    description: 'Memória flash ligada pelo SATA. Não tem peças móveis e lê ~550 MB/s.',
    stats: { storageKind: 'SATA SSD', gb: 512, readMBs: 550 },
  },
  {
    id: 'nvme_2tb', name: 'SSD NVMe 2 TB', slot: 'storage', gender: 'm', price: 160, draw: 6,
    requiresLesson: 'storage',
    description: 'Memória flash ligada direto no PCIe. Lê ~3500 MB/s.',
    stats: { storageKind: 'NVMe SSD', gb: 2000, readMBs: 3500 },
  },

  // PSUs
  {
    id: 'psu_250', name: 'Fonte 250 W', slot: 'psu', gender: 'f', price: 35, draw: 0,
    requiresLesson: 'power',
    description: 'Transforma a corrente AC da tomada na corrente DC que as peças usam. Até 250 W.',
    stats: { watts: 250 },
  },
  {
    id: 'psu_450', name: 'Fonte 450 W', slot: 'psu', gender: 'f', price: 70, draw: 0,
    requiresLesson: 'power',
    description: 'Até 450 W. Aguenta com folga um PC intermediário.',
    stats: { watts: 450 },
  },
  {
    id: 'psu_750', name: 'Fonte 750 W', slot: 'psu', gender: 'f', price: 140, draw: 0,
    requiresLesson: 'power',
    description: 'Até 750 W. Para processadores que gastam muita energia.',
    stats: { watts: 750 },
  },

  // NICs
  {
    id: 'nic_100', name: 'Placa de rede Fast Ethernet', slot: 'nic', gender: 'f', price: 15, draw: 2,
    requiresLesson: 'network-basics',
    description: 'Placa de rede de 100 Mbps. Com ela, o PC ganha um endereço MAC e uma porta Ethernet.',
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
    description: 'Placa de rede de 10 Gbps. Coisa de data center.',
    stats: { mbps: 10000 },
  },

  // Routers
  {
    id: 'router_home', name: 'Roteador Doméstico', slot: 'router', gender: 'm', price: 50, draw: 0,
    requiresLesson: 'network-basics',
    description: 'Conecta a sua rede local (LAN) à internet do provedor (WAN). Portas de 100 Mbps.',
    stats: { mbps: 100 },
  },
  {
    id: 'router_gig', name: 'Roteador Gigabit', slot: 'router', gender: 'm', price: 130, draw: 0,
    requiresLesson: 'network-basics',
    description: 'Portas Gigabit. Mas a conexão nunca passa da velocidade do equipamento mais lento do caminho.',
    stats: { mbps: 1000 },
  },
  {
    id: 'router_10g', name: 'Roteador de Borda de Fibra', slot: 'router', gender: 'm', price: 600, draw: 0,
    requiresLesson: 'network-basics',
    description: 'Uplink de fibra de 10 Gbps. Isso sim é largura de banda.',
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
    case 'cpu': return `${plural(s.cores ?? 0, 'núcleo', 'núcleos')} de ${decimal(s.ghz ?? 0)} GHz · Socket ${s.socket} · ${part.draw} W`;
    case 'ram': return `${s.gb} GB ${s.ramType}`;
    case 'storage': return `${s.gb} GB ${s.storageKind} · ${s.readMBs} MB/s`;
    case 'psu': return `fornece até ${s.watts} W`;
    case 'nic':
    case 'router': return linkSpeed(s.mbps ?? 0);
  }
}
