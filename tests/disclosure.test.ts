import { describe, expect, it } from 'vitest';
import {
  acknowledge, advance, CARDS, ELEMENTS, logLines, isLessonListed, isNodeListed, isPartListed, listedSlots, goalLine, isCardSeen, isCurrent, isVisible, knownDisclosure, markCardSeen, type ElementId,
} from '../src/core/disclosure';
import { restore } from '../src/core/store';
import { LOG_CAP } from '../src/core/log';
import { issueCertificate, presentCertificate } from '../src/core/certificates';
import {
  breach, buy, canBuy, completeLesson, install, newGame, objective, setNetConfig, STARTING_MONEY, uninstall, type GameState,
} from '../src/core/state';

import { CARD_TEXT, ELEMENT_TEXT, openingLine, type ElementText } from '../src/data/intros';
import { money } from '../src/core/fmt';
import { getNode, NODES } from '../src/data/nodes';
import { getLesson, LESSONS } from '../src/data/lessons';
import { PARTS } from '../src/data/parts';

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
    expect(logLines(s)).toEqual([OPENING_LINE]);
    advance(s);
    expect(isCurrent(s, 'study')).toBe(true);
    expect(ELEMENTS.filter((e) => isVisible(s, e.id)).map((e) => e.id)).toEqual(['study']);
    expect(logLines(s)).toEqual([OPENING_LINE, ELEMENT_TEXT.study.log]);
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
    expect(logLines(s).filter((l) => l === ELEMENT_TEXT.study.log)).toHaveLength(1);
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
    expect(logLines(s)).not.toContain(OPENING_LINE);
  });

  it('adds one line for a passed lesson and one for a first breach', () => {
    const s = online();
    const before = s.disclosure.log.length;
    completeLesson(s, 'ethics');
    expect(s.disclosure.log).toHaveLength(before + 1);
    const target = getNode('isp');
    breach(s, target.id);
    expect(s.disclosure.log).toHaveLength(before + 2);
    expect(logLines(s).at(-1)).toContain(target.name);
    breach(s, target.id);
    expect(s.disclosure.log).toHaveLength(before + 2);
  });
});

describe('intros text', () => {
  it('gives every element a log line and every control a goal, and has no text for unknown elements', () => {
    expect(Object.keys(ELEMENT_TEXT).sort()).toEqual(ELEMENTS.map((e) => e.id).sort());
    for (const e of ELEMENTS) {
      const text: ElementText = ELEMENT_TEXT[e.id];
      expect(text.log.length).toBeGreaterThan(0);
      expect(!!text.goal).toBe(!e.passive);
    }
  });

  it('keeps the objective in the goal line while a passive element is being introduced', () => {
    const s = newGame();
    drain(s);
    completeLesson(s, 'computer-basics');
    advance(s);
    expect(isCurrent(s, 'money')).toBe(true);
    expect(goalLine(s)).toBe(objective(s));
  });
});

describe('saves from before disclosure', () => {
  function veteran(): GameState {
    const s = online();
    completeLesson(s, 'ethics');
    for (const id of ['isp', 'museum', 'resolver']) breach(s, id);
    return s;
  }

  it('counts everything an old save reached as introduced, with nothing current and no log lines', () => {
    const s = veteran();
    const known = knownDisclosure(s);
    expect(known.current).toBeNull();
    expect(known.log).toEqual([]);
    for (const id of ['study', 'money', 'shop', 'reset', 'workbench', 'net-setup', 'net-map', 'noc-tab'] as ElementId[]) {
      expect(known.introduced).toContain(id);
    }
    expect(known.introduced).not.toContain('cities');
  });

  it('marks the cards of reached screens as seen, and leaves the rest to open later', () => {
    const known = knownDisclosure(veteran());
    expect(known.cards).toEqual(expect.arrayContaining(['study', 'lesson', 'net-map', 'minigame', 'workbench', 'noc']));
    expect(known.cards).not.toContain('cities');
    expect(known.cards).not.toContain('city-map');
  });

  it('gives a save without the disclosure field the derived one, and keeps a stored one unchanged', () => {
    const old = JSON.parse(JSON.stringify(veteran())) as Record<string, unknown>;
    delete old.disclosure;
    const restored = restore(old as unknown as GameState);
    expect(restored.disclosure).toEqual(knownDisclosure(restored));

    const fresh = newGame();
    advance(fresh);
    const kept = restore(JSON.parse(JSON.stringify(fresh)) as GameState);
    expect(kept.disclosure).toEqual(fresh.disclosure);
  });

  it('drops a current element this version does not know, and the queue moves on', () => {
    const s = newGame();
    s.disclosure.current = 'achievements';
    const restored = restore(JSON.parse(JSON.stringify(s)) as GameState);
    expect(restored.disclosure.current).toBeNull();
    advance(restored);
    expect(isCurrent(restored, 'study')).toBe(true);
  });

  it('loads a save naming an element this version does not know', () => {
    const s = newGame();
    s.disclosure.introduced.push('achievements');
    const restored = restore(JSON.parse(JSON.stringify(s)) as GameState);
    advance(restored);
    expect(isCurrent(restored, 'study')).toBe(true);
  });
});

describe('cards', () => {
  it('shows a card once and remembers it', () => {
    const s = newGame();
    expect(isCardSeen(s, 'study')).toBe(false);
    markCardSeen(s, 'study');
    markCardSeen(s, 'study');
    expect(isCardSeen(s, 'study')).toBe(true);
    expect(s.disclosure.cards).toEqual(['study']);
  });
});

describe('card text', () => {
  it('gives every registered card a title and control lines, and nothing else', () => {
    expect(Object.keys(CARD_TEXT).sort()).toEqual(CARDS.map((c) => c.id).sort());
    for (const card of Object.values(CARD_TEXT)) {
      expect(card.title.length).toBeGreaterThan(0);
      expect(card.lines.length).toBeGreaterThan(0);
    }
  });
});

describe('lists inside screens', () => {
  it('lists only the first lesson before any lesson is passed', () => {
    const s = newGame();
    expect(LESSONS.filter((l) => isLessonListed(s, l.id)).map((l) => l.id)).toEqual(['computer-basics']);
  });

  it('lists one Shop slot, the motherboard, once the first lesson is done', () => {
    const s = newGame();
    completeLesson(s, 'computer-basics');
    expect(listedSlots(s)).toEqual(['motherboard']);
  });

  it('lists RAM the player cannot afford yet with its reason, and no network card before the network lesson', () => {
    const s = newGame();
    for (const id of ['computer-basics', 'memory']) completeLesson(s, id);
    s.money = 0;
    const listed = PARTS.filter((p) => isPartListed(s, p));
    expect(listed.some((p) => p.slot === 'ram')).toBe(true);
    expect(listed.some((p) => p.slot === 'nic')).toBe(false);
    expect(canBuy(s, listed.find((p) => p.slot === 'ram')!).code).toBe('no-money');
  });

  it('draws only the PC, a breached router and the machines it links to', () => {
    const s = online();
    breach(s, 'isp');
    const isp = getNode('isp');
    const listed = NODES.filter((n) => isNodeListed(s, n)).map((n) => n.id).sort();
    expect(listed).toEqual(['home', 'isp', ...isp.links.filter((id) => id !== 'home')].sort());
  });
});

describe('log entries', () => {
  it('saves ids, not text, and renders the text from them', () => {
    const s = online();
    completeLesson(s, 'ethics');
    expect(s.disclosure.log.at(-1)).toEqual({ kind: 'lesson', id: 'ethics', reward: getLesson('ethics').reward });
    expect(logLines(s).at(-1)).toContain(getLesson('ethics').title);
  });

  it('logs a certificate once and a finished city once', () => {
    const s = online();
    const before = s.disclosure.log.length;
    issueCertificate(s, 'conclusao');
    issueCertificate(s, 'conclusao');
    expect(s.disclosure.log.slice(before)).toEqual([{ kind: 'certificate', id: 'conclusao' }]);
  });

  it('skips an entry naming an element this build does not know', () => {
    const s = newGame();
    s.disclosure.log.push({ kind: 'element', id: 'achievements' });
    expect(logLines(s)).toEqual([OPENING_LINE]);
  });
});
