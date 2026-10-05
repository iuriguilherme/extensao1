import { getPart, type Part, type Slot } from '../data/parts';

export type Installed = Partial<Record<Slot, string>>;

/** Stable problem codes: tests and logic check these, never the message wording. */
export type IssueCode = `missing-${Slot}` | 'socket-mismatch' | 'ram-mismatch' | 'psu-overload';

export interface Issue {
  slot: Slot | 'system';
  code: IssueCode;
  message: string;
}

export interface Specs {
  /** True when the machine can power on and load an operating system. */
  boots: boolean;
  /** True when the NIC and router are installed and compatible with a booting PC. */
  networkReady: boolean;
  issues: Issue[];
  cpuPower: number;
  ramGB: number;
  storageGB: number;
  linkMbps: number;
  powerDraw: number;
  psuWatts: number;
}

const BOOT_SLOTS: Slot[] = ['motherboard', 'cpu', 'ram', 'storage', 'psu'];

const MISSING_HINT: Record<Slot, string> = {
  motherboard: 'Sem placa-mãe: as outras peças não têm onde ser encaixadas.',
  cpu: 'Sem processador: não há quem execute os programas.',
  ram: 'Sem memória RAM: o processador não tem onde carregar o sistema operacional.',
  storage: 'Sem armazenamento: o sistema operacional não tem onde ficar guardado.',
  psu: 'Sem fonte: nenhuma peça recebe energia.',
  nic: 'Sem placa de rede: o PC não tem como se conectar a nenhuma rede.',
  router: 'Sem roteador: a sua rede local não tem saída para a internet.',
  switch: 'Sem switch: as portas do roteador são as únicas para ligar nós ao enxame.',
};

/**
 * Checks what is installed and derives the machine's specs, explaining every
 * problem in terms of the concept it teaches.
 */
export function computeSpecs(installed: Installed): Specs {
  const issues: Issue[] = [];
  const part = (slot: Slot): Part | undefined => {
    const id = installed[slot];
    return id ? getPart(id) : undefined;
  };

  const mb = part('motherboard');
  const cpu = part('cpu');
  const ram = part('ram');
  const storage = part('storage');
  const psu = part('psu');
  const nic = part('nic');
  const router = part('router');

  for (const slot of BOOT_SLOTS) {
    if (!installed[slot]) issues.push({ slot, code: `missing-${slot}`, message: MISSING_HINT[slot] });
  }

  if (mb && cpu && mb.stats.socket !== cpu.stats.socket) {
    issues.push({
      slot: 'cpu',
      code: 'socket-mismatch',
      message: `${cpu.name} é socket ${cpu.stats.socket}: não encaixa na ${mb.name}, que é socket ${mb.stats.socket}.`,
    });
  }
  if (mb && ram && mb.stats.ramType !== ram.stats.ramType) {
    issues.push({
      slot: 'ram',
      code: 'ram-mismatch',
      message: `${ram.name} é ${ram.stats.ramType}: não encaixa na ${mb.name}, que só aceita ${mb.stats.ramType}.`,
    });
  }

  const powerDraw = [mb, cpu, ram, storage, nic].reduce((sum, p) => sum + (p?.draw ?? 0), 0);
  const psuWatts = psu?.stats.watts ?? 0;
  if (psu && powerDraw > psuWatts) {
    issues.push({
      slot: 'psu',
      code: 'psu-overload',
      message: `As peças precisam de ${powerDraw} W, mas a fonte só aguenta ${psuWatts} W.`,
    });
  }

  const boots = issues.length === 0;

  if (!nic) issues.push({ slot: 'nic', code: 'missing-nic', message: MISSING_HINT.nic });
  if (!router) issues.push({ slot: 'router', code: 'missing-router', message: MISSING_HINT.router });
  const networkReady = boots && !!nic && !!router;

  const cores = cpu?.stats.cores ?? 0;
  const ghz = cpu?.stats.ghz ?? 0;

  return {
    boots,
    networkReady,
    issues,
    cpuPower: round1(cores * ghz),
    ramGB: ram?.stats.gb ?? 0,
    storageGB: storage?.stats.gb ?? 0,
    linkMbps: nic && router ? Math.min(nic.stats.mbps ?? 0, router.stats.mbps ?? 0) : 0,
    powerDraw,
    psuWatts,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * How hardware helps during intrusions:
 * - CPU power buys thinking time per round.
 * - RAM lets the intrusion survive more mistakes before crashing.
 */
export function roundSeconds(cpuPower: number): number {
  return Math.round(Math.min(30, Math.max(8, 8 + cpuPower * 0.25)));
}

export function mistakesAllowed(ramGB: number): number {
  if (ramGB >= 64) return 4;
  if (ramGB >= 32) return 3;
  if (ramGB >= 16) return 2;
  return 1;
}
