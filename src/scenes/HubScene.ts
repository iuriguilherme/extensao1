import Phaser from 'phaser';
import { mistakesAllowed, roundSeconds } from '../core/hardware';
import { hasLesson, isOnline, phaseOf, specsOf } from '../core/state';
import { game, resetGame } from '../core/store';
import { getPart, formatMbps, SLOT_LABELS } from '../data/parts';
import { button, COLORS, header, HEIGHT, objectiveBar, panel, textStyle, WIDTH } from '../ui/widgets';

/** The player's desk: a monitor showing the PC's state and the main menu. */
export class HubScene extends Phaser.Scene {
  constructor() {
    super('Hub');
  }

  create() {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    header(this, 'ROOTKIT ACADEMY — your desk');
    objectiveBar(this);

    const state = game();
    const specs = specsOf(state);
    const phase = phaseOf(state);

    // Monitor
    panel(this, 40, 90, 720, 520, specs.boots ? COLORS.accent : COLORS.muted);
    this.add.rectangle(360, 622, 160, 14, COLORS.panelBorder);
    const lines: string[] = [];
    if (!specs.boots) {
      lines.push('[ NO SIGNAL ]', '', 'The machine will not start:', '');
      for (const issue of specs.issues.filter((i) => i.slot !== 'nic' && i.slot !== 'router')) lines.push(`  ✗ ${issue.message}`);
    } else {
      lines.push('POST ........................ OK');
      for (const slot of ['motherboard', 'cpu', 'ram', 'storage', 'psu'] as const) {
        lines.push(`${SLOT_LABELS[slot].padEnd(14)} ${getPart(state.installed[slot]!).name}`);
      }
      lines.push(`Power draw     ${specs.powerDraw} W / ${specs.psuWatts} W`);
      lines.push('', 'Operating system loaded.', '');
      lines.push(`CPU power ${specs.cpuPower}  →  ${roundSeconds(specs.cpuPower)} s per intrusion step`);
      lines.push(`RAM ${specs.ramGB} GB   →  survives ${mistakesAllowed(specs.ramGB)} mistake(s)`);
      lines.push('');
      if (isOnline(state)) {
        lines.push(`eth0: ${state.netConfig!.ip}  gw ${state.netConfig!.gateway}  dns ${state.netConfig!.dns}`);
        lines.push(`link: ${formatMbps(specs.linkMbps)}   status: ONLINE`);
      } else if (specs.networkReady) {
        lines.push('eth0: link up, no IP configured → open Network Setup');
      } else {
        lines.push('eth0: no network hardware detected');
      }
      if (phase === 'won') lines.push('', '*** DATA CENTER CORE BREACHED — YOU WIN ***');
    }
    this.add.text(64, 112, lines.join('\n'), textStyle(17, specs.boots ? COLORS.accent : COLORS.danger, {
      lineSpacing: 6, wordWrap: { width: 670 },
    }));

    // Menu
    const x = 800;
    const w = 440;
    const items: { label: string; scene: string; enabled: boolean; hint: string }[] = [
      { label: 'Study', scene: 'Study', enabled: true, hint: 'Lessons unlock parts and targets' },
      { label: 'Shop', scene: 'Shop', enabled: true, hint: 'Buy hardware' },
      { label: 'Workbench', scene: 'Workbench', enabled: true, hint: 'Install and swap parts' },
      {
        label: 'Network Setup', scene: 'NetSetup',
        enabled: specs.networkReady && hasLesson(state, 'ip-addressing') && hasLesson(state, 'dns'),
        hint: 'Needs NIC + router, IP and DNS lessons',
      },
      { label: 'Net Map', scene: 'NetMap', enabled: isOnline(state), hint: 'Needs an online PC' },
    ];
    items.forEach((item, i) => {
      const y = 100 + i * 88;
      button(this, x, y, w, 56, item.label, () => this.scene.start(item.scene), { disabled: !item.enabled, size: 22 });
      this.add.text(x + 4, y + 62, item.hint, textStyle(13, COLORS.muted));
    });

    button(this, x, 560, 210, 44, 'Side job ($)', () => {
      this.scene.start('Minigame', { minigame: 'binary', difficulty: 1, reward: 25, title: 'Side job: fix the neighbor\'s router' });
    }, { size: 16, color: COLORS.info });
    button(this, x + 230, 560, 210, 44, 'Reset save', () => {
      if (window.confirm('Erase all progress and start over?')) {
        resetGame();
        this.scene.restart();
      }
    }, { size: 16, color: COLORS.danger });

    this.add.text(WIDTH - 16, HEIGHT - 60, 'progress saves automatically', textStyle(12, COLORS.muted)).setOrigin(1, 0.5);
  }
}
