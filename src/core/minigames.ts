/**
 * Mini-game content generators. Each knowledge area produces a list of rounds
 * from a seeded RNG, so the scene only has to render and time them.
 *
 * Round kinds:
 * - choice: pick the right option.
 * - bits:   toggle binary switches until they add up to a target number.
 */

import type { MinigameId } from '../data/nodes';
import { broadcastAddress, formatIp, networkAddress, prefixToMask, usableHosts } from './ip';
import { pick, randInt, shuffle, type Rng } from './random';

export interface ChoiceRound {
  kind: 'choice';
  prompt: string;
  /** Optional monospace block shown under the prompt (zone file, packet…). */
  detail?: string;
  options: string[];
  answer: number;
  explain: string;
}

export interface BitsRound {
  kind: 'bits';
  prompt: string;
  bits: number;
  target: number;
  explain: string;
}

export type Round = ChoiceRound | BitsRound;
export type Difficulty = 1 | 2 | 3;

export function roundCount(difficulty: Difficulty): number {
  return [5, 7, 9][difficulty - 1];
}

export function buildRounds(id: MinigameId, difficulty: Difficulty, rng: Rng): Round[] {
  const generator = GENERATORS[id];
  const rounds: Round[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (rounds.length < roundCount(difficulty) && guard++ < 200) {
    const round = generator(rng, difficulty);
    const key = round.prompt + (round.kind === 'choice' ? round.detail ?? '' : round.target);
    if (seen.has(key)) continue;
    seen.add(key);
    rounds.push(round);
  }
  return rounds;
}

const GENERATORS: Record<MinigameId, (rng: Rng, d: Difficulty) => Round> = {
  binary: binaryRound,
  subnet: subnetRound,
  ports: portsRound,
  http: httpRound,
  dns: dnsRound,
};

/** Builds a choice round from a correct answer and distractor candidates. */
function choice(rng: Rng, prompt: string, correct: string, distractors: string[], explain: string, detail?: string): ChoiceRound {
  const wrong = shuffle(rng, [...new Set(distractors.filter((d) => d !== correct))]).slice(0, 3);
  const options = shuffle(rng, [correct, ...wrong]);
  return { kind: 'choice', prompt, detail, options, answer: options.indexOf(correct), explain };
}

export function toBinary(value: number, bits: number): string {
  return value.toString(2).padStart(bits, '0');
}

// ─── Binary ───────────────────────────────────────────────────────────────

function binaryRound(rng: Rng, d: Difficulty): Round {
  const bits = [4, 6, 8][d - 1];
  const max = 2 ** bits - 1;
  const type = randInt(rng, 0, d === 1 ? 1 : 2);

  if (type === 0) {
    const target = randInt(rng, 1, max);
    return {
      kind: 'bits',
      prompt: `Vire os bits para formar ${target}`,
      bits,
      target,
      explain: `${target} = ${toBinary(target, bits)} (${placeBreakdown(target, bits)})`,
    };
  }
  if (type === 1) {
    const value = randInt(rng, 1, max);
    const near = [value + 1, value - 1, value ^ 1, value ^ 2, value * 2, value >> 1, value + 8].filter((v) => v > 0 && v <= max * 2);
    return choice(
      rng,
      `Quanto é ${toBinary(value, bits)} em decimal?`,
      String(value),
      near.map(String),
      `${toBinary(value, bits)} = ${placeBreakdown(value, bits)} = ${value}`,
    );
  }
  const n = randInt(rng, 2, 16);
  return choice(
    rng,
    `Quantos valores diferentes ${n} bits conseguem representar?`,
    String(2 ** n),
    [String(2 ** n - 1), String(n * 2), String(2 ** (n + 1)), String(n ** 2), String(2 ** (n - 1))],
    `Cada bit dobra as possibilidades: 2^${n} = ${2 ** n}.`,
  );
}

function placeBreakdown(value: number, bits: number): string {
  const terms: number[] = [];
  for (let i = bits - 1; i >= 0; i--) if (value & (1 << i)) terms.push(1 << i);
  return terms.join(' + ');
}

// ─── Subnets ──────────────────────────────────────────────────────────────

function randomPrivateIp(rng: Rng): number {
  const block = randInt(rng, 0, 2);
  const [a, b] = block === 0 ? [10, randInt(rng, 0, 255)] : block === 1 ? [172, randInt(rng, 16, 31)] : [192, 168];
  return ((a << 24) | (b << 16) | (randInt(rng, 0, 255) << 8) | randInt(rng, 1, 254)) >>> 0;
}

function subnetRound(rng: Rng, d: Difficulty): Round {
  const prefixes = d === 1 ? [24] : d === 2 ? [16, 24, 25, 26] : [20, 22, 26, 27, 28];
  const prefix = pick(rng, prefixes);
  const ip = randomPrivateIp(rng);
  const type = randInt(rng, 0, d === 1 ? 1 : 3);
  const cidr = `${formatIp(ip)}/${prefix}`;
  const blockSize = 2 ** (32 - prefix);

  if (type === 0) {
    // Same-subnet question.
    const net = networkAddress(ip, prefix);
    const inside = (net + randInt(rng, 1, blockSize - 2)) >>> 0;
    const outside = [
      (net + blockSize + randInt(rng, 1, 20)) >>> 0,
      (net - randInt(rng, 1, 20)) >>> 0,
      (ip ^ (1 << (32 - prefix))) >>> 0,
      (ip ^ (1 << (33 - prefix))) >>> 0,
    ].filter((v) => networkAddress(v, prefix) !== net);
    return choice(
      rng,
      `Qual host está na mesma rede que ${cidr}?`,
      formatIp(inside),
      outside.map(formatIp),
      `${cidr} pertence à rede ${formatIp(net)}/${prefix} (${formatIp(net)} – ${formatIp(broadcastAddress(ip, prefix))}).`,
    );
  }
  if (type === 1) {
    const net = networkAddress(ip, prefix);
    return choice(
      rng,
      `Qual é o endereço de rede de ${cidr}?`,
      formatIp(net),
      [formatIp(ip), formatIp(broadcastAddress(ip, prefix)), formatIp((net + 1) >>> 0), formatIp(networkAddress(ip, prefix - 8 < 0 ? 0 : prefix - 8))],
      `Aplique a máscara de sub-rede ${formatIp(prefixToMask(prefix))}: mantenha os bits de rede e zere os bits de host → ${formatIp(net)}.`,
    );
  }
  if (type === 2) {
    const p = randInt(rng, 22, 30);
    const hosts = usableHosts(p);
    return choice(
      rng,
      `Quantos endereços de host utilizáveis existem em uma rede /${p}?`,
      String(hosts),
      [String(hosts + 2), String(hosts + 1), String(2 ** (32 - p - 1)), String(32 - p), String(hosts * 2)],
      `Uma rede /${p} deixa ${32 - p} bits de host: 2^${32 - p} = ${2 ** (32 - p)}, menos o endereço de rede e o endereço de broadcast = ${hosts}.`,
    );
  }
  const bcast = broadcastAddress(ip, prefix);
  const net = networkAddress(ip, prefix);
  return choice(
    rng,
    `Qual é o endereço de broadcast de ${cidr}?`,
    formatIp(bcast),
    [formatIp(net), formatIp((bcast - 1) >>> 0), formatIp(broadcastAddress(ip, Math.max(8, prefix - 8))), formatIp((bcast + 1) >>> 0)],
    `Coloque todos os bits de host em 1: ${formatIp(bcast)}. É o último endereço da rede ${formatIp(net)}/${prefix}.`,
  );
}

// ─── Ports ────────────────────────────────────────────────────────────────

interface Service { name: string; port: number; proto: 'TCP' | 'UDP'; level: Difficulty }

export const SERVICES: Service[] = [
  { name: 'HTTP', port: 80, proto: 'TCP', level: 1 },
  { name: 'HTTPS', port: 443, proto: 'TCP', level: 1 },
  { name: 'SSH', port: 22, proto: 'TCP', level: 1 },
  { name: 'DNS', port: 53, proto: 'UDP', level: 1 },
  { name: 'SMTP (e-mail)', port: 25, proto: 'TCP', level: 1 },
  { name: 'FTP', port: 21, proto: 'TCP', level: 2 },
  { name: 'MySQL', port: 3306, proto: 'TCP', level: 2 },
  { name: 'Área de Trabalho Remota (RDP)', port: 3389, proto: 'TCP', level: 2 },
  { name: 'IMAP', port: 143, proto: 'TCP', level: 2 },
  { name: 'POP3', port: 110, proto: 'TCP', level: 2 },
  { name: 'Telnet', port: 23, proto: 'TCP', level: 3 },
  { name: 'PostgreSQL', port: 5432, proto: 'TCP', level: 3 },
  { name: 'Servidor DHCP', port: 67, proto: 'UDP', level: 3 },
  { name: 'SNMP', port: 161, proto: 'UDP', level: 3 },
  { name: 'NTP (hora)', port: 123, proto: 'UDP', level: 3 },
];

function portsRound(rng: Rng, d: Difficulty): Round {
  const pool = SERVICES.filter((s) => s.level <= d);
  const svc = pick(rng, pool);
  const others = pool.filter((s) => s !== svc);
  const type = randInt(rng, 0, d === 1 ? 1 : d === 2 ? 2 : 3);

  if (type === 0) {
    return choice(rng, `Qual é a porta padrão do serviço ${svc.name}?`, String(svc.port), others.map((s) => String(s.port)),
      `O serviço ${svc.name} escuta na porta ${svc.proto} ${svc.port}.`);
  }
  if (type === 1) {
    return choice(rng, `A porta ${svc.port} está aberta. Qual serviço provavelmente está escutando nela?`, svc.name, others.map((s) => s.name),
      `${svc.port}/${svc.proto} é a porta padrão do serviço ${svc.name}.`);
  }
  if (type === 2) {
    const allowed = shuffle(rng, pool).slice(0, 2);
    const blocked = pool.filter((s) => !allowed.includes(s));
    const target = pick(rng, allowed);
    return choice(
      rng,
      'Veja as regras do firewall abaixo. Qual conexão passa?',
      `${target.name} na porta ${target.port}`,
      blocked.map((s) => `${s.name} na porta ${s.port}`),
      `Só as portas ${allowed.map((s) => s.port).join(' e ')} são permitidas; o serviço ${target.name} usa a porta ${target.port}.`,
      [...allowed.map((s) => `ALLOW ${s.proto} ${s.port}`), 'DENY  ALL'].join('\n'),
    );
  }
  return choice(
    rng,
    `Qual protocolo de transporte o serviço ${svc.name} costuma usar?`,
    svc.proto,
    [svc.proto === 'TCP' ? 'UDP' : 'TCP', 'ICMP', 'ARP'],
    svc.proto === 'TCP'
      ? `O serviço ${svc.name} precisa de entrega confiável e em ordem: TCP.`
      : `O serviço ${svc.name} envia mensagens pequenas e rápidas, em que a velocidade importa mais que a garantia de entrega: UDP.`,
  );
}

// ─── HTTP ─────────────────────────────────────────────────────────────────

interface Status { code: number; meaning: string; scenario: string; level: Difficulty }

export const STATUSES: Status[] = [
  { code: 200, meaning: 'OK', scenario: 'A página carregou normalmente', level: 1 },
  { code: 301, meaning: 'Moved Permanently', scenario: 'A página mudou de vez para uma nova URL', level: 1 },
  { code: 403, meaning: 'Forbidden', scenario: 'Você fez login, mas não tem permissão para ver isto', level: 1 },
  { code: 404, meaning: 'Not Found', scenario: 'A URL não existe no servidor', level: 1 },
  { code: 500, meaning: 'Internal Server Error', scenario: 'O código do servidor travou enquanto respondia', level: 1 },
  { code: 201, meaning: 'Created', scenario: 'Uma nova conta de usuário foi criada com sucesso', level: 2 },
  { code: 204, meaning: 'No Content', scenario: 'A exclusão funcionou e não há nada para devolver', level: 2 },
  { code: 302, meaning: 'Found (redirecionamento temporário)', scenario: 'Mandar para a página de login por enquanto', level: 2 },
  { code: 400, meaning: 'Bad Request', scenario: 'A requisição veio malformada (JSON quebrado)', level: 2 },
  { code: 401, meaning: 'Unauthorized', scenario: 'Você precisa fazer login primeiro', level: 2 },
  { code: 503, meaning: 'Service Unavailable', scenario: 'O servidor está sobrecarregado ou em manutenção', level: 2 },
  { code: 304, meaning: 'Not Modified', scenario: 'A cópia guardada no seu navegador ainda está atualizada', level: 3 },
  { code: 405, meaning: 'Method Not Allowed', scenario: 'Você enviou DELETE para uma rota que só aceita GET', level: 3 },
  { code: 429, meaning: 'Too Many Requests', scenario: 'Você passou do limite de requisições permitido', level: 3 },
  { code: 502, meaning: 'Bad Gateway', scenario: 'O servidor intermediário recebeu uma resposta inválida do servidor da aplicação', level: 3 },
];

const METHODS = [
  { method: 'GET', use: 'Ler um recurso sem alterá-lo' },
  { method: 'POST', use: 'Enviar dados para criar algo novo' },
  { method: 'PUT', use: 'Substituir um recurso por inteiro' },
  { method: 'DELETE', use: 'Remover um recurso' },
];

function httpRound(rng: Rng, d: Difficulty): Round {
  const pool = STATUSES.filter((s) => s.level <= d);
  const status = pick(rng, pool);
  const others = pool.filter((s) => s !== status);
  const type = randInt(rng, 0, 3);

  if (type === 0) {
    return choice(rng, `O servidor respondeu ${status.code}. O que isso significa?`, status.meaning, others.map((s) => s.meaning),
      `${status.code} ${status.meaning}. Situação típica: ${status.scenario}.`);
  }
  if (type === 1) {
    return choice(rng, `Qual código de status combina com esta situação: "${status.scenario}"?`, String(status.code), others.map((s) => String(s.code)),
      `${status.code} ${status.meaning}.`);
  }
  if (type === 2) {
    const m = pick(rng, METHODS);
    return choice(rng, `Qual método HTTP você deve usar para ${m.use.toLowerCase()}?`, m.method, METHODS.map((x) => x.method),
      `${m.method}: ${m.use}.`);
  }
  const klass = Math.floor(status.code / 100);
  const classes = ['Sucesso', 'Redirecionamento', 'Erro do cliente', 'Erro do servidor'];
  return choice(rng, `A qual classe pertence uma resposta ${status.code}?`, classes[klass - 2], classes,
    `Códigos ${klass}xx indicam ${classes[klass - 2].toLowerCase()}.`);
}

// ─── DNS ──────────────────────────────────────────────────────────────────

interface RecordType { type: string; purpose: string; level: Difficulty }

export const RECORD_TYPES: RecordType[] = [
  { type: 'A', purpose: 'Associa um nome a um endereço IPv4', level: 1 },
  { type: 'AAAA', purpose: 'Associa um nome a um endereço IPv6', level: 1 },
  { type: 'CNAME', purpose: 'Faz de um nome um apelido de outro nome', level: 1 },
  { type: 'MX', purpose: 'Indica o servidor de e-mail de um domínio', level: 1 },
  { type: 'NS', purpose: 'Indica os servidores de nomes oficiais (autoritativos) de um domínio', level: 2 },
  { type: 'TXT', purpose: 'Guarda texto livre, como a prova de que você é dono do domínio', level: 2 },
  { type: 'PTR', purpose: 'Associa um endereço IP de volta a um nome (consulta reversa)', level: 3 },
  { type: 'SOA', purpose: 'Início de autoridade da zona: número de série e temporizadores', level: 3 },
  { type: 'SRV', purpose: 'Localiza um serviço pelo host e pela porta', level: 3 },
];

function dnsRound(rng: Rng, d: Difficulty): Round {
  const pool = RECORD_TYPES.filter((r) => r.level <= d);
  const rec = pick(rng, pool);
  const others = pool.filter((r) => r !== rec);
  const type = randInt(rng, 0, 2);

  if (type === 0) {
    return choice(rng, `Qual tipo de registro DNS faz isto: "${rec.purpose}"?`, rec.type, others.map((r) => r.type), `${rec.type}: ${rec.purpose}.`);
  }
  if (type === 1) {
    return choice(rng, `O que o registro ${rec.type} faz?`, rec.purpose, others.map((r) => r.purpose), `${rec.type}: ${rec.purpose}.`);
  }
  // Resolve a name using a small zone file (CNAME chains from difficulty 2).
  const domain = pick(rng, ['example.com', 'corp.test', 'uni.example', 'shop.test']);
  const ips = shuffle(rng, ['203.0.113.10', '203.0.113.25', '198.51.100.7', '192.0.2.44']);
  const useChain = d >= 2 && rng() < 0.7;
  const lines = [
    `www.${domain}    ${useChain ? `CNAME  web.${domain}` : `A      ${ips[0]}`}`,
    `web.${domain}    A      ${ips[1]}`,
    `mail.${domain}   A      ${ips[2]}`,
    `${domain}        MX     mail.${domain}`,
  ];
  const askMail = rng() < 0.4;
  const answer = askMail ? ips[2] : useChain ? ips[1] : ips[0];
  return choice(
    rng,
    askMail ? `Em qual endereço IP o e-mail para @${domain} deve ser entregue?` : `Para qual endereço IP o nome www.${domain} é resolvido?`,
    answer,
    ips,
    askMail
      ? `O registro MX aponta para mail.${domain}, cujo registro A é ${ips[2]}.`
      : useChain
        ? `www é um CNAME de web.${domain}, cujo registro A é ${ips[1]}.`
        : `www.${domain} tem um registro A: ${ips[0]}.`,
    shuffle(rng, lines).join('\n'),
  );
}
