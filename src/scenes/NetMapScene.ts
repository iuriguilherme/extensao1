import Phaser from 'phaser';
import { isNodeListed } from '../core/disclosure';
import { canConnect, checkRequirements, isOnline, nodeStatus, REPLAY_RATIO, type NodeStatus } from '../core/state';
import { game } from '../core/store';
import { providerLabel } from '../core/swarm';
import { NODE_KIND_LABELS, nodePartNames } from '../data/nodeBuilds';
import { MINIGAME_AREAS, NODES, getNode, type NetNode } from '../data/nodes';
import { listJoin, money } from '../core/fmt';
import { COLORS, fitText, header, hex, Layer, goalBar, textStyle, WIDTH } from '../ui/widgets';

const STATUS_COLOR: Record<NodeStatus, number> = {
  home: COLORS.info,
  breached: COLORS.accent,
  reachable: COLORS.warn,
  hidden: COLORS.muted,
};

/** The explorable network: breach reachable nodes to reveal their neighbors. */
export class NetMapScene extends Phaser.Scene {
  private info!: Layer;

  constructor() {
    super('NetMap');
  }

  create() {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    header(this, 'Mapa da Rede', () => this.scene.start('Hub'), 'net-map');
    goalBar(this);
    this.info = new Layer(this);
    const state = game();

    // The map grows outward from the PC: machines nobody reaches yet are not drawn.
    const listed = NODES.filter((n) => isNodeListed(state, n));
    // Links first, so nodes are drawn on top.
    const g = this.add.graphics();
    for (const node of listed) {
      for (const id of node.links) {
        if (id < node.id) continue;
        const other = getNode(id);
        if (!isNodeListed(state, other)) continue;
        g.lineStyle(2, COLORS.panelBorder, 1);
        g.lineBetween(node.x, node.y, other.x, other.y);
      }
    }

    for (const node of listed) {
      const status = nodeStatus(state, node);
      const color = STATUS_COLOR[status];
      const circle = this.add.circle(node.x, node.y, status === 'home' ? 26 : 20, COLORS.panel).setStrokeStyle(3, color);
      this.add.text(node.x, node.y + 32, node.name, textStyle(14, color, { align: 'center' })).setOrigin(0.5, 0);
      this.add.text(node.x, node.y + 50, node.ip, textStyle(11, COLORS.muted)).setOrigin(0.5, 0);
      if (status === 'breached') this.add.text(node.x, node.y, '✓', textStyle(18, color)).setOrigin(0.5);
      // A filled dot on the rim marks nodes plugged into the swarm.
      if (state.swarm[node.id]) this.add.circle(node.x + 15, node.y - 15, 6, COLORS.info).setStrokeStyle(2, COLORS.bg);
      if (status === 'reachable') {
        this.tweens.add({ targets: circle, scale: 1.15, yoyo: true, repeat: -1, duration: 700 });
      }
      circle.setInteractive({ useHandCursor: true });
      circle.on('pointerdown', () => this.showInfo(node));
    }

    const legend: [string, number][] = [['você', COLORS.info], ['alcançável', COLORS.warn], ['invadido', COLORS.accent]];
    let lx = 24;
    for (const [label, color] of legend) {
      this.add.circle(lx + 6, 656, 6, COLORS.panel).setStrokeStyle(2, color);
      const t = this.add.text(lx + 18, 656, label, textStyle(13, color)).setOrigin(0, 0.5);
      lx += t.width + 40;
    }
    this.add.circle(lx + 6, 656, 6, COLORS.info).setStrokeStyle(2, COLORS.bg);
    this.add.text(lx + 18, 656, 'no swarm', textStyle(13, COLORS.info)).setOrigin(0, 0.5);
    this.add.text(24, 76, 'Clique em um nó para ver os detalhes.', textStyle(13, COLORS.muted));

    if (!isOnline(state)) {
      this.add.text(WIDTH / 2, 360, 'SEM CONEXÃO — configure a rede primeiro.', textStyle(28, COLORS.danger)).setOrigin(0.5);
    }
  }

  private showInfo(node: NetNode) {
    this.info.clear();
    const state = game();
    const status = nodeStatus(state, node);
    const x = 20;
    const y = 100;
    const w = 440;
    // Height is set at the end, once the content is laid out.
    const panel = this.info.rect(x, y, w, 244, COLORS.panel, STATUS_COLOR[status]);
    // Every target is a lab machine; only the player's own PC is real.
    const tag = status === 'home' ? null : this.info.text(x + w - 14, y + 14, 'SIMULADO', textStyle(12, COLORS.muted)).setOrigin(1, 0);
    fitText(this.info.text(x + 14, y + 10, `${node.name}  (${node.ip})`, textStyle(18, STATUS_COLOR[status])), w - 28 - (tag ? tag.width + 10 : 0));

    if (status === 'home') {
      this.info.text(x + 14, y + 42, 'Este é o seu PC, a única máquina de verdade aqui. Invada as vizinhas no laboratório para descobrir o resto da rede.', textStyle(14, COLORS.text, { wordWrap: { width: w - 28 } }));
      return;
    }

    let cy = y + 36;
    if (node.hardware) {
      this.info.text(x + 14, cy, `${NODE_KIND_LABELS[node.hardware.kind]} · nível ${node.hardware.tier}`, textStyle(14, COLORS.warn));
      cy += 20;
    }
    this.info.text(x + 14, cy, `Área: ${MINIGAME_AREAS[node.minigame]} · Dificuldade ${'★'.repeat(node.difficulty)}`, textStyle(14, COLORS.info));
    cy += 20;
    const flavor = fitText(this.info.text(x + 14, cy, node.flavor, textStyle(13, COLORS.text, { wordWrap: { width: w - 28 } })), w - 28, 38);
    cy += Math.max(flavor.height, 18) + 6;
    const checks = checkRequirements(state, node);
    checks.forEach((c) => {
      fitText(this.info.text(x + 14, cy, `${c.met ? '✓' : '✗'} ${c.label}`, textStyle(13, c.met ? COLORS.accent : COLORS.danger)), w - 28);
      cy += 16;
    });

    const breached = status === 'breached';
    if (breached) {
      cy += 6;
      const parts = nodePartNames(node);
      if (parts.length) {
        const list = fitText(this.info.text(x + 14, cy, `Peças: ${listJoin(parts)}.`, textStyle(13, COLORS.text, { wordWrap: { width: w - 28 } })), w - 28, 54);
        cy += list.height + 6;
      }
      const provider = state.swarm[node.id];
      const swarmLine = provider
        ? `No swarm, conectado via ${providerLabel(state, provider)}.`
        : 'Fora do swarm. Para conectar este nó, use a aba NOC da Bancada.';
      const line = fitText(this.info.text(x + 14, cy, swarmLine, textStyle(13, provider ? COLORS.info : COLORS.warn, { wordWrap: { width: w - 28 } })), w - 28, 36);
      cy += line.height + 6;
    }

    const reward = breached ? Math.floor(node.reward * REPLAY_RATIO) : node.reward;
    const ok = canConnect(state, node);
    const by = Math.max(cy + 4, y + 192);
    const b = this.info.button(x + w - 190, by, 176, 42, breached ? `Invadir de novo ${money(reward)}` : `Invadir ${money(reward)}`, () => {
      this.scene.start('Minigame', {
        nodeId: node.id,
        minigame: node.minigame,
        difficulty: node.difficulty,
        reward,
        title: `Invadindo: ${node.name} (${node.ip})`,
      });
    }, { disabled: !ok, color: COLORS.warn, size: 16 });
    if (!ok) b.label.setColor(hex(COLORS.muted));
    panel.setSize(w, by + 48 - y);
  }
}
