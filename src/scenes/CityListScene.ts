import Phaser from 'phaser';
import { isCityTypeUnlocked } from '../core/certificates';
import { CITY_TYPE_LABELS, type CityType } from '../core/city';
import { CITY_NAMES, encodeCityCode, MAX_CITY_LEVEL, randomCitySeed, TYPE_PREFIXES } from '../core/cityCode';
import { plural } from '../core/fmt';
import { createRng } from '../core/random';
import { enterCityCode, nextCityLevel, startCity, type CityProgress } from '../core/state';
import { game, save } from '../core/store';
import { TIERS } from '../data/tiers';
import { COLORS, fitText, header, Layer, objectiveBar, textStyle, WIDTH } from '../ui/widgets';
import type { CityMapData } from './CityMapScene';

const ROWS_PER_PAGE = 6;
const ROW_TOP = 116;
const ROW_STEP = 72;

/** Code form fields: a type prefix, a city name, a level and four single digits. */
interface CodeField {
  label: string;
  width: number;
  count: number;
  /** Shown value for an index; level indexes are 0-based (level 1 is index 0). */
  show: (i: number) => string;
}

/** Index 0 is a plain code, with no prefix. */
const CODE_PREFIXES = ['', ...TIERS.map((t) => TYPE_PREFIXES[t.cityType])];

const CODE_FIELDS: CodeField[] = [
  { label: 'Tipo', width: 120, count: CODE_PREFIXES.length, show: (i) => CODE_PREFIXES[i] || '—' },
  { label: 'Cidade', width: 130, count: CITY_NAMES.length, show: (i) => CITY_NAMES[i] },
  { label: 'Nível', width: 100, count: MAX_CITY_LEVEL, show: (i) => String(i + 1) },
  ...[1, 2, 3, 4].map(() => ({ label: '', width: 80, count: 10, show: (i: number) => String(i) })),
];

/** What each city type trains, on the "Nova cidade" choice. */
const TYPE_HINTS: Record<CityType, string> = {
  plain: 'Endereços IPv4 e rotas',
  nat: 'Redes privadas atrás de um endereço público',
  vlan: 'Segmentos separados por VLANs',
  ipv6: 'Endereços e rotas IPv6',
};

/** The player's generated cities: open one, start a new one or type a code. */
export class CityListScene extends Phaser.Scene {
  private layer!: Layer;
  private page = 0;
  private picks: number[] = [];

  constructor() {
    super('Cities');
  }

  create() {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    header(this, 'Cidades', () => this.scene.start('Hub'));
    objectiveBar(this);
    this.layer = new Layer(this);
    this.page = 0;
    this.picks = [0, 0, nextCityLevel(game()) - 1, 0, 0, 0, 0];
    this.drawList();
  }

  /** City types the student can start now; locked types are never listed. */
  private unlockedTypes(): CityType[] {
    return TIERS.map((t) => t.cityType).filter((type) => isCityTypeUnlocked(game(), type));
  }

  private drawList() {
    this.layer.clear();
    const state = game();
    fitText(this.layer.text(140, 76, 'Cada cidade é um exercício novo do laboratório: uma rede simulada para você abrir, rota por rota.',
      textStyle(16, COLORS.info, { wordWrap: { width: WIDTH - 280 } })), WIDTH - 280, 40);

    // Newest first: the save keeps cities in the order they were started.
    const order = state.cities.map((_, i) => i).reverse();
    const pages = Math.max(1, Math.ceil(order.length / ROWS_PER_PAGE));
    this.page = Math.min(this.page, pages - 1);

    if (order.length === 0) {
      fitText(this.layer.text(WIDTH / 2, 320, 'Você ainda não tem nenhuma cidade.\nClique em "Nova cidade" para gerar uma, ou em "Entrar código" para abrir a cidade que alguém passou para você.',
        textStyle(20, COLORS.muted, { align: 'center', lineSpacing: 10, wordWrap: { width: WIDTH - 280 } })).setOrigin(0.5), WIDTH - 280, 200);
    }
    order.slice(this.page * ROWS_PER_PAGE, (this.page + 1) * ROWS_PER_PAGE)
      .forEach((index, row) => this.cityRow(index, state.cities[index], ROW_TOP + row * ROW_STEP));

    const level = nextCityLevel(state);
    // With no type unlocked, a new city is plain right away, as before the pós-graduação.
    this.layer.button(140, 576, 300, 52, `Nova cidade (nível ${level})`, () => {
      if (this.unlockedTypes().length === 0) this.newCity('plain');
      else this.drawTypes();
    }, { size: 20 });
    this.layer.button(460, 576, 240, 52, 'Entrar código', () => this.drawCodeForm(), { size: 20, color: COLORS.info });

    if (pages > 1) {
      const prev = this.layer.button(820, 576, 130, 52, '< Anterior', () => { this.page--; this.drawList(); }, { size: 16 });
      prev.setDisabled(this.page === 0);
      this.layer.text(1010, 602, `${this.page + 1} de ${pages}`, textStyle(16, COLORS.muted)).setOrigin(0.5);
      const next = this.layer.button(1070, 576, 130, 52, 'Próxima >', () => { this.page++; this.drawList(); }, { size: 16 });
      next.setDisabled(this.page === pages - 1);
    }
  }

  /** Plain cities and the unlocked types only. */
  private drawTypes() {
    this.layer.clear();
    const level = nextCityLevel(game());
    this.layer.text(WIDTH / 2, 100, `Que tipo de cidade você quer treinar? (nível ${level})`, textStyle(22, COLORS.accent)).setOrigin(0.5);
    (['plain', ...this.unlockedTypes()] as CityType[]).forEach((type, i) => {
      const y = 150 + i * 96;
      this.layer.button(WIDTH / 2 - 300, y, 600, 80, `Cidade ${CITY_TYPE_LABELS[type]}\n${TYPE_HINTS[type]}`, () => this.newCity(type),
        { size: 20, color: type === 'plain' ? COLORS.accent : COLORS.warn, wrap: true });
    });
    this.layer.button(WIDTH / 2 - 150, 576, 300, 52, 'Cancelar', () => this.drawList(), { size: 20, color: COLORS.info });
  }

  private newCity(type: CityType) {
    const index = startCity(game(), nextCityLevel(game()), randomCitySeed(createRng(Date.now())), type);
    save();
    this.openCity({ index });
  }

  private cityRow(index: number, city: CityProgress, y: number) {
    const x = 140;
    const w = WIDTH - 280;
    const h = 60;
    // In-progress cities stand out; finished ones step back.
    const color = city.finished ? COLORS.muted : COLORS.warn;
    const bg = this.layer.rect(x, y, w, h, COLORS.panel, color);
    fitText(this.layer.text(x + 20, y + h / 2, encodeCityCode(city.level, city.seed, city.type), textStyle(24, city.finished ? COLORS.text : COLORS.warn)).setOrigin(0, 0.5), 260);
    this.layer.text(x + 300, y + h / 2, `nível ${city.level}`, textStyle(18, COLORS.info)).setOrigin(0, 0.5);
    this.layer.text(x + 440, y + h / 2, plural(city.breached.length, 'máquina invadida', 'máquinas invadidas'), textStyle(16, COLORS.muted)).setOrigin(0, 0.5);
    this.layer.text(x + w - 20, y + h / 2, city.finished ? '✓ concluída' : 'em andamento', textStyle(18, city.finished ? COLORS.accent : COLORS.warn)).setOrigin(1, 0.5);

    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => bg.setFillStyle(COLORS.accentDim, 0.35));
    bg.on('pointerout', () => bg.setFillStyle(COLORS.panel));
    bg.on('pointerdown', () => this.openCity({ index }));
  }

  private code(): string {
    const [type, name, level, ...digits] = this.picks;
    const prefix = CODE_PREFIXES[type] ? `${CODE_PREFIXES[type]}-` : '';
    return `${prefix}${CITY_NAMES[name]}-${level + 1}-${digits.join('')}`;
  }

  /** Pick-with-arrows form: ▲ and ▼ cycle each field, wrapping at the ends. */
  private drawCodeForm(error?: string) {
    this.layer.clear();
    fitText(this.layer.text(WIDTH / 2, 92, 'Escolha o código que passaram para você. O mesmo código gera a mesma cidade para todo mundo.',
      textStyle(17, COLORS.info, { align: 'center', wordWrap: { width: WIDTH - 200 } })).setOrigin(0.5, 0), WIDTH - 200, 48);

    const gap = 14;
    const dash = 30;
    const total = CODE_FIELDS.reduce((sum, f) => sum + f.width, 0) + 3 * dash + 3 * gap;
    let x = (WIDTH - total) / 2;
    let digitsLeft = 0;
    CODE_FIELDS.forEach((f, i) => {
      const cycle = (delta: number) => {
        this.picks[i] = (this.picks[i] + delta + f.count) % f.count;
        this.drawCodeForm();
      };
      if (i === 3) digitsLeft = x;
      if (f.label) this.layer.text(x + f.width / 2, 160, f.label, textStyle(16, COLORS.accent)).setOrigin(0.5);
      this.layer.button(x, 180, f.width, 44, '▲', () => cycle(1));
      this.layer.rect(x, 234, f.width, 64);
      this.layer.text(x + f.width / 2, 266, f.show(this.picks[i]), textStyle(30, COLORS.text)).setOrigin(0.5);
      this.layer.button(x, 308, f.width, 44, '▼', () => cycle(-1));
      x += f.width;
      if (i < 3) {
        this.layer.text(x + dash / 2, 266, '-', textStyle(30, COLORS.muted)).setOrigin(0.5);
        x += dash;
      } else if (i < CODE_FIELDS.length - 1) {
        x += gap;
      }
    });

    this.layer.text((digitsLeft + x) / 2, 160, 'Número', textStyle(16, COLORS.accent)).setOrigin(0.5);
    this.layer.text(WIDTH / 2, 380, 'Sem tipo ("—"), o código é de uma cidade comum.', textStyle(14, COLORS.muted)).setOrigin(0.5);

    this.layer.text(WIDTH / 2, 420, `Código: ${this.code()}`, textStyle(30, COLORS.warn)).setOrigin(0.5);
    this.layer.button(WIDTH / 2 - 310, 470, 300, 56, 'Abrir cidade', () => this.confirmCode(), { size: 22, color: COLORS.warn });
    this.layer.button(WIDTH / 2 + 10, 470, 300, 56, 'Cancelar', () => this.drawList(), { size: 22 });
    if (error) {
      this.layer.text(WIDTH / 2, 560, `✗ ${error}`, textStyle(17, COLORS.danger, { align: 'center', wordWrap: { width: WIDTH - 200 } })).setOrigin(0.5, 0);
    }
  }

  private confirmCode() {
    const entry = enterCityCode(game(), this.code());
    if (!entry.ok) {
      this.drawCodeForm(entry.message);
      return;
    }
    save();
    this.openCity({ index: entry.index, notice: entry.known ? 'Você já tinha essa cidade. Ela abriu com o progresso que você já fez.' : undefined });
  }

  private openCity(data: CityMapData) {
    this.scene.start('CityMap', data);
  }
}
