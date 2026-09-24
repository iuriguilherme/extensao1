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
  motherboard: 'Motherboard',
  cpu: 'CPU',
  ram: 'RAM',
  storage: 'Storage',
  psu: 'Power Supply',
  nic: 'Network Card',
  router: 'Router',
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
    id: 'mb_b1', name: 'Basic Board B1', slot: 'motherboard', price: 80, draw: 20,
    requiresLesson: 'computer-basics',
    description: 'Entry board. Socket S1 CPUs, DDR4 memory. Every other part plugs into it.',
    stats: { socket: 'S1', ramType: 'DDR4' },
  },
  {
    id: 'mb_x5', name: 'ProBoard X5', slot: 'motherboard', price: 240, draw: 30,
    requiresLesson: 'cpu',
    description: 'Modern board. Socket S2 CPUs, DDR5 memory. Needed for high-end CPUs and RAM.',
    stats: { socket: 'S2', ramType: 'DDR5' },
  },

  // CPUs
  {
    id: 'cpu_s1_2c', name: 'Duo 2.4 GHz', slot: 'cpu', price: 90, draw: 45,
    requiresLesson: 'cpu',
    description: '2 cores at 2.4 GHz. Socket S1. Slow, but it runs.',
    stats: { socket: 'S1', cores: 2, ghz: 2.4 },
  },
  {
    id: 'cpu_s1_4c', name: 'Quad 3.2 GHz', slot: 'cpu', price: 180, draw: 95,
    requiresLesson: 'cpu',
    description: '4 cores at 3.2 GHz. Socket S1. More cores = more work in parallel.',
    stats: { socket: 'S1', cores: 4, ghz: 3.2 },
  },
  {
    id: 'cpu_s2_8c', name: 'Octa 4.0 GHz', slot: 'cpu', price: 420, draw: 150,
    requiresLesson: 'cpu',
    description: '8 cores at 4.0 GHz. Socket S2 — will not fit an S1 board.',
    stats: { socket: 'S2', cores: 8, ghz: 4.0 },
  },
  {
    id: 'cpu_s2_16c', name: 'Hexadeca 4.8 GHz', slot: 'cpu', price: 900, draw: 280,
    requiresLesson: 'cpu',
    description: '16 cores at 4.8 GHz. Socket S2. Hungry for power: check your PSU.',
    stats: { socket: 'S2', cores: 16, ghz: 4.8 },
  },

  // RAM
  {
    id: 'ram_4_ddr4', name: '4 GB DDR4', slot: 'ram', price: 30, draw: 3,
    requiresLesson: 'memory',
    description: '4 GB of DDR4. Enough to boot, not much more.',
    stats: { ramType: 'DDR4', gb: 4 },
  },
  {
    id: 'ram_16_ddr4', name: '16 GB DDR4', slot: 'ram', price: 90, draw: 5,
    requiresLesson: 'memory',
    description: '16 GB of DDR4. Room for many programs at once.',
    stats: { ramType: 'DDR4', gb: 16 },
  },
  {
    id: 'ram_32_ddr5', name: '32 GB DDR5', slot: 'ram', price: 210, draw: 6,
    requiresLesson: 'memory',
    description: '32 GB of faster DDR5. DDR5 does not fit DDR4 slots.',
    stats: { ramType: 'DDR5', gb: 32 },
  },
  {
    id: 'ram_64_ddr5', name: '64 GB DDR5', slot: 'ram', price: 420, draw: 8,
    requiresLesson: 'memory',
    description: '64 GB of DDR5. Workstation territory.',
    stats: { ramType: 'DDR5', gb: 64 },
  },

  // Storage
  {
    id: 'hdd_500', name: '500 GB HDD', slot: 'storage', price: 40, draw: 8,
    requiresLesson: 'storage',
    description: 'Spinning magnetic disk. Cheap per GB, but ~120 MB/s and moving parts.',
    stats: { storageKind: 'HDD', gb: 500, readMBs: 120 },
  },
  {
    id: 'ssd_512', name: '512 GB SATA SSD', slot: 'storage', price: 70, draw: 4,
    requiresLesson: 'storage',
    description: 'Flash memory over SATA. No moving parts, ~550 MB/s.',
    stats: { storageKind: 'SATA SSD', gb: 512, readMBs: 550 },
  },
  {
    id: 'nvme_2tb', name: '2 TB NVMe SSD', slot: 'storage', price: 160, draw: 6,
    requiresLesson: 'storage',
    description: 'Flash memory directly on PCIe lanes. ~3500 MB/s.',
    stats: { storageKind: 'NVMe SSD', gb: 2000, readMBs: 3500 },
  },

  // PSUs
  {
    id: 'psu_250', name: '250 W PSU', slot: 'psu', price: 35, draw: 0,
    requiresLesson: 'power',
    description: 'Converts wall AC into the DC voltages parts need. Max 250 W.',
    stats: { watts: 250 },
  },
  {
    id: 'psu_450', name: '450 W PSU', slot: 'psu', price: 70, draw: 0,
    requiresLesson: 'power',
    description: 'Max 450 W. Leaves headroom for a mid-range build.',
    stats: { watts: 450 },
  },
  {
    id: 'psu_750', name: '750 W PSU', slot: 'psu', price: 140, draw: 0,
    requiresLesson: 'power',
    description: 'Max 750 W. For power-hungry CPUs.',
    stats: { watts: 750 },
  },

  // NICs
  {
    id: 'nic_100', name: 'Fast Ethernet NIC', slot: 'nic', price: 15, draw: 2,
    requiresLesson: 'network-basics',
    description: 'Network Interface Card, 100 Mbps. Gives your PC a MAC address and an Ethernet port.',
    stats: { mbps: 100 },
  },
  {
    id: 'nic_1g', name: 'Gigabit NIC', slot: 'nic', price: 40, draw: 3,
    requiresLesson: 'network-basics',
    description: 'Network Interface Card, 1000 Mbps (1 Gbps).',
    stats: { mbps: 1000 },
  },
  {
    id: 'nic_10g', name: '10 Gigabit NIC', slot: 'nic', price: 180, draw: 8,
    requiresLesson: 'network-basics',
    description: 'Network Interface Card, 10 Gbps. Data-center class.',
    stats: { mbps: 10000 },
  },

  // Routers
  {
    id: 'router_home', name: 'Home Router', slot: 'router', price: 50, draw: 0,
    requiresLesson: 'network-basics',
    description: 'Connects your LAN to your ISP (the WAN). 100 Mbps ports.',
    stats: { mbps: 100 },
  },
  {
    id: 'router_gig', name: 'Gigabit Router', slot: 'router', price: 130, draw: 0,
    requiresLesson: 'network-basics',
    description: 'Gigabit ports. A link is only as fast as its slowest end.',
    stats: { mbps: 1000 },
  },
  {
    id: 'router_10g', name: 'Fiber Edge Router', slot: 'router', price: 600, draw: 0,
    requiresLesson: 'network-basics',
    description: '10 Gbps fiber uplink. Serious bandwidth.',
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
    case 'cpu': return `${s.cores} cores @ ${s.ghz} GHz · Socket ${s.socket} · ${part.draw} W`;
    case 'ram': return `${s.gb} GB ${s.ramType}`;
    case 'storage': return `${s.gb} GB ${s.storageKind} · ${s.readMBs} MB/s`;
    case 'psu': return `${s.watts} W capacity`;
    case 'nic':
    case 'router': return `${formatMbps(s.mbps ?? 0)}`;
  }
}

export function formatMbps(mbps: number): string {
  return mbps >= 1000 ? `${mbps / 1000} Gbps` : `${mbps} Mbps`;
}
