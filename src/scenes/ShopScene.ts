import Phaser from 'phaser';
import { buy, canBuy, ownedCount } from '../core/state';
import { game, save } from '../core/store';
import { describeStats, PARTS, SLOT_LABELS, SLOTS, type Slot } from '../data/parts';
import { money } from '../core/fmt';
import { COLORS, fitText, header, Layer, goalBar, textStyle, toast, WIDTH } from '../ui/widgets';

export class ShopScene extends Phaser.Scene {
  private slot: Slot = 'motherboard';
  private layer!: Layer;
  private refreshHeader!: () => void;
  private refreshObjective!: () => void;

  constructor() {
    super('Shop');
  }

  create() {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.refreshHeader = header(this, 'Loja de Informática', () => this.scene.start('Hub')).refresh;
    this.refreshObjective = goalBar(this).refresh;
    this.layer = new Layer(this);
    this.draw();
  }

  private draw() {
    this.layer.clear();
    const state = game();
    const tabW = (WIDTH - 40) / SLOTS.length;
    SLOTS.forEach((slot, i) => {
      this.layer.button(20 + i * tabW, 70, tabW - 8, 40, SLOT_LABELS[slot], () => {
        this.slot = slot;
        this.draw();
      }, { size: 15, color: slot === this.slot ? COLORS.warn : COLORS.accent });
    });

    const parts = PARTS.filter((p) => p.slot === this.slot);
    parts.forEach((part, i) => {
      const y = 128 + i * 128;
      const check = canBuy(state, part);
      const locked = check.code === 'needs-lesson';
      const owned = ownedCount(state, part.id);
      this.layer.rect(20, y, WIDTH - 40, 116, COLORS.panel, locked ? COLORS.muted : COLORS.panelBorder);
      this.layer.text(40, y + 14, locked ? `🔒 ${part.name}` : part.name, textStyle(22, locked ? COLORS.muted : COLORS.accent));
      this.layer.text(40, y + 46, describeStats(part), textStyle(16, COLORS.info));
      fitText(this.layer.text(40, y + 72, part.description, textStyle(15, COLORS.text, { wordWrap: { width: 880 } })), 880, 40);
      this.layer.text(WIDTH - 250, y + 16, money(part.price), textStyle(24, COLORS.warn));
      if (owned) this.layer.text(WIDTH - 130, y + 20, `você já tem ${owned}`, textStyle(14, COLORS.muted));
      this.layer.button(WIDTH - 250, y + 56, 200, 42, check.ok ? 'Comprar' : check.reason!, () => {
        toast(this, buy(state, part.id));
        save();
        this.refreshHeader();
        this.refreshObjective();
        this.draw();
      }, { size: check.ok ? 18 : 14, disabled: !check.ok, wrap: !check.ok });
    });
  }
}
