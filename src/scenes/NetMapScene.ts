import Phaser from 'phaser';
import { canConnect, checkRequirements, isOnline, nodeStatus, REPLAY_RATIO, type NodeStatus } from '../core/state';
import { game } from '../core/store';
import { MINIGAME_AREAS, NODES, getNode, type NetNode } from '../data/nodes';
import { COLORS, header, hex, Layer, objectiveBar, textStyle, WIDTH } from '../ui/widgets';

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
    header(this, 'Net Map', () => this.scene.start('Hub'));
    objectiveBar(this);
    this.info = new Layer(this);
    const state = game();

    // Links first, so nodes are drawn on top.
    const g = this.add.graphics();
    for (const node of NODES) {
      for (const id of node.links) {
        if (id < node.id) continue;
        const other = getNode(id);
        const visible = nodeStatus(state, node) !== 'hidden' || nodeStatus(state, other) !== 'hidden';
        g.lineStyle(2, visible ? COLORS.panelBorder : 0x111a22, 1);
        g.lineBetween(node.x, node.y, other.x, other.y);
      }
    }

    for (const node of NODES) {
      const status = nodeStatus(state, node);
      const color = STATUS_COLOR[status];
      const circle = this.add.circle(node.x, node.y, status === 'home' ? 26 : 20, COLORS.panel).setStrokeStyle(3, color);
      const hidden = status === 'hidden';
      this.add.text(node.x, node.y + 32, hidden ? '???' : node.name, textStyle(14, color, { align: 'center' })).setOrigin(0.5, 0);
      this.add.text(node.x, node.y + 50, hidden ? '' : node.ip, textStyle(11, COLORS.muted)).setOrigin(0.5, 0);
      if (status === 'breached') this.add.text(node.x, node.y, '✓', textStyle(18, color)).setOrigin(0.5);
      if (status === 'reachable') {
        this.tweens.add({ targets: circle, scale: 1.15, yoyo: true, repeat: -1, duration: 700 });
      }
      if (!hidden) {
        circle.setInteractive({ useHandCursor: true });
        circle.on('pointerdown', () => this.showInfo(node));
      }
    }

    const legend: [string, number][] = [['you', COLORS.info], ['reachable', COLORS.warn], ['breached', COLORS.accent], ['unknown', COLORS.muted]];
    let lx = 24;
    for (const [label, color] of legend) {
      this.add.circle(lx + 6, 656, 6, COLORS.panel).setStrokeStyle(2, color);
      const t = this.add.text(lx + 18, 656, label, textStyle(13, color)).setOrigin(0, 0.5);
      lx += t.width + 40;
    }
    this.add.text(24, 76, 'Click a node to inspect it.', textStyle(13, COLORS.muted));

    if (!isOnline(state)) {
      this.add.text(WIDTH / 2, 360, 'OFFLINE — configure your network first.', textStyle(28, COLORS.danger)).setOrigin(0.5);
    }
  }

  private showInfo(node: NetNode) {
    this.info.clear();
    const state = game();
    const status = nodeStatus(state, node);
    const x = 20;
    const y = 100;
    const w = 440;
    this.info.rect(x, y, w, 244, COLORS.panel, STATUS_COLOR[status]);
    this.info.text(x + 14, y + 10, `${node.name}  (${node.ip})`, textStyle(18, STATUS_COLOR[status]));

    if (status === 'home') {
      this.info.text(x + 14, y + 42, 'This is you. Breach neighbors to see further.', textStyle(14));
      return;
    }

    this.info.text(x + 14, y + 36, `Area: ${MINIGAME_AREAS[node.minigame]} · Difficulty ${'★'.repeat(node.difficulty)}`, textStyle(14, COLORS.info));
    this.info.text(x + 14, y + 56, node.flavor, textStyle(13, COLORS.text, { wordWrap: { width: w - 28 } }));
    const checks = checkRequirements(state, node);
    checks.forEach((c, i) => {
      this.info.text(x + 14, y + 96 + i * 18, `${c.met ? '✓' : '✗'} ${c.label}`, textStyle(13, c.met ? COLORS.accent : COLORS.danger));
    });

    const breached = status === 'breached';
    const reward = breached ? Math.floor(node.reward * REPLAY_RATIO) : node.reward;
    const ok = canConnect(state, node);
    const b = this.info.button(x + w - 190, y + 192, 176, 42, breached ? `Re-breach $${reward}` : `Connect $${reward}`, () => {
      this.scene.start('Minigame', {
        nodeId: node.id,
        minigame: node.minigame,
        difficulty: node.difficulty,
        reward,
        title: `Connecting to ${node.name} (${node.ip})`,
      });
    }, { disabled: !ok, color: COLORS.warn, size: 16 });
    if (!ok) b.label.setColor(hex(COLORS.muted));
  }
}
