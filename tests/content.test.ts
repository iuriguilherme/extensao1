/**
 * English scan: fails when player-visible text carries English outside the
 * glossary's kept terms (src/data/termos.ts). It reads text two ways:
 * - at runtime, from data, validations, objectives and generated rounds;
 * - from scene and widget source, as string/template literal text that
 *   contains a space (ids, scene keys and colors have none, so they are skipped).
 *
 * Single-word labels in scene source cannot be told apart from scene keys, so
 * the screen walkthrough checks those by eye.
 */

import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { computeSpecs } from '../src/core/hardware';
import { validateNetConfig, type LanInfo, type NetConfig } from '../src/core/ip';
import { buildRounds, CONCEPTS, MAX_LEVEL, STATUSES } from '../src/core/minigames';
import { LENS_LABELS } from '../src/core/explanations';
import { generateCity } from '../src/core/city';
import { createRng } from '../src/core/random';
import { routeChoices, validateRoute } from '../src/core/routing';
import { correctGate, gateChoices, validateGate, type GateEntry } from '../src/core/gates';
import { certificateTitle, issueCertificate, presentCertificate, validateStudentName } from '../src/core/certificates';
import {
  breach, buy, canBuy, checkRequirements, completeLesson, enterCityCode, install, newGame, objective, sell, setNetConfig, uninstall,
} from '../src/core/state';
import { TIERS } from '../src/data/tiers';
import { LESSONS, TRACK_LABELS } from '../src/data/lessons';
import { MINIGAME_AREAS, NODES, type MinigameId } from '../src/data/nodes';
import { describeStats, getPart, PARTS, SLOT_LABELS } from '../src/data/parts';
import { INGLES_PERMITIDO } from '../src/data/termos';
import { CARD_TEXT, ELEMENT_TEXT, type ElementText } from '../src/data/intros';
import { NODE_KIND_LABELS, NODE_KINDS } from '../src/data/nodeBuilds';
import { joinSwarm, leaveSwarm, removeSwitch } from '../src/core/swarm';

/**
 * Common English words that never appear in Portuguese text. Words that are
 * also Portuguese ("a", "as", "do", "no", "me", "some", "use", "time", "page",
 * "remove", "continue", "come", "more") are left out on purpose.
 */
const ENGLISH = new Set(`
the and of to in is are was were be been being it its this that these those with for from by on at or but not
your you we they he she his her their our my will would can could should must have has had does did done what
which who when where why how there here then than most less many much any every each other only also just
very too into over under about after before again all none yes out up down off if so because while until new
old first last next back open close buy sell install study lesson lessons shop workbench map network settings
setup step steps mistake mistakes allowed reward required requires requirement knowledge power storage card
router board empty inventory game save progress finish connect connected connecting connection failed lost
granted access wrong right correct question result review take see get make used uses using find found keep
need needs work works slow faster free inside outside enough money price owned welcome hello click press
`.split(/\s+/).filter(Boolean));

/**
 * All-caps entries (GET, ALL, DENY, DNS) are notation: they pass only when
 * written in caps, so a loose "get" or "all" in a sentence is still caught.
 */
const isNotation = (w: string) => /^[A-Z0-9]+$/.test(w);
const ALLOWED = new Set(INGLES_PERMITIDO.filter((w) => !isNotation(w)).map((w) => w.toLowerCase()));
const NOTATION = new RegExp(`\\b(${INGLES_PERMITIDO.filter(isNotation).join('|')})\\b`, 'g');

/** HTTP reason phrases are protocol notation: accepted only as whole phrases. */
const PROTOCOL_PHRASES = [...STATUSES.map((s) => s.meaning)].sort((a, b) => b.length - a.length);

function englishWords(text: string): string[] {
  let rest = text;
  for (const phrase of PROTOCOL_PHRASES) rest = rest.split(phrase).join(' ');
  rest = rest.replace(NOTATION, ' ');
  // Host and domain names (www.shop.test, mail.example.com) are notation too.
  rest = rest.replace(/[\p{L}\d@-]+(\.[\p{L}\d-]+)+/gu, ' ');
  // So are IPv6 addresses, whose hex groups can spell words (2001:db8::be).
  rest = rest.replace(/[0-9a-f]{0,4}(:[0-9a-f]{0,4}){2,7}/gi, ' ');
  return (rest.match(/\p{L}+/gu) ?? [])
    .map((w) => w.toLowerCase())
    .filter((w) => ENGLISH.has(w) && !ALLOWED.has(w));
}

// ─── Runtime text ─────────────────────────────────────────────────────────

const LAN: LanInfo = {
  routerIp: '192.168.0.1', mask: '255.255.255.0',
  takenBy: { 'Smart TV': '192.168.0.10' }, dnsServers: ['192.168.0.1'],
};
const GOOD: NetConfig = { ip: '192.168.0.42', mask: '255.255.255.0', gateway: '192.168.0.1', dns: '192.168.0.1' };
const BAD_CONFIGS: Partial<NetConfig>[] = [
  { ip: '192.168.0' }, { mask: '255.0.255.0' }, { mask: '255.255.0.0' }, { ip: '192.168.1.42' },
  { ip: '192.168.0.0' }, { ip: '192.168.0.255' }, { ip: '192.168.0.10' }, { gateway: 'x' },
  { gateway: '192.168.0.10' }, { dns: 'x' }, { dns: '8.8.8.8' },
];

function runtimeTexts(): string[] {
  const out: string[] = [];
  for (const l of LESSONS) out.push(l.title, ...l.pages, ...l.quiz.flatMap((q) => [q.question, ...q.options, q.explain]));
  for (const p of PARTS) out.push(p.name, p.description, describeStats(p));
  out.push(...Object.values(SLOT_LABELS), ...Object.values(TRACK_LABELS), ...Object.values(MINIGAME_AREAS));
  for (const n of NODES) out.push(n.name, n.flavor);
  // Disclosure: each element's log and goal line, and the log lines a new game and its events write.
  for (const t of Object.values(ELEMENT_TEXT) as ElementText[]) out.push(t.log, t.goal ?? '');
  for (const c of Object.values(CARD_TEXT)) out.push(c.title, ...c.lines);

  for (const build of [{}, { motherboard: 'mb_b1', cpu: 'cpu_s2_16c', ram: 'ram_32_ddr5', storage: 'hdd_500', psu: 'psu_250' }]) {
    out.push(...computeSpecs(build).issues.map((i) => i.message));
  }
  for (const bad of BAD_CONFIGS) out.push(...validateNetConfig({ ...GOOD, ...bad }, LAN).map((e) => e.message));

  // City node names and flavor, and every routing error the form's options can trigger.
  for (const city of [generateCity(1, 1), generateCity(12, 7)]) {
    for (const n of city.nodes) out.push(n.name, n.flavor);
    for (const router of city.nodes.filter((n) => n.role === 'router')) {
      const choices = routeChoices(city, router.id);
      for (const destination of choices.destination) for (const prefix of choices.prefix) for (const nextHop of choices.nextHop) {
        out.push(...validateRoute({ destination, prefix, nextHop }, city, router.id).map((e) => e.message));
      }
    }
  }

  // Typed city nodes and every error a typed gate's options can trigger, one wrong field at a time.
  for (const type of ['nat', 'vlan', 'ipv6'] as const) {
    const city = generateCity(9, 21, type);
    for (const n of city.nodes) out.push(n.name, n.flavor);
    for (const router of city.nodes.filter((n) => n.role === 'router')) {
      const right = correctGate(city, router.id) as unknown as Record<string, unknown>;
      for (const [field, options] of Object.entries(gateChoices(city, router.id))) {
        if (field === 'kind') continue;
        for (const option of options as unknown[]) {
          out.push(...validateGate(city, router.id, { ...right, [field]: option } as unknown as GateEntry).map((e) => e.message));
        }
      }
    }
  }

  // Walk the progression, collecting objectives, purchase reasons and results.
  const s = newGame();
  out.push(objective(s), canBuy(s, getPart('mb_b1')).reason ?? '', buy(s, 'mb_b1'));
  for (const id of ['computer-basics', 'power', 'cpu', 'memory', 'storage']) completeLesson(s, id);
  out.push(objective(s));
  for (const id of ['mb_b1', 'cpu_s1_2c', 'ram_4_ddr4', 'hdd_500', 'psu_250']) {
    out.push(buy(s, id), objective(s), install(s, id));
  }
  out.push(objective(s), uninstall(s, 'psu'), install(s, 'psu_250'));
  buy(s, 'cpu_s1_4c');
  out.push(install(s, 'cpu_s1_4c'), sell(s, 'cpu_s1_2c'));
  s.money = 0;
  out.push(canBuy(s, getPart('ram_16_ddr4')).reason ?? '');
  s.money = 10000;
  for (const id of ['binary', 'network-basics', 'ip-addressing', 'dns', 'ports', 'http']) {
    out.push(objective(s));
    completeLesson(s, id);
  }
  for (const id of ['nic_100', 'router_home']) out.push(buy(s, id), install(s, id), objective(s));
  setNetConfig(s, GOOD);
  out.push(objective(s));
  for (const n of NODES) out.push(...checkRequirements(s, n).map((c) => c.label));

  // Swarm and NOC actions, including the blocked and refused ones.
  s.inventory.push('sw_8_fast', 'router_gig');
  out.push(install(s, 'sw_8_fast'), joinSwarm(s, 'isp').message);
  for (const id of ['isp', 'museum', 'resolver', 'blog', 'shop', 'uni', 'mail', 'corp-fw']) {
    s.breached.push(id);
    out.push(joinSwarm(s, id).message);
  }
  out.push(joinSwarm(s, 'isp').message, leaveSwarm(s, 'core').message, leaveSwarm(s, 'isp').message);
  out.push(removeSwitch(s, s.noc[0].id).message, removeSwitch(s, 'sw9').message);
  out.push(install(s, 'router_gig'), uninstall(s, 'router'), leaveSwarm(s, 'museum').message);
  out.push(...NODE_KINDS.map((k) => NODE_KIND_LABELS[k]));
  s.breached.push('core');
  out.push(objective(s));

  // The pós-graduação goals, step by step, plus code and name errors.
  const grad = newGame();
  grad.lessonsCompleted.push('routing');
  breach(grad, 'core');
  presentCertificate(grad, 'conclusao', 'Ana');
  for (const tier of TIERS) {
    out.push(objective(grad));
    grad.lessonsCompleted.push(...tier.lessons);
    out.push(objective(grad));
    issueCertificate(grad, tier.id);
    presentCertificate(grad, tier.id);
  }
  out.push(objective(grad), certificateTitle('conclusao'));
  for (const code of ['VLAN-RIO-1-0001', 'IP6-RIO-1-0001', 'RIO-1-001']) {
    const entry = enterCityCode(newGame(), code);
    if (!entry.ok) out.push(entry.message);
  }
  for (const name of ['A', 'a'.repeat(31), 'Ana 2']) {
    const check = validateStudentName(name);
    if (!check.ok) out.push(check.message);
  }

  // Log lines the walk wrote: opening line, lessons, breaches and certificates.
  out.push(...s.disclosure.log, ...grad.disclosure.log);

  out.push(...Object.values(CONCEPTS).map((c) => c.label), ...Object.values(LENS_LABELS));
  const ids = Object.keys(MINIGAME_AREAS) as MinigameId[];
  for (const id of ids) {
    for (let d = 1; d <= MAX_LEVEL[id]; d++) {
      for (let seed = 1; seed <= 30; seed++) {
        for (const r of buildRounds(id, d, createRng(seed))) {
          out.push(r.prompt, ...Object.values(r.explain));
          if (r.kind === 'choice') out.push(...r.options);
        }
      }
    }
  }
  return out;
}

// ─── Source literals ──────────────────────────────────────────────────────

const SOURCES = import.meta.glob(['../src/scenes/*.ts', '../src/ui/*.ts'], {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>;

/** Variables whose literals are configuration, not text the player reads. */
const NOT_PLAYER_TEXT = new Set(['FONT']);

function sourceLiterals(path: string, code: string): string[] {
  const file = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true);
  const out: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && NOT_PLAYER_TEXT.has(node.name.text)) return;
    if (ts.isImportDeclaration(node)) return;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      out.push(node.text);
    } else if (ts.isTemplateExpression(node)) {
      // Only the literal pieces: `${…}` expressions are code, not text.
      out.push([node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join(' '));
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return out.filter((text) => /\s/.test(text.trim()));
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('English scan', () => {
  it('flags common English words and names the string', () => {
    expect(englishWords('Install the parts in your inventory')).toEqual(['install', 'the', 'in', 'your', 'inventory']);
    expect(englishWords('Click to continue')).toContain('click');
  });

  it('accepts kept terms, protocol notation and addresses', () => {
    expect(englishWords('O firewall libera DNS na porta 53')).toEqual([]);
    expect(englishWords('404 Not Found: o recurso não existe')).toEqual([]);
    expect(englishWords('192.168.0.0/24 · 1010 · ALLOW TCP 80')).toEqual([]);
    expect(englishWords('2001:db8::be/64 · fe80::add · ::1')).toEqual([]);
  });

  it('accepts protocol tokens only in caps', () => {
    expect(englishWords('ALLOW TCP 80 / DENY ALL / GET')).toEqual([]);
    expect(englishWords('Get all parts')).toEqual(['get', 'all']);
  });

  it('still catches loose English that only appears inside a reason phrase', () => {
    expect(englishWords('Not enough money')).toEqual(['not', 'enough', 'money']);
  });

  it('runtime game text is Portuguese', () => {
    const offenders = runtimeTexts()
      .map((text) => ({ text, words: englishWords(text) }))
      .filter((o) => o.words.length > 0);
    expect(offenders).toEqual([]);
  });

  it('scene and widget text is Portuguese', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(5);
    const offenders = Object.entries(SOURCES)
      .flatMap(([path, code]) => sourceLiterals(path, code).map((text) => ({ path, text, words: englishWords(text) })))
      .filter((o) => o.words.length > 0);
    expect(offenders).toEqual([]);
  });
});
