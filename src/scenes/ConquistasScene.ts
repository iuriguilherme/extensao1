import Phaser from 'phaser';
import { counterProgress } from '../core/achievements';
import { achievements, setPopups } from '../core/achievementStore';
import { ACHIEVEMENTS, type Achievement } from '../data/achievements';
import { badge, COLORS, fitText, goalBar, header, Layer, panel, textStyle, WIDTH } from '../ui/widgets';

const PER_PAGE = 10;
const CELL_W = 590;
const CELL_H = 88;
const GRID_TOP = 120;
const ROW_STEP = 96;

/** Every conquista with its state and progress, plus the pop-up switch. */
export class ConquistasScene extends Phaser.Scene {
  private layer!: Layer;
  private page = 0;

  constructor() {
    super('Conquistas');
  }

  create() {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    header(this, 'Conquistas', () => this.scene.start('Hub'), 'conquistas');
    goalBar(this);
    this.layer = new Layer(this);
    this.page = 0;
    this.draw();
  }

  private draw() {
    this.layer.clear();
    const state = achievements();
    this.layer.text(40, 80, `${state.unlocked.length} de ${ACHIEVEMENTS.length} conquistas`, textStyle(20, COLORS.accent));
    this.layer.button(WIDTH - 340, 70, 300, 40, `Avisos na tela: ${state.popups ? 'ligados' : 'desligados'}`, () => {
      setPopups(!achievements().popups);
      this.draw();
    }, { size: 16, color: state.popups ? COLORS.info : COLORS.muted });

    const pages = Math.ceil(ACHIEVEMENTS.length / PER_PAGE);
    ACHIEVEMENTS.slice(this.page * PER_PAGE, (this.page + 1) * PER_PAGE).forEach((achievement, i) => {
      const x = 40 + (i % 2) * (CELL_W + 20);
      const y = GRID_TOP + Math.floor(i / 2) * ROW_STEP;
      this.cell(achievement, x, y);
    });

    const prev = this.layer.button(820, 604, 130, 44, '< Anterior', () => { this.page--; this.draw(); }, { size: 16 });
    prev.setDisabled(this.page === 0);
    this.layer.text(1010, 626, `${this.page + 1} de ${pages}`, textStyle(16, COLORS.muted)).setOrigin(0.5);
    const next = this.layer.button(1070, 604, 130, 44, 'Próxima >', () => { this.page++; this.draw(); }, { size: 16 });
    next.setDisabled(this.page === pages - 1);
  }

  private cell(achievement: Achievement, x: number, y: number) {
    const state = achievements();
    const unlocked = state.unlocked.includes(achievement.id);
    const hidden = !unlocked && achievement.kind === 'secret';
    this.layer.add(panel(this, x, y, CELL_W, CELL_H, unlocked ? COLORS.accentDim : COLORS.panelBorder));
    for (const part of badge(this, x + 14, y + 16, 56, achievement, unlocked)) this.layer.add(part);

    const progress = counterProgress(achievement.id, state.totals);
    const right = progress ? 110 : 20;
    const name = hidden ? '???' : `${unlocked ? '✓ ' : ''}${achievement.name}`;
    fitText(this.layer.text(x + 86, y + 12, name, textStyle(19, unlocked ? COLORS.text : COLORS.muted)), CELL_W - 86 - right);
    const description = hidden ? 'Conquista secreta.' : achievement.description;
    fitText(this.layer.text(x + 86, y + 40, description, textStyle(14, COLORS.muted, { wordWrap: { width: CELL_W - 100 } })), CELL_W - 100, 42);
    if (progress) {
      this.layer.text(x + CELL_W - 14, y + 12, `${progress.value}/${progress.target}`, textStyle(16, unlocked ? COLORS.warn : COLORS.muted)).setOrigin(1, 0);
    }
  }
}
