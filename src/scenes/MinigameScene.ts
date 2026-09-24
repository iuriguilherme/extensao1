import Phaser from 'phaser';
import { mistakesAllowed, roundSeconds } from '../core/hardware';
import { buildRounds, toBinary, type BitsRound, type ChoiceRound, type Difficulty, type Round } from '../core/minigames';
import { createRng } from '../core/random';
import { breach, earn, specsOf } from '../core/state';
import { game, save } from '../core/store';
import { MINIGAME_AREAS, type MinigameId } from '../data/nodes';
import { COLORS, header, hex, Layer, textStyle, WIDTH } from '../ui/widgets';

export interface MinigameData {
  minigame: MinigameId;
  difficulty: Difficulty;
  reward: number;
  title: string;
  /** Set when attacking a network node; otherwise it is a side job. */
  nodeId?: string;
}

/**
 * Timed intrusion: a sequence of knowledge rounds. CPU power sets the time per
 * round, RAM sets how many mistakes the intrusion survives.
 */
export class MinigameScene extends Phaser.Scene {
  private params!: MinigameData;
  private rounds: Round[] = [];
  private index = 0;
  private mistakes = 0;
  private allowed = 1;
  private seconds = 10;
  private remaining = 0;
  private running = false;
  private revealAnswer: () => void = () => {};

  private layer!: Layer;
  private timerBar!: Phaser.GameObjects.Rectangle;
  private status!: Phaser.GameObjects.Text;

  constructor() {
    super('Minigame');
  }

  create(data: MinigameData) {
    this.params = data;
    this.cameras.main.setBackgroundColor(COLORS.bg);
    header(this, data.title, () => this.leave());

    const specs = specsOf(game());
    this.seconds = roundSeconds(specs.cpuPower);
    this.allowed = mistakesAllowed(specs.ramGB) + (data.nodeId ? 0 : 1);
    this.rounds = buildRounds(data.minigame, data.difficulty, createRng(Date.now()));
    this.index = 0;
    this.mistakes = 0;

    this.add.text(20, 70, `${MINIGAME_AREAS[data.minigame]} · ${this.seconds}s per step (CPU) · ${this.allowed} mistake(s) allowed (RAM)`, textStyle(14, COLORS.muted));
    this.status = this.add.text(WIDTH - 20, 70, '', textStyle(14, COLORS.info)).setOrigin(1, 0);
    this.add.rectangle(20, 96, WIDTH - 40, 10, COLORS.panel).setOrigin(0).setStrokeStyle(1, COLORS.panelBorder);
    this.timerBar = this.add.rectangle(20, 96, WIDTH - 40, 10, COLORS.accent).setOrigin(0);
    this.layer = new Layer(this);
    this.showRound();
  }

  update(_time: number, delta: number) {
    if (!this.running) return;
    this.remaining -= delta / 1000;
    const ratio = Math.max(0, this.remaining / this.seconds);
    this.timerBar.width = (WIDTH - 40) * ratio;
    this.timerBar.fillColor = ratio > 0.5 ? COLORS.accent : ratio > 0.25 ? COLORS.warn : COLORS.danger;
    if (this.remaining <= 0) {
      this.revealAnswer();
      const round = this.rounds[this.index];
      this.resolve(false, round.explain, true);
    }
  }

  private updateStatus() {
    // One block per hit the intrusion can take, plus the one that ends it.
    const blocks = this.allowed + 1;
    const left = Math.max(0, blocks - this.mistakes);
    const integrity = '■'.repeat(left) + '□'.repeat(blocks - left);
    this.status.setText(`step ${Math.min(this.index + 1, this.rounds.length)}/${this.rounds.length}   integrity ${integrity}`);
  }

  private showRound() {
    this.layer.clear();
    this.updateStatus();
    const round = this.rounds[this.index];
    this.remaining = this.seconds;
    this.running = true;
    this.revealAnswer = () => {};
    this.layer.text(40, 130, round.prompt, textStyle(28, COLORS.text, { wordWrap: { width: WIDTH - 80 } }));
    if (round.kind === 'choice') this.showChoice(round);
    else this.showBits(round);
  }

  private showChoice(round: ChoiceRound) {
    let top = 190;
    if (round.detail) {
      const detail = this.layer.text(60, top, round.detail, textStyle(18, COLORS.info, {
        backgroundColor: hex(COLORS.panel), padding: { x: 16, y: 12 }, lineSpacing: 4,
      }));
      top += detail.height + 20;
    }
    const h = Math.min(60, (560 - top) / round.options.length - 10);
    const buttons = round.options.map((option, i) =>
      this.layer.button(40, top + i * (h + 10), WIDTH - 80, h, option, () => {
        if (!this.running) return;
        mark(i, i === round.answer ? COLORS.accent : COLORS.danger);
        if (i !== round.answer) mark(round.answer, COLORS.accent);
        this.resolve(i === round.answer, round.explain);
      }, { size: 20, color: COLORS.info }));
    const mark = (i: number, color: number) => {
      buttons[i].label.setText(`${color === COLORS.accent ? '✓' : '✗'} ${round.options[i]}`).setColor(hex(color));
    };
    // Reveal the answer on time-out too.
    this.revealAnswer = () => mark(round.answer, COLORS.accent);
  }

  private showBits(round: BitsRound) {
    let value = 0;
    const size = 90;
    const gap = 16;
    const startX = (WIDTH - (round.bits * (size + gap) - gap)) / 2;
    const readout = this.layer.text(WIDTH / 2, 420, '', textStyle(28, COLORS.warn)).setOrigin(0.5);
    const refresh = () => readout.setText(`${toBinary(value, round.bits)}  =  ${value}   (target ${round.target})`);
    refresh();

    for (let i = 0; i < round.bits; i++) {
      const bit = round.bits - 1 - i;
      const x = startX + i * (size + gap);
      this.layer.text(x + size / 2, 220, String(1 << bit), textStyle(18, COLORS.muted)).setOrigin(0.5);
      const b = this.layer.button(x, 250, size, size, '0', () => {
        if (!this.running) return;
        value ^= 1 << bit;
        const on = (value & (1 << bit)) !== 0;
        b.label.setText(on ? '1' : '0');
        b.label.setColor(hex(on ? COLORS.accent : COLORS.info));
        refresh();
        if (value === round.target) this.resolve(true, round.explain);
      }, { size: 40, color: COLORS.info });
    }
    this.layer.text(WIDTH / 2, 470, 'Tip: start from the biggest place value that fits.', textStyle(15, COLORS.muted)).setOrigin(0.5);
  }

  private resolve(correct: boolean, explain: string, timedOut = false) {
    this.running = false;
    if (!correct) this.mistakes++;
    this.updateStatus();

    const crashed = this.mistakes > this.allowed;
    const done = this.index === this.rounds.length - 1;
    this.layer.rect(40, 560, WIDTH - 80, 100, COLORS.panel, correct ? COLORS.accent : COLORS.danger);
    this.layer.text(60, 572, `${correct ? '✓ Access step granted.' : timedOut ? '✗ Too slow — detected!' : '✗ Wrong move.'}  ${explain}`,
      textStyle(17, correct ? COLORS.accent : COLORS.warn, { wordWrap: { width: WIDTH - 340 }, lineSpacing: 4 }));

    const label = crashed ? 'Intrusion crashed' : done ? 'Finish' : 'Next step >';
    this.layer.button(WIDTH - 270, 586, 210, 50, label, () => {
      if (crashed) this.finish(false);
      else if (done) this.finish(true);
      else {
        this.index++;
        this.showRound();
      }
    }, { color: crashed ? COLORS.danger : COLORS.warn, size: 18 });
  }

  private finish(success: boolean) {
    this.layer.clear();
    this.timerBar.width = 0;
    const state = game();
    let message: string;
    if (success) {
      let reward = this.params.reward;
      if (this.params.nodeId) reward = breach(state, this.params.nodeId);
      else earn(state, reward);
      save();
      message = `ACCESS GRANTED\n\n+$${reward}`;
      if (this.params.nodeId) message += '\nNew routes revealed on the Net Map.';
    } else {
      message = 'CONNECTION LOST\n\nToo many mistakes crashed your tools.\nStudy the area, upgrade RAM for more tolerance\nor CPU for more time, and try again.';
    }
    this.add.text(WIDTH / 2, 320, message, textStyle(30, success ? COLORS.accent : COLORS.danger, { align: 'center', lineSpacing: 8 })).setOrigin(0.5);
    this.layer.button(WIDTH / 2 - 150, 520, 300, 56, 'Continue', () => this.leave(), { size: 22 });
  }

  private leave() {
    this.running = false;
    this.scene.start(this.params.nodeId ? 'NetMap' : 'Hub');
  }
}
