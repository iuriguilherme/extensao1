import Phaser from 'phaser';
import { validateNetConfig, type LanInfo, type NetConfig } from '../core/ip';
import { setNetConfig } from '../core/state';
import { game, save } from '../core/store';
import { plural } from '../core/fmt';
import { button, COLORS, header, Layer, objectiveBar, panel, textStyle, WIDTH } from '../ui/widgets';

/** The home LAN the player has to join. DHCP is "broken", so it is manual. */
export const HOME_LAN: LanInfo = {
  routerIp: '192.168.0.1',
  mask: '255.255.255.0',
  takenBy: { 'roteador': '192.168.0.1', 'Smart TV': '192.168.0.10', 'impressora': '192.168.0.20' },
  dnsServers: ['192.168.0.1', '203.0.113.53'],
};

interface Field {
  key: keyof NetConfig;
  label: string;
  hint: string;
  choices: string[];
}

const FIELDS: Field[] = [
  {
    key: 'ip', label: 'Endereço IP', hint: 'Um endereço livre dentro da LAN (nem de rede, nem de broadcast, nem ocupado).',
    choices: ['192.168.1.42', '192.168.0.10', '192.168.0.300', '192.168.0.255', '192.168.0.42', '10.0.0.42', '192.168.0.0'],
  },
  {
    key: 'mask', label: 'Máscara de sub-rede', hint: 'Precisa bater com a da LAN, para todos concordarem onde a rede termina.',
    choices: ['255.255.0.0', '255.255.255.255', '255.255.255.0', '255.0.255.0'],
  },
  {
    key: 'gateway', label: 'Gateway padrão', hint: 'Para onde mandar o tráfego destinado a outras redes.',
    choices: ['192.168.0.10', '192.168.0.255', '203.0.113.53', '192.168.0.1'],
  },
  {
    key: 'dns', label: 'Servidor DNS', hint: 'Quem traduz nomes em IPs para você.',
    choices: ['127.0.0.1', '192.168.0.20', '203.0.113.53', '192.168.0.1'],
  },
];

export class NetSetupScene extends Phaser.Scene {
  private selection: Record<keyof NetConfig, number> = { ip: 0, mask: 0, gateway: 0, dns: 0 };
  private layer!: Layer;
  private result!: Layer;

  constructor() {
    super('NetSetup');
  }

  create() {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    header(this, 'Configuração de Rede — eth0', () => this.scene.start('Hub'));
    const refreshObjective = objectiveBar(this).refresh;
    this.layer = new Layer(this);
    this.result = new Layer(this);

    const current = game().netConfig;
    if (current) {
      for (const f of FIELDS) this.selection[f.key] = Math.max(0, f.choices.indexOf(current[f.key]));
    }

    // Info sheet taped to the router.
    panel(this, 820, 76, 440, 300, COLORS.info);
    // Pad from the longest label so the monospace column survives longer PT-BR labels.
    const noteRows: [string, string][] = [['IP do roteador:', HOME_LAN.routerIp], ['Máscara da LAN:', `${HOME_LAN.mask}  (/24)`]];
    const pad = Math.max(...noteRows.map(([label]) => label.length)) + 1;
    this.add.text(840, 92, [
      'BILHETE COLADO NO ROTEADOR',
      '',
      'DHCP: DESLIGADO (alguém quebrou)',
      ...noteRows.map(([label, value]) => `${label.padEnd(pad)}${value}`),
      '',
      'Já estão na LAN:',
      ...Object.entries(HOME_LAN.takenBy).map(([name, ip]) => `  ${ip.padEnd(14)} ${name}`),
      '',
      'O roteador repassa DNS: sim',
      'DNS do provedor: 203.0.113.53',
    ].join('\n'), textStyle(15, COLORS.info, { lineSpacing: 4 }));

    button(this, 40, 560, 300, 56, 'Aplicar', () => {
      const config = this.config();
      const errors = validateNetConfig(config, HOME_LAN);
      this.result.clear();
      if (errors.length) {
        const shown = errors.slice(0, 3).map((e) => `  • ${e.message}`);
        if (errors.length > 3) shown.push(`  (+${plural(errors.length - 3, 'outro problema', 'outros problemas')})`);
        this.result.text(360, 540, ['✗ Falha na conexão:', ...shown].join('\n'),
          textStyle(15, COLORS.danger, { wordWrap: { width: WIDTH - 400 }, lineSpacing: 3 }));
        return;
      }
      setNetConfig(game(), config);
      save();
      refreshObjective();
      this.result.text(360, 548, [
        `✓ ping ${config.gateway} … resposta em 1 ms`,
        `✓ nslookup example.com via ${config.dns} … 203.0.113.80`,
        'Você está ONLINE.',
      ].join('\n'), textStyle(16, COLORS.accent, { lineSpacing: 3 }));
      this.result.button(WIDTH - 260, 560, 220, 56, 'Abrir Mapa da Rede >', () => this.scene.start('NetMap'), { color: COLORS.warn });
    }, { size: 22, color: COLORS.warn });

    this.drawFields();
  }

  private config(): NetConfig {
    const c = {} as NetConfig;
    for (const f of FIELDS) c[f.key] = f.choices[this.selection[f.key]];
    return c;
  }

  private drawFields() {
    this.layer.clear();
    FIELDS.forEach((f, i) => {
      const y = 80 + i * 116;
      this.layer.text(40, y, f.label, textStyle(20, COLORS.accent));
      this.layer.text(40, y + 28, f.hint, textStyle(14, COLORS.muted));
      const cycle = (delta: number) => {
        this.selection[f.key] = (this.selection[f.key] + delta + f.choices.length) % f.choices.length;
        this.result.clear();
        this.drawFields();
      };
      this.layer.button(40, y + 54, 50, 46, '<', () => cycle(-1));
      this.layer.rect(100, y + 54, 360, 46);
      this.layer.text(280, y + 77, f.choices[this.selection[f.key]], textStyle(22, COLORS.text)).setOrigin(0.5);
      this.layer.button(470, y + 54, 50, 46, '>', () => cycle(1));
    });
  }
}
