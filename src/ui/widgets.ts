import Phaser from 'phaser';
import { game } from '../core/store';
import { objective } from '../core/state';

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
  const label = scene.add.text(w / 2, h / 2, text, textStyle(opts.size ?? 18, color, { align: 'center' })).setOrigin(0.5);
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

/** Top bar with title, money and a back button. */
export function header(scene: Phaser.Scene, title: string, back?: () => void) {
  scene.add.rectangle(0, 0, WIDTH, 56, COLORS.panel).setOrigin(0).setStrokeStyle(1, COLORS.panelBorder);
  scene.add.text(back ? 140 : 24, 28, title, textStyle(24, COLORS.accent)).setOrigin(0, 0.5);
  const money = scene.add.text(WIDTH - 24, 28, '', textStyle(22, COLORS.warn)).setOrigin(1, 0.5);
  const refresh = () => money.setText(`$${game().money}`);
  refresh();
  if (back) button(scene, 12, 10, 110, 36, '< Back', back, { size: 16 });
  return { refresh };
}

/** Bottom strip with the current objective. */
export function objectiveBar(scene: Phaser.Scene) {
  scene.add.rectangle(0, HEIGHT - 40, WIDTH, 40, COLORS.panel).setOrigin(0).setStrokeStyle(1, COLORS.panelBorder);
  const label = scene.add.text(16, HEIGHT - 20, '', textStyle(16, COLORS.info)).setOrigin(0, 0.5);
  const refresh = () => label.setText(`▶ ${objective(game())}`);
  refresh();
  return { refresh };
}

/** Floating message that fades out. */
export function toast(scene: Phaser.Scene, message: string, color = COLORS.accent) {
  const t = scene.add.text(WIDTH / 2, HEIGHT - 70, message, textStyle(18, color, {
    backgroundColor: hex(COLORS.panel), padding: { x: 14, y: 8 },
  })).setOrigin(0.5).setDepth(1000);
  scene.tweens.add({ targets: t, alpha: 0, delay: 1800, duration: 500, onComplete: () => t.destroy() });
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
