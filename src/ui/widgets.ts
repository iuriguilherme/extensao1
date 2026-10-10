import Phaser from 'phaser';
import { game, save } from '../core/store';
import { money } from '../core/fmt';
import { acknowledge, goalLine, isCardSeen, isCurrent, isVisible, logLines, markCardSeen, type CardId, type ElementId } from '../core/disclosure';
import { CARD_TEXT } from '../data/intros';

export const WIDTH = 1280;
export const HEIGHT = 720;

export const COLORS = {
  bg: 0x05080d,
  panel: 0x0d1621,
  panelBorder: 0x1f3a4d,
  accent: 0x39ff88,
  accentDim: 0x1a6b42,
  warn: 0xffc247,
  danger: 0xff4d6a,
  info: 0x4dc3ff,
  muted: 0x5b7083,
  text: 0xd8f5e5,
};

export const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

export const FONT = '"Fira Code", "Consolas", "Courier New", monospace';

export function textStyle(size = 18, color = COLORS.text, extra: Phaser.Types.GameObjects.Text.TextStyle = {}) {
  return { fontFamily: FONT, fontSize: `${size}px`, color: hex(color), ...extra };
}

export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, border = COLORS.panelBorder) {
  return scene.add.rectangle(x, y, w, h, COLORS.panel).setOrigin(0).setStrokeStyle(2, border);
}

export interface ButtonOptions {
  disabled?: boolean;
  color?: number;
  size?: number;
  /** Wrap the label over several lines; it then shrinks to fit the button's height. */
  wrap?: boolean;
}

/** Smallest font size text shrinks to before it is considered unreadable. */
const MIN_FONT_SIZE = 11;

/**
 * Shrinks a text object's font step by step until it fits the box. Portuguese
 * runs longer than English, so every fixed frame uses this as a safety net.
 * A wrapped text is measured against maxHeight; a single line against maxWidth.
 */
export function fitText(text: Phaser.GameObjects.Text, maxWidth: number, maxHeight = Infinity): Phaser.GameObjects.Text {
  let size = parseInt(String(text.style.fontSize), 10);
  while (size > MIN_FONT_SIZE && (text.width > maxWidth || text.height > maxHeight)) {
    size -= 1;
    text.setFontSize(size);
  }
  return text;
}

export interface Button {
  container: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.Text;
  setDisabled(disabled: boolean): void;
}

/** A clickable rectangle with a label, top-left anchored. */
export function button(
  scene: Phaser.Scene, x: number, y: number, w: number, h: number,
  text: string, onClick: () => void, opts: ButtonOptions = {},
): Button {
  const color = opts.color ?? COLORS.accent;
  const bg = scene.add.rectangle(0, 0, w, h, COLORS.panel).setOrigin(0).setStrokeStyle(2, color);
  const label = scene.add.text(w / 2, h / 2, text, textStyle(opts.size ?? 18, color, {
    align: 'center', ...(opts.wrap ? { wordWrap: { width: w - 12 } } : {}),
  })).setOrigin(0.5);
  fitText(label, w - 12, h - 4);
  const container = scene.add.container(x, y, [bg, label]);
  let disabled = false;

  bg.setInteractive({ useHandCursor: true });
  bg.on('pointerover', () => { if (!disabled) bg.setFillStyle(COLORS.accentDim, 0.35); });
  bg.on('pointerout', () => bg.setFillStyle(COLORS.panel));
  bg.on('pointerdown', () => { if (!disabled) onClick(); });

  const setDisabled = (value: boolean) => {
    disabled = value;
    bg.setStrokeStyle(2, value ? COLORS.muted : color);
    label.setColor(hex(value ? COLORS.muted : color));
    if (value) bg.setFillStyle(COLORS.panel);
  };
  setDisabled(!!opts.disabled);
  return { container, label, setDisabled };
}

/**
 * A real text field (an HTML input over the canvas), so accents and phone
 * keyboards work. Needs the DOM container enabled in the game config. Enter
 * calls onEnter; the input is removed with its scene or with destroy().
 */
export function textInput(
  scene: Phaser.Scene, x: number, y: number, w: number, h: number,
  opts: { value?: string; maxLength: number; onEnter: () => void },
): { value(): string; setVisible(visible: boolean): void; destroy(): void } {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = opts.value ?? '';
  input.maxLength = opts.maxLength;
  input.autocomplete = 'off';
  input.spellcheck = false;
  Object.assign(input.style, {
    width: `${w}px`, height: `${h}px`, boxSizing: 'border-box', padding: '0 16px', outline: 'none',
    font: `${Math.round(h * 0.5)}px ${FONT}`, color: hex(COLORS.text), background: hex(COLORS.panel),
    border: `2px solid ${hex(COLORS.accent)}`, borderRadius: '0',
  });
  input.addEventListener('keydown', (e) => {
    // Typed keys stay in the field; only Enter does something in the game.
    e.stopPropagation();
    if (e.key === 'Enter') opts.onEnter();
  });
  const element = scene.add.dom(x, y, input).setOrigin(0);
  // Focus once the element is in the page, with the cursor after any kept text.
  scene.time.delayedCall(0, () => {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  });
  return { value: () => input.value, setVisible: (visible) => element.setVisible(visible), destroy: () => element.destroy() };
}

/**
 * Top bar with title, money and a back button. The money shows only once it
 * has been introduced. A screen with a card shows it the first time it opens
 * and gets a "?" at the right edge to show it again.
 */
export function header(scene: Phaser.Scene, title: string, back?: () => void, card?: CardId) {
  scene.add.rectangle(0, 0, WIDTH, 56, COLORS.panel).setOrigin(0).setStrokeStyle(1, COLORS.panelBorder);
  scene.add.text(back ? 140 : 24, 28, title, textStyle(24, COLORS.accent)).setOrigin(0, 0.5);
  const cashRight = card ? WIDTH - 72 : WIDTH - 24;
  const cash = scene.add.text(cashRight, 28, '', textStyle(22, COLORS.warn)).setOrigin(1, 0.5);
  const refresh = () => cash.setText(money(game().money)).setVisible(isVisible(game(), 'money'));
  refresh();
  pulseIfCurrent(scene, 'money', cash);
  if (back) button(scene, 12, 10, 110, 36, '< Voltar', back, { size: 16 });
  if (card) {
    button(scene, WIDTH - 56, 10, 40, 36, '?', () => introCard(scene, card), { size: 18, color: COLORS.info });
    showCardOnce(scene, card);
  }
  return { refresh };
}

/** Bottom strip naming the player's next step. */
export function goalBar(scene: Phaser.Scene) {
  scene.add.rectangle(0, HEIGHT - 40, WIDTH, 40, COLORS.panel).setOrigin(0).setStrokeStyle(1, COLORS.panelBorder);
  const label = scene.add.text(16, HEIGHT - 20, '', textStyle(16, COLORS.info)).setOrigin(0, 0.5);
  // Long goals shrink to fit the bar instead of running off the canvas.
  const refresh = () => fitText(label.setText(`▶ ${goalLine(game())}`).setFontSize(16), WIDTH - 32);
  refresh();
  return { refresh };
}

/** Lines of the desk's message log kept in view; older ones scroll away. */
export const LOG_LINES_IN_VIEW = 5;

/** The desk's message log: the newest lines, the latest brightest. */
export function messageLog(scene: Phaser.Scene, x: number, y: number, w: number, h: number) {
  panel(scene, x, y, w, h);
  const lines = logLines(game()).slice(-LOG_LINES_IN_VIEW);
  const lineH = (h - 16) / LOG_LINES_IN_VIEW;
  lines.forEach((line, i) => {
    const newest = i === lines.length - 1;
    fitText(scene.add.text(x + 14, y + 8 + i * lineH, `> ${line}`, textStyle(14, newest ? COLORS.text : COLORS.muted, {
      wordWrap: { width: w - 28 },
    })), w - 28, lineH);
  });
}

/** Marks an element being introduced: it breathes until the player uses it. */
export function pulse(scene: Phaser.Scene, target: Phaser.GameObjects.Container | Phaser.GameObjects.Text) {
  return scene.tweens.add({ targets: target, alpha: 0.45, yoyo: true, repeat: -1, duration: 650, ease: 'Sine.easeInOut' });
}

/** Pulses the element's control while it is the one being introduced. */
export function pulseIfCurrent(scene: Phaser.Scene, id: ElementId, target: Phaser.GameObjects.Container | Phaser.GameObjects.Text) {
  if (isCurrent(game(), id)) pulse(scene, target);
}

/** Using the element being introduced counts as its introduction; the next one may appear. */
export function useElement(id: ElementId): void {
  const state = game();
  if (!isCurrent(state, id)) return;
  acknowledge(state, id);
  save();
}

/**
 * The card that explains a screen's controls, over everything and blocking
 * clicks beneath it. The scene receives 'card-open' and 'card-close' events,
 * so a timed screen can stop its clock while the card is up.
 */
export function introCard(scene: Phaser.Scene, id: CardId, onClose?: () => void) {
  const text = CARD_TEXT[id];
  const w = 860;
  const h = 460;
  const x = (WIDTH - w) / 2;
  const y = (HEIGHT - h) / 2;
  const blocker = scene.add.rectangle(0, 0, WIDTH, HEIGHT, COLORS.bg, 0.8).setOrigin(0).setInteractive().setDepth(2000);
  const box = scene.add.rectangle(x, y, w, h, COLORS.panel).setOrigin(0).setStrokeStyle(2, COLORS.info).setDepth(2000);
  const title = scene.add.text(x + 30, y + 26, text.title, textStyle(26, COLORS.info)).setDepth(2000);
  const body = fitText(scene.add.text(x + 30, y + 80, text.lines.map((l) => `• ${l}`).join('\n\n'), textStyle(18, COLORS.text, {
    wordWrap: { width: w - 60 }, lineSpacing: 4,
  })).setDepth(2000), w - 60, h - 170);
  const ok = button(scene, x + w / 2 - 110, y + h - 76, 220, 52, 'Entendi', () => {
    for (const o of [blocker, box, title, body, ok.container]) o.destroy();
    scene.events.emit('card-close');
    onClose?.();
  }, { size: 20 });
  ok.container.setDepth(2001);
  scene.events.emit('card-open');
}

/**
 * Shows a screen's card the first time the screen opens and remembers it.
 * Returns whether a card opened; onClose runs once it is dismissed.
 */
export function showCardOnce(scene: Phaser.Scene, id: CardId, onClose?: () => void): boolean {
  const state = game();
  if (isCardSeen(state, id)) return false;
  markCardSeen(state, id);
  save();
  introCard(scene, id, onClose);
  return true;
}

/**
 * Floating message that fades out. Long messages wrap inside the canvas and
 * grow upward from above the goal bar, and stay longer on screen.
 */
export function toast(scene: Phaser.Scene, message: string, color = COLORS.accent) {
  const t = scene.add.text(WIDTH / 2, HEIGHT - 50, message, textStyle(18, color, {
    backgroundColor: hex(COLORS.panel), padding: { x: 14, y: 8 },
    align: 'center', wordWrap: { width: WIDTH - 120 },
  })).setOrigin(0.5, 1).setDepth(1000);
  const delay = Math.max(1800, message.length * 45);
  scene.tweens.add({ targets: t, alpha: 0, delay, duration: 500, onComplete: () => t.destroy() });
}

/**
 * Groups game objects that are rebuilt on every refresh, so scenes can simply
 * redraw their dynamic parts after a state change.
 */
export class Layer {
  private objects: Phaser.GameObjects.GameObject[] = [];
  constructor(private scene: Phaser.Scene) {}

  add<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.objects.push(obj);
    return obj;
  }

  text(x: number, y: number, content: string, style = textStyle()) {
    return this.add(this.scene.add.text(x, y, content, style));
  }

  button(x: number, y: number, w: number, h: number, label: string, onClick: () => void, opts?: ButtonOptions) {
    const b = button(this.scene, x, y, w, h, label, onClick, opts);
    this.add(b.container);
    return b;
  }

  rect(x: number, y: number, w: number, h: number, fill = COLORS.panel, border = COLORS.panelBorder) {
    return this.add(this.scene.add.rectangle(x, y, w, h, fill).setOrigin(0).setStrokeStyle(2, border));
  }

  clear() {
    for (const o of this.objects) o.destroy();
    this.objects = [];
  }
}
