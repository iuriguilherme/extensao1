import Phaser from 'phaser';
import { install, sell, specsOf, SELL_RATIO, uninstall } from '../core/state';
import { game, save } from '../core/store';
import { describeStats, formatMbps, getPart, SLOT_LABELS, SLOTS } from '../data/parts';
import { COLORS, header, Layer, objectiveBar, textStyle, toast } from '../ui/widgets';

/** Install, remove and swap parts; shows what is wrong with the build and why. */
export class WorkbenchScene extends Phaser.Scene {
  private layer!: Layer;
  private refreshHeader!: () => void;
  private refreshObjective!: () => void;

  constructor() {
    super('Workbench');
  }

  create() {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.refreshHeader = header(this, 'Workbench', () => this.scene.start('Hub')).refresh;
    this.refreshObjective = objectiveBar(this).refresh;
    this.layer = new Layer(this);
    this.draw();
  }

  private act(message: string) {
    toast(this, message);
    save();
    this.refreshHeader();
    this.refreshObjective();
    this.draw();
  }

  private draw() {
    this.layer.clear();
    const state = game();
    const specs = specsOf(state);

    // Slots
    this.layer.text(20, 70, 'INSIDE THE CASE', textStyle(16, COLORS.muted));
    SLOTS.forEach((slot, i) => {
      const y = 96 + i * 66;
      const id = state.installed[slot];
      const issue = specs.issues.find((s) => s.slot === slot);
      const border = id ? (issue ? COLORS.danger : COLORS.accent) : COLORS.muted;
      this.layer.rect(20, y, 600, 58, COLORS.panel, border);
      this.layer.text(34, y + 8, SLOT_LABELS[slot], textStyle(14, COLORS.muted));
      if (id) {
        const part = getPart(id);
        this.layer.text(34, y + 28, `${part.name} — ${describeStats(part)}`, textStyle(15, COLORS.text));
        this.layer.button(520, y + 12, 88, 34, 'Remove', () => this.act(uninstall(state, slot)), { size: 14, color: COLORS.warn });
      } else {
        this.layer.text(34, y + 28, '(empty)', textStyle(15, COLORS.muted));
      }
    });

    // Diagnostics
    const diagY = 96 + SLOTS.length * 66 + 6;
    const diag: string[] = [
      `Power: ${specs.powerDraw} W drawn / ${specs.psuWatts} W available   ·   CPU power ${specs.cpuPower}   ·   RAM ${specs.ramGB} GB   ·   Link ${formatMbps(specs.linkMbps)}`,
    ];
    const problems = specs.issues.filter((i) => specs.boots ? true : i.slot !== 'nic' && i.slot !== 'router');
    diag.push(specs.boots ? '✓ System boots.' : '✗ System does not boot.');
    for (const p of problems.slice(0, 3)) diag.push(`  • ${p.message}`);
    this.layer.text(20, diagY, diag.join('\n'), textStyle(14, specs.boots ? COLORS.accent : COLORS.warn, { lineSpacing: 4, wordWrap: { width: 1240 } }));

    // Inventory
    this.layer.text(650, 70, 'INVENTORY', textStyle(16, COLORS.muted));
    if (state.inventory.length === 0) {
      this.layer.text(650, 100, 'Empty. Buy parts in the Shop.', textStyle(16, COLORS.muted));
    }
    state.inventory.slice(0, 9).forEach((id, i) => {
      const part = getPart(id);
      const y = 96 + i * 50;
      this.layer.rect(650, y, 610, 44);
      this.layer.text(662, y + 5, part.name, textStyle(15, COLORS.text));
      this.layer.text(662, y + 24, `${SLOT_LABELS[part.slot]} · ${describeStats(part)}`, textStyle(12, COLORS.info));
      this.layer.button(1020, y + 6, 110, 32, 'Install', () => this.act(install(state, id)), { size: 14 });
      this.layer.button(1140, y + 6, 110, 32, `Sell $${Math.floor(part.price * SELL_RATIO)}`, () => this.act(sell(state, id)), { size: 13, color: COLORS.warn });
    });
    if (state.inventory.length > 9) {
      this.layer.text(650, 96 + 9 * 50, `…and ${state.inventory.length - 9} more`, textStyle(14, COLORS.muted));
    }
  }
}
