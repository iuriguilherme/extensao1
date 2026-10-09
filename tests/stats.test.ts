import { describe, expect, it } from 'vitest';
import { newGame } from '../src/core/state';
import { areaStats, recordAnswer } from '../src/core/stats';

describe('answer stats', () => {
  it('a correct answer counts as answered and correct, and remembers its concept once', () => {
    const s = newGame();
    recordAnswer(s, 'subnet.broadcast', true);
    expect(areaStats(s, 'subnet')).toEqual({ answered: 1, correct: 1 });
    expect(s.correctConcepts).toEqual(['subnet.broadcast']);
  });

  it('a wrong answer, a timeout included, counts as answered only', () => {
    const s = newGame();
    recordAnswer(s, 'ports.firewall', false);
    expect(areaStats(s, 'ports')).toEqual({ answered: 1, correct: 0 });
    expect(s.correctConcepts).toEqual([]);
  });

  it('keeps one entry per concept answered right more than once', () => {
    const s = newGame();
    recordAnswer(s, 'dns.resolve', true);
    recordAnswer(s, 'dns.resolve', true);
    recordAnswer(s, 'dns.recordType', true);
    expect(areaStats(s, 'dns')).toEqual({ answered: 3, correct: 3 });
    expect(s.correctConcepts).toEqual(['dns.resolve', 'dns.recordType']);
  });

  it('counts each area apart', () => {
    const s = newGame();
    recordAnswer(s, 'binary.toBinary', true);
    recordAnswer(s, 'http.method', false);
    expect(areaStats(s, 'binary')).toEqual({ answered: 1, correct: 1 });
    expect(areaStats(s, 'http')).toEqual({ answered: 1, correct: 0 });
  });

  it('reports an area with no answers as absent, not as 0%', () => {
    expect(areaStats(newGame(), 'subnet')).toBeNull();
  });
});
