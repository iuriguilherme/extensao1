/**
 * Glossário do jogo: o termo único que todo texto usa para cada conceito.
 *
 * Regra (uso de TI no Brasil): traduzimos o que profissionais brasileiros
 * traduzem (roteador, placa de rede) e mantemos em inglês o que eles falam em
 * inglês (switch, firewall, DNS). Todo texto novo — swarm, mineração, aulas —
 * segue esta lista. Notação técnica (IPs, máscaras, CIDR, binário, portas,
 * códigos HTTP, registros DNS) nunca é traduzida.
 */

import type { Gender } from '../core/fmt';

export interface Termo {
  /** O conceito, como aparece no código/inglês. */
  conceito: string;
  /** A palavra que o jogador lê. */
  termo: string;
  genero: Gender;
  /** true quando o termo fica em inglês por ser assim no mercado brasileiro. */
  mantido: boolean;
  nota?: string;
}

export const TERMOS: Termo[] = [
  // ─── Hardware ───────────────────────────────────────────────────────────
  { conceito: 'computer', termo: 'computador', genero: 'm', mantido: false },
  { conceito: 'PC', termo: 'PC', genero: 'm', mantido: true },
  { conceito: 'motherboard', termo: 'placa-mãe', genero: 'f', mantido: false },
  { conceito: 'CPU', termo: 'processador', genero: 'm', mantido: false, nota: '"CPU" continua aceito como sigla em estatísticas.' },
  { conceito: 'core', termo: 'núcleo', genero: 'm', mantido: false },
  { conceito: 'socket', termo: 'socket', genero: 'm', mantido: true },
  { conceito: 'RAM', termo: 'memória RAM', genero: 'f', mantido: false, nota: 'Rótulo curto: "RAM".' },
  { conceito: 'storage', termo: 'armazenamento', genero: 'm', mantido: false },
  { conceito: 'hard drive', termo: 'HD', genero: 'm', mantido: true },
  { conceito: 'SSD', termo: 'SSD', genero: 'm', mantido: true },
  { conceito: 'power supply / PSU', termo: 'fonte de alimentação', genero: 'f', mantido: false, nota: 'Rótulo curto: "fonte".' },
  { conceito: 'network card / NIC', termo: 'placa de rede', genero: 'f', mantido: false },
  { conceito: 'router', termo: 'roteador', genero: 'm', mantido: false },
  { conceito: 'switch', termo: 'switch', genero: 'm', mantido: true },
  { conceito: 'power draw', termo: 'consumo', genero: 'm', mantido: false },
  { conceito: 'AC (alternating current)', termo: 'AC', genero: 'f', mantido: true, nota: '"corrente AC"; na primeira menção, "corrente alternada (AC)".' },
  { conceito: 'DC (direct current)', termo: 'DC', genero: 'f', mantido: true, nota: '"corrente DC"; na primeira menção, "corrente contínua (DC)".' },
  { conceito: 'boot', termo: 'boot', genero: 'm', mantido: true, nota: '"O PC não dá boot."' },

  // ─── Redes ──────────────────────────────────────────────────────────────
  { conceito: 'network', termo: 'rede', genero: 'f', mantido: false },
  { conceito: 'subnet', termo: 'sub-rede', genero: 'f', mantido: false },
  { conceito: 'subnet mask', termo: 'máscara de sub-rede', genero: 'f', mantido: false },
  { conceito: 'IP address', termo: 'endereço IP', genero: 'm', mantido: false },
  { conceito: 'network address', termo: 'endereço de rede', genero: 'm', mantido: false },
  { conceito: 'broadcast address', termo: 'endereço de broadcast', genero: 'm', mantido: false },
  { conceito: 'gateway', termo: 'gateway', genero: 'm', mantido: true },
  { conceito: 'host', termo: 'host', genero: 'm', mantido: true },
  { conceito: 'link', termo: 'link', genero: 'm', mantido: true },
  { conceito: 'bandwidth', termo: 'largura de banda', genero: 'f', mantido: false },
  { conceito: 'port', termo: 'porta', genero: 'f', mantido: false },
  { conceito: 'firewall', termo: 'firewall', genero: 'm', mantido: true },
  { conceito: 'server', termo: 'servidor', genero: 'm', mantido: false },
  { conceito: 'name server', termo: 'servidor de nomes', genero: 'm', mantido: false },
  { conceito: 'DNS record', termo: 'registro DNS', genero: 'm', mantido: false },
  { conceito: 'ISP', termo: 'provedor', genero: 'm', mantido: false },
  { conceito: 'email', termo: 'e-mail', genero: 'm', mantido: false },
  { conceito: 'uplink', termo: 'uplink', genero: 'm', mantido: true, nota: 'O link que leva o tráfego de um switch para o resto da rede.' },
  { conceito: 'NOC (network operations center)', termo: 'NOC', genero: 'm', mantido: true, nota: 'Na primeira menção, "NOC (centro de operações de rede)".' },
  { conceito: 'swarm', termo: 'swarm', genero: 'm', mantido: true, nota: 'Os nós invadidos que estão conectados e somam poder ao seu PC. Fica em inglês: "enxame" não é o termo usado na área.' },

  // ─── Jogo ───────────────────────────────────────────────────────────────
  { conceito: 'lesson', termo: 'aula', genero: 'f', mantido: false },
  { conceito: 'quiz', termo: 'quiz', genero: 'm', mantido: true },
  { conceito: 'shop', termo: 'loja', genero: 'f', mantido: false },
  { conceito: 'workbench', termo: 'bancada', genero: 'f', mantido: false },
  { conceito: 'inventory', termo: 'inventário', genero: 'm', mantido: false },
  { conceito: 'node', termo: 'nó', genero: 'm', mantido: false },
  { conceito: 'breach', termo: 'invadir / invasão', genero: 'f', mantido: false },
  { conceito: 'intrusion step', termo: 'etapa da invasão', genero: 'f', mantido: false },
  { conceito: 'mistake', termo: 'erro', genero: 'm', mantido: false },
  { conceito: 'side job', termo: 'trabalho extra', genero: 'm', mantido: false },
  { conceito: 'reward', termo: 'recompensa', genero: 'f', mantido: false },
  { conceito: 'save / progress', termo: 'progresso', genero: 'm', mantido: false },
  { conceito: 'rootkit', termo: 'rootkit', genero: 'm', mantido: true },
];

/**
 * Palavras e siglas em inglês permitidas no texto do jogador: termos mantidos,
 * protocolos e unidades. As frases de status HTTP ("404 Not Found") também
 * ficam em inglês, mas a varredura (tests/content.test.ts) as aceita como frase
 * inteira, lida de STATUSES, para que "Not" ou "No" soltos ainda sejam pegos.
 */
export const INGLES_PERMITIDO: string[] = [
  ...TERMOS.filter((t) => t.mantido).map((t) => t.termo),
  'Rootkit', 'Academy', 'CPU', 'RAM', 'DDR4', 'DDR5', 'HDD', 'NVMe', 'SATA', 'PCIe', 'slot', 'flash', 'cache',
  'IP', 'IPv4', 'IPv6', 'TCP', 'UDP', 'ICMP', 'ARP', 'HTTP', 'HTTPS', 'SSH', 'FTP', 'SMTP', 'IMAP', 'POP3',
  'SNMP', 'NTP', 'DHCP', 'RDP', 'DNS', 'TLS', 'LAN', 'WAN', 'MAC', 'Ethernet', 'Gigabit', 'uplink', 'web',
  'MySQL', 'PostgreSQL', 'Telnet', 'URL', 'JSON', 'online', 'login', 'OK',
  'A', 'AAAA', 'CNAME', 'MX', 'NS', 'TXT', 'PTR', 'SOA', 'SRV',
  'GET', 'POST', 'PUT', 'DELETE', 'ALLOW', 'DENY', 'ALL', 'eth0', 'gw',
];
