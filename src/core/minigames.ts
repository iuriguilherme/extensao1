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
      prompt: `Flip the bits to make ${target}`,
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
      `What is ${toBinary(value, bits)} in decimal?`,
      String(value),
      near.map(String),
      `${toBinary(value, bits)} = ${placeBreakdown(value, bits)} = ${value}`,
    );
  }
  const n = randInt(rng, 2, 16);
  return choice(
    rng,
    `How many different values can ${n} bits represent?`,
    String(2 ** n),
    [String(2 ** n - 1), String(n * 2), String(2 ** (n + 1)), String(n ** 2), String(2 ** (n - 1))],
    `Each bit doubles the possibilities: 2^${n} = ${2 ** n}.`,
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
      `Which host is in the same network as ${cidr}?`,
      formatIp(inside),
      outside.map(formatIp),
      `${cidr} belongs to ${formatIp(net)}/${prefix} (${formatIp(net)} – ${formatIp(broadcastAddress(ip, prefix))}).`,
    );
  }
  if (type === 1) {
    const net = networkAddress(ip, prefix);
    return choice(
      rng,
      `What is the network address of ${cidr}?`,
      formatIp(net),
      [formatIp(ip), formatIp(broadcastAddress(ip, prefix)), formatIp((net + 1) >>> 0), formatIp(networkAddress(ip, prefix - 8 < 0 ? 0 : prefix - 8))],
      `Apply the mask ${formatIp(prefixToMask(prefix))}: keep the network bits, zero the host bits → ${formatIp(net)}.`,
    );
  }
  if (type === 2) {
    const p = randInt(rng, 22, 30);
    const hosts = usableHosts(p);
    return choice(
      rng,
      `How many usable host addresses are in a /${p} network?`,
      String(hosts),
      [String(hosts + 2), String(hosts + 1), String(2 ** (32 - p - 1)), String(32 - p), String(hosts * 2)],
      `/${p} leaves ${32 - p} host bits: 2^${32 - p} = ${2 ** (32 - p)}, minus network and broadcast = ${hosts}.`,
    );
  }
  const bcast = broadcastAddress(ip, prefix);
  const net = networkAddress(ip, prefix);
  return choice(
    rng,
    `What is the broadcast address of ${cidr}?`,
    formatIp(bcast),
    [formatIp(net), formatIp((bcast - 1) >>> 0), formatIp(broadcastAddress(ip, Math.max(8, prefix - 8))), formatIp((bcast + 1) >>> 0)],
    `Set every host bit to 1: ${formatIp(bcast)}. It is the last address of ${formatIp(net)}/${prefix}.`,
  );
}

// ─── Ports ────────────────────────────────────────────────────────────────

interface Service { name: string; port: number; proto: 'TCP' | 'UDP'; level: Difficulty }

export const SERVICES: Service[] = [
  { name: 'HTTP', port: 80, proto: 'TCP', level: 1 },
  { name: 'HTTPS', port: 443, proto: 'TCP', level: 1 },
  { name: 'SSH', port: 22, proto: 'TCP', level: 1 },
  { name: 'DNS', port: 53, proto: 'UDP', level: 1 },
  { name: 'SMTP (mail)', port: 25, proto: 'TCP', level: 1 },
  { name: 'FTP', port: 21, proto: 'TCP', level: 2 },
  { name: 'MySQL', port: 3306, proto: 'TCP', level: 2 },
  { name: 'Remote Desktop (RDP)', port: 3389, proto: 'TCP', level: 2 },
  { name: 'IMAP', port: 143, proto: 'TCP', level: 2 },
  { name: 'POP3', port: 110, proto: 'TCP', level: 2 },
  { name: 'Telnet', port: 23, proto: 'TCP', level: 3 },
  { name: 'PostgreSQL', port: 5432, proto: 'TCP', level: 3 },
  { name: 'DHCP server', port: 67, proto: 'UDP', level: 3 },
  { name: 'SNMP', port: 161, proto: 'UDP', level: 3 },
  { name: 'NTP (time)', port: 123, proto: 'UDP', level: 3 },
];

function portsRound(rng: Rng, d: Difficulty): Round {
  const pool = SERVICES.filter((s) => s.level <= d);
  const svc = pick(rng, pool);
  const others = pool.filter((s) => s !== svc);
  const type = randInt(rng, 0, d === 1 ? 1 : d === 2 ? 2 : 3);

  if (type === 0) {
    return choice(rng, `Which port does ${svc.name} use by default?`, String(svc.port), others.map((s) => String(s.port)),
      `${svc.name} listens on ${svc.proto} port ${svc.port}.`);
  }
  if (type === 1) {
    return choice(rng, `Port ${svc.port} is open. Which service is probably listening?`, svc.name, others.map((s) => s.name),
      `${svc.port}/${svc.proto} is the standard port for ${svc.name}.`);
  }
  if (type === 2) {
    const allowed = shuffle(rng, pool).slice(0, 2);
    const blocked = pool.filter((s) => !allowed.includes(s));
    const target = pick(rng, allowed);
    return choice(
      rng,
      'Firewall rules below. Which connection gets through?',
      `${target.name} to port ${target.port}`,
      blocked.map((s) => `${s.name} to port ${s.port}`),
      `Only ports ${allowed.map((s) => s.port).join(' and ')} are allowed; ${target.name} uses ${target.port}.`,
      [...allowed.map((s) => `ALLOW ${s.proto} ${s.port}`), 'DENY  ALL'].join('\n'),
    );
  }
  return choice(
    rng,
    `Which transport protocol does ${svc.name} typically use?`,
    svc.proto,
    [svc.proto === 'TCP' ? 'UDP' : 'TCP', 'ICMP', 'ARP'],
    svc.proto === 'TCP'
      ? `${svc.name} needs reliable, ordered delivery: TCP.`
      : `${svc.name} sends small, quick messages where speed beats guarantees: UDP.`,
  );
}

// ─── HTTP ─────────────────────────────────────────────────────────────────

interface Status { code: number; meaning: string; scenario: string; level: Difficulty }

export const STATUSES: Status[] = [
  { code: 200, meaning: 'OK', scenario: 'The page loaded normally', level: 1 },
  { code: 301, meaning: 'Moved Permanently', scenario: 'The page moved to a new URL for good', level: 1 },
  { code: 403, meaning: 'Forbidden', scenario: 'You are logged in but not allowed to see this', level: 1 },
  { code: 404, meaning: 'Not Found', scenario: 'The URL does not exist on the server', level: 1 },
  { code: 500, meaning: 'Internal Server Error', scenario: 'The server code crashed while answering', level: 1 },
  { code: 201, meaning: 'Created', scenario: 'A new user account was successfully created', level: 2 },
  { code: 204, meaning: 'No Content', scenario: 'Delete worked; there is nothing to send back', level: 2 },
  { code: 302, meaning: 'Found (temporary redirect)', scenario: 'Redirect to the login page for now', level: 2 },
  { code: 400, meaning: 'Bad Request', scenario: 'The request was malformed (broken JSON)', level: 2 },
  { code: 401, meaning: 'Unauthorized', scenario: 'You need to log in first', level: 2 },
  { code: 503, meaning: 'Service Unavailable', scenario: 'The server is overloaded or in maintenance', level: 2 },
  { code: 304, meaning: 'Not Modified', scenario: 'Your cached copy is still up to date', level: 3 },
  { code: 405, meaning: 'Method Not Allowed', scenario: 'You sent DELETE to an endpoint that only accepts GET', level: 3 },
  { code: 429, meaning: 'Too Many Requests', scenario: 'You hit the rate limit', level: 3 },
  { code: 502, meaning: 'Bad Gateway', scenario: 'The proxy got an invalid answer from the app server behind it', level: 3 },
];

const METHODS = [
  { method: 'GET', use: 'Read a resource without changing it' },
  { method: 'POST', use: 'Submit data to create something new' },
  { method: 'PUT', use: 'Replace a resource entirely' },
  { method: 'DELETE', use: 'Remove a resource' },
];

function httpRound(rng: Rng, d: Difficulty): Round {
  const pool = STATUSES.filter((s) => s.level <= d);
  const status = pick(rng, pool);
  const others = pool.filter((s) => s !== status);
  const type = randInt(rng, 0, 3);

  if (type === 0) {
    return choice(rng, `The server answered ${status.code}. What does it mean?`, status.meaning, others.map((s) => s.meaning),
      `${status.code} ${status.meaning}: ${status.scenario.toLowerCase()}.`);
  }
  if (type === 1) {
    return choice(rng, `Which status code fits: "${status.scenario}"?`, String(status.code), others.map((s) => String(s.code)),
      `${status.code} ${status.meaning}.`);
  }
  if (type === 2) {
    const m = pick(rng, METHODS);
    return choice(rng, `Which HTTP method should you use to: ${m.use.toLowerCase()}?`, m.method, METHODS.map((x) => x.method),
      `${m.method}: ${m.use}.`);
  }
  const klass = Math.floor(status.code / 100);
  const classes = ['Success', 'Redirection', 'Client error', 'Server error'];
  return choice(rng, `A ${status.code} response belongs to which class?`, classes[klass - 2], classes,
    `${klass}xx codes are ${classes[klass - 2].toLowerCase()}s.`);
}

// ─── DNS ──────────────────────────────────────────────────────────────────

interface RecordType { type: string; purpose: string; level: Difficulty }

export const RECORD_TYPES: RecordType[] = [
  { type: 'A', purpose: 'Maps a name to an IPv4 address', level: 1 },
  { type: 'AAAA', purpose: 'Maps a name to an IPv6 address', level: 1 },
  { type: 'CNAME', purpose: 'Makes a name an alias of another name', level: 1 },
  { type: 'MX', purpose: 'Names the mail server for a domain', level: 1 },
  { type: 'NS', purpose: 'Names the authoritative name servers of a domain', level: 2 },
  { type: 'TXT', purpose: 'Holds free text, e.g. domain ownership proofs', level: 2 },
  { type: 'PTR', purpose: 'Maps an IP address back to a name (reverse lookup)', level: 3 },
  { type: 'SOA', purpose: 'Start of Authority: zone serial and timers', level: 3 },
  { type: 'SRV', purpose: 'Locates a service by host and port', level: 3 },
];

function dnsRound(rng: Rng, d: Difficulty): Round {
  const pool = RECORD_TYPES.filter((r) => r.level <= d);
  const rec = pick(rng, pool);
  const others = pool.filter((r) => r !== rec);
  const type = randInt(rng, 0, 2);

  if (type === 0) {
    return choice(rng, `Which record type: "${rec.purpose}"?`, rec.type, others.map((r) => r.type), `${rec.type}: ${rec.purpose}.`);
  }
  if (type === 1) {
    return choice(rng, `What does the ${rec.type} record do?`, rec.purpose, others.map((r) => r.purpose), `${rec.type}: ${rec.purpose}.`);
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
    askMail ? `Where should email for @${domain} be delivered (IP)?` : `What IP does www.${domain} resolve to?`,
    answer,
    ips,
    askMail
      ? `MX points to mail.${domain}, whose A record is ${ips[2]}.`
      : useChain
        ? `www is a CNAME for web.${domain}, whose A record is ${ips[1]}.`
        : `www.${domain} has an A record: ${ips[0]}.`,
    shuffle(rng, lines).join('\n'),
  );
}
