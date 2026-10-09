import { describe, expect, it } from 'vitest';
import { parseIp } from '../src/core/ip';
import { parseIpv6 } from '../src/core/ipv6';
import { jobBoard } from '../src/core/jobs';
import { buildRounds, CONCEPTS, privateRangeOf, vlanIdVerdict, type ChoiceRound, type TypedContext } from '../src/core/minigames';
import { createRng } from '../src/core/random';
import { newGame } from '../src/core/state';

const ip = (text: string) => parseIp(text)!;

const NAT: TypedContext = {
  nat: { publicIp: ip('203.0.113.7'), privateNetwork: ip('192.168.10.0'), privatePrefix: 24, privateHost: ip('192.168.10.20') },
};

function choiceRounds(area: 'nat' | 'vlan' | 'ipv6', level: number, focus: keyof typeof CONCEPTS, typed?: TypedContext): ChoiceRound[] {
  const rounds: ChoiceRound[] = [];
  for (let seed = 1; seed <= 30; seed++) {
    for (const r of buildRounds(area, level, createRng(seed), focus, undefined, typed)) {
      if (r.kind === 'choice' && r.concept === focus) rounds.push(r);
    }
  }
  return rounds;
}

describe('NAT, VLAN and IPv6 areas', () => {
  it('each area has three concepts', () => {
    for (const area of ['nat', 'vlan', 'ipv6']) {
      expect(Object.values(CONCEPTS).filter((c) => c.area === area)).toHaveLength(3);
    }
  });

  it('knows the three private ranges and their near misses', () => {
    expect(privateRangeOf(ip('172.31.255.1'))).toBe('172.16.0.0/12');
    expect(privateRangeOf(ip('192.168.0.42'))).toBe('192.168.0.0/16');
    expect(privateRangeOf(ip('10.200.0.1'))).toBe('10.0.0.0/8');
    for (const pub of ['172.32.0.1', '172.15.9.9', '192.169.0.1', '11.0.0.1']) expect(privateRangeOf(ip(pub)), pub).toBeNull();
  });

  it('a port-forwarding rule round in a NAT city publishes the city host on the city public address', () => {
    const rules = choiceRounds('nat', 3, 'nat.portForward', NAT).filter((r) => r.options[r.answer].includes('→'));
    expect(rules.length).toBeGreaterThan(0);
    for (const r of rules) expect(r.options[r.answer]).toMatch(/^203\.0\.113\.7:\d+ → 192\.168\.10\.20:\d+$/);
  });

  it('private-or-public rounds in a NAT city ask about PCs of the city site, among other addresses', () => {
    const asked = choiceRounds('nat', 1, 'nat.privateRange', NAT)
      .map((r) => /O endereço (\S+) é/.exec(r.prompt)?.[1])
      .filter((a): a is string => a !== undefined);
    const inSite = asked.filter((a) => a.startsWith('192.168.10.'));
    expect(inSite.length).toBeGreaterThan(0);
    expect(new Set(inSite).size).toBeGreaterThan(1);
  });

  it('an IPv6 shortening round has exactly one option with the asked address', () => {
    for (let level = 1; level <= 3; level++) {
      for (const r of choiceRounds('ipv6', level, 'ipv6.compress')) {
        const match = /(?:de|que) (\S+)\?$/.exec(r.prompt);
        if (!match) continue;
        const asked = parseIpv6(match[1]);
        expect(asked).not.toBeNull();
        expect(r.options.filter((o) => parseIpv6(o) === asked), r.prompt).toEqual([r.options[r.answer]]);
      }
    }
  });

  it('a prefix round in an IPv6 city asks about an address of the node /64', () => {
    const host = parseIpv6('2001:db8:4b2:17::2a')!;
    const rounds = choiceRounds('ipv6', 2, 'ipv6.prefix', { ipv6: { host } });
    const addresses = rounds.map((r) => r.prompt.match(/[0-9a-f]*:[0-9a-f:]{2,}/g) ?? []).filter((a) => a.length > 0);
    expect(addresses.length).toBeGreaterThan(0);
    for (const found of addresses) {
      expect(found.some((a) => a.startsWith('2001:db8:4b2:17::')), found.join(' ')).toBe(true);
    }
  });

  it('a VLAN membership round in a VLAN city asks about the node VLAN', () => {
    for (const r of choiceRounds('vlan', 2, 'vlan.membership', { vlan: { id: 230, name: 'Secretaria' } })) {
      expect(r.explain.steps).toContain('230 (Secretaria)');
    }
  });

  it('a typed city node never repeats a question within one intrusion', () => {
    const contexts: ['nat' | 'vlan' | 'ipv6', TypedContext][] = [
      ['nat', NAT],
      ['vlan', { vlan: { id: 230, name: 'Secretaria' } }],
      ['ipv6', { ipv6: { host: parseIpv6('2001:db8:4b2:17::2a')! } }],
    ];
    for (const [area, typed] of contexts) {
      for (let level = 1; level <= 3; level++) {
        for (let seed = 1; seed <= 30; seed++) {
          const rounds = buildRounds(area, level, createRng(seed), undefined, undefined, typed);
          const keys = rounds.map((r) => r.prompt + (r.kind === 'choice' ? r.detail ?? '' : ''));
          expect(new Set(keys).size, `${area} level ${level} seed ${seed}: ${keys.join(' | ')}`).toBe(rounds.length);
        }
      }
    }
  });

  it('offers as many question shapes as the other level 1-3 areas', () => {
    const shape = (p: string) => p.replace(/[0-9a-f]*:[0-9a-f:]{2,}(\/\d+)?/gi, '#').replace(/[\d.]+/g, '#')
      .replace(/\(([\p{Lu}][\p{L}-]+)\)/gu, '#').replace(/VLAN [\p{Lu}][\p{L}-]+\./gu, 'VLAN #.')
      .replace(/(uma impressora|uma câmera|um telefone IP|um PC)/g, '#')
      .replace(/O (servidor web|servidor HTTPS|servidor SSH|servidor FTP|banco de dados MySQL)/g, '#');
    const minimum = [6, 10, 12];
    for (const area of ['nat', 'vlan', 'ipv6'] as const) {
      for (let level = 1; level <= 3; level++) {
        const shapes = new Set<string>();
        for (let seed = 1; seed <= 200; seed++) for (const r of buildRounds(area, level, createRng(seed))) shapes.add(shape(r.prompt));
        expect(shapes.size, `${area} level ${level}`).toBeGreaterThanOrEqual(level === 1 && area === 'vlan' ? 5 : minimum[level - 1]);
      }
    }
  });

  it('judges VLAN IDs: the default, the reserved ones and the range', () => {
    expect(vlanIdVerdict(1)).toBe('default');
    for (const id of [1002, 1003, 1004, 1005]) expect(vlanIdVerdict(id)).toBe('reserved');
    for (const id of [0, 4095, 4096]) expect(vlanIdVerdict(id)).toBe('range');
    for (const id of [2, 1001, 1006, 4094]) expect(vlanIdVerdict(id)).toBe('ok');
  });

  it('the board offers no NAT job before both NAT lessons are done', () => {
    const s = newGame();
    s.lessonsCompleted.push('nat-basics');
    expect(jobBoard(s).some((j) => j.area === 'nat')).toBe(false);
    s.lessonsCompleted.push('port-forwarding');
    expect(jobBoard(s).some((j) => j.area === 'nat')).toBe(true);
  });
});
