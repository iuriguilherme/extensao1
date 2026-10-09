/**
 * Mini-game content generators. Each knowledge area produces a list of rounds
 * from a seeded RNG, so the scene only has to render and time them.
 *
 * Round kinds:
 * - choice: pick the right option.
 * - bits:   toggle binary switches until they add up to a target number.
 */

import type { MinigameId } from '../data/nodes';
import {
  explainAddressType, explainBroadcast, explainCombinations, explainCompress, explainFirewall, explainMethod,
  explainNetworkAddress, explainOutsideAddress, explainPortForward, explainPortMode, explainPrivateRange,
  explainRecordType, explainResolve, explainSameNetwork, explainServicePort, explainStatusClass, explainStatusCode,
  explainToBinary, explainToDecimal, explainTransport, explainUsableHosts, explainV6Prefix, explainVlanId,
  explainVlanMembership, type Explanations, type V6Kind, type VlanIdVerdict,
} from './explanations';
import { listJoin } from './fmt';
import { broadcastAddress, formatIp, networkAddress, parseIp, prefixToMask, sameSubnet, usableHosts } from './ip';
import { formatIpv6, formatIpv6Full, ipv6Network, parseIpv6 } from './ipv6';
import { pick, randInt, shuffle, type Rng } from './random';

/** One idea a round can test. Misses are tracked per concept. */
export type ConceptId =
  | 'binary.toBinary' | 'binary.toDecimal' | 'binary.combinations'
  | 'subnet.sameNetwork' | 'subnet.networkAddress' | 'subnet.usableHosts' | 'subnet.broadcast'
  | 'ports.servicePort' | 'ports.firewall' | 'ports.transport'
  | 'http.statusCode' | 'http.method' | 'http.statusClass'
  | 'dns.recordType' | 'dns.resolve'
  | 'nat.privateRange' | 'nat.portForward' | 'nat.outsideAddress'
  | 'vlan.membership' | 'vlan.portMode' | 'vlan.validId'
  | 'ipv6.compress' | 'ipv6.prefix' | 'ipv6.addressType';

/** Each concept's area, the lowest level whose rounds can ask it, and its name on the side-job board. */
export const CONCEPTS: Record<ConceptId, { area: MinigameId; fromLevel: number; label: string }> = {
  'binary.toBinary': { area: 'binary', fromLevel: 1, label: 'Decimal para binário' },
  'binary.toDecimal': { area: 'binary', fromLevel: 1, label: 'Binário para decimal' },
  'binary.combinations': { area: 'binary', fromLevel: 2, label: 'Quantos valores cabem em n bits' },
  'subnet.sameNetwork': { area: 'subnet', fromLevel: 1, label: 'Hosts da mesma rede' },
  'subnet.networkAddress': { area: 'subnet', fromLevel: 1, label: 'Endereço de rede' },
  'subnet.usableHosts': { area: 'subnet', fromLevel: 2, label: 'Hosts válidos numa rede' },
  'subnet.broadcast': { area: 'subnet', fromLevel: 2, label: 'Endereço de broadcast' },
  'ports.servicePort': { area: 'ports', fromLevel: 1, label: 'A porta de cada serviço' },
  'ports.firewall': { area: 'ports', fromLevel: 2, label: 'Regras de firewall' },
  'ports.transport': { area: 'ports', fromLevel: 3, label: 'TCP ou UDP' },
  'http.statusCode': { area: 'http', fromLevel: 1, label: 'Códigos de resposta HTTP' },
  'http.method': { area: 'http', fromLevel: 1, label: 'Métodos HTTP' },
  'http.statusClass': { area: 'http', fromLevel: 1, label: 'Classes de código HTTP' },
  'dns.recordType': { area: 'dns', fromLevel: 1, label: 'Tipos de registro DNS' },
  'dns.resolve': { area: 'dns', fromLevel: 1, label: 'Resolver nomes no DNS' },
  'nat.privateRange': { area: 'nat', fromLevel: 1, label: 'Endereços privados e públicos' },
  'nat.outsideAddress': { area: 'nat', fromLevel: 1, label: 'O endereço que a internet vê' },
  'nat.portForward': { area: 'nat', fromLevel: 2, label: 'Redirecionamento de porta' },
  'vlan.membership': { area: 'vlan', fromLevel: 1, label: 'Quem está na mesma VLAN' },
  'vlan.portMode': { area: 'vlan', fromLevel: 1, label: 'Porta de acesso ou tronco' },
  'vlan.validId': { area: 'vlan', fromLevel: 2, label: 'IDs de VLAN válidos' },
  'ipv6.compress': { area: 'ipv6', fromLevel: 1, label: 'Abreviar endereços IPv6' },
  'ipv6.prefix': { area: 'ipv6', fromLevel: 1, label: 'Prefixos IPv6' },
  'ipv6.addressType': { area: 'ipv6', fromLevel: 1, label: 'Tipos de endereço IPv6' },
};

export interface ChoiceRound {
  kind: 'choice';
  concept: ConceptId;
  prompt: string;
  /** Optional monospace block shown under the prompt (zone file, packet…). */
  detail?: string;
  options: string[];
  answer: number;
  explain: Explanations;
}

export interface BitsRound {
  kind: 'bits';
  concept: ConceptId;
  prompt: string;
  bits: number;
  target: number;
  explain: Explanations;
}

export type Round = ChoiceRound | BitsRound;
/** Level 1 and up; each area stops at its MAX_LEVEL. Map nodes use 1-3. */
export type Difficulty = number;

/** Ports, HTTP, DNS, NAT, VLAN and IPv6 content is tagged 1-3, so only binary and subnets go higher. */
export const MAX_LEVEL: Record<MinigameId, number> = { binary: 7, subnet: 5, ports: 3, http: 3, dns: 3, nat: 3, vlan: 3, ipv6: 3 };

/**
 * A city node's addresses, as unsigned 32-bit numbers (the form `ip.ts` uses).
 * Subnet rounds ask about `network`/`prefix`; 8-bit decimal-to-binary rounds
 * ask for an octet of `host`.
 */
export interface RoundContext {
  network: number;
  prefix: number;
  host: number;
}

/**
 * What a typed city adds to its nodes' rounds: the NAT pair of a private site,
 * the node's VLAN, or its IPv6 address. Rounds of other areas ignore it.
 */
export interface TypedContext {
  nat?: { publicIp: number; privateNetwork: number; privatePrefix: number; privateHost: number };
  vlan?: { id: number; name: string };
  ipv6?: { host: bigint };
}

export function roundCount(difficulty: Difficulty): number {
  return [5, 7, 9][Math.min(difficulty, 3) - 1];
}

/**
 * Builds the rounds of one mini-game. With a focus concept (review jobs), at
 * least two thirds of the rounds ask that concept; once its unique prompts run
 * out, it repeats a prompt with reshuffled options. With a context (city
 * nodes), subnet and 8-bit decimal-to-binary rounds use the node's addresses;
 * other rounds ignore it. Without a context, the rng draws are those of the context-free
 * generators, so existing levels and seeds keep their rounds. A typed context
 * (typed city nodes) feeds the NAT, VLAN and IPv6 rounds the same way.
 */
export function buildRounds(
  id: MinigameId, difficulty: Difficulty, rng: Rng, focus?: ConceptId, context?: RoundContext, typed?: TypedContext,
): Round[] {
  const level = Math.min(difficulty, MAX_LEVEL[id]);
  const generator = GENERATORS[id];
  const total = roundCount(level);
  const rounds: Round[] = [];
  const seen = new Set<string>();

  const fill = (count: number, only?: ConceptId) => {
    const target = rounds.length + count;
    let repeats = 0;
    while (rounds.length < target) {
      const round = generator(rng, level, only, context, typed);
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

type Generator = (rng: Rng, d: Difficulty, focus?: ConceptId, context?: RoundContext, typed?: TypedContext) => Round;

const GENERATORS: Record<MinigameId, Generator> = {
  binary: binaryRound,
  subnet: subnetRound,
  ports: portsRound,
  http: httpRound,
  dns: dnsRound,
  nat: natRound,
  vlan: vlanRound,
  ipv6: ipv6Round,
};

/** Builds a choice round from a correct answer and distractor candidates. */
function choice(rng: Rng, concept: ConceptId, prompt: string, correct: string, distractors: string[], explain: Explanations, detail?: string): ChoiceRound {
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

/**
 * The value an 8-bit decimal-to-binary round asks for: a nonzero octet of the
 * context host other than the first (the leading 10), or a random one when
 * there is none. The random draw is the same call as without a context.
 */
function binaryValue(rng: Rng, bits: number, max: number, context?: RoundContext): number {
  if (context && bits === 8) {
    const octets = [16, 8, 0].map((shift) => (context.host >>> shift) & 255).filter((o) => o > 0);
    if (octets.length > 0) return pick(rng, octets);
  }
  return randInt(rng, 1, max);
}

function binaryRound(rng: Rng, d: Difficulty, focus?: ConceptId, context?: RoundContext): Round {
  const bits = binaryBits(d);
  const max = 2 ** bits - 1;
  const type = roundType(rng, focus, { 'binary.toBinary': [0], 'binary.toDecimal': [1], 'binary.combinations': [2] }, d === 1 ? 1 : 2);

  if (type === 0) {
    const target = binaryValue(rng, bits, max, context);
    return {
      kind: 'bits',
      concept: 'binary.toBinary',
      prompt: `Ligue os bits até formar ${target}`,
      bits,
      target,
      explain: explainToBinary(target, bits, toBinary(target, bits)),
    };
  }
  if (type === 1) {
    // Never an octet of the host: the mini-game title shows its IP, which would give the answer away.
    const value = randInt(rng, 1, max);
    const near = [value + 1, value - 1, value ^ 1, value ^ 2, value * 2, value >> 1, value + 8].filter((v) => v > 0 && v <= max * 2);
    return choice(
      rng,
      'binary.toDecimal',
      `Quanto vale ${toBinary(value, bits)} em decimal?`,
      String(value),
      near.map(String),
      explainToDecimal(value, bits, toBinary(value, bits)),
    );
  }
  const n = randInt(rng, 2, 16);
  return choice(
    rng,
    'binary.combinations',
    `Com ${n} bits, dá para representar quantos valores diferentes?`,
    String(2 ** n),
    [String(2 ** n - 1), String(n * 2), String(2 ** (n + 1)), String(n ** 2), String(2 ** (n - 1))],
    explainCombinations(n),
  );
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

/** A fresh host inside the context subnet, never its network or broadcast address. */
function contextHost(rng: Rng, context: RoundContext): number {
  return (networkAddress(context.network, context.prefix) + randInt(rng, 1, 2 ** (32 - context.prefix) - 2)) >>> 0;
}

function subnetRound(rng: Rng, d: Difficulty, focus?: ConceptId, context?: RoundContext): Round {
  const prefix = context ? context.prefix : pick(rng, SUBNET_PREFIXES[d - 1]);
  const ip = context ? contextHost(rng, context) : randomPrivateIp(rng, prefix);
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
      explainSameNetwork(cidr, formatIp(net), formatIp(broadcastAddress(ip, prefix)), prefix),
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
      explainNetworkAddress(cidr, formatIp(prefixToMask(prefix)), formatIp(net), prefix),
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
      explainUsableHosts(p, hosts),
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
    explainBroadcast(cidr, formatIp(net), formatIp(bcast), prefix),
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
      explainServicePort(svc.name, svc.port, svc.proto));
  }
  if (type === 1) {
    return choice(rng, 'ports.servicePort', `A porta ${svc.port} está aberta. Que serviço deve estar rodando nela?`, svc.name, others.map((s) => s.name),
      explainServicePort(svc.name, svc.port, svc.proto));
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
      explainFirewall(allowed.map((s) => s.port), target.name, target.port),
      [...allowed.map((s) => `ALLOW ${s.proto} ${s.port}`), 'DENY  ALL'].join('\n'),
    );
  }
  return choice(
    rng,
    'ports.transport',
    `Qual protocolo de transporte o serviço ${svc.name} costuma usar?`,
    svc.proto,
    [svc.proto === 'TCP' ? 'UDP' : 'TCP', 'ICMP', 'ARP'],
    explainTransport(svc.name, svc.proto),
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
      explainStatusCode(status.code, status.meaning, status.scenario));
  }
  if (type === 1) {
    return choice(rng, 'http.statusCode', `Que código o servidor devolve nesta situação: "${status.scenario}"?`, String(status.code), others.map((s) => String(s.code)),
      explainStatusCode(status.code, status.meaning, status.scenario));
  }
  if (type === 2) {
    const m = pick(rng, METHODS);
    return choice(rng, 'http.method', `Qual método HTTP você deve usar para ${m.use.toLowerCase()}?`, m.method, METHODS.map((x) => x.method),
      explainMethod(m.method, m.use));
  }
  const klass = Math.floor(status.code / 100);
  const classes = ['Sucesso', 'Redirecionamento', 'Erro do cliente', 'Erro do servidor'];
  return choice(rng, 'http.statusClass', `Em qual classe se encaixa o código ${status.code}?`, classes[klass - 2], classes,
    explainStatusClass(status.code, classes[klass - 2]));
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
    return choice(rng, 'dns.recordType', `Qual registro DNS faz isto: "${rec.purpose}"?`, rec.type, others.map((r) => r.type), explainRecordType(rec.type, rec.purpose));
  }
  if (type === 1) {
    return choice(rng, 'dns.recordType', `Para que serve o registro ${rec.type}?`, rec.purpose, others.map((r) => r.purpose), explainRecordType(rec.type, rec.purpose));
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
    explainResolve(domain, askMail ? 'mail' : useChain ? 'chain' : 'direct', answer),
    shuffle(rng, lines).join('\n'),
  );
}

// ─── NAT ──────────────────────────────────────────────────────────────────

const PRIVATE_RANGES = [
  { label: '10.0.0.0/8', network: parseIp('10.0.0.0')!, prefix: 8 },
  { label: '172.16.0.0/12', network: parseIp('172.16.0.0')!, prefix: 12 },
  { label: '192.168.0.0/16', network: parseIp('192.168.0.0')!, prefix: 16 },
];

/** The private block an address is in, or null for a public address. */
export function privateRangeOf(ip: number): string | null {
  return PRIVATE_RANGES.find((r) => sameSubnet(ip, r.network, r.prefix))?.label ?? null;
}

/** Documentation ranges the game uses as public addresses. */
export const PUBLIC_NETWORKS = ['203.0.113.0', '198.51.100.0'];

/** A service a NAT router can publish: its port and a common public port for it. */
export interface PublishedService {
  name: string;
  port: number;
  altPort: number;
}

export const PUBLISHED_SERVICES: PublishedService[] = [
  { name: 'servidor web', port: 80, altPort: 8080 },
  { name: 'servidor HTTPS', port: 443, altPort: 8443 },
  { name: 'servidor SSH', port: 22, altPort: 2222 },
  { name: 'servidor FTP', port: 21, altPort: 2121 },
  { name: 'banco de dados MySQL', port: 3306, altPort: 3307 },
];

const octets = (a: number, b: number, c: number, d: number) => ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;

/** A private /24 site with one host behind a public router address, for rounds outside a NAT city. */
function randomNat(rng: Rng): NonNullable<TypedContext['nat']> {
  const privateNetwork = rng() < 0.5 ? octets(192, 168, randInt(rng, 0, 254), 0) : octets(10, randInt(rng, 0, 255), randInt(rng, 0, 255), 0);
  return {
    publicIp: (parseIp(pick(rng, PUBLIC_NETWORKS))! + randInt(rng, 1, 254)) >>> 0,
    privateNetwork,
    privatePrefix: 24,
    privateHost: privateNetwork + randInt(rng, 2, 254),
  };
}

/** An address for the private-or-public question; from level 2, public ones include near misses. */
function rangeQuestionIp(rng: Rng, d: Difficulty): number {
  const kind = randInt(rng, 0, 3);
  if (kind === 0) return octets(10, randInt(rng, 0, 255), randInt(rng, 0, 255), randInt(rng, 1, 254));
  if (kind === 1) return octets(172, randInt(rng, 16, 31), randInt(rng, 0, 255), randInt(rng, 1, 254));
  if (kind === 2) return octets(192, 168, randInt(rng, 0, 255), randInt(rng, 1, 254));
  if (d >= 2 && rng() < 0.6) {
    const [a, b] = pick(rng, [[172, 15], [172, 32], [192, 169], [192, 167], [11, -1], [9, -1]]);
    return octets(a, b < 0 ? randInt(rng, 0, 255) : b, randInt(rng, 0, 255), randInt(rng, 1, 254));
  }
  return octets(pick(rng, [8, 31, 45, 52, 104, 142, 177, 186, 200, 201]), randInt(rng, 0, 255), randInt(rng, 0, 255), randInt(rng, 1, 254));
}

const RANGE_OPTIONS = [...PRIVATE_RANGES.map((r) => `Privado, da faixa ${r.label}`), 'Público: vale na internet'];

function natRound(rng: Rng, d: Difficulty, focus?: ConceptId, _context?: RoundContext, typed?: TypedContext): Round {
  const nat = typed?.nat ?? randomNat(rng);
  const type = roundType(rng, focus, { 'nat.privateRange': [0], 'nat.outsideAddress': [1], 'nat.portForward': [2] }, d === 1 ? 1 : 2);
  const host = formatIp(nat.privateHost);
  const publicIp = formatIp(nat.publicIp);
  // By convention the router takes the first usable address of the site.
  const inside = formatIp((nat.privateNetwork + 1) >>> 0);

  if (type === 0) {
    // A city node asks about its own site's addresses: the private host or the public one.
    const ip = typed?.nat ? (rng() < 0.5 ? nat.privateHost : nat.publicIp) : rangeQuestionIp(rng, d);
    const range = privateRangeOf(ip);
    return choice(rng, 'nat.privateRange', `O endereço ${formatIp(ip)} é privado ou público?`,
      range ? `Privado, da faixa ${range}` : RANGE_OPTIONS[3], RANGE_OPTIONS, explainPrivateRange(formatIp(ip), range));
  }
  if (type === 1) {
    if (d < 3 || rng() < 0.5) {
      return choice(rng, 'nat.outsideAddress',
        `O PC ${host} abre um site. O roteador da rede usa ${inside} por dentro e ${publicIp} na internet. De qual endereço o site vê a conexão chegar?`,
        publicIp, [host, inside, formatIp(nat.privateNetwork)], explainOutsideAddress(host, publicIp, 'out'));
    }
    // The reply comes back to the public address; the NAT table says whose connection it is.
    const offset = nat.privateHost - nat.privateNetwork;
    let otherOffset: number;
    do otherOffset = randInt(rng, 2, 254);
    while (otherOffset === offset);
    const other = formatIp((nat.privateNetwork + otherOffset) >>> 0);
    const mine = randInt(rng, 40000, 44999);
    const rows = shuffle(rng, [
      `${host}:${randInt(rng, 50000, 54999)}  ↔  ${publicIp}:${mine}`,
      `${other}:${randInt(rng, 55000, 59999)}  ↔  ${publicIp}:${randInt(rng, 45000, 49999)}`,
    ]);
    return choice(rng, 'nat.outsideAddress', `Chegou uma resposta em ${publicIp}:${mine}. Para qual endereço o roteador entrega?`,
      host, [other, publicIp, inside], explainOutsideAddress(host, publicIp, 'back'), ['tabela do NAT', ...rows].join('\n'));
  }
  const svc = pick(rng, PUBLISHED_SERVICES);
  const publicPort = d >= 3 && rng() < 0.5 ? svc.altPort : svc.port;
  const wrongPort = pick(rng, PUBLISHED_SERVICES.filter((s) => s !== svc)).port;
  const rule = (from: string, fromPort: number, to: string, toPort: number) => `${from}:${fromPort} → ${to}:${toPort}`;
  const correct = rule(publicIp, publicPort, host, svc.port);
  const distractors = [
    rule(host, svc.port, publicIp, publicPort),
    rule(publicIp, publicPort, formatIp(broadcastAddress(nat.privateNetwork, nat.privatePrefix)), svc.port),
    rule(publicIp, publicPort, host, wrongPort),
    rule(publicIp, publicPort, formatIp(nat.privateNetwork), svc.port),
  ];
  if (publicPort !== svc.port) distractors.push(rule(publicIp, svc.port, host, publicPort));
  const where = publicPort === svc.port ? publicIp : `${publicIp}, na porta ${publicPort}`;
  return choice(rng, 'nat.portForward', `O ${svc.name} ${host} escuta na porta ${svc.port}. Que regra publica esse serviço em ${where}?`,
    correct, distractors, explainPortForward(correct, publicIp, host));
}

// ─── VLAN ─────────────────────────────────────────────────────────────────

export const VLAN_NAMES = [
  'Alunos', 'Professores', 'Secretaria', 'Biblioteca', 'Laboratório', 'Financeiro', 'Servidores', 'Visitantes',
  'Câmeras', 'Impressoras', 'Diretoria', 'Telefonia', 'Wi-Fi', 'Cantina', 'Ginásio', 'Auditório', 'Manutenção',
  'Portaria', 'Enfermaria', 'Almoxarifado',
];

export interface Vlan {
  id: number;
  name: string;
}

/** Why an ID can or cannot be given to a new VLAN. */
export function vlanIdVerdict(id: number): VlanIdVerdict {
  if (id === 1) return 'default';
  if (id >= 1002 && id <= 1005) return 'reserved';
  if (id < 1 || id > 4094) return 'range';
  return 'ok';
}

/** `count` VLANs with distinct names and IDs in tens; `first` leads the list when given. */
function someVlans(rng: Rng, count: number, first?: Vlan): Vlan[] {
  const vlans = first ? [first] : [];
  while (vlans.length < count) {
    const vlan = { id: randInt(rng, 1, 99) * 10, name: pick(rng, VLAN_NAMES) };
    if (!vlans.some((v) => v.id === vlan.id || v.name === vlan.name)) vlans.push(vlan);
  }
  return vlans;
}

const VERDICT_OPTIONS: Record<VlanIdVerdict, string> = {
  ok: 'Serve: está livre',
  default: 'Não: é a VLAN padrão, onde toda porta começa',
  reserved: 'Não: está entre os reservados, de 1002 a 1005',
  range: 'Não: fica fora da faixa de 1 a 4094',
};

function vlanRound(rng: Rng, d: Difficulty, focus?: ConceptId, _context?: RoundContext, typed?: TypedContext): Round {
  const type = roundType(rng, focus, { 'vlan.membership': [0], 'vlan.portMode': [1], 'vlan.validId': [2] }, d === 1 ? 1 : 2);

  if (type === 0) {
    // Two ports share the asked VLAN; every other port sits in another one.
    const [target, ...others] = someVlans(rng, d === 1 ? 2 : 3, typed?.vlan);
    const members = [target, target, ...Array.from({ length: d === 1 ? 3 : 5 }, (_, i) => others[i % others.length])];
    const ports = shuffle(rng, members.map((_, i) => i + 1));
    const rows = members.map((v, i) => ({ port: ports[i], text: `porta ${ports[i]}  VLAN ${v.id} · ${v.name}` })).sort((a, b) => a.port - b.port);
    const width = Math.max(...rows.map((r) => r.text.length)) + 4;
    const lines: string[] = [];
    for (let i = 0; i < rows.length; i += 2) lines.push(rows[i].text.padEnd(width) + (rows[i + 1]?.text ?? ''));
    return choice(rng, 'vlan.membership', `Pela tabela do switch, o PC da porta ${ports[0]} fala direto com o PC de qual porta?`,
      `Porta ${ports[1]}`, ports.slice(2).map((p) => `Porta ${p}`), explainVlanMembership(ports[0], ports[1], `${target.id} (${target.name})`),
      lines.join('\n').trimEnd());
  }
  if (type === 1) {
    const vlans = someVlans(rng, 3, typed?.vlan);
    const ids = vlans.map((v) => v.id);
    const access = (id: number) => `Porta de acesso na VLAN ${id}`;
    if (rng() < 0.5) {
      return choice(rng, 'vlan.portMode', `O cabo entre dois switches precisa levar as VLANs ${listJoin(ids.map(String))}. Como configurar a porta desse cabo?`,
        'Tronco', ids.map(access), explainPortMode(ids));
    }
    const [vlan] = vlans;
    const device = pick(rng, ['uma impressora', 'uma câmera', 'um telefone IP', 'um PC']);
    return choice(rng, 'vlan.portMode', `Uma porta do switch vai ligar ${device} da VLAN ${vlan.id} (${vlan.name}). Como configurar essa porta?`,
      access(vlan.id), ['Tronco', ...ids.slice(1).map(access)], explainPortMode([vlan.id]));
  }
  const invalid = d >= 3 ? [1, 0, 4095, 4096, 1002, 1003, 1004, 1005] : [1, 0, 4095, 4096];
  if (d >= 3 && rng() < 0.5) {
    const id = pick(rng, [randInt(rng, 2, 1001), ...invalid]);
    const verdict = vlanIdVerdict(id);
    return choice(rng, 'vlan.validId', `O ID ${id} serve para uma VLAN nova?`, VERDICT_OPTIONS[verdict], Object.values(VERDICT_OPTIONS),
      explainVlanId(id, verdict));
  }
  const name = typed?.vlan?.name ?? pick(rng, VLAN_NAMES);
  const id = typed?.vlan?.id ?? randInt(rng, 2, 400) * 10;
  return choice(rng, 'vlan.validId', `Você vai criar a VLAN ${name}. Qual destes IDs ela pode usar?`, String(id), invalid.map(String),
    explainVlanId(id, 'ok'));
}

// ─── IPv6 ─────────────────────────────────────────────────────────────────

const groupsToV6 = (groups: number[]) => groups.reduce((value, g) => (value << 16n) | BigInt(g), 0n);

/**
 * A host in 2001:db8::/32. Level 1 has one run of zero groups; higher levels
 * scatter zero groups (so the longest run must be found) and, at level 3,
 * groups with leading zeros.
 */
function randomV6Host(rng: Rng, d: Difficulty): bigint {
  if (d === 1) return groupsToV6([0x2001, 0xdb8, randInt(rng, 1, 0xfff), randInt(rng, 1, 0xff), 0, 0, 0, randInt(rng, 1, 0xff)]);
  let groups: number[];
  do groups = [0x2001, 0xdb8, ...Array.from({ length: 6 }, () => (rng() < 0.5 ? 0 : randInt(rng, 1, d >= 3 ? 0xffff : 0xfff)))];
  while (!/(^|,)0,0(,|$)/.test(groups.slice(2).join(',')) || groups[7] === 0);
  return groupsToV6(groups);
}

/** Wrong ways to shorten an address: each is invalid or names another address. */
function compressMistakes(value: bigint): string[] {
  const short = formatIpv6(value);
  const [head, tail] = short.split('::');
  const all = [...(head ? head.split(':') : []), ...(tail ? tail.split(':') : [])];
  const moved = Array.from({ length: all.length + 1 }, (_, k) => `${all.slice(0, k).join(':')}::${all.slice(k).join(':')}`);
  return [
    short.replace('::', ':'),
    short.replace(':', '::'),
    short.replace(/^2001/, '201'),
    short.replace(/^2001/, '21'),
    ...moved,
  ].filter((text) => text !== short && parseIpv6(text) !== value);
}

const V6_KIND_LABELS: Record<V6Kind, string> = {
  global: 'Global: vale na internet',
  linkLocal: 'Link-local: só vale no próprio link',
  loopback: 'Loopback: o próprio computador',
  multicast: 'Multicast: um grupo de destinos',
  uniqueLocal: 'Local única: privado, como o 192.168',
};

function v6OfKind(rng: Rng, kind: V6Kind, host: bigint): bigint {
  const word = () => BigInt(randInt(rng, 1, 0xffff));
  switch (kind) {
    case 'global': return host;
    case 'linkLocal': return (0xfe80n << 112n) | (word() << 48n) | word();
    case 'loopback': return 1n;
    case 'multicast': return parseIpv6(pick(rng, ['ff02::1', 'ff02::2', 'ff02::fb', 'ff05::1:3']))!;
    case 'uniqueLocal': return groupsToV6([0xfd00 | randInt(rng, 1, 0xff), randInt(rng, 1, 0xffff), randInt(rng, 1, 0xffff), randInt(rng, 1, 0xff), 0, 0, 0, randInt(rng, 1, 0xff)]);
  }
}

function ipv6Round(rng: Rng, d: Difficulty, focus?: ConceptId, _context?: RoundContext, typed?: TypedContext): Round {
  const type = roundType(rng, focus, { 'ipv6.compress': [0], 'ipv6.prefix': [1], 'ipv6.addressType': [2] }, 2);

  if (type === 0) {
    const value = typed?.ipv6?.host ?? randomV6Host(rng, d);
    const full = formatIpv6Full(value);
    const short = formatIpv6(value);
    return choice(rng, 'ipv6.compress', `Qual é a forma abreviada de ${full}?`, short, compressMistakes(value), explainCompress(full, short));
  }
  if (type === 1) {
    const value = typed?.ipv6?.host ?? randomV6Host(rng, 1);
    const length = d >= 2 && rng() < 0.4 ? 48 : 64;
    const host = formatIpv6(value);
    const net = (bits: number) => ipv6Network(value, bits);
    const written = (network: bigint) => `${formatIpv6(network)}/${length}`;
    const correct = written(net(length));
    const prompt = length === 64
      ? `Em qual rede /64 está o endereço ${host}?`
      : `Qual é o prefixo /48 da organização dona do endereço ${host}?`;
    return choice(rng, 'ipv6.prefix', prompt, correct, [
      `${host}/${length}`,
      written(net(length === 64 ? 48 : 64)),
      written(net(length) + (1n << BigInt(128 - length))),
      written(0x20010db8n << 96n),
    ], explainV6Prefix(host, correct, length));
  }
  const kinds: V6Kind[] = d === 1 ? ['global', 'linkLocal', 'loopback', 'multicast'] : ['global', 'linkLocal', 'loopback', 'multicast', 'uniqueLocal'];
  // A city node asks about its own address half of the time.
  const kind = typed?.ipv6 && rng() < 0.5 ? 'global' : pick(rng, kinds);
  const address = formatIpv6(v6OfKind(rng, kind, typed?.ipv6?.host ?? randomV6Host(rng, 1)));
  return choice(rng, 'ipv6.addressType', `Que tipo de endereço IPv6 é ${address}?`, V6_KIND_LABELS[kind], kinds.map((k) => V6_KIND_LABELS[k]),
    explainAddressType(address, kind));
}
