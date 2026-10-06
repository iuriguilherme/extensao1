import Phaser from 'phaser';
import { cityNode, generateCity, type City } from '../core/city';
import { mistakesAllowed, roundSeconds } from '../core/hardware';
import { LENS_LABELS } from '../core/explanations';
import { completeJob, type Job } from '../core/jobs';
import { parseIp } from '../core/ip';
import { buildRounds, toBinary, type BitsRound, type ChoiceRound, type ConceptId, type Difficulty, type Round, type RoundContext } from '../core/minigames';
import { createRng } from '../core/random';
import { commitRun, recordMiss } from '../core/reteach';
import { breach, breachCityNode } from '../core/state';
import { joinSwarm, totalSpecs } from '../core/swarm';
import { game, save } from '../core/store';
import { nodePartNames } from '../data/nodeBuilds';
import { MINIGAME_AREAS, getNode, type MinigameId } from '../data/nodes';
import { listJoin, money, plural } from '../core/fmt';
import { COLORS, fitText, header, hex, Layer, textStyle, WIDTH } from '../ui/widgets';
import type { CityMapData } from './CityMapScene';

export interface MinigameData {
  minigame: MinigameId;
  difficulty: Difficulty;
  /** Shown by the Net Map; the payout comes from breach() or completeJob(). */
  reward?: number;
  title: string;
  /** Set when attacking a network node. */
  nodeId?: string;
  /** Set for side jobs from the board. */
  job?: Job;
  /** Set when attacking a node of a generated city. */
  city?: { index: number; nodeId: string };
}

/**
 * Timed intrusion: a sequence of knowledge rounds. CPU power sets the time per
 * round, RAM sets how many mistakes the intrusion survives.
 */
export class MinigameScene extends Phaser.Scene {
  private params!: MinigameData;
  /** The generated city being attacked, rebuilt from the save; null otherwise. */
  private city: City | null = null;
  private rounds: Round[] = [];
  private index = 0;
  private mistakes = 0;
  private allowed = 1;
  private seconds = 10;
  private remaining = 0;
  private running = false;
  private revealAnswer: () => void = () => {};
  /** Concepts answered right and wrong in this run, committed when it ends. */
  private correctConcepts: ConceptId[] = [];
  private missedConcepts: ConceptId[] = [];
  /** Set when this run breached a city's core for the first time. */
  private finishedNow = false;

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

    const specs = totalSpecs(game());
    this.seconds = roundSeconds(specs.cpuPower);
    this.allowed = mistakesAllowed(specs.ramGB) + (data.nodeId || data.city ? 0 : 1);
    const focus = data.job?.kind === 'review' ? data.job.concept : undefined;
    this.city = null;
    let context: RoundContext | undefined;
    if (data.city) {
      // City rounds use the addresses of the node's own subnet.
      const progress = game().cities[data.city.index];
      this.city = generateCity(progress.level, progress.seed);
      const node = cityNode(this.city, data.city.nodeId);
      const subnet = this.city.subnets[node.subnetId];
      context = { network: parseIp(subnet.network)!, prefix: subnet.prefix, host: parseIp(node.ip)! };
    }
    this.rounds = buildRounds(data.minigame, data.difficulty, createRng(Date.now()), focus, context);
    this.index = 0;
    this.mistakes = 0;
    this.correctConcepts = [];
    this.missedConcepts = [];
    this.finishedNow = false;

    this.add.text(20, 70, `${MINIGAME_AREAS[data.minigame]} · ${this.seconds} s por etapa (processador) · ${plural(this.allowed, 'erro permitido', 'erros permitidos')} (RAM)`, textStyle(14, COLORS.muted));
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
      this.resolve(false, true);
    }
  }

  private updateStatus() {
    // One block per hit the intrusion can take, plus the one that ends it.
    const blocks = this.allowed + 1;
    const left = Math.max(0, blocks - this.mistakes);
    const integrity = '■'.repeat(left) + '□'.repeat(blocks - left);
    this.status.setText(`etapa ${Math.min(this.index + 1, this.rounds.length)}/${this.rounds.length}   integridade ${integrity}`);
  }

  private showRound() {
    this.layer.clear();
    this.updateStatus();
    const round = this.rounds[this.index];
    this.remaining = this.seconds;
    this.running = true;
    this.revealAnswer = () => {};
    fitText(this.layer.text(40, 130, round.prompt, textStyle(28, COLORS.text, { wordWrap: { width: WIDTH - 80 } })), WIDTH - 80, 56);
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
        this.resolve(i === round.answer);
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
    // Above 8 bits the switches wrap into two equal rows, highest place values on top.
    const rows = round.bits > 8 ? 2 : 1;
    const perRow = Math.ceil(round.bits / rows);
    const startX = (WIDTH - (perRow * (size + gap) - gap)) / 2;
    const below = rows === 1 ? 420 : 490;
    const readout = this.layer.text(WIDTH / 2, below, '', textStyle(28, COLORS.warn)).setOrigin(0.5);
    const refresh = () => readout.setText(`${toBinary(value, round.bits)}  =  ${value}   (alvo ${round.target})`);
    refresh();

    for (let i = 0; i < round.bits; i++) {
      const bit = round.bits - 1 - i;
      const x = startX + (i % perRow) * (size + gap);
      const top = rows === 1 ? 250 : 225 + Math.floor(i / perRow) * 130;
      this.layer.text(x + size / 2, top - 30, String(1 << bit), textStyle(18, COLORS.muted)).setOrigin(0.5);
      const b = this.layer.button(x, top, size, size, '0', () => {
        if (!this.running) return;
        value ^= 1 << bit;
        const on = (value & (1 << bit)) !== 0;
        b.label.setText(on ? '1' : '0');
        b.label.setColor(hex(on ? COLORS.accent : COLORS.info));
        refresh();
        if (value === round.target) this.resolve(true);
      }, { size: 40, color: COLORS.info });
    }
    this.layer.text(WIDTH / 2, below + 45, 'Dica: comece pela maior casa que ainda cabe no número.', textStyle(15, COLORS.muted)).setOrigin(0.5);
  }

  private resolve(correct: boolean, timedOut = false) {
    this.running = false;
    const round = this.rounds[this.index];
    let explain = round.explain.steps;
    if (correct) {
      this.correctConcepts.push(round.concept);
    } else {
      this.mistakes++;
      this.missedConcepts.push(round.concept);
      // Each repeat miss of a concept gets a lens the student has not seen yet.
      const lens = recordMiss(game(), round.concept, this.params.difficulty);
      save();
      explain = `\n${LENS_LABELS[lens]}: ${round.explain[lens]}`;
    }
    this.updateStatus();

    const crashed = this.mistakes > this.allowed;
    const done = this.index === this.rounds.length - 1;
    this.layer.rect(40, 560, WIDTH - 80, 100, COLORS.panel, correct ? COLORS.accent : COLORS.danger);
    fitText(this.layer.text(60, 572, `${correct ? '✓ Etapa vencida.' : timedOut ? '✗ Demorou demais e foi detectado!' : '✗ Resposta errada.'}  ${explain}`,
      textStyle(17, correct ? COLORS.accent : COLORS.warn, { wordWrap: { width: WIDTH - 340 }, lineSpacing: 4 })), WIDTH - 340, 80);

    const label = crashed ? 'Acesso perdido' : done ? 'Finalizar' : 'Próxima etapa >';
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
    const nodeId = this.params.nodeId;
    commitRun(state, this.correctConcepts, this.missedConcepts);
    const job = this.params.job ? completeJob(state, this.params.job, this.mistakes, success) : undefined;
    save();
    if (!success) {
      const message = 'CONEXÃO PERDIDA\n\nVocê errou demais e foi desconectado.\nEstude mais o assunto ou melhore o PC: mais RAM aguenta\nmais erros, e um processador melhor dá mais tempo.';
      this.add.text(WIDTH / 2, 320, message, textStyle(30, COLORS.danger, { align: 'center', lineSpacing: 8 })).setOrigin(0.5);
      this.layer.button(WIDTH / 2 - 150, 520, 300, 56, 'Continuar', () => this.leave(), { size: 22 });
      return;
    }

    // Only a first breach reveals the node and plugs it in; a replay just pays.
    const firstBreach = nodeId !== undefined && !state.breached.includes(nodeId);
    let reward = 0;
    let details = '';
    let joined = true;
    if (this.params.city && this.city) {
      const { index, nodeId: cityNodeId } = this.params.city;
      const progress = state.cities[index];
      const firstCityBreach = !progress.breached.includes(cityNodeId);
      const wasFinished = progress.finished;
      reward = breachCityNode(state, index, this.city, cityNodeId);
      this.finishedNow = !wasFinished && progress.finished;
      const node = cityNode(this.city, cityNodeId);
      if (this.finishedNow) details = 'Você invadiu o núcleo: a cidade está concluída!';
      else if (firstCityBreach && node.role === 'router') details = 'Agora escreva a rota até a rede que fica atrás deste roteador.';
    } else if (nodeId) {
      reward = breach(state, nodeId);
      if (firstBreach) {
        const parts = nodePartNames(getNode(nodeId));
        const join = joinSwarm(state, nodeId);
        joined = join.ok;
        details = [
          parts.length ? `Peças encontradas: ${listJoin(parts)}.` : '',
          join.message,
          'Novos caminhos apareceram no Mapa da Rede.',
        ].filter(Boolean).join('\n');
      }
    } else if (job) {
      reward = job.pay;
      if (job.leveledUp) {
        details = `Nível ${this.params.difficulty + 1} liberado em ${MINIGAME_AREAS[this.params.minigame]}!`;
      }
    }
    save();

    const top = details ? 200 : 320;
    this.add.text(WIDTH / 2, top, `ACESSO LIBERADO\n\n+${money(reward)}`, textStyle(30, COLORS.accent, { align: 'center', lineSpacing: 8 })).setOrigin(0.5);
    if (details) {
      const text = this.layer.text(WIDTH / 2, 290, details, textStyle(19, joined ? COLORS.info : COLORS.warn, { align: 'center', lineSpacing: 6, wordWrap: { width: WIDTH - 200 } })).setOrigin(0.5, 0);
      fitText(text, WIDTH - 200, 200);
    }
    this.layer.button(WIDTH / 2 - 150, 520, 300, 56, 'Continuar', () => this.leave(), { size: 22 });
  }

  private leave() {
    this.running = false;
    const city = this.params.city;
    if (city) {
      const back: CityMapData = {
        index: city.index,
        focus: cityNode(this.city!, city.nodeId).subnetId,
        // The core banner replaces the node's panel.
        ...(this.finishedNow ? { finishedNow: true } : { select: city.nodeId }),
      };
      this.scene.start('CityMap', back);
      return;
    }
    this.scene.start(this.params.nodeId ? 'NetMap' : 'Jobs');
  }
}
