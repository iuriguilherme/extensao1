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

  it('a port-forwarding round in a NAT city publishes the city host on the city public address', () => {
    const rounds = choiceRounds('nat', 3, 'nat.portForward', NAT);
    expect(rounds.length).toBeGreaterThan(0);
    for (const r of rounds) {
      const correct = r.options[r.answer];
      expect(correct).toMatch(/^203\.0\.113\.7:\d+ → 192\.168\.10\.20:\d+$/);
    }
  });

  it('a private-or-public round in a NAT city asks about the city addresses', () => {
    for (const r of choiceRounds('nat', 1, 'nat.privateRange', NAT)) {
      expect(r.prompt).toMatch(/192\.168\.10\.20|203\.0\.113\.7/);
    }
  });

  it('an IPv6 shortening round has exactly one option with the asked address', () => {
    for (let level = 1; level <= 3; level++) {
      for (const r of choiceRounds('ipv6', level, 'ipv6.compress')) {
        const asked = parseIpv6(/de (\S+)\?$/.exec(r.prompt)![1]);
        expect(asked).not.toBeNull();
        expect(r.options.filter((o) => parseIpv6(o) === asked), r.prompt).toEqual([r.options[r.answer]]);
      }
    }
  });

  it('an IPv6 round in an IPv6 city uses the node address', () => {
    const host = parseIpv6('2001:db8:4b2:17::2a')!;
    for (const r of choiceRounds('ipv6', 2, 'ipv6.prefix', { ipv6: { host } })) {
      expect(r.prompt).toContain('2001:db8:4b2:17::2a');
    }
  });

  it('a VLAN membership round in a VLAN city asks about the node VLAN', () => {
    for (const r of choiceRounds('vlan', 2, 'vlan.membership', { vlan: { id: 230, name: 'Secretaria' } })) {
      expect(r.explain.steps).toContain('230 (Secretaria)');
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
