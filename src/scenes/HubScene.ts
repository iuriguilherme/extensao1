import Phaser from 'phaser';
import { mistakesAllowed, roundSeconds } from '../core/hardware';
import { hasLesson, isOnline, phaseOf, specsOf } from '../core/state';
import { FINAL_NODE_ID, getNode } from '../data/nodes';
import { game, resetGame } from '../core/store';
import { getPart, SLOT_LABELS } from '../data/parts';
import { alignColumns, decimal, linkSpeed, money, plural } from '../core/fmt';
import { button, COLORS, fitText, header, HEIGHT, objectiveBar, panel, textStyle, WIDTH } from '../ui/widgets';

/** The player's desk: a monitor showing the PC's state and the main menu. */
export class HubScene extends Phaser.Scene {
  constructor() {
    super('Hub');
  }

  create() {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    header(this, 'ROOTKIT ACADEMY — sua estação');
    objectiveBar(this);

    const state = game();
    const specs = specsOf(state);
    const phase = phaseOf(state);

    // Monitor
    panel(this, 40, 90, 720, 520, specs.boots ? COLORS.accent : COLORS.muted);
    this.add.rectangle(360, 622, 160, 14, COLORS.panelBorder);
    const lines: string[] = [];
    if (!specs.boots) {
      lines.push('[ SEM SINAL ]', '', 'O PC não dá boot:', '');
      for (const issue of specs.issues.filter((i) => i.slot !== 'nic' && i.slot !== 'router')) lines.push(`  ✗ ${issue.message}`);
    } else {
      lines.push('POST ........................ OK');
      const rows: [string, string][] = (['motherboard', 'cpu', 'ram', 'storage', 'psu'] as const)
        .map((slot) => [SLOT_LABELS[slot], getPart(state.installed[slot]!).name]);
      rows.push(['Consumo', `${specs.powerDraw} W / ${specs.psuWatts} W`]);
      lines.push(...alignColumns(rows, 2));
      lines.push('', 'Sistema operacional carregado.', '');
      lines.push(`Processamento ${decimal(specs.cpuPower)}  →  ${roundSeconds(specs.cpuPower)} s para cada etapa da invasão`);
      lines.push(`RAM ${specs.ramGB} GB  →  aguenta ${plural(mistakesAllowed(specs.ramGB), 'erro', 'erros')} por invasão`);
      lines.push('');
      if (isOnline(state)) {
        lines.push(`eth0: ${state.netConfig!.ip}  gw ${state.netConfig!.gateway}  dns ${state.netConfig!.dns}`);
        lines.push(`link: ${linkSpeed(specs.linkMbps)}   status: ONLINE`);
      } else if (specs.networkReady) {
        lines.push('eth0: cabo conectado, mas sem IP → abra a Configuração de Rede');
      } else {
        lines.push('eth0: nenhuma placa de rede encontrada');
      }
      if (phase === 'won') lines.push('', `*** ${getNode(FINAL_NODE_ID).name.toUpperCase()} INVADIDO — VOCÊ VENCEU ***`);
    }
    fitText(this.add.text(64, 112, lines.join('\n'), textStyle(17, specs.boots ? COLORS.accent : COLORS.danger, {
      lineSpacing: 6, wordWrap: { width: 670 },
    })), 670, 490);

    // Menu
    const x = 800;
    const w = 440;
    const items: { label: string; scene: string; enabled: boolean; hint: string }[] = [
      { label: 'Estudar', scene: 'Study', enabled: true, hint: 'As aulas liberam peças e alvos' },
      { label: 'Loja', scene: 'Shop', enabled: true, hint: 'Compre peças para o PC' },
      { label: 'Bancada', scene: 'Workbench', enabled: true, hint: 'Instale e troque peças' },
      {
        label: 'Configuração de Rede', scene: 'NetSetup',
        enabled: specs.networkReady && hasLesson(state, 'ip-addressing') && hasLesson(state, 'dns'),
        hint: 'Precisa de placa de rede, roteador e das aulas de IP e DNS',
      },
      { label: 'Mapa da Rede', scene: 'NetMap', enabled: isOnline(state), hint: 'Precisa do PC conectado à internet' },
    ];
    items.forEach((item, i) => {
      const y = 100 + i * 88;
      button(this, x, y, w, 56, item.label, () => this.scene.start(item.scene), { disabled: !item.enabled, size: 22 });
      this.add.text(x + 4, y + 62, item.hint, textStyle(13, COLORS.muted));
    });

    const sideJobReward = 25;
    button(this, x, 560, 210, 44, `Trabalho extra (${money(sideJobReward)})`, () => {
      this.scene.start('Minigame', { minigame: 'binary', difficulty: 1, reward: sideJobReward, title: 'Trabalho extra: consertar o roteador do vizinho' });
    }, { size: 16, color: COLORS.info });
    button(this, x + 230, 560, 210, 44, 'Apagar progresso', () => {
      if (window.confirm('Apagar todo o progresso e começar do zero?')) {
        resetGame();
        this.scene.restart();
      }
    }, { size: 16, color: COLORS.danger });

    this.add.text(WIDTH - 16, HEIGHT - 60, 'o progresso é salvo automaticamente', textStyle(12, COLORS.muted)).setOrigin(1, 0.5);
  }
}
