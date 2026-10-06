import Phaser from 'phaser';
import { CITY_NAMES, decodeCityCode, encodeCityCode, MAX_CITY_LEVEL, randomCitySeed } from '../core/cityCode';
import { plural } from '../core/fmt';
import { createRng } from '../core/random';
import { nextCityLevel, startCity, type CityProgress } from '../core/state';
import { game, save } from '../core/store';
import { COLORS, fitText, header, Layer, objectiveBar, textStyle, WIDTH } from '../ui/widgets';
import type { CityMapData } from './CityMapScene';

const ROWS_PER_PAGE = 6;
const ROW_TOP = 116;
const ROW_STEP = 72;

/** Code form fields: a city name, a level and four single digits. */
interface CodeField {
  label: string;
  width: number;
  count: number;
  /** Shown value for an index; level indexes are 0-based (level 1 is index 0). */
  show: (i: number) => string;
}

const CODE_FIELDS: CodeField[] = [
  { label: 'Cidade', width: 130, count: CITY_NAMES.length, show: (i) => CITY_NAMES[i] },
  { label: 'Nível', width: 100, count: MAX_CITY_LEVEL, show: (i) => String(i + 1) },
  ...[1, 2, 3, 4].map(() => ({ label: '', width: 80, count: 10, show: (i: number) => String(i) })),
];

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
    this.picks = [0, nextCityLevel(game()) - 1, 0, 0, 0, 0];
    this.drawList();
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
    this.layer.button(140, 576, 300, 52, `Nova cidade (nível ${level})`, () => {
      const index = startCity(game(), level, randomCitySeed(createRng(Date.now())));
      save();
      this.openCity({ index });
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

  private cityRow(index: number, city: CityProgress, y: number) {
    const x = 140;
    const w = WIDTH - 280;
    const h = 60;
    // In-progress cities stand out; finished ones step back.
    const color = city.finished ? COLORS.muted : COLORS.warn;
    const bg = this.layer.rect(x, y, w, h, COLORS.panel, color);
    this.layer.text(x + 20, y + h / 2, encodeCityCode(city.level, city.seed), textStyle(24, city.finished ? COLORS.text : COLORS.warn)).setOrigin(0, 0.5);
    this.layer.text(x + 260, y + h / 2, `nível ${city.level}`, textStyle(18, COLORS.info)).setOrigin(0, 0.5);
    this.layer.text(x + 420, y + h / 2, plural(city.breached.length, 'máquina invadida', 'máquinas invadidas'), textStyle(16, COLORS.muted)).setOrigin(0, 0.5);
    this.layer.text(x + w - 20, y + h / 2, city.finished ? '✓ concluída' : 'em andamento', textStyle(18, city.finished ? COLORS.accent : COLORS.warn)).setOrigin(1, 0.5);

    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => bg.setFillStyle(COLORS.accentDim, 0.35));
    bg.on('pointerout', () => bg.setFillStyle(COLORS.panel));
    bg.on('pointerdown', () => this.openCity({ index }));
  }

  private code(): string {
    const [name, level, ...digits] = this.picks;
    return `${CITY_NAMES[name]}-${level + 1}-${digits.join('')}`;
  }

  /** Pick-with-arrows form: ▲ and ▼ cycle each field, wrapping at the ends. */
  private drawCodeForm(error?: string) {
    this.layer.clear();
    fitText(this.layer.text(WIDTH / 2, 92, 'Escolha o código que passaram para você. O mesmo código gera a mesma cidade para todo mundo.',
      textStyle(17, COLORS.info, { align: 'center', wordWrap: { width: WIDTH - 200 } })).setOrigin(0.5, 0), WIDTH - 200, 48);

    const gap = 14;
    const dash = 30;
    const total = CODE_FIELDS.reduce((sum, f) => sum + f.width, 0) + 2 * dash + 3 * gap;
    let x = (WIDTH - total) / 2;
    let digitsLeft = 0;
    CODE_FIELDS.forEach((f, i) => {
      const cycle = (delta: number) => {
        this.picks[i] = (this.picks[i] + delta + f.count) % f.count;
        this.drawCodeForm();
      };
      if (i === 2) digitsLeft = x;
      if (f.label) this.layer.text(x + f.width / 2, 160, f.label, textStyle(16, COLORS.accent)).setOrigin(0.5);
      this.layer.button(x, 180, f.width, 44, '▲', () => cycle(1));
      this.layer.rect(x, 234, f.width, 64);
      this.layer.text(x + f.width / 2, 266, f.show(this.picks[i]), textStyle(30, COLORS.text)).setOrigin(0.5);
      this.layer.button(x, 308, f.width, 44, '▼', () => cycle(-1));
      x += f.width;
      if (i < 2) {
        this.layer.text(x + dash / 2, 266, '-', textStyle(30, COLORS.muted)).setOrigin(0.5);
        x += dash;
      } else if (i < CODE_FIELDS.length - 1) {
        x += gap;
      }
    });

    this.layer.text((digitsLeft + x) / 2, 160, 'Número', textStyle(16, COLORS.accent)).setOrigin(0.5);

    this.layer.text(WIDTH / 2, 410, `Código: ${this.code()}`, textStyle(30, COLORS.warn)).setOrigin(0.5);
    this.layer.button(WIDTH / 2 - 310, 470, 300, 56, 'Abrir cidade', () => this.confirmCode(), { size: 22, color: COLORS.warn });
    this.layer.button(WIDTH / 2 + 10, 470, 300, 56, 'Cancelar', () => this.drawList(), { size: 22 });
    if (error) {
      this.layer.text(WIDTH / 2, 560, `✗ ${error}`, textStyle(17, COLORS.danger, { align: 'center', wordWrap: { width: WIDTH - 200 } })).setOrigin(0.5, 0);
    }
  }

  private confirmCode() {
    const decoded = decodeCityCode(this.code());
    if (!decoded) {
      this.drawCodeForm('Esse código não existe. Confira as letras e os números.');
      return;
    }
    const state = game();
    const known = state.cities.some((c) => c.level === decoded.level && c.seed === decoded.seed);
    const index = startCity(state, decoded.level, decoded.seed);
    save();
    this.openCity({ index, notice: known ? 'Você já tinha essa cidade. Ela abriu com o progresso que você já fez.' : undefined });
  }

  private openCity(data: CityMapData) {
    this.scene.start('CityMap', data);
  }
}
