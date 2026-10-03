import { describe, expect, it } from 'vitest';
import { agree, decimal, linkSpeed, money, plural } from '../src/core/fmt';

describe('fmt', () => {
  it('formats money in reais, without cents for whole amounts', () => {
    expect(money(1200)).toBe('R$ 1.200');
    expect(money(0)).toBe('R$ 0');
    expect(money(1234567)).toBe('R$ 1.234.567');
  });

  it('formats fractional money with two decimals and a comma', () => {
    expect(money(4.5)).toBe('R$ 4,50');
  });

  it('never emits a non-breaking space', () => {
    expect(money(1200)).not.toMatch(/ /);
  });

  it('writes decimals with a comma and leaves integers alone', () => {
    expect(decimal(4.8)).toBe('4,8');
    expect(decimal(76.8)).toBe('76,8');
    expect(decimal(64)).toBe('64');
    expect(decimal(2.4)).toBe('2,4');
  });

  it('formats link speeds', () => {
    expect(linkSpeed(100)).toBe('100 Mbps');
    expect(linkSpeed(1000)).toBe('1 Gbps');
    expect(linkSpeed(2500)).toBe('2,5 Gbps');
    expect(linkSpeed(10000)).toBe('10 Gbps');
  });

  it('uses the singular only for exactly one', () => {
    expect(plural(1, 'erro', 'erros')).toBe('1 erro');
    expect(plural(0, 'erro', 'erros')).toBe('0 erros');
    expect(plural(2, 'erro', 'erros')).toBe('2 erros');
    expect(plural(4, 'erro', 'erros')).toBe('4 erros');
  });

  it('picks the word form that agrees with the gender', () => {
    expect(agree('f', 'instalado', 'instalada')).toBe('instalada');
    expect(agree('m', 'instalado', 'instalada')).toBe('instalado');
  });
});
