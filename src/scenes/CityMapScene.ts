import Phaser from 'phaser';
import { CITY_COLUMN_WIDTH, cityNode, type City, type CityNode, type CitySubnet } from '../core/city';
import { encodeCityCode } from '../core/cityCode';
import { money, plural } from '../core/fmt';
import { correctGate, gateKind, vlanGate, type GateKind } from '../core/gates';
import {
  canConnectCityNode, cityNodeStatus, cityRequirementChecks, isSubnetOpen, loadCity, nextCityLevel, REPLAY_RATIO, type CityNodeStatus, type CityProgress,
} from '../core/state';
import { game } from '../core/store';
import { MINIGAME_AREAS } from '../data/nodes';
import { button, COLORS, fitText, header, hex, Layer, goalBar, textStyle, toast, WIDTH, type Button } from '../ui/widgets';
import { startPendingCeremony } from './CertificateScene';
import type { MinigameData } from './MinigameScene';

/** The button that opens a router's gate form, by gate kind. */
const GATE_BUTTON: Record<GateKind, string> = {
  route: 'Escrever rota', ipv6: 'Escrever rota', nat: 'Redirecionar porta', vlan: 'Configurar porta',
};

export interface CityMapData {
  /** Index of the city in `GameState.cities`. */
  index: number;
  /** Subnet whose column the map scrolls to on entry. */
  focus?: number;
  /** City node whose info panel opens on entry. */
  select?: string;
  /** Toast shown on entry. */
  notice?: string;
  /** Set when the core was just breached for the first time. */
  finishedNow?: boolean;
}

const STATUS_COLOR: Record<CityNodeStatus, number> = {
  breached: COLORS.accent,
  reachable: COLORS.warn,
  hidden: COLORS.muted,
};

/** The map camera's viewport sits between the header (56) and the objective bar (680). */
const VIEW_TOP = 56;
const VIEW_HEIGHT = 624;
/** Map y shown at the top of the viewport; city boxes start at y 86 or lower. */
const VIEW_SCROLL_Y = 60;
/** Boxes are drawn taller than the generator's box, so the labels of a third row fit inside. */
const BOX_LABEL_ROOM = 24;
/** Distance from a router to the "?" of a route not written yet. */
const STUB_LENGTH = 85;

/**
 * A generated city as a network diagram with fog of war: only open subnets
 * are drawn. The diagram lives in a second camera that scrolls sideways under
 * the fixed header, legend, info panel and objective bar.
 */
export class CityMapScene extends Phaser.Scene {
  private params!: CityMapData;
  private city!: City;
  private mapCam!: Phaser.Cameras.Scene2D.Camera;
  private mapObjects = new Set<Phaser.GameObjects.GameObject>();
  private info!: Layer;
  private left!: Button;
  private right!: Button;
  private maxScroll = 0;
  private drag: { x: number; scroll: number } | null = null;

  constructor() {
    super('CityMap');
  }

  create(data: CityMapData) {
    // The first core of a typed city earns a tier certificate: its ceremony comes first.
    if (data.finishedNow && startPendingCeremony(this)) return;
    this.params = data;
    this.mapObjects = new Set();
    this.drag = null;
    const progress = this.progress();
    this.city = loadCity(game(), data.index);

    // The map camera renders first and the main camera (UI) on top of it, so
    // the info panel covers the diagram and takes clicks before it does. The
    // main camera stays transparent; the game background shows outside the map.
    this.mapCam = this.cameras.add(0, VIEW_TOP, WIDTH, VIEW_HEIGHT).setBackgroundColor(COLORS.bg);
    const list = this.cameras.cameras;
    list.unshift(list.splice(list.indexOf(this.mapCam), 1)[0]);
    this.mapCam.setScroll(0, VIEW_SCROLL_Y);

    const status = progress.finished ? 'concluída' : 'em andamento';
    header(this, `Cidade ${encodeCityCode(progress.level, progress.seed, progress.type)} · nível ${progress.level} · ${status}`, () => this.scene.start('Cities'), 'city-map');
    goalBar(this);
    this.info = new Layer(this);

    this.drawLegend();
    this.drawDiagram();
    this.left = button(this, 1150, 60, 50, 24, '<', () => this.scrollTo(this.mapCam.scrollX - CITY_COLUMN_WIDTH, true), { size: 16 });
    this.right = button(this, 1210, 60, 50, 24, '>', () => this.scrollTo(this.mapCam.scrollX + CITY_COLUMN_WIDTH, true), { size: 16 });
    this.setupDrag();
    this.scrollTo(0, false);

    if (data.focus !== undefined) this.focusSubnet(this.city.subnets[data.focus]);
    if (data.select) this.showInfo(cityNode(this.city, data.select));
    if (data.finishedNow) this.showFinished();
    this.syncCameras();
    if (data.notice) this.notify(data.notice);
  }

  private progress(): CityProgress {
    return game().cities[this.params.index];
  }

  private isOpen(subnet: CitySubnet): boolean {
    return isSubnetOpen(this.progress(), subnet);
  }

  /** Adds a diagram object, drawn only by the map camera. */
  private m<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.mapObjects.add(obj);
    return obj;
  }

  /** Each camera skips the other's objects; called after anything new is drawn. */
  private syncCameras() {
    for (const obj of this.children.list) {
      if (this.mapObjects.has(obj)) this.cameras.main.ignore(obj);
      else this.mapCam.ignore(obj);
    }
  }

  private notify(message: string, color?: number) {
    toast(this, message, color);
    this.syncCameras();
  }

  private drawLegend() {
    const items: [string, number][] = [['alcançável', COLORS.warn], ['invadido', COLORS.accent], ['rota pendente', COLORS.info]];
    let lx = 20;
    for (const [label, color] of items) {
      this.add.circle(lx + 6, 72, 6, COLORS.panel).setStrokeStyle(2, color);
      const t = this.add.text(lx + 18, 72, label, textStyle(13, color)).setOrigin(0, 0.5);
      lx += t.width + 36;
    }
    this.add.rectangle(lx, 66, 12, 12, COLORS.panel).setOrigin(0).setStrokeStyle(2, COLORS.muted);
    lx += this.add.text(lx + 18, 72, 'roteador', textStyle(13, COLORS.muted)).setOrigin(0, 0.5).width + 54;
    this.add.text(lx, 72, 'Clique em uma máquina para ver os detalhes. Arraste o mapa para os lados.', textStyle(13, COLORS.muted)).setOrigin(0, 0.5);
  }

  private drawDiagram() {
    const state = game();
    const city = this.city;
    const g = this.m(this.add.graphics());
    let right = 0;

    for (const subnet of city.subnets.filter((s) => this.isOpen(s))) {
      const { x, y, width, height } = subnet.box;
      right = Math.max(right, x + width);
      const home = subnet.depth === 0;
      this.m(this.add.rectangle(x, y, width, height + BOX_LABEL_ROOM, COLORS.panel).setOrigin(0).setStrokeStyle(2, home ? COLORS.info : COLORS.panelBorder));
      fitText(this.m(this.add.text(x + 8, y + 6, `${subnet.network}/${subnet.prefix}`, textStyle(15, COLORS.info))), width - 16);
      // The box's top-right tag: the entrance, and on typed cities what the subnet is.
      const tag = [home ? 'entrada' : '', subnet.vlan ? `VLAN ${subnet.vlan.id} · ${subnet.vlan.name}` : '',
        city.type === 'nat' ? (home ? 'rede pública' : 'rede privada') : ''].filter(Boolean).join(' · ');
      if (tag) fitText(this.m(this.add.text(x + width - 8, y - 4, tag, textStyle(11, COLORS.info)).setOrigin(1, 1)), width);

      // The link to an open child subnet is the route the player wrote.
      if (subnet.routerId) {
        const router = cityNode(city, subnet.routerId);
        g.lineStyle(2, COLORS.accentDim, 1);
        g.lineBetween(router.x + 10, router.y, x, y + height / 2);
      }
    }

    for (const node of city.nodes) {
      const status = cityNodeStatus(state, this.params.index, city, node);
      if (status === 'hidden') continue;
      const color = STATUS_COLOR[status];
      const shape = node.role === 'router'
        ? this.add.rectangle(node.x, node.y, 20, 20, COLORS.panel).setStrokeStyle(3, color)
        : this.add.circle(node.x, node.y, node.role === 'core' ? 13 : 10, COLORS.panel).setStrokeStyle(node.role === 'core' ? 4 : 3, color);
      this.m(shape);
      if (status === 'breached') this.m(this.add.text(node.x, node.y, '✓', textStyle(13, color)).setOrigin(0.5));
      if (status === 'reachable') this.tweens.add({ targets: shape, scale: 1.12, yoyo: true, repeat: -1, duration: 700 });
      fitText(this.m(this.add.text(node.x, node.y + 14, node.name, textStyle(11, color)).setOrigin(0.5, 0)), 96);
      this.m(this.add.text(node.x, node.y + 27, this.shortIp(node), textStyle(10, COLORS.muted)).setOrigin(0.5, 0));
      shape.setInteractive({ useHandCursor: true });
      shape.on('pointerdown', () => this.showInfo(node));

      // A breached router whose route is not written yet leads to a "?".
      const child = node.childSubnetId === null ? null : city.subnets[node.childSubnetId];
      if (status === 'breached' && child && !this.isOpen(child)) {
        const sx = node.x + STUB_LENGTH;
        g.lineStyle(2, COLORS.info, 1);
        for (let lx = node.x + 12; lx < sx - 12; lx += 10) g.lineBetween(lx, node.y, Math.min(lx + 5, sx - 12), node.y);
        const stub = this.m(this.add.circle(sx, node.y, 12, COLORS.panel).setStrokeStyle(2, COLORS.info));
        this.m(this.add.text(sx, node.y, '?', textStyle(15, COLORS.info)).setOrigin(0.5));
        stub.setInteractive({ useHandCursor: true });
        stub.on('pointerdown', () => this.showInfo(node));
        right = Math.max(right, sx + 12);
      }
    }
    this.maxScroll = Math.max(0, right + 40 - WIDTH);
  }

  private setupDrag() {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      const inMap = p.y >= VIEW_TOP && p.y < VIEW_TOP + VIEW_HEIGHT;
      // Dragging starts on the diagram only, never on the panel or buttons.
      if (inMap && over.every((o) => this.mapObjects.has(o))) this.drag = { x: p.x, scroll: this.mapCam.scrollX };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.drag && p.isDown) this.scrollTo(this.drag.scroll - (p.x - this.drag.x), false);
    });
    this.input.on('pointerup', () => { this.drag = null; });
  }

  private scrollTo(target: number, animate: boolean) {
    const x = Phaser.Math.Clamp(target, 0, this.maxScroll);
    this.tweens.killTweensOf(this.mapCam);
    if (animate) this.tweens.add({ targets: this.mapCam, scrollX: x, duration: 350, ease: 'Sine.easeInOut' });
    else this.mapCam.scrollX = x;
    this.left.setDisabled(x <= 0);
    this.right.setDisabled(x >= this.maxScroll);
  }

  /** Brings a subnet's column into view and flashes its box. */
  private focusSubnet(subnet: CitySubnet) {
    const { x, y, width, height } = subnet.box;
    this.scrollTo(x + width / 2 - WIDTH / 2, true);
    const flash = this.m(this.add.rectangle(x, y, width, height + BOX_LABEL_ROOM).setOrigin(0).setStrokeStyle(3, COLORS.accent));
    this.tweens.add({ targets: flash, alpha: 0, duration: 600, yoyo: true, repeat: 2, onComplete: () => { this.mapObjects.delete(flash); flash.destroy(); } });
  }

  private showInfo(node: CityNode) {
    this.info.clear();
    const state = game();
    const index = this.params.index;
    const status = cityNodeStatus(state, index, this.city, node);
    const w = 440;
    // The panel sits on the side away from the node, so the node stays visible.
    const x = node.x - this.mapCam.scrollX < WIDTH / 2 ? WIDTH - w - 20 : 20;
    const y = 96;
    const color = STATUS_COLOR[status];
    const panel = this.info.rect(x, y, w, 240, COLORS.panel, color);
    // The panel swallows clicks, so nodes under it cannot be picked through it.
    panel.setInteractive();
    // Every city machine is a lab machine, like the campaign's.
    const tag = this.info.text(x + w - 14, y + 14, 'SIMULADO', textStyle(12, COLORS.muted)).setOrigin(1, 0);
    fitText(this.info.text(x + 14, y + 10, `${node.name}  (${node.ip})`, textStyle(18, color)), w - 28 - tag.width - 10);

    let cy = y + 36;
    this.info.text(x + 14, cy, `Área: ${MINIGAME_AREAS[node.minigame]} · Dificuldade ${'★'.repeat(node.difficulty)}`, textStyle(14, COLORS.info));
    cy += 20;
    const flavor = fitText(this.info.text(x + 14, cy, node.flavor, textStyle(13, COLORS.text, { wordWrap: { width: w - 28 } })), w - 28, 38);
    cy += Math.max(flavor.height, 18) + 6;
    for (const c of cityRequirementChecks(state, node)) {
      fitText(this.info.text(x + 14, cy, `${c.met ? '✓' : '✗'} ${c.label}`, textStyle(13, c.met ? COLORS.accent : COLORS.danger)), w - 28);
      cy += 16;
    }

    const breached = status === 'breached';
    const child = node.childSubnetId === null ? null : this.city.subnets[node.childSubnetId];
    const routeMissing = breached && child !== null && !this.isOpen(child);
    const kind = child ? gateKind(this.city, node.id) : 'route';
    const line = (text: string, size: number, color: number, indent = 14, height = 20) => {
      fitText(this.info.text(x + indent, cy, text, textStyle(size, color)), w - indent - 14);
      cy += height;
    };
    if (routeMissing) {
      cy += 8;
      if (kind === 'vlan') {
        const gate = vlanGate(this.city, node.id);
        line(`O segmento atrás deste roteador se chama ${gate.segment.name}.`, 13, COLORS.text);
        // The names can be many; the gate screen lists them in full.
        line(`O link até ele leva ${plural(gate.carried.length, 'VLAN', 'VLANs')}.`, 13, COLORS.info, 14, 22);
      } else {
        line('Você achou a interface do outro lado do roteador:', 13, COLORS.text);
        line(`eth1: ${kind === 'ipv6' ? 'inet6' : 'inet'} ${child.routerChildIp}/${child.prefix}`, 15, COLORS.info, 24, 22);
        if (kind === 'nat') {
          const { service, host } = child.publish!;
          line(`Serviço publicado: ${service.name}, porta ${service.port}, no host .${host.split('.')[3]}`, 13, COLORS.warn);
        }
      }
      const hint = fitText(this.info.text(x + 14, cy, GATE_HINT[kind], textStyle(13, COLORS.muted, { wordWrap: { width: w - 28 } })), w - 28, 36);
      cy += hint.height + 4;
    } else if (breached && child) {
      cy += 8;
      line(gateDone(this.city, node), 13, COLORS.accent);
    }

    const by = Math.max(cy + 8, y + 190);
    const reward = breached ? Math.floor(node.reward * REPLAY_RATIO) : node.reward;
    const ok = canConnectCityNode(state, index, this.city, node);
    const attack = this.info.button(x + w - 190, by, 176, 42, breached ? `Invadir de novo ${money(reward)}` : `Invadir ${money(reward)}`, () => {
      const data: MinigameData = {
        minigame: node.minigame,
        difficulty: node.difficulty,
        reward,
        title: `Invadindo: ${node.name} (${node.ip})`,
        city: { index, nodeId: node.id },
      };
      this.scene.start('Minigame', data);
    }, { disabled: !ok, color: COLORS.warn, size: 16 });
    if (!ok) attack.label.setColor(hex(COLORS.muted));
    if (routeMissing) {
      this.info.button(x + 14, by, 176, 42, GATE_BUTTON[kind], () => this.scene.start('Route', { index, routerId: node.id }), { color: COLORS.info, size: 16 });
    } else {
      this.info.button(x + 14, by, 110, 42, 'Fechar', () => this.info.clear(), { color: COLORS.info, size: 16 });
    }
    panel.setSize(w, by + 56 - y);
    this.syncCameras();
  }

  /** IPv6 nodes show only their interface part ("::2a"); the subnet box already shows the prefix. */
  private shortIp(node: CityNode): string {
    const network = this.city.subnets[node.subnetId].network;
    return this.city.type === 'ipv6' && network.endsWith('::') && node.ip.startsWith(network) ? `::${node.ip.slice(network.length)}` : node.ip;
  }

  /** Banner for the first breach of the core: the city is done. */
  private showFinished() {
    this.info.clear();
    const w = 640;
    const h = 250;
    const x = (WIDTH - w) / 2;
    const y = 200;
    this.info.rect(x, y, w, h, COLORS.panel, COLORS.accent).setInteractive();
    this.info.text(WIDTH / 2, y + 30, 'CIDADE CONCLUÍDA', textStyle(30, COLORS.accent)).setOrigin(0.5, 0);
    const core = cityNode(this.city, this.city.coreId);
    fitText(this.info.text(WIDTH / 2, y + 84, `Você invadiu o ${core.name} e fechou este exercício.\nA sua próxima cidade nova vai ser de nível ${nextCityLevel(game())}.`,
      textStyle(18, COLORS.text, { align: 'center', lineSpacing: 6, wordWrap: { width: w - 40 } })).setOrigin(0.5, 0), w - 40, 80);
    this.info.button(x + 30, y + h - 76, 280, 50, 'Ver cidades', () => this.scene.start('Cities'), { size: 20 });
    this.info.button(x + w - 310, y + h - 76, 280, 50, 'Ficar no mapa', () => this.info.clear(), { size: 20, color: COLORS.info });
  }
}

/** What a router's panel asks for while its gate is closed. */
const GATE_HINT: Record<GateKind, string> = {
  route: 'Escreva a rota até a rede que fica atrás dele para ela aparecer no mapa.',
  ipv6: 'Escreva a rota IPv6 até a rede que fica atrás dele para ela aparecer no mapa.',
  nat: 'Redirecione a porta do serviço publicado para a rede privada aparecer no mapa.',
  vlan: 'Configure a porta do switch com a VLAN do segmento para ele aparecer no mapa.',
};

/** The entry that opened a router's gate, as the panel shows it afterwards. */
function gateDone(city: City, router: CityNode): string {
  const entry = correctGate(city, router.id);
  switch (entry.kind) {
    case 'route':
    case 'ipv6': return `Rota escrita: ${entry.destination}/${entry.prefix} via ${entry.nextHop}`;
    case 'nat': return `Redirecionamento: ${entry.publicAddress}:${entry.publicPort} → ${entry.privateAddress}:${entry.privatePort}`;
    case 'vlan': return `Porta configurada: ${entry.mode === 'trunk' ? 'tronco' : 'acesso'}, VLAN ${entry.vlanId}`;
  }
}
