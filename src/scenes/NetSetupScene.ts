import Phaser from 'phaser';
import { validateNetConfig, type LanInfo, type NetConfig } from '../core/ip';
import { setNetConfig } from '../core/state';
import { game, save } from '../core/store';
import { button, COLORS, header, Layer, objectiveBar, panel, textStyle, WIDTH } from '../ui/widgets';

/** The home LAN the player has to join. DHCP is "broken", so it is manual. */
export const HOME_LAN: LanInfo = {
  routerIp: '192.168.0.1',
  mask: '255.255.255.0',
  takenBy: { 'the router': '192.168.0.1', 'the Smart TV': '192.168.0.10', 'the printer': '192.168.0.20' },
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
    key: 'ip', label: 'IP address', hint: 'A free address inside the LAN (not network, broadcast or taken).',
    choices: ['192.168.1.42', '192.168.0.10', '192.168.0.300', '192.168.0.255', '192.168.0.42', '10.0.0.42', '192.168.0.0'],
  },
  {
    key: 'mask', label: 'Subnet mask', hint: 'Must match the LAN so everyone agrees where the network ends.',
    choices: ['255.255.0.0', '255.255.255.255', '255.255.255.0', '255.0.255.0'],
  },
  {
    key: 'gateway', label: 'Default gateway', hint: 'Where to send traffic for other networks.',
    choices: ['192.168.0.10', '192.168.0.255', '203.0.113.53', '192.168.0.1'],
  },
  {
    key: 'dns', label: 'DNS server', hint: 'Who translates names into IPs for you.',
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
    header(this, 'Network Setup — eth0', () => this.scene.start('Hub'));
    const refreshObjective = objectiveBar(this).refresh;
    this.layer = new Layer(this);
    this.result = new Layer(this);

    const current = game().netConfig;
    if (current) {
      for (const f of FIELDS) this.selection[f.key] = Math.max(0, f.choices.indexOf(current[f.key]));
    }

    // Info sheet taped to the router.
    panel(this, 820, 76, 440, 300, COLORS.info);
    this.add.text(840, 92, [
      'STICKY NOTE ON THE ROUTER',
      '',
      'DHCP: OFF (someone broke it)',
      `Router LAN IP: ${HOME_LAN.routerIp}`,
      `LAN mask:      ${HOME_LAN.mask}  (/24)`,
      '',
      'Already on the LAN:',
      ...Object.entries(HOME_LAN.takenBy).map(([name, ip]) => `  ${ip.padEnd(14)} ${name}`),
      '',
      'Router forwards DNS: yes',
      'ISP DNS: 203.0.113.53',
    ].join('\n'), textStyle(15, COLORS.info, { lineSpacing: 4 }));

    button(this, 40, 560, 300, 56, 'Apply settings', () => {
      const config = this.config();
      const errors = validateNetConfig(config, HOME_LAN);
      this.result.clear();
      if (errors.length) {
        const shown = errors.slice(0, 3).map((e) => `  • ${e}`);
        if (errors.length > 3) shown.push(`  (+${errors.length - 3} more problem${errors.length > 4 ? 's' : ''})`);
        this.result.text(360, 540, ['✗ Connection failed:', ...shown].join('\n'),
          textStyle(15, COLORS.danger, { wordWrap: { width: WIDTH - 400 }, lineSpacing: 3 }));
        return;
      }
      setNetConfig(game(), config);
      save();
      refreshObjective();
      this.result.text(360, 548, [
        `✓ ping ${config.gateway} … reply in 1 ms`,
        `✓ nslookup example.com via ${config.dns} … 203.0.113.80`,
        'You are ONLINE.',
      ].join('\n'), textStyle(16, COLORS.accent, { lineSpacing: 3 }));
      this.result.button(WIDTH - 260, 560, 220, 56, 'Open Net Map >', () => this.scene.start('NetMap'), { color: COLORS.warn });
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
