import { describe, expect, it } from 'vitest';
import {
  acknowledge, advance, ELEMENTS, goalLine, isCurrent, isVisible, type ElementId,
} from '../src/core/disclosure';
import { LOG_CAP } from '../src/core/log';
import { issueCertificate, presentCertificate } from '../src/core/certificates';
import {
  breach, buy, completeLesson, install, newGame, objective, setNetConfig, STARTING_MONEY, uninstall, type GameState,
} from '../src/core/state';

import { ELEMENT_TEXT, openingLine } from '../src/data/intros';
import { money } from '../src/core/fmt';
import { getNode } from '../src/data/nodes';
import { TIERS } from '../src/data/tiers';

const OPENING_LINE = openingLine(money(STARTING_MONEY));

/** Advances and acknowledges whatever is current until the queue is empty. */
function drain(state: GameState): ElementId[] {
  const seen: ElementId[] = [];
  advance(state);
  while (state.disclosure.current) {
    const id = state.disclosure.current as ElementId;
    seen.push(id);
    acknowledge(state, id);
  }
  return seen;
}

function online(): GameState {
  const s = newGame();
  s.money = 100000;
  for (const id of ['computer-basics', 'power', 'cpu', 'memory', 'storage', 'binary', 'network-basics', 'ip-addressing', 'dns']) completeLesson(s, id);
  for (const id of ['mb_b1', 'cpu_s1_2c', 'ram_4_ddr4', 'hdd_500', 'psu_250', 'nic_100', 'router_home']) {
    buy(s, id);
    install(s, id);
  }
  setNetConfig(s, { ip: '192.168.0.42', mask: '255.255.255.0', gateway: '192.168.0.1', dns: '192.168.0.1' });
  return s;
}

describe('disclosure queue', () => {
  it('opens a new game on Estudar alone, with the opening line in the log', () => {
    const s = newGame();
    expect(s.disclosure.log).toEqual([OPENING_LINE]);
    advance(s);
    expect(isCurrent(s, 'study')).toBe(true);
    expect(ELEMENTS.filter((e) => isVisible(s, e.id)).map((e) => e.id)).toEqual(['study']);
    expect(s.disclosure.log).toEqual([OPENING_LINE, ELEMENT_TEXT.study.log]);
  });

  it('promotes nothing more before a lesson is passed', () => {
    const s = newGame();
    expect(drain(s)).toEqual(['study']);
    expect(s.disclosure.current).toBeNull();
    expect(isVisible(s, 'shop')).toBe(false);
  });

  it('introduces the money counter first after the first lesson, and keeps the Loja hidden', () => {
    const s = newGame();
    drain(s);
    completeLesson(s, 'computer-basics');
    advance(s);
    expect(isCurrent(s, 'money')).toBe(true);
    expect(isVisible(s, 'shop')).toBe(false);
  });

  it('shows two elements that unlock together one at a time, in progression order', () => {
    const s = newGame();
    drain(s);
    completeLesson(s, 'computer-basics');
    advance(s);
    acknowledge(s, 'money');
    expect(isCurrent(s, 'shop')).toBe(true);
    expect(isVisible(s, 'reset')).toBe(false);
    acknowledge(s, 'shop');
    expect(isCurrent(s, 'reset')).toBe(true);
  });

  it('writes an element\'s log line once, however often the queue advances', () => {
    const s = newGame();
    advance(s);
    advance(s);
    expect(s.disclosure.log.filter((l) => l === ELEMENT_TEXT.study.log)).toHaveLength(1);
  });

  it('ignores acknowledging an element that is not current', () => {
    const s = newGame();
    advance(s);
    acknowledge(s, 'shop');
    expect(isCurrent(s, 'study')).toBe(true);
    expect(s.disclosure.introduced).toEqual([]);
  });

  it('hides an introduced Mapa da Rede while offline, and shows it again without reintroducing it', () => {
    const s = online();
    drain(s);
    expect(isVisible(s, 'net-map')).toBe(true);
    uninstall(s, 'nic');
    expect(isVisible(s, 'net-map')).toBe(false);
    install(s, 'nic_100');
    advance(s);
    expect(isVisible(s, 'net-map')).toBe(true);
    expect(isCurrent(s, 'net-map')).toBe(false);
  });

  it('keeps a current element queued but undrawn while it is unavailable, then draws it again', () => {
    const s = online();
    s.netConfig = null;
    advance(s);
    while (s.disclosure.current && s.disclosure.current !== 'net-setup') acknowledge(s, s.disclosure.current as ElementId);
    expect(isCurrent(s, 'net-setup')).toBe(true);
    const lines = s.disclosure.log.length;

    uninstall(s, 'router');
    advance(s);
    expect(isVisible(s, 'net-setup')).toBe(false);
    expect(isCurrent(s, 'net-setup')).toBe(true);
    expect(goalLine(s)).toBe(objective(s));

    install(s, 'router_home');
    advance(s);
    expect(isVisible(s, 'net-setup')).toBe(true);
    expect(isCurrent(s, 'net-setup')).toBe(true);
    expect(s.disclosure.log).toHaveLength(lines);
  });

  it('adds the Pós-graduação tab to the queue only once the first tier opens', () => {
    const s = online();
    drain(s);
    expect(isVisible(s, 'pos-tab')).toBe(false);
    issueCertificate(s, 'conclusao');
    presentCertificate(s, 'conclusao', 'Ana');
    expect(TIERS[0]).toBeDefined();
    advance(s);
    const order = drain(s);
    expect(order).toContain('pos-tab');
    expect(order.indexOf('certificates')).toBeLessThan(order.indexOf('pos-tab'));
  });

  it('names the current element in the goal line, and falls back to the objective once the queue is empty', () => {
    const s = newGame();
    drain(s);
    completeLesson(s, 'computer-basics');
    advance(s);
    acknowledge(s, 'money');
    expect(goalLine(s)).toBe(ELEMENT_TEXT.shop.goal);
    drain(s);
    expect(goalLine(s)).toBe(objective(s));
  });
});

describe('message log', () => {
  it(`keeps at most ${LOG_CAP} lines and drops the oldest`, () => {
    const s = newGame();
    for (let i = 0; i < LOG_CAP + 5; i++) {
      s.lessonsCompleted = [];
      completeLesson(s, 'computer-basics');
    }
    expect(s.disclosure.log).toHaveLength(LOG_CAP);
    expect(s.disclosure.log).not.toContain(OPENING_LINE);
  });

  it('adds one line for a passed lesson and one for a first breach', () => {
    const s = online();
    const before = s.disclosure.log.length;
    completeLesson(s, 'ethics');
    expect(s.disclosure.log).toHaveLength(before + 1);
    const target = getNode('isp');
    breach(s, target.id);
    expect(s.disclosure.log).toHaveLength(before + 2);
    expect(s.disclosure.log.at(-1)).toContain(target.name);
    breach(s, target.id);
    expect(s.disclosure.log).toHaveLength(before + 2);
  });
});

describe('intros text', () => {
  it('gives every element a log line and a goal, and has no text for unknown elements', () => {
    expect(Object.keys(ELEMENT_TEXT).sort()).toEqual(ELEMENTS.map((e) => e.id).sort());
    for (const text of Object.values(ELEMENT_TEXT)) {
      expect(text.log.length).toBeGreaterThan(0);
      expect(text.goal.length).toBeGreaterThan(0);
    }
  });
});
