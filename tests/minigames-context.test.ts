import { describe, expect, it } from 'vitest';
import { networkAddress, parseIp } from '../src/core/ip';
import { generateCity, roundContext } from '../src/core/city';
import { buildRounds, CONCEPTS, MAX_LEVEL, roundCount, type ConceptId, type Round, type RoundContext } from '../src/core/minigames';
import { createRng } from '../src/core/random';
import type { MinigameId } from '../src/data/nodes';

const AREAS: MinigameId[] = ['binary', 'subnet', 'ports', 'http', 'dns'];
const levels = (id: MinigameId) => Array.from({ length: MAX_LEVEL[id] }, (_, i) => i + 1);

/** 32-bit FNV-1a over the UTF-16 code units of a string, as 8 hex digits. */
function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Every round without a context: each area, level 1..MAX_LEVEL, seeds 1-30, unfocused and focused on each of its concepts. */
function allRoundsWithoutContext(): string {
  const out: unknown[] = [];
  for (const id of AREAS) {
    const concepts = (Object.keys(CONCEPTS) as ConceptId[]).filter((c) => CONCEPTS[c].area === id);
    for (const d of levels(id)) {
      for (let seed = 1; seed <= 30; seed++) {
        out.push(buildRounds(id, d, createRng(seed)));
        for (const c of concepts) out.push(buildRounds(id, d, createRng(seed), c));
      }
    }
  }
  return JSON.stringify(out);
}

/** Hash of allRoundsWithoutContext() captured before round contexts existed. */
const PINNED_ROUNDS_HASH = '733806dd';

describe('round context', () => {
  it('leaves rounds without a context exactly as pinned', () => {
    expect(fnv1a(allRoundsWithoutContext())).toBe(PINNED_ROUNDS_HASH);
  });

  const ip = (text: string) => parseIp(text)!;
  const ctx24: RoundContext = { network: ip('10.4.2.0'), prefix: 24, host: ip('10.4.2.17') };
  const inside = (text: string, ctx: RoundContext) => networkAddress(ip(text), ctx.prefix) === ctx.network;
  const ADDRESS_CONCEPTS: ConceptId[] = ['subnet.sameNetwork', 'subnet.networkAddress', 'subnet.broadcast'];

  const expectValid = (rounds: Round[], id: MinigameId, d: number) => {
    expect(rounds.length).toBe(roundCount(d));
    for (const r of rounds) {
      expect(CONCEPTS[r.concept].area).toBe(id);
      if (r.kind === 'choice') {
        expect(r.options.length).toBeGreaterThanOrEqual(2);
        expect(new Set(r.options).size).toBe(r.options.length);
        expect(r.answer).toBeGreaterThanOrEqual(0);
        expect(r.answer).toBeLessThan(r.options.length);
      } else {
        expect(r.target).toBeGreaterThan(0);
        expect(r.target).toBeLessThan(2 ** r.bits);
      }
    }
  };

  /** The address a subnet round asks about, when its prompt shows one in CIDR form. */
  const askedCidr = (r: Round) => {
    const m = /(\d+\.\d+\.\d+\.\d+)\/(\d+)/.exec(r.prompt);
    return m ? { ip: m[1], prefix: Number(m[2]) } : null;
  };
  const usesContext = (r: Round, ctx: RoundContext) => {
    const asked = askedCidr(r);
    return asked !== null && asked.prefix === ctx.prefix && inside(asked.ip, ctx);
  };

  it('asks about the context subnet in at most two rounds, inside it', () => {
    let asked = 0;
    for (const d of levels('subnet')) {
      for (let seed = 1; seed <= 30; seed++) {
        for (const focus of [undefined, ...ADDRESS_CONCEPTS]) {
          const rounds = buildRounds('subnet', d, createRng(seed), focus, ctx24);
          const onContext = rounds.filter((r) => usesContext(r, ctx24));
          expect(onContext.length).toBeLessThanOrEqual(2);
          for (const r of onContext) {
            asked++;
            if (r.kind === 'choice' && ADDRESS_CONCEPTS.includes(r.concept)) expect(inside(r.options[r.answer], ctx24)).toBe(true);
          }
        }
      }
    }
    expect(asked).toBeGreaterThan(0);
  });

  it('draws the other rounds of a city node at its difficulty, never repeating a prompt', () => {
    let otherPrefixes = 0;
    for (let level = 1; level <= 12; level++) {
      for (let seed = 1; seed <= 20; seed++) {
        const city = generateCity(level, seed);
        for (const node of city.nodes.filter((n) => n.minigame === 'subnet')) {
          const ctx = roundContext(city, node.id)!;
          const rounds = buildRounds('subnet', node.difficulty, createRng(seed), undefined, ctx);
          expect(new Set(rounds.map((r) => r.prompt)).size).toBe(rounds.length);
          expect(rounds.filter((r) => usesContext(r, ctx)).length).toBeLessThanOrEqual(2);
          if (node.difficulty >= 3) otherPrefixes += rounds.filter((r) => (askedCidr(r)?.prefix ?? ctx.prefix) !== ctx.prefix).length;
        }
      }
    }
    expect(otherPrefixes).toBeGreaterThan(0);
  });

  it('keeps every round valid with a context', () => {
    const contexts: RoundContext[] = [
      ctx24,
      { network: ip('10.7.0.0'), prefix: 26, host: ip('10.7.0.5') },
      { network: ip('10.9.0.0'), prefix: 16, host: ip('10.9.3.1') },
    ];
    for (const ctx of contexts) {
      for (const id of AREAS) {
        for (const d of levels(id)) {
          for (let seed = 1; seed <= 10; seed++) {
            expectValid(buildRounds(id, d, createRng(seed), undefined, ctx), id, d);
          }
        }
      }
    }
  });

  it('asks to build a nonzero octet of the host, other than the first, in at most two rounds at binary level 3', () => {
    const ctx: RoundContext = { network: ip('10.4.2.0'), prefix: 24, host: ip('10.4.0.200') };
    let fromHost = 0;
    for (let seed = 1; seed <= 30; seed++) {
      for (const focus of [undefined, 'binary.toBinary'] as const) {
        const bits = buildRounds('binary', 3, createRng(seed), focus, ctx).filter((r) => r.kind === 'bits');
        const octets = bits.filter((r) => r.kind === 'bits' && [4, 200].includes(r.target));
        expect(octets.length).toBeLessThanOrEqual(2);
        fromHost += octets.length;
      }
    }
    expect(fromHost).toBeGreaterThan(0);
  });

  it('never gives away a decimal answer that the node address shows', () => {
    // The mini-game title shows the node's IP, so its octets cannot be answers.
    const ctx: RoundContext = { network: ip('10.4.2.0'), prefix: 24, host: ip('10.4.0.200') };
    for (let seed = 1; seed <= 30; seed++) {
      for (const r of buildRounds('binary', 3, createRng(seed), 'binary.toDecimal', ctx)) {
        if (r.concept !== 'binary.toDecimal' || r.kind !== 'choice') continue;
        expect(r.options[r.answer]).not.toBe('200');
      }
    }
  });

  it('never asks for a zero bits target when an octet of the host is zero', () => {
    const ctx: RoundContext = { network: ip('10.7.0.0'), prefix: 24, host: ip('10.7.0.5') };
    for (let seed = 1; seed <= 30; seed++) {
      for (const r of buildRounds('binary', 3, createRng(seed), 'binary.toBinary', ctx)) {
        if (r.kind === 'bits') expect(r.target).toBeGreaterThan(0);
      }
    }
  });

  it('falls back to a random value when no octet after the first is nonzero', () => {
    const ctx: RoundContext = { network: ip('10.0.0.0'), prefix: 8, host: ip('10.0.0.0') };
    for (let seed = 1; seed <= 10; seed++) expectValid(buildRounds('binary', 3, createRng(seed), undefined, ctx), 'binary', 3);
  });

  it('fills a full level-1 subnet game from one /24 context', () => {
    for (let seed = 1; seed <= 30; seed++) {
      expect(buildRounds('subnet', 1, createRng(seed), undefined, ctx24).length).toBe(roundCount(1));
    }
  });
});
