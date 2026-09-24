import Phaser from 'phaser';
import { buy, canBuy } from '../core/state';
import { game, save } from '../core/store';
import { describeStats, PARTS, SLOT_LABELS, SLOTS, type Slot } from '../data/parts';
import { COLORS, header, Layer, objectiveBar, textStyle, toast, WIDTH } from '../ui/widgets';

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
    this.refreshHeader = header(this, 'Hardware Shop', () => this.scene.start('Hub')).refresh;
    this.refreshObjective = objectiveBar(this).refresh;
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
      const locked = check.reason?.startsWith('Study');
      const owned = state.inventory.filter((id) => id === part.id).length + (state.installed[part.slot] === part.id ? 1 : 0);
      this.layer.rect(20, y, WIDTH - 40, 116, COLORS.panel, locked ? COLORS.muted : COLORS.panelBorder);
      this.layer.text(40, y + 14, locked ? `🔒 ${part.name}` : part.name, textStyle(22, locked ? COLORS.muted : COLORS.accent));
      this.layer.text(40, y + 46, describeStats(part), textStyle(16, COLORS.info));
      this.layer.text(40, y + 72, part.description, textStyle(15, COLORS.text, { wordWrap: { width: 880 } }));
      this.layer.text(WIDTH - 250, y + 16, `$${part.price}`, textStyle(24, COLORS.warn));
      if (owned) this.layer.text(WIDTH - 150, y + 20, `owned: ${owned}`, textStyle(14, COLORS.muted));
      const b = this.layer.button(WIDTH - 250, y + 56, 200, 42, check.ok ? 'Buy' : check.reason!, () => {
        toast(this, buy(state, part.id));
        save();
        this.refreshHeader();
        this.refreshObjective();
        this.draw();
      }, { size: check.ok ? 18 : 12, disabled: !check.ok });
      if (!check.ok) b.label.setWordWrapWidth(190).setAlign('center');
    });
  }
}
