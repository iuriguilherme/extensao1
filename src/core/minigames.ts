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

/** One idea a round can test. Misses are tracked per concept. */
export type ConceptId =
  | 'binary.toBinary' | 'binary.toDecimal' | 'binary.combinations'
  | 'subnet.sameNetwork' | 'subnet.networkAddress' | 'subnet.usableHosts' | 'subnet.broadcast'
  | 'ports.servicePort' | 'ports.firewall' | 'ports.transport'
  | 'http.statusCode' | 'http.method' | 'http.statusClass'
  | 'dns.recordType' | 'dns.resolve';

/** The area each concept belongs to, and the lowest level whose rounds can ask it. */
export const CONCEPTS: Record<ConceptId, { area: MinigameId; fromLevel: number }> = {
  'binary.toBinary': { area: 'binary', fromLevel: 1 },
  'binary.toDecimal': { area: 'binary', fromLevel: 1 },
  'binary.combinations': { area: 'binary', fromLevel: 2 },
  'subnet.sameNetwork': { area: 'subnet', fromLevel: 1 },
  'subnet.networkAddress': { area: 'subnet', fromLevel: 1 },
  'subnet.usableHosts': { area: 'subnet', fromLevel: 2 },
  'subnet.broadcast': { area: 'subnet', fromLevel: 2 },
  'ports.servicePort': { area: 'ports', fromLevel: 1 },
  'ports.firewall': { area: 'ports', fromLevel: 2 },
  'ports.transport': { area: 'ports', fromLevel: 3 },
  'http.statusCode': { area: 'http', fromLevel: 1 },
  'http.method': { area: 'http', fromLevel: 1 },
  'http.statusClass': { area: 'http', fromLevel: 1 },
  'dns.recordType': { area: 'dns', fromLevel: 1 },
  'dns.resolve': { area: 'dns', fromLevel: 1 },
};

export interface ChoiceRound {
  kind: 'choice';
  concept: ConceptId;
  prompt: string;
  /** Optional monospace block shown under the prompt (zone file, packet…). */
  detail?: string;
  options: string[];
  answer: number;
  explain: string;
}

export interface BitsRound {
  kind: 'bits';
  concept: ConceptId;
  prompt: string;
  bits: number;
  target: number;
  explain: string;
}

export type Round = ChoiceRound | BitsRound;
/** Level 1 and up; each area stops at its MAX_LEVEL. Map nodes use 1-3. */
export type Difficulty = number;

/** Ports, HTTP and DNS content is tagged 1-3, so only binary and subnets go higher. */
export const MAX_LEVEL: Record<MinigameId, number> = { binary: 7, subnet: 5, ports: 3, http: 3, dns: 3 };

export function roundCount(difficulty: Difficulty): number {
  return [5, 7, 9][Math.min(difficulty, 3) - 1];
}

/**
 * Builds the rounds of one mini-game. With a focus concept (review jobs), at
 * least two thirds of the rounds ask that concept; once its unique prompts run
 * out, it repeats a prompt with reshuffled options.
 */
export function buildRounds(id: MinigameId, difficulty: Difficulty, rng: Rng, focus?: ConceptId): Round[] {
  const level = Math.min(difficulty, MAX_LEVEL[id]);
  const generator = GENERATORS[id];
  const total = roundCount(level);
  const rounds: Round[] = [];
  const seen = new Set<string>();

  const fill = (count: number, only?: ConceptId) => {
    const target = rounds.length + count;
    let repeats = 0;
    while (rounds.length < target) {
      const round = generator(rng, level, only);
      const key = round.prompt + (round.kind === 'choice' ? round.detail ?? '' : round.target);
      if (seen.has(key) && repeats++ < 200) continue;
      seen.add(key);
      rounds.push(round);
    }
  };

  if (!focus) {
    fill(total);
    return rounds;
  }
  fill(Math.ceil((total * 2) / 3), focus);
  fill(total - rounds.length);
  return shuffle(rng, rounds);
}

/** Picks a round type: the focus concept's own type(s), or any type the level allows. */
function roundType(rng: Rng, focus: ConceptId | undefined, types: Partial<Record<ConceptId, number[]>>, maxType: number): number {
  const forced = focus && types[focus];
  return forced ? pick(rng, forced) : randInt(rng, 0, maxType);
}

const GENERATORS: Record<MinigameId, (rng: Rng, d: Difficulty, focus?: ConceptId) => Round> = {
  binary: binaryRound,
  subnet: subnetRound,
  ports: portsRound,
  http: httpRound,
  dns: dnsRound,
};

/** Builds a choice round from a correct answer and distractor candidates. */
function choice(rng: Rng, concept: ConceptId, prompt: string, correct: string, distractors: string[], explain: string, detail?: string): ChoiceRound {
  const wrong = shuffle(rng, [...new Set(distractors.filter((d) => d !== correct))]).slice(0, 3);
  const options = shuffle(rng, [correct, ...wrong]);
  return { kind: 'choice', concept, prompt, detail, options, answer: options.indexOf(correct), explain };
}

export function toBinary(value: number, bits: number): string {
  return value.toString(2).padStart(bits, '0');
}

// ─── Binary ───────────────────────────────────────────────────────────────

/** 4, 6 and 8 bits on levels 1-3, then 2 more per level up to 16. */
function binaryBits(d: Difficulty): number {
  return d <= 3 ? [4, 6, 8][d - 1] : 8 + 2 * (d - 3);
}

function binaryRound(rng: Rng, d: Difficulty, focus?: ConceptId): Round {
  const bits = binaryBits(d);
  const max = 2 ** bits - 1;
  const type = roundType(rng, focus, { 'binary.toBinary': [0], 'binary.toDecimal': [1], 'binary.combinations': [2] }, d === 1 ? 1 : 2);

  if (type === 0) {
    const target = randInt(rng, 1, max);
    return {
      kind: 'bits',
      concept: 'binary.toBinary',
      prompt: `Ligue os bits até formar ${target}`,
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
      'binary.toDecimal',
      `Quanto vale ${toBinary(value, bits)} em decimal?`,
      String(value),
      near.map(String),
      `${toBinary(value, bits)} = ${placeBreakdown(value, bits)} = ${value}`,
    );
  }
  const n = randInt(rng, 2, 16);
  return choice(
    rng,
    'binary.combinations',
    `Com ${n} bits, dá para representar quantos valores diferentes?`,
    String(2 ** n),
    [String(2 ** n - 1), String(n * 2), String(2 ** (n + 1)), String(n ** 2), String(2 ** (n - 1))],
    `Cada bit a mais dobra as combinações: 2^${n} = ${2 ** n}.`,
  );
}

function placeBreakdown(value: number, bits: number): string {
  const terms: number[] = [];
  for (let i = bits - 1; i >= 0; i--) if (value & (1 << i)) terms.push(1 << i);
  return terms.join(' + ');
}

// ─── Subnets ──────────────────────────────────────────────────────────────

/**
 * A host in a private range. A prefix shorter than /16 would carry 192.168 or
 * 172.16-31 networks out of their private block, so short prefixes only use
 * 10.0.0.0/8 (and 172.16.0.0/12 from /12 on).
 */
function randomPrivateIp(rng: Rng, prefix: number): number {
  const blocks = prefix >= 16 ? 2 : prefix >= 12 ? 1 : 0;
  const block = randInt(rng, 0, blocks);
  const [a, b] = block === 0 ? [10, randInt(rng, 0, 255)] : block === 1 ? [172, randInt(rng, 16, 31)] : [192, 168];
  return ((a << 24) | (b << 16) | (randInt(rng, 0, 255) << 8) | randInt(rng, 1, 254)) >>> 0;
}

const SUBNET_PREFIXES = [
  [24],
  [16, 24, 25, 26],
  [20, 22, 26, 27, 28],
  [17, 18, 19, 21, 23, 29, 30],
  [9, 10, 11, 12, 13, 14, 15],
];

function subnetRound(rng: Rng, d: Difficulty, focus?: ConceptId): Round {
  const prefix = pick(rng, SUBNET_PREFIXES[d - 1]);
  const ip = randomPrivateIp(rng, prefix);
  const type = roundType(
    rng, focus,
    { 'subnet.sameNetwork': [0], 'subnet.networkAddress': [1], 'subnet.usableHosts': [2], 'subnet.broadcast': [3] },
    d === 1 ? 1 : 3,
  );
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
      'subnet.sameNetwork',
      `Qual destes hosts está na mesma rede que ${cidr}?`,
      formatIp(inside),
      outside.map(formatIp),
      `${cidr} fica na rede ${formatIp(net)}/${prefix}, que vai de ${formatIp(net)} a ${formatIp(broadcastAddress(ip, prefix))}.`,
    );
  }
  if (type === 1) {
    const net = networkAddress(ip, prefix);
    return choice(
      rng,
      'subnet.networkAddress',
      `Qual é o endereço de rede de ${cidr}?`,
      formatIp(net),
      [formatIp(ip), formatIp(broadcastAddress(ip, prefix)), formatIp((net + 1) >>> 0), formatIp(networkAddress(ip, prefix - 8 < 0 ? 0 : prefix - 8))],
      `Aplique a máscara de sub-rede ${formatIp(prefixToMask(prefix))}: os bits de rede continuam iguais e os de host viram 0 → ${formatIp(net)}.`,
    );
  }
  if (type === 2) {
    const p = randInt(rng, d <= 3 ? 22 : 16, 30);
    const hosts = usableHosts(p);
    return choice(
      rng,
      'subnet.usableHosts',
      `Quantos hosts válidos cabem numa rede /${p}?`,
      String(hosts),
      [String(hosts + 2), String(hosts + 1), String(2 ** (32 - p - 1)), String(32 - p), String(hosts * 2)],
      `Numa rede /${p} sobram ${32 - p} bits de host: 2^${32 - p} = ${2 ** (32 - p)}. Tirando o endereço de rede e o de broadcast, ficam ${hosts}.`,
    );
  }
  const bcast = broadcastAddress(ip, prefix);
  const net = networkAddress(ip, prefix);
  return choice(
    rng,
    'subnet.broadcast',
    `Qual é o endereço de broadcast de ${cidr}?`,
    formatIp(bcast),
    [formatIp(net), formatIp((bcast - 1) >>> 0), formatIp(broadcastAddress(ip, Math.max(8, prefix - 8))), formatIp((bcast + 1) >>> 0)],
    `Com todos os bits de host em 1, dá ${formatIp(bcast)}: o último endereço da rede ${formatIp(net)}/${prefix}.`,
  );
}

// ─── Ports ────────────────────────────────────────────────────────────────

interface Service { name: string; port: number; proto: 'TCP' | 'UDP'; level: 1 | 2 | 3 }

export const SERVICES: Service[] = [
  { name: 'HTTP', port: 80, proto: 'TCP', level: 1 },
  { name: 'HTTPS', port: 443, proto: 'TCP', level: 1 },
  { name: 'SSH', port: 22, proto: 'TCP', level: 1 },
  { name: 'DNS', port: 53, proto: 'UDP', level: 1 },
  { name: 'SMTP (envio de e-mail)', port: 25, proto: 'TCP', level: 1 },
  { name: 'FTP', port: 21, proto: 'TCP', level: 2 },
  { name: 'MySQL', port: 3306, proto: 'TCP', level: 2 },
  { name: 'Área de Trabalho Remota (RDP)', port: 3389, proto: 'TCP', level: 2 },
  { name: 'IMAP', port: 143, proto: 'TCP', level: 2 },
  { name: 'POP3', port: 110, proto: 'TCP', level: 2 },
  { name: 'Telnet', port: 23, proto: 'TCP', level: 3 },
  { name: 'PostgreSQL', port: 5432, proto: 'TCP', level: 3 },
  { name: 'DHCP (servidor)', port: 67, proto: 'UDP', level: 3 },
  { name: 'SNMP', port: 161, proto: 'UDP', level: 3 },
  { name: 'NTP (horário)', port: 123, proto: 'UDP', level: 3 },
];

function portsRound(rng: Rng, d: Difficulty, focus?: ConceptId): Round {
  const pool = SERVICES.filter((s) => s.level <= d);
  const svc = pick(rng, pool);
  const others = pool.filter((s) => s !== svc);
  const type = roundType(
    rng, focus,
    { 'ports.servicePort': [0, 1], 'ports.firewall': [2], 'ports.transport': [3] },
    d === 1 ? 1 : d === 2 ? 2 : 3,
  );

  if (type === 0) {
    return choice(rng, 'ports.servicePort', `Qual é a porta padrão do serviço ${svc.name}?`, String(svc.port), others.map((s) => String(s.port)),
      `O serviço ${svc.name} escuta na porta ${svc.proto} ${svc.port}.`);
  }
  if (type === 1) {
    return choice(rng, 'ports.servicePort', `A porta ${svc.port} está aberta. Que serviço deve estar rodando nela?`, svc.name, others.map((s) => s.name),
      `A porta padrão do serviço ${svc.name} é ${svc.port}/${svc.proto}.`);
  }
  if (type === 2) {
    const allowed = shuffle(rng, pool).slice(0, 2);
    const blocked = pool.filter((s) => !allowed.includes(s));
    const target = pick(rng, allowed);
    return choice(
      rng,
      'ports.firewall',
      'Com estas regras no firewall, qual conexão passa?',
      `${target.name} na porta ${target.port}`,
      blocked.map((s) => `${s.name} na porta ${s.port}`),
      `O firewall só libera as portas ${allowed.map((s) => s.port).join(' e ')}, e o serviço ${target.name} usa a porta ${target.port}.`,
      [...allowed.map((s) => `ALLOW ${s.proto} ${s.port}`), 'DENY  ALL'].join('\n'),
    );
  }
  return choice(
    rng,
    'ports.transport',
    `Qual protocolo de transporte o serviço ${svc.name} costuma usar?`,
    svc.proto,
    [svc.proto === 'TCP' ? 'UDP' : 'TCP', 'ICMP', 'ARP'],
    svc.proto === 'TCP'
      ? `O serviço ${svc.name} precisa que tudo chegue completo e na ordem certa: TCP.`
      : `O serviço ${svc.name} troca mensagens curtas e precisa de rapidez, não de garantia de entrega: UDP.`,
  );
}

// ─── HTTP ─────────────────────────────────────────────────────────────────

interface Status { code: number; meaning: string; scenario: string; level: 1 | 2 | 3 }

export const STATUSES: Status[] = [
  { code: 200, meaning: 'OK', scenario: 'A página carregou normalmente', level: 1 },
  { code: 301, meaning: 'Moved Permanently', scenario: 'A página mudou de URL de vez', level: 1 },
  { code: 403, meaning: 'Forbidden', scenario: 'Você está logado, mas não tem permissão para ver esta página', level: 1 },
  { code: 404, meaning: 'Not Found', scenario: 'Essa URL não existe no servidor', level: 1 },
  { code: 500, meaning: 'Internal Server Error', scenario: 'O programa do servidor deu erro no meio da resposta', level: 1 },
  { code: 201, meaning: 'Created', scenario: 'Uma conta de usuário nova foi criada com sucesso', level: 2 },
  { code: 204, meaning: 'No Content', scenario: 'O item foi apagado e não há nada para mandar de volta', level: 2 },
  { code: 302, meaning: 'Found (redirecionamento temporário)', scenario: 'O site manda você para a página de login, só por enquanto', level: 2 },
  { code: 400, meaning: 'Bad Request', scenario: 'A requisição chegou com o formato errado (JSON quebrado)', level: 2 },
  { code: 401, meaning: 'Unauthorized', scenario: 'Você precisa fazer login primeiro', level: 2 },
  { code: 503, meaning: 'Service Unavailable', scenario: 'O servidor está sobrecarregado ou em manutenção', level: 2 },
  { code: 304, meaning: 'Not Modified', scenario: 'A cópia que o navegador já guardou continua valendo', level: 3 },
  { code: 405, meaning: 'Method Not Allowed', scenario: 'Você enviou DELETE para uma rota que só aceita GET', level: 3 },
  { code: 429, meaning: 'Too Many Requests', scenario: 'Você mandou requisições demais em pouco tempo', level: 3 },
  { code: 502, meaning: 'Bad Gateway', scenario: 'O servidor intermediário recebeu uma resposta inválida da aplicação', level: 3 },
];

const METHODS = [
  { method: 'GET', use: 'Buscar um recurso sem mudar nada nele' },
  { method: 'POST', use: 'Enviar dados e criar algo novo' },
  { method: 'PUT', use: 'Substituir um recurso por inteiro' },
  { method: 'DELETE', use: 'Apagar um recurso' },
];

function httpRound(rng: Rng, d: Difficulty, focus?: ConceptId): Round {
  const pool = STATUSES.filter((s) => s.level <= d);
  const status = pick(rng, pool);
  const others = pool.filter((s) => s !== status);
  const type = roundType(rng, focus, { 'http.statusCode': [0, 1], 'http.method': [2], 'http.statusClass': [3] }, 3);

  if (type === 0) {
    return choice(rng, 'http.statusCode', `O servidor respondeu ${status.code}. O que isso significa?`, status.meaning, others.map((s) => s.meaning),
      `${status.code} ${status.meaning}. Exemplo: ${status.scenario}.`);
  }
  if (type === 1) {
    return choice(rng, 'http.statusCode', `Que código o servidor devolve nesta situação: "${status.scenario}"?`, String(status.code), others.map((s) => String(s.code)),
      `${status.code} ${status.meaning}.`);
  }
  if (type === 2) {
    const m = pick(rng, METHODS);
    return choice(rng, 'http.method', `Qual método HTTP você deve usar para ${m.use.toLowerCase()}?`, m.method, METHODS.map((x) => x.method),
      `${m.method}: ${m.use}.`);
  }
  const klass = Math.floor(status.code / 100);
  const classes = ['Sucesso', 'Redirecionamento', 'Erro do cliente', 'Erro do servidor'];
  return choice(rng, 'http.statusClass', `Em qual classe se encaixa o código ${status.code}?`, classes[klass - 2], classes,
    `Os códigos ${klass}xx são de ${classes[klass - 2].toLowerCase()}.`);
}

// ─── DNS ──────────────────────────────────────────────────────────────────

interface RecordType { type: string; purpose: string; level: 1 | 2 | 3 }

export const RECORD_TYPES: RecordType[] = [
  { type: 'A', purpose: 'Aponta um nome para um endereço IPv4', level: 1 },
  { type: 'AAAA', purpose: 'Aponta um nome para um endereço IPv6', level: 1 },
  { type: 'CNAME', purpose: 'Cria um apelido que aponta para outro nome', level: 1 },
  { type: 'MX', purpose: 'Diz qual servidor recebe o e-mail de um domínio', level: 1 },
  { type: 'NS', purpose: 'Diz quais servidores de nomes respondem oficialmente por um domínio', level: 2 },
  { type: 'TXT', purpose: 'Guarda texto livre, como a prova de que você é dono do domínio', level: 2 },
  { type: 'PTR', purpose: 'Traduz um endereço IP de volta para um nome (DNS reverso)', level: 3 },
  { type: 'SOA', purpose: 'Guarda os dados de controle da zona: número de série e tempos de atualização', level: 3 },
  { type: 'SRV', purpose: 'Diz em qual host e em qual porta um serviço está rodando', level: 3 },
];

function dnsRound(rng: Rng, d: Difficulty, focus?: ConceptId): Round {
  const pool = RECORD_TYPES.filter((r) => r.level <= d);
  const rec = pick(rng, pool);
  const others = pool.filter((r) => r !== rec);
  const type = roundType(rng, focus, { 'dns.recordType': [0, 1], 'dns.resolve': [2] }, 2);

  if (type === 0) {
    return choice(rng, 'dns.recordType', `Qual registro DNS faz isto: "${rec.purpose}"?`, rec.type, others.map((r) => r.type), `${rec.type}: ${rec.purpose}.`);
  }
  if (type === 1) {
    return choice(rng, 'dns.recordType', `Para que serve o registro ${rec.type}?`, rec.purpose, others.map((r) => r.purpose), `${rec.type}: ${rec.purpose}.`);
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
    'dns.resolve',
    askMail ? `O e-mail para @${domain} deve ser entregue em qual endereço IP?` : `O nome www.${domain} resolve para qual endereço IP?`,
    answer,
    ips,
    askMail
      ? `O registro MX aponta para mail.${domain}, e o registro A desse nome é ${ips[2]}.`
      : useChain
        ? `www é um apelido (CNAME) de web.${domain}, que tem registro A ${ips[1]}.`
        : `O registro A de www.${domain} aponta direto para ${ips[0]}.`,
    shuffle(rng, lines).join('\n'),
  );
}
