import Phaser from 'phaser';
import { mistakesAllowed, roundSeconds } from '../core/hardware';
import { canStartCities, hasLesson, isOnline, phaseOf, specsOf } from '../core/state';
import { connectedNodes, swarmReport, totalSpecs } from '../core/swarm';
import { game } from '../core/store';
import { getLesson, ROUTING_LESSON_ID } from '../data/lessons';
import { getPart, SLOT_LABELS } from '../data/parts';
import { alignColumns, decimal, linkSpeed, plural } from '../core/fmt';
import { button, COLORS, fitText, header, HEIGHT, objectiveBar, panel, resetEverything, textStyle, toast, WIDTH } from '../ui/widgets';
import { startPendingCeremony, type CertificateData } from './CertificateScene';

export interface HubData {
  /** Toast shown on entry, e.g. the tier a ceremony just opened. */
  notice?: string;
}

/** The player's desk: a monitor showing the PC's state and the main menu. */
export class HubScene extends Phaser.Scene {
  constructor() {
    super('Hub');
  }

  create(data: HubData = {}) {
    // A certificate issued but not presented yet (tab closed mid-ceremony,
    // or just earned) resumes its ceremony before anything else.
    if (startPendingCeremony(this)) return;
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
      { label: 'Cidades', scene: 'Cities', enabled: canStartCities(state), hint: citiesHint(phase === 'won', hasLesson(state, ROUTING_LESSON_ID)) },
    ];
    // Six rows fit between the header and the side-job row at y 560.
    items.forEach((item, i) => {
      const y = 76 + i * 78;
      button(this, x, y, w, 48, item.label, () => this.scene.start(item.scene), { disabled: !item.enabled, size: 22 });
      fitText(this.add.text(x + 4, y + 53, item.hint, textStyle(13, COLORS.muted)), w - 8);
    });

    // The certificates entry appears with the first certificate, never before.
    const certificates = state.certificates.some((c) => c.presented);
    const w3 = certificates ? 140 : 210;
    const gap = certificates ? 10 : 20;
    button(this, x, 560, w3, 44, 'Trabalhos extras', () => this.scene.start('Jobs'), { size: 16, color: COLORS.info });
    if (certificates) {
      button(this, x + w3 + gap, 560, w3, 44, 'Certificados', () => this.scene.start('Certificate', {} satisfies CertificateData), { size: 16, color: COLORS.warn });
    }
    button(this, x + (w3 + gap) * (certificates ? 2 : 1), 560, w3, 44, 'Apagar progresso', () => {
      if (window.confirm('Apagar todo o progresso e começar do zero?')) {
        resetEverything();
        this.scene.restart();
      }
    }, { size: 16, color: COLORS.danger });

    this.add.text(WIDTH - 16, HEIGHT - 60, 'o progresso é salvo automaticamente', textStyle(12, COLORS.muted)).setOrigin(1, 0.5);
    if (data.notice) toast(this, data.notice, COLORS.warn);
  }
}

/** What the Cities item still needs, or what it offers once open. */
function citiesHint(won: boolean, routing: boolean): string {
  const lesson = `a aula "${getLesson(ROUTING_LESSON_ID).title}"`;
  if (!won && !routing) return `Conclua o laboratório e faça ${lesson}`;
  if (!won) return 'Conclua o exercício final do laboratório';
  if (!routing) return `Faça ${lesson} para liberar`;
  return 'Redes novas para treinar endereços e rotas';
}
