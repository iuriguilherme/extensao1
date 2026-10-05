import Phaser from 'phaser';
import { install, isOnline, sell, specsOf, SELL_RATIO, uninstall, type GameState } from '../core/state';
import {
  attachedTo, connectedNodes, freePorts, installSwitch, joinSwarm, leaveSwarm, nodeStats, providerLabel, providers,
  removeSwitch, swarmReport, totalSpecs, type Provider, type SwarmResult,
} from '../core/swarm';
import { game, save } from '../core/store';
import { describeStats, getPart, CASE_SLOTS, SLOT_LABELS } from '../data/parts';
import { getNode, HOME_NODE_ID } from '../data/nodes';
import { NODE_KIND_LABELS, type Contribution } from '../data/nodeBuilds';
import { decimal, linkSpeed, money, plural } from '../core/fmt';
import { COLORS, fitText, header, Layer, objectiveBar, textStyle, toast } from '../ui/widgets';

type Tab = 'case' | 'noc';

/** One line of the NOC node list; the list is paginated by rows. */
interface Row {
  draw: (y: number) => void;
}

const ROW_H = 32;
const LIST_W = 840;
const SIDE_X = 880;
/** Bottom of the content area, above the objective bar. */
const CONTENT_BOTTOM = 636;
const SHELF_ROW_H = 54;

const kindLabel = (id: string) => {
  const kind = getNode(id).hardware?.kind;
  return kind ? NODE_KIND_LABELS[kind] : '';
};
const contributionText = (c: Contribution) =>
  `CPU ${decimal(c.cpuPower)} · ${c.ramGB} GB de RAM · link de ${linkSpeed(c.linkMbps)}${c.ports ? ` · +${plural(c.ports, 'porta', 'portas')}` : ''}`;

/** Install, remove and swap parts; shows what is wrong with the build and why. */
export class WorkbenchScene extends Phaser.Scene {
  private layer!: Layer;
  private refreshHeader!: () => void;
  private refreshObjective!: () => void;
  private tab: Tab = 'case';
  private page = 0;

  constructor() {
    super('Workbench');
  }

  create() {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.refreshHeader = header(this, 'Bancada', () => this.scene.start('Hub')).refresh;
    this.refreshObjective = objectiveBar(this).refresh;
    this.layer = new Layer(this);
    this.draw();
  }

  private act(message: string, color = COLORS.accent) {
    toast(this, message, color);
    save();
    this.refreshHeader();
    this.refreshObjective();
    this.draw();
  }

  private actSwarm(result: SwarmResult) {
    this.act(result.message, result.ok ? COLORS.accent : COLORS.warn);
  }

  /** Installs or removes a part; a refused change (e.g. nodes would lose their port) shows as a warning. */
  private actOnRig(change: () => string) {
    const state = game();
    const rig = () => JSON.stringify([state.installed, state.noc]);
    const before = rig();
    const message = change();
    this.act(message, rig() === before ? COLORS.warn : COLORS.accent);
  }

  private draw() {
    this.layer.clear();
    const tabs: [Tab, string][] = [['case', 'Gabinete'], ['noc', 'NOC e enxame']];
    tabs.forEach(([tab, label], i) => {
      this.layer.button(300 + i * 170, 10, 160, 36, label, () => {
        this.tab = tab;
        this.page = 0;
        this.draw();
      }, { size: 16, color: tab === this.tab ? COLORS.warn : COLORS.accent });
    });
    if (this.tab === 'noc') this.drawNoc();
    else this.drawCase();
  }

  private drawCase() {
    const state = game();
    const specs = specsOf(state);
    const total = totalSpecs(state);

    // Slots
    this.layer.text(20, 70, 'DENTRO DO GABINETE', textStyle(16, COLORS.muted));
    CASE_SLOTS.forEach((slot, i) => {
      const y = 96 + i * 66;
      const id = state.installed[slot];
      const issue = specs.issues.find((s) => s.slot === slot);
      const border = id ? (issue ? COLORS.danger : COLORS.accent) : COLORS.muted;
      this.layer.rect(20, y, 600, 58, COLORS.panel, border);
      this.layer.text(34, y + 8, SLOT_LABELS[slot], textStyle(14, COLORS.muted));
      if (id) {
        const part = getPart(id);
        fitText(this.layer.text(34, y + 28, `${part.name} — ${describeStats(part)}`, textStyle(15, COLORS.text)), 480);
        this.layer.button(520, y + 12, 88, 34, 'Remover', () => this.actOnRig(() => uninstall(state, slot)), { size: 14, color: COLORS.warn });
      } else {
        this.layer.text(34, y + 28, '(vazio)', textStyle(15, COLORS.muted));
      }
    });

    // Diagnostics
    const diagY = 96 + CASE_SLOTS.length * 66 + 6;
    const diag: string[] = [
      `Energia: ${specs.powerDraw} W usados de ${specs.psuWatts} W   ·   Processamento ${decimal(total.cpuPower)}   ·   RAM ${total.ramGB} GB   ·   Link ${linkSpeed(specs.linkMbps)}`,
    ];
    const problems = specs.issues.filter((i) => specs.boots ? true : i.slot !== 'nic' && i.slot !== 'router');
    diag.push(specs.boots ? '✓ O PC dá boot.' : '✗ O PC não dá boot.');
    for (const p of problems.slice(0, 3)) diag.push(`  • ${p.message}`);
    this.layer.text(20, diagY, diag.join('\n'), textStyle(14, specs.boots ? COLORS.accent : COLORS.warn, { lineSpacing: 4, wordWrap: { width: 1240 } }));

    // Inventory
    this.layer.text(650, 70, 'INVENTÁRIO', textStyle(16, COLORS.muted));
    if (state.inventory.length === 0) {
      this.layer.text(650, 100, 'Nada por aqui. Compre peças na Loja.', textStyle(16, COLORS.muted));
    }
    state.inventory.slice(0, 9).forEach((id, i) => {
      const part = getPart(id);
      const y = 96 + i * 50;
      this.layer.rect(650, y, 610, 44);
      this.layer.text(662, y + 5, part.name, textStyle(15, COLORS.text));
      this.layer.text(662, y + 24, `${SLOT_LABELS[part.slot]} · ${describeStats(part)}`, textStyle(12, COLORS.info));
      this.layer.button(1020, y + 6, 110, 32, 'Instalar', () => this.actOnRig(() => install(state, id)), { size: 14 });
      this.layer.button(1140, y + 6, 110, 32, `Vender ${money(Math.floor(part.price * SELL_RATIO))}`, () => this.act(sell(state, id)), { size: 13, color: COLORS.warn });
    });
    if (state.inventory.length > 9) {
      this.layer.text(650, 96 + 9 * 50, `…e mais ${state.inventory.length - 9}`, textStyle(14, COLORS.muted));
    }
  }

  private drawNoc() {
    const state = game();
    const specs = specsOf(state);
    const online = isOnline(state);
    const report = swarmReport(state);
    const provs = providers(state);
    const connected = connectedNodes(state);
    const free = provs.reduce((sum, p) => sum + Math.max(0, freePorts(state, p.id)), 0);

    // Summary
    this.layer.text(20, 66, 'NOC (CENTRO DE OPERAÇÕES DE REDE)', textStyle(16, COLORS.muted));
    const lines = [
      `Portas: ${connected.length} em uso, ${plural(free, 'livre', 'livres')}   ·   Largura de banda do enxame: ${linkSpeed(report.bandwidthMbps)}`,
      `Processamento aproveitado: ${decimal(report.usable.cpuPower)} de ${decimal(report.raw.cpuPower)}   ·   RAM aproveitada: ${report.usable.ramGB} GB de ${report.raw.ramGB} GB   ·   Armazenamento: ${report.usable.storageGB} GB`,
    ];
    const summary = this.layer.text(20, 90, lines.join('\n'), textStyle(14, COLORS.info, { lineSpacing: 4, wordWrap: { width: 1240 } }));
    let y = summary.y + summary.height + 6;
    let note: string;
    let noteColor: number;
    if (!online) {
      const reason = !specs.boots
        ? 'seu PC não dá boot'
        : !specs.networkReady
          ? 'seu PC está sem placa de rede ou sem roteador'
          : 'a rede do seu PC ainda não foi configurada';
      note = `Enxame suspenso: ${reason}. Os nós continuam conectados, mas só voltam a somar processamento e RAM quando seu PC voltar para a internet.`;
      noteColor = COLORS.danger;
    } else if (report.limited) {
      note = `A largura de banda do enxame é o tráfego entre o NOC e os nós, não a sua internet. Com ${linkSpeed(report.bandwidthMbps)}, não passa dado suficiente para aproveitar tudo: parte do processamento e da RAM dos nós fica parada esperando a rede. Troque por switches com uplink mais rápido ou conecte nós com link melhor.`;
      noteColor = COLORS.warn;
    } else {
      note = 'A largura de banda do enxame é o tráfego entre o NOC e os nós, não a sua internet. Cada switch, roteador ou nó com portas só repassa até a velocidade do próprio uplink.';
      noteColor = COLORS.muted;
    }
    const noteText = this.layer.text(20, y, note, textStyle(14, noteColor, { lineSpacing: 3, wordWrap: { width: 1240 } }));
    y = noteText.y + noteText.height + 14;

    this.drawNodeList(state, provs, online, free, y);
    this.drawSwitchShelf(state, y);
  }

  /** Providers with their nodes, then the breached nodes waiting for a port; paginated. */
  private drawNodeList(state: GameState, provs: Provider[], online: boolean, free: number, top: number) {
    const rows: Row[] = [];
    const textW = LIST_W - 140;

    for (const p of provs) {
      const attached = attachedTo(state, p.id);
      const demand = attached.reduce((sum, id) => sum + nodeStats(id).linkMbps, 0);
      const throughput = Math.min(p.uplinkMbps, demand);
      const label = providerLabel(state, p.id);
      const title = p.kind === 'router'
        ? `${label}: ${attached.length} de ${plural(p.ports, 'porta LAN', 'portas LAN')} em uso`
        : p.kind === 'switch'
          ? `${label}: ${attached.length} de ${plural(p.ports, 'porta', 'portas')} em uso`
          : `Nó ${label} (${kindLabel(p.id)}): ${attached.length} de ${plural(p.ports, 'porta', 'portas')} em uso`;
      rows.push({
        draw: (ry) => {
          this.layer.rect(20, ry, LIST_W, ROW_H - 4, COLORS.panel, COLORS.panelBorder);
          fitText(this.layer.text(30, ry + 6, `${title} · tráfego de ${linkSpeed(throughput)} no uplink de ${linkSpeed(p.uplinkMbps)}`,
            textStyle(14, COLORS.accent)), p.kind === 'switch' ? textW : LIST_W - 20);
          if (p.kind === 'switch') {
            this.layer.button(LIST_W - 100, ry + 2, 110, ROW_H - 8, 'Remover', () => this.actSwarm(removeSwitch(state, p.id)), { size: 13, color: COLORS.warn });
          }
        },
      });
      if (demand > p.uplinkMbps) {
        rows.push({
          draw: (ry) => fitText(this.layer.text(40, ry + 6,
            `Uplink no limite: juntos, os nós daqui pedem ${linkSpeed(demand)}, mas o uplink só passa ${linkSpeed(p.uplinkMbps)} e eles dividem essa banda.`,
            textStyle(13, COLORS.warn)), LIST_W - 30),
        });
      }
      for (const id of attached) {
        rows.push({
          draw: (ry) => {
            const detail = online ? contributionText(nodeStats(id)) : 'não soma nada enquanto o enxame está suspenso';
            fitText(this.layer.text(40, ry + 6, `${getNode(id).name} (${kindLabel(id)}) · ${detail}`,
              textStyle(14, online ? COLORS.text : COLORS.muted)), textW);
            this.layer.button(LIST_W - 100, ry + 2, 110, ROW_H - 8, 'Desconectar', () => this.actSwarm(leaveSwarm(state, id)), { size: 13, color: COLORS.warn });
          },
        });
      }
    }

    const waiting = state.breached.filter((id) => id !== HOME_NODE_ID && !state.swarm[id] && getNode(id).hardware);
    if (state.breached.every((id) => id === HOME_NODE_ID)) {
      rows.push({
        draw: (ry) => fitText(this.layer.text(20, ry + 6, 'Nenhum nó invadido ainda. Invada nós no mapa da rede para montar o enxame.',
          textStyle(14, COLORS.muted)), LIST_W),
      });
    } else if (waiting.length) {
      rows.push({
        draw: (ry) => this.layer.text(20, ry + 8, `ESPERANDO CONEXÃO · ${plural(free, 'porta livre', 'portas livres')}`, textStyle(15, COLORS.muted)),
      });
      for (const id of waiting) {
        rows.push({
          draw: (ry) => {
            fitText(this.layer.text(40, ry + 6, `${getNode(id).name} (${kindLabel(id)}) · ${contributionText(nodeStats(id))}`,
              textStyle(14, COLORS.text)), textW);
            this.layer.button(LIST_W - 100, ry + 2, 110, ROW_H - 8, 'Conectar', () => this.actSwarm(joinSwarm(state, id)), { size: 13 });
          },
        });
      }
    }

    const bottom = CONTENT_BOTTOM;
    const fits = Math.max(1, Math.floor((bottom - top) / ROW_H));
    const perPage = rows.length > fits ? Math.max(1, fits - 1) : fits;
    const pages = Math.max(1, Math.ceil(rows.length / perPage));
    this.page = Math.min(this.page, pages - 1);
    rows.slice(this.page * perPage, (this.page + 1) * perPage).forEach((row, i) => row.draw(top + i * ROW_H));
    if (pages > 1) {
      this.layer.button(20, bottom, 44, 32, '◀', () => { this.page -= 1; this.draw(); }, { size: 16, disabled: this.page === 0 });
      this.layer.text(76, bottom + 7, `Página ${this.page + 1} de ${pages}`, textStyle(14, COLORS.muted));
      this.layer.button(230, bottom, 44, 32, '▶', () => { this.page += 1; this.draw(); }, { size: 16, disabled: this.page >= pages - 1 });
    }
  }

  /** Switches the player owns but has not put in the NOC. */
  private drawSwitchShelf(state: GameState, top: number) {
    const w = 1260 - SIDE_X;
    this.layer.text(SIDE_X, top, 'SWITCHES GUARDADOS', textStyle(15, COLORS.muted));
    fitText(this.layer.text(SIDE_X, top + 24,
      'Cada switch instalado no NOC soma portas para o enxame. Todos os nós ligados nele dividem o uplink dele.',
      textStyle(13, COLORS.info, { wordWrap: { width: w } })), w, 54);
    const owned = state.inventory.filter((id) => getPart(id).slot === 'switch');
    const startY = top + 84;
    if (owned.length === 0) {
      fitText(this.layer.text(SIDE_X, startY, 'Nenhum switch no inventário. Compre um na Loja, na aba Switch.',
        textStyle(14, COLORS.muted, { wordWrap: { width: w } })), w, 60);
      return;
    }
    const fits = Math.max(1, Math.floor((CONTENT_BOTTOM - startY) / SHELF_ROW_H));
    owned.slice(0, fits).forEach((id, i) => {
      const part = getPart(id);
      const y = startY + i * SHELF_ROW_H;
      this.layer.rect(SIDE_X, y, w, 48);
      fitText(this.layer.text(SIDE_X + 10, y + 5, part.name, textStyle(14, COLORS.text)), w - 120);
      fitText(this.layer.text(SIDE_X + 10, y + 26, describeStats(part), textStyle(12, COLORS.info)), w - 120);
      this.layer.button(SIDE_X + w - 104, y + 8, 96, 32, 'Instalar', () => this.actSwarm(installSwitch(state, id)), { size: 14 });
    });
    if (owned.length > fits) {
      this.layer.text(SIDE_X, startY + fits * SHELF_ROW_H, `…e mais ${owned.length - fits}`, textStyle(14, COLORS.muted));
    }
  }
}
