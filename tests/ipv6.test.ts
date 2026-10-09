import { describe, expect, it } from 'vitest';
import { formatIpv6, formatIpv6Full, inIpv6Prefix, ipv6Network, parseIpv6 } from '../src/core/ipv6';

const v6 = (text: string) => {
  const value = parseIpv6(text);
  if (value === null) throw new Error(`bad ipv6 ${text}`);
  return value;
};

describe('ipv6', () => {
  it('parses the compressed and full forms to the same value', () => {
    expect(parseIpv6('2001:db8::1')).toBe(parseIpv6('2001:0db8:0000:0000:0000:0000:0000:0001'));
    expect(parseIpv6('2001:db8::1')).toBe(0x20010db8000000000000000000000001n);
    expect(parseIpv6('::')).toBe(0n);
    expect(parseIpv6('::1')).toBe(1n);
    expect(parseIpv6('fe80::')).toBe(0xfe80n << 112n);
  });

  it('formats in compressed form, folding the longest zero run and the leftmost on a tie', () => {
    expect(formatIpv6(v6('2001:0db8:0000:0000:0000:0000:0000:0001'))).toBe('2001:db8::1');
    expect(formatIpv6(v6('2001:db8:0:0:1:0:0:0'))).toBe('2001:db8:0:0:1::');
    expect(formatIpv6(v6('2001:0:0:1:0:0:2:3'))).toBe('2001::1:0:0:2:3');
    expect(formatIpv6(v6('2001:db8:0:1:1:1:1:1'))).toBe('2001:db8:0:1:1:1:1:1');
    expect(formatIpv6(0n)).toBe('::');
    expect(formatIpv6(1n)).toBe('::1');
  });

  it('formats the full form with eight groups of four digits', () => {
    expect(formatIpv6Full(v6('2001:db8:4b2:17::2a'))).toBe('2001:0db8:04b2:0017:0000:0000:0000:002a');
  });

  it('rejects two "::", a five-digit group, nine groups and other junk', () => {
    for (const bad of ['2001:db8::1::2', '2001:db8:12345::1', '1:2:3:4:5:6:7:8:9', '1:2:3:4:5:6:7', '2001:dg8::1', ':1:2:3:4:5:6:7', '1:2:3:4:5:6:7:', '', ':::', '1:2:3:4::5:6:7:8']) {
      expect(parseIpv6(bad), bad).toBeNull();
    }
  });

  it('reads uppercase and writes lowercase', () => {
    expect(formatIpv6(v6('2001:DB8::ABCD'))).toBe('2001:db8::abcd');
  });

  it('finds the /64 network of an address', () => {
    expect(formatIpv6(ipv6Network(v6('2001:db8:4:2::5'), 64))).toBe('2001:db8:4:2::');
    expect(formatIpv6(ipv6Network(v6('2001:db8:4b2:17::2a'), 48))).toBe('2001:db8:4b2::');
  });

  it('tells whether an address is inside a prefix', () => {
    expect(inIpv6Prefix(v6('2001:db8:4:2::5'), v6('2001:db8:4:2::'), 64)).toBe(true);
    expect(inIpv6Prefix(v6('2001:db8:4:3::5'), v6('2001:db8:4:2::'), 64)).toBe(false);
    expect(inIpv6Prefix(v6('2001:db8:4:3::5'), v6('2001:db8:4::'), 48)).toBe(true);
  });
});
