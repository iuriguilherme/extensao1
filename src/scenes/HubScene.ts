import Phaser from 'phaser';
import { acknowledge, advance, isCurrent, isPassive, isVisible, type ElementId } from '../core/disclosure';
import { mistakesAllowed, roundSeconds } from '../core/hardware';
import { isOnline, phaseOf, specsOf } from '../core/state';
import { connectedNodes, swarmReport, totalSpecs } from '../core/swarm';
import { game, resetGame, save } from '../core/store';
import { getPart, SLOT_LABELS } from '../data/parts';
import { alignColumns, decimal, linkSpeed, plural } from '../core/fmt';
import { button, COLORS, fitText, goalBar, header, HEIGHT, messageLog, panel, pulse, textStyle, toast, WIDTH } from '../ui/widgets';
import { startPendingCeremony, type CertificateData } from './CertificateScene';

export interface HubData {
  /** Toast shown on entry, e.g. the tier a ceremony just opened. */
  notice?: string;
}

/** How long a passive element (money, reset) pulses on the desk before the next one may appear. */
const PASSIVE_MS = 3000;

interface MenuItem {
  id: ElementId;
  label: string;
  open: () => void;
}

/**
 * The player's desk: a monitor showing the PC's state, the message log and
 * the menu. Only introduced elements are drawn, plus the one being introduced.
 */
export class HubScene extends Phaser.Scene {
  constructor() {
    super('Hub');
  }

  create(data: HubData = {}) {
    // A certificate issued but not presented yet (tab closed mid-ceremony,
    // or just earned) resumes its ceremony before anything else.
    if (startPendingCeremony(this)) return;
    const state = game();
    advance(state);
    save();
    this.cameras.main.setBackgroundColor(COLORS.bg);
    header(this, 'ROOTKIT ACADEMY — sua estação');
    goalBar(this);

    const specs = specsOf(state);
    const phase = phaseOf(state);

    // Monitor, with the message log under it
    panel(this, 40, 76, 720, 392, specs.boots ? COLORS.accent : COLORS.muted);
    this.add.rectangle(320, 470, 160, 10, COLORS.panelBorder).setOrigin(0);
    messageLog(this, 40, 492, 720, 172);
    const lines: string[] = [];
    if (!specs.boots && !isVisible(state, 'workbench')) {
      // Nothing to build with yet: the monitor stays dark.
      lines.push('[ SEM SINAL ]');
    } else if (!specs.boots) {
      lines.push('[ SEM SINAL ]', '', 'O PC não dá boot:', '');
      for (const issue of specs.issues.filter((i) => i.slot !== 'nic' && i.slot !== 'router')) lines.push(`  ✗ ${issue.message}`);
    } else {
      lines.push('POST ........................ OK');
      const rows: [string, string][] = (['motherboard', 'cpu', 'ram', 'storage', 'psu'] as const)
        .map((slot) => [SLOT_LABELS[slot], getPart(state.installed[slot]!).name]);
      rows.push(['Consumo', `${specs.powerDraw} W / ${specs.psuWatts} W`]);
      lines.push(...alignColumns(rows, 2));
      lines.push('', 'Sistema operacional carregado.', '');
      const total = totalSpecs(state);
      lines.push(`Processamento ${decimal(total.cpuPower)}  →  ${roundSeconds(total.cpuPower)} s para cada etapa da invasão`);
      lines.push(`RAM ${total.ramGB} GB  →  aguenta ${plural(mistakesAllowed(total.ramGB), 'erro', 'erros')} por invasão`);
      const nodes = connectedNodes(state).length;
      if (nodes > 0 && isOnline(state)) {
        const r = swarmReport(state);
        lines.push(`Swarm: ${plural(nodes, 'nó', 'nós')}, +${decimal(r.usable.cpuPower)} de processamento e +${r.usable.ramGB} GB de RAM`);
      } else if (nodes > 0) {
        lines.push(`Swarm: ${plural(nodes, 'nó parado', 'nós parados')} até o PC voltar a ficar online`);
      }
      lines.push('');
      if (isOnline(state)) {
        lines.push(`eth0: ${state.netConfig!.ip}  gw ${state.netConfig!.gateway}  dns ${state.netConfig!.dns}`);
        lines.push(`link: ${linkSpeed(specs.linkMbps)}   status: ONLINE`);
      } else if (specs.networkReady) {
        lines.push('eth0: cabo conectado, mas sem IP → abra a Configuração de Rede');
      } else {
        lines.push('eth0: nenhuma placa de rede encontrada');
      }
      if (phase === 'won') lines.push('', '*** EXERCÍCIO FINAL DO LABORATÓRIO CONCLUÍDO ***');
    }
    fitText(this.add.text(64, 96, lines.join('\n'), textStyle(17, specs.boots ? COLORS.accent : COLORS.danger, {
      lineSpacing: 6, wordWrap: { width: 670 },
    })), 670, 356);

    this.drawMenu();
    if (isVisible(state, 'reset')) {
      this.add.text(WIDTH - 16, HEIGHT - 60, 'o progresso é salvo automaticamente', textStyle(12, COLORS.muted)).setOrigin(1, 0.5);
    }
    if (data.notice) toast(this, data.notice, COLORS.warn);

    // A passive element counts as introduced once the desk has shown it for a
    // moment; leaving the desk first cancels the timer, so it starts over.
    const current = state.disclosure.current as ElementId | null;
    if (current && isPassive(current) && isVisible(state, current)) {
      this.time.delayedCall(PASSIVE_MS, () => {
        acknowledge(game(), current);
        save();
        this.scene.restart();
      });
    }
  }

  /** Visible menu entries stack from the top; the side entries share the bottom row. */
  private drawMenu() {
    const state = game();
    const x = 800;
    const w = 440;
    const main: (MenuItem & { hint: string })[] = [
      { id: 'study', label: 'Estudar', hint: 'As aulas liberam peças e alvos', open: () => this.scene.start('Study') },
      { id: 'shop', label: 'Loja', hint: 'Compre peças para o PC', open: () => this.scene.start('Shop') },
      { id: 'workbench', label: 'Bancada', hint: 'Instale e troque peças', open: () => this.scene.start('Workbench') },
      { id: 'net-setup', label: 'Configuração de Rede', hint: 'Defina o endereço IP do seu PC', open: () => this.scene.start('NetSetup') },
      { id: 'net-map', label: 'Mapa da Rede', hint: 'Invada as máquinas do laboratório', open: () => this.scene.start('NetMap') },
      { id: 'cities', label: 'Cidades', hint: 'Redes novas para treinar endereços e rotas', open: () => this.scene.start('Cities') },
    ];
    // Six rows fit between the header and the side row at y 560.
    main.filter((item) => isVisible(state, item.id)).forEach((item, i) => {
      const y = 76 + i * 78;
      const b = button(this, x, y, w, 48, item.label, () => this.use(item), { size: 22 });
      if (isCurrent(state, item.id)) pulse(this, b.container);
      fitText(this.add.text(x + 4, y + 53, item.hint, textStyle(13, COLORS.muted)), w - 8);
    });

    const side: (MenuItem & { color: number })[] = [
      { id: 'jobs', label: 'Trabalhos extras', color: COLORS.info, open: () => this.scene.start('Jobs') },
      { id: 'certificates', label: 'Certificados', color: COLORS.warn, open: () => this.scene.start('Certificate', {} satisfies CertificateData) },
      {
        id: 'reset', label: 'Apagar progresso', color: COLORS.danger,
        open: () => {
          if (window.confirm('Apagar todo o progresso e começar do zero?')) {
            resetGame();
            this.scene.restart();
          }
        },
      },
    ];
    const gap = 10;
    const w3 = (w - gap * 2) / 3;
    side.filter((item) => isVisible(state, item.id)).forEach((item, i) => {
      const b = button(this, x + i * (w3 + gap), 560, w3, 44, item.label, () => this.use(item), { size: 16, color: item.color });
      if (isCurrent(state, item.id)) pulse(this, b.container);
    });
  }

  /** Opening the element being introduced counts as using it; passive ones advance on their own. */
  private use(item: MenuItem) {
    const state = game();
    if (isCurrent(state, item.id) && !isPassive(item.id)) {
      acknowledge(state, item.id);
      save();
    }
    item.open();
  }
}
