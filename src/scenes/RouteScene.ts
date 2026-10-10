import Phaser from 'phaser';
import { cityNode, type City, type CityNode } from '../core/city';
import { alignColumns, listJoin, plural } from '../core/fmt';
import { gateChoices, vlanGate, type GateChoices, type GateEntry, type GateKind } from '../core/gates';
import { loadCity, submitGate } from '../core/state';
import { game, save } from '../core/store';
import { button, COLORS, fitText, header, Layer, goalBar, panel, textStyle, WIDTH } from '../ui/widgets';
import type { CityMapData } from './CityMapScene';

export interface RouteData {
  index: number;
  routerId: string;
}

interface Field {
  key: string;
  label: string;
  hint: string;
}

/** The form's fields for each kind of gate, top to bottom. */
const FIELDS: Record<GateKind, Field[]> = {
  route: [
    { key: 'destination', label: 'Destino', hint: 'A rede que você quer alcançar: o endereço de rede, com os bits de host em zero.' },
    { key: 'prefix', label: 'Prefixo', hint: 'Quantos bits do endereço são a parte da rede. É o mesmo da rede de destino.' },
    { key: 'nextHop', label: 'Próximo salto', hint: 'Para quem você entrega os pacotes: um endereço na rede onde você já está.' },
  ],
  ipv6: [
    { key: 'destination', label: 'Destino', hint: 'A rede que você quer alcançar: o prefixo, com a parte do host zerada. Vale a forma curta ou a completa.' },
    { key: 'prefix', label: 'Prefixo', hint: 'O tamanho do prefixo da rede de destino.' },
    { key: 'nextHop', label: 'Próximo salto', hint: 'Para quem você entrega os pacotes: o endereço do roteador na rede onde você já está.' },
  ],
  nat: [
    { key: 'publicAddress', label: 'Endereço público', hint: 'O endereço que a internet enxerga: o deste roteador na rede pública.' },
    { key: 'publicPort', label: 'Porta pública', hint: 'A porta que quem vem de fora usa para chegar ao serviço.' },
    { key: 'privateAddress', label: 'Endereço privado', hint: 'O host da rede privada que roda o serviço publicado.' },
    { key: 'privatePort', label: 'Porta privada', hint: 'A porta em que o serviço escuta nesse host.' },
  ],
  vlan: [
    { key: 'vlanId', label: 'ID da VLAN', hint: 'O número que a tabela do switch dá ao segmento atrás deste roteador.' },
    { key: 'mode', label: 'Modo da porta', hint: 'Uma porta de acesso leva uma VLAN só; um tronco leva várias.' },
  ],
};

const TITLES: Record<GateKind, string> = {
  route: 'Tabela de roteamento', ipv6: 'Tabela de roteamento IPv6', nat: 'Redirecionamento de porta', vlan: 'Porta do switch',
};

/** The apply button and the label over the entry preview. */
const WORDS: Record<GateKind, { apply: string; preview: string }> = {
  route: { apply: 'Aplicar rota', preview: 'Sua rota:' },
  ipv6: { apply: 'Aplicar rota', preview: 'Sua rota:' },
  nat: { apply: 'Aplicar regra', preview: 'Sua regra:' },
  vlan: { apply: 'Configurar porta', preview: 'Sua configuração:' },
};

const FAILED: Record<GateKind, string> = {
  route: '✗ A rota não funcionou:', ipv6: '✗ A rota não funcionou:', nat: '✗ O redirecionamento não funcionou:', vlan: '✗ A porta não funcionou assim:',
};

/**
 * Writes the gate entry that opens the subnet behind a breached city router:
 * a route, a port forward, a VLAN port or an IPv6 route, by the city's type.
 */
export class RouteScene extends Phaser.Scene {
  private params!: RouteData;
  private city!: City;
  private router!: CityNode;
  private choices!: GateChoices;
  private selection: Record<string, number> = {};
  private layer!: Layer;
  private result!: Layer;

  constructor() {
    super('Route');
  }

  create(data: RouteData) {
    this.params = data;
    this.city = loadCity(game(), data.index);
    this.router = cityNode(this.city, data.routerId);
    this.choices = gateChoices(this.city, data.routerId);
    this.selection = Object.fromEntries(FIELDS[this.choices.kind].map((f) => [f.key, 0]));

    this.cameras.main.setBackgroundColor(COLORS.bg);
    header(this, `${TITLES[this.choices.kind]} — ${this.router.name}`, () => this.back(), 'route');
    goalBar(this);
    this.layer = new Layer(this);
    this.result = new Layer(this);

    // What the breach revealed, like the note taped to the home router.
    const lines = this.revealed();
    const height = Math.min(420, 32 + lines.length * 19);
    panel(this, 780, 76, 480, height, COLORS.info);
    fitText(this.add.text(800, 92, lines.join('\n'), textStyle(15, COLORS.info, { lineSpacing: 4 })), 440, height - 28);

    button(this, 40, 560, 300, 56, WORDS[this.choices.kind].apply, () => this.apply(), { size: 22, color: COLORS.warn });
    this.drawFields();
  }

  private revealed(): string[] {
    const parent = this.city.subnets[this.router.subnetId];
    const child = this.city.subnets[this.router.childSubnetId!];
    const here: [string, string][] = [['Rede deste lado:', `${parent.network}/${parent.prefix}`], ['Roteador deste lado:', this.router.ip]];
    switch (this.choices.kind) {
      case 'vlan': {
        const gate = vlanGate(this.city, this.router.id);
        const table = gate.table.map((v) => `VLAN ${v.id} · ${v.name}`);
        const width = Math.max(...table.map((t) => t.length)) + 3;
        const rows: string[] = [];
        for (let i = 0; i < table.length; i += 2) rows.push(table[i].padEnd(width) + (table[i + 1] ?? ''));
        return [
          'O QUE A INVASÃO REVELOU', '',
          `Segmento atrás deste roteador: ${gate.segment.name}`,
          `O link leva ${plural(gate.carried.length, 'VLAN', 'VLANs')}:`,
          ...wrap(listJoin(gate.carried.map((v) => v.name)), 44).map((l) => `  ${l}`),
          '', 'Tabela de VLANs do switch:', ...rows.map((r) => r.trimEnd()),
        ];
      }
      case 'nat': {
        const { service, host } = child.publish!;
        return [
          'O QUE A INVASÃO REVELOU', '', ...alignColumns(here, 1), '',
          'Interface do outro lado do roteador:', `  eth1: inet ${child.routerChildIp}/${child.prefix}`, '',
          `Serviço publicado: ${service.name},`, `  porta ${service.port}, no host .${host.split('.')[3]}`, '',
          'Um redirecionamento diz: o que chegar', 'ao endereço público e à porta vai para', 'o host privado e a porta dele.',
        ];
      }
      case 'ipv6':
        return [
          'O QUE A INVASÃO REVELOU', '', 'Rede deste lado:', `  ${parent.network}/${parent.prefix}`, 'Roteador deste lado:', `  ${this.router.ip}`, '',
          'Interface do outro lado do roteador:', `  eth1: inet6 ${child.routerChildIp}/${child.prefix}`, '',
          'Uma rota diz: para chegar à rede X/P,', 'entregue os pacotes ao próximo salto.',
        ];
      case 'route':
        return [
          'O QUE A INVASÃO REVELOU', '', ...alignColumns(here, 1), '',
          'Interface do outro lado do roteador:', `  eth1: inet ${child.routerChildIp}/${child.prefix}`, '',
          'Uma rota diz: para chegar à rede X/P,', 'entregue os pacotes ao próximo salto.',
          'A rede de destino é a que fica atrás', 'deste roteador.',
        ];
    }
  }

  private options(key: string): (string | number)[] {
    return (this.choices as unknown as Record<string, (string | number)[]>)[key];
  }

  private entry(): GateEntry {
    const values = Object.fromEntries(FIELDS[this.choices.kind].map((f) => [f.key, this.options(f.key)[this.selection[f.key]]]));
    return { kind: this.choices.kind, ...values } as GateEntry;
  }

  private show(key: string, value: string | number): string {
    if (key === 'prefix') return `/${value}`;
    if (key === 'mode') return value === 'trunk' ? 'Tronco' : 'Porta de acesso';
    return String(value);
  }

  private drawFields() {
    this.layer.clear();
    const fields = FIELDS[this.choices.kind];
    const step = fields.length > 3 ? 100 : 116;
    fields.forEach((f, i) => {
      const y = 76 + i * step;
      this.layer.text(40, y, f.label, textStyle(20, COLORS.accent));
      fitText(this.layer.text(40, y + 28, f.hint, textStyle(14, COLORS.muted)), 700);
      const options = this.options(f.key);
      const cycle = (delta: number) => {
        this.selection[f.key] = (this.selection[f.key] + delta + options.length) % options.length;
        this.result.clear();
        this.drawFields();
      };
      const h = fields.length > 3 ? 40 : 46;
      this.layer.button(40, y + 52, 50, h, '<', () => cycle(-1));
      this.layer.rect(100, y + 52, 360, h);
      fitText(this.layer.text(280, y + 52 + h / 2, this.show(f.key, options[this.selection[f.key]]), textStyle(22, COLORS.text)).setOrigin(0.5), 348);
      this.layer.button(470, y + 52, 50, h, '>', () => cycle(1));
    });
    const top = 76 + fields.length * step;
    this.layer.text(40, top - 4, WORDS[this.choices.kind].preview, textStyle(16, COLORS.muted));
    fitText(this.layer.text(40, top + 20, command(this.entry()), textStyle(20, COLORS.warn)), 720);
  }

  private apply() {
    const entry = this.entry();
    const errors = submitGate(game(), this.params.index, this.city, this.params.routerId, entry);
    this.result.clear();
    if (errors.length) {
      const shown = errors.slice(0, 3).map((e) => `  • ${e.message}`);
      if (errors.length > 3) shown.push(`  (+${plural(errors.length - 3, 'outro problema', 'outros problemas')})`);
      // Kept above the objective bar: long teaching messages shrink to fit.
      const top = Math.max(510, 76 + FIELDS[entry.kind].length * (FIELDS[entry.kind].length > 3 ? 100 : 116) + 60);
      fitText(this.result.text(360, top, [FAILED[entry.kind], ...shown].join('\n'),
        textStyle(15, COLORS.danger, { wordWrap: { width: WIDTH - 400 }, lineSpacing: 3 })), WIDTH - 400, 672 - top);
      return;
    }
    save();
    const child = this.city.subnets[this.router.childSubnetId!];
    const back: CityMapData = {
      index: this.params.index,
      focus: child.id,
      notice: entry.kind === 'vlan'
        ? `Porta configurada! O segmento ${child.vlan!.name} (VLAN ${child.vlan!.id}) apareceu no mapa.`
        : `${entry.kind === 'nat' ? 'Redirecionamento aceito' : 'Rota aceita'}! A rede ${child.network}/${child.prefix} apareceu no mapa.`,
    };
    this.scene.start('CityMap', back);
  }

  private back() {
    const back: CityMapData = { index: this.params.index, focus: this.router.subnetId, select: this.router.id };
    this.scene.start('CityMap', back);
  }
}

/** The entry as one line of configuration. */
function command(entry: GateEntry): string {
  switch (entry.kind) {
    case 'route': return `ip route add ${entry.destination}/${entry.prefix} via ${entry.nextHop}`;
    case 'ipv6': return `ip -6 route add ${entry.destination}/${entry.prefix} via ${entry.nextHop}`;
    case 'nat': return `redirecionar ${entry.publicAddress}:${entry.publicPort} → ${entry.privateAddress}:${entry.privatePort}`;
    case 'vlan': return `porta do switch: ${entry.mode === 'trunk' ? 'tronco' : 'acesso'}, VLAN ${entry.vlanId}`;
  }
}

/** Splits text into lines of at most `width` characters, at spaces. */
function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line && line.length + 1 + word.length > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  return line ? [...lines, line] : lines;
}
