import Phaser from 'phaser';
import { cityNode, type City, type CityNode } from '../core/city';
import { alignColumns, plural } from '../core/fmt';
import { routeChoices, type RouteChoices, type RouteEntry } from '../core/routing';
import { loadCity, submitRoute } from '../core/state';
import { game, save } from '../core/store';
import { button, COLORS, fitText, header, Layer, objectiveBar, panel, textStyle, WIDTH } from '../ui/widgets';
import type { CityMapData } from './CityMapScene';

export interface RouteData {
  index: number;
  routerId: string;
}

interface Field {
  key: keyof RouteChoices;
  label: string;
  hint: string;
}

const FIELDS: Field[] = [
  { key: 'destination', label: 'Destino', hint: 'A rede que você quer alcançar: o endereço de rede, com os bits de host em zero.' },
  { key: 'prefix', label: 'Prefixo', hint: 'Quantos bits do endereço são a parte da rede. É o mesmo da rede de destino.' },
  { key: 'nextHop', label: 'Próximo salto', hint: 'Para quem você entrega os pacotes: um endereço na rede onde você já está.' },
];

/** Writes the routing entry that opens the subnet behind a breached city router. */
export class RouteScene extends Phaser.Scene {
  private params!: RouteData;
  private city!: City;
  private router!: CityNode;
  private choices!: RouteChoices;
  private selection: Record<keyof RouteChoices, number> = { destination: 0, prefix: 0, nextHop: 0 };
  private layer!: Layer;
  private result!: Layer;

  constructor() {
    super('Route');
  }

  create(data: RouteData) {
    this.params = data;
    this.city = loadCity(game(), data.index);
    this.router = cityNode(this.city, data.routerId);
    this.choices = routeChoices(this.city, data.routerId);
    this.selection = { destination: 0, prefix: 0, nextHop: 0 };

    this.cameras.main.setBackgroundColor(COLORS.bg);
    header(this, `Tabela de roteamento — ${this.router.name}`, () => this.back());
    objectiveBar(this);
    this.layer = new Layer(this);
    this.result = new Layer(this);

    // What the breach revealed, like the note taped to the home router.
    const parent = this.city.subnets[this.router.subnetId];
    const child = this.city.subnets[this.router.childSubnetId!];
    panel(this, 780, 76, 480, 272, COLORS.info);
    const rows: [string, string][] = [
      ['Rede deste lado:', `${parent.network}/${parent.prefix}`],
      ['Roteador deste lado:', this.router.ip],
    ];
    this.add.text(800, 92, [
      'O QUE A INVASÃO REVELOU',
      '',
      ...alignColumns(rows, 1),
      '',
      'Interface do outro lado do roteador:',
      `  eth1: inet ${child.routerChildIp}/${child.prefix}`,
      '',
      'Uma rota diz: para chegar à rede X/P,',
      'entregue os pacotes ao próximo salto.',
      'A rede de destino é a que fica atrás',
      'deste roteador.',
    ].join('\n'), textStyle(15, COLORS.info, { lineSpacing: 4 }));

    button(this, 40, 560, 300, 56, 'Aplicar rota', () => this.apply(), { size: 22, color: COLORS.warn });
    this.drawFields();
  }

  private entry(): RouteEntry {
    return {
      destination: this.choices.destination[this.selection.destination],
      prefix: this.choices.prefix[this.selection.prefix],
      nextHop: this.choices.nextHop[this.selection.nextHop],
    };
  }

  private show(key: keyof RouteChoices, i: number): string {
    return key === 'prefix' ? `/${this.choices.prefix[i]}` : String(this.choices[key][i]);
  }

  private drawFields() {
    this.layer.clear();
    FIELDS.forEach((f, i) => {
      const y = 76 + i * 116;
      this.layer.text(40, y, f.label, textStyle(20, COLORS.accent));
      this.layer.text(40, y + 28, f.hint, textStyle(14, COLORS.muted, { wordWrap: { width: 700 } }));
      const count = this.choices[f.key].length;
      const cycle = (delta: number) => {
        this.selection[f.key] = (this.selection[f.key] + delta + count) % count;
        this.result.clear();
        this.drawFields();
      };
      this.layer.button(40, y + 54, 50, 46, '<', () => cycle(-1));
      this.layer.rect(100, y + 54, 360, 46);
      this.layer.text(280, y + 77, this.show(f.key, this.selection[f.key]), textStyle(22, COLORS.text)).setOrigin(0.5);
      this.layer.button(470, y + 54, 50, 46, '>', () => cycle(1));
    });
    const e = this.entry();
    this.layer.text(40, 440, 'Sua rota:', textStyle(16, COLORS.muted));
    this.layer.text(40, 466, `ip route add ${e.destination}/${e.prefix} via ${e.nextHop}`, textStyle(20, COLORS.warn));
  }

  private apply() {
    const entry = this.entry();
    const errors = submitRoute(game(), this.params.index, this.city, this.params.routerId, entry);
    this.result.clear();
    if (errors.length) {
      const shown = errors.slice(0, 3).map((e) => `  • ${e.message}`);
      if (errors.length > 3) shown.push(`  (+${plural(errors.length - 3, 'outro problema', 'outros problemas')})`);
      // Kept above the objective bar: long teaching messages shrink to fit.
      fitText(this.result.text(360, 510, ['✗ A rota não funcionou:', ...shown].join('\n'),
        textStyle(15, COLORS.danger, { wordWrap: { width: WIDTH - 400 }, lineSpacing: 3 })), WIDTH - 400, 162);
      return;
    }
    save();
    const child = this.city.subnets[this.router.childSubnetId!];
    const back: CityMapData = {
      index: this.params.index,
      focus: child.id,
      notice: `Rota aceita! A rede ${child.network}/${child.prefix} apareceu no mapa.`,
    };
    this.scene.start('CityMap', back);
  }

  private back() {
    const back: CityMapData = { index: this.params.index, focus: this.router.subnetId, select: this.router.id };
    this.scene.start('CityMap', back);
  }
}
