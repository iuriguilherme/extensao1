import { describe, expect, it } from 'vitest';
import { networkAddress, parseIp } from '../src/core/ip';
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

  it('asks address rounds about addresses inside the context subnet', () => {
    let asked = 0;
    for (const d of levels('subnet')) {
      for (let seed = 1; seed <= 30; seed++) {
        for (const focus of [undefined, ...ADDRESS_CONCEPTS]) {
          for (const r of buildRounds('subnet', d, createRng(seed), focus, ctx24)) {
            if (!ADDRESS_CONCEPTS.includes(r.concept)) continue;
            asked++;
            const m = /(\d+\.\d+\.\d+\.\d+)\/(\d+)/.exec(r.prompt);
            expect(m).not.toBeNull();
            expect(Number(m![2])).toBe(24);
            expect(inside(m![1], ctx24)).toBe(true);
            if (r.kind === 'choice') expect(inside(r.options[r.answer], ctx24)).toBe(true);
          }
        }
      }
    }
    expect(asked).toBeGreaterThan(0);
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

  it('converts a nonzero octet of the host, other than the first, at binary level 3', () => {
    const ctx: RoundContext = { network: ip('10.4.2.0'), prefix: 24, host: ip('10.4.0.200') };
    let checked = 0;
    for (let seed = 1; seed <= 30; seed++) {
      for (const focus of [undefined, 'binary.toBinary', 'binary.toDecimal'] as const) {
        for (const r of buildRounds('binary', 3, createRng(seed), focus, ctx)) {
          if (r.concept === 'binary.combinations') continue;
          checked++;
          const value = r.kind === 'bits' ? r.target : Number(r.kind === 'choice' ? r.options[r.answer] : NaN);
          expect([4, 200]).toContain(value);
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
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
