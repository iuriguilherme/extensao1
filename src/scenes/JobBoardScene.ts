import Phaser from 'phaser';
import { money } from '../core/fmt';
import { jobBoard, jobPay, type Job } from '../core/jobs';
import { CONCEPTS, MAX_LEVEL } from '../core/minigames';
import { game } from '../core/store';
import { getLesson } from '../data/lessons';
import { AREA_LESSON, MINIGAME_AREAS } from '../data/nodes';
import { COLORS, fitText, header, goalBar, textStyle, WIDTH } from '../ui/widgets';
import type { MinigameData } from './MinigameScene';

/**
 * Side-job board: review jobs for the concepts the student keeps missing,
 * plus fresh jobs that raise an area's level. Rebuilt from the save on entry.
 */
export class JobBoardScene extends Phaser.Scene {
  constructor() {
    super('Jobs');
  }

  create() {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    header(this, 'Trabalhos extras', () => this.scene.start('Hub'));
    goalBar(this);
    const state = game();
    const jobs = jobBoard(state);

    if (jobs.length === 0) {
      const lesson = getLesson(AREA_LESSON.binary).title;
      fitText(this.add.text(WIDTH / 2, 300, `Ainda não há trabalhos extras para você.\nFaça a aula "${lesson}" para liberar os primeiros.`,
        textStyle(22, COLORS.muted, { align: 'center', lineSpacing: 10, wordWrap: { width: WIDTH - 200 } })).setOrigin(0.5), WIDTH - 200, 200);
      return;
    }

    fitText(this.add.text(140, 80, 'Pratique o que você mais errou ou suba de nível. Cada trabalho paga ao terminar.',
      textStyle(17, COLORS.info)), WIDTH - 280);
    jobs.forEach((job, i) => this.jobCard(job, 140, 124 + i * 150));
  }

  private jobCard(job: Job, x: number, y: number) {
    const w = WIDTH - 280;
    const h = 130;
    const color = job.kind === 'review' ? COLORS.warn : COLORS.accent;
    const bg = this.add.rectangle(x, y, w, h, COLORS.panel).setOrigin(0).setStrokeStyle(2, color);

    const tag = job.kind === 'review' ? 'REVISÃO' : 'NOVO';
    fitText(this.add.text(x + 20, y + 16, `${tag} · ${MINIGAME_AREAS[job.area]} · nível ${job.level}`, textStyle(20, color)), w - 220);
    const detail = job.kind === 'review'
      ? `Treine: ${CONCEPTS[job.concept].label}. Você errou isso recentemente.`
      : job.level < MAX_LEVEL[job.area]
        ? `Termine com no máximo 1 erro para liberar o nível ${job.level + 1}.`
        : 'Você já está no nível máximo desta área.';
    fitText(this.add.text(x + 20, y + 58, detail, textStyle(16, COLORS.text, { wordWrap: { width: w - 240 } })), w - 240, 60);
    this.add.text(x + w - 24, y + h / 2, money(jobPay(job.level)), textStyle(26, COLORS.warn)).setOrigin(1, 0.5);

    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => bg.setFillStyle(COLORS.accentDim, 0.35));
    bg.on('pointerout', () => bg.setFillStyle(COLORS.panel));
    bg.on('pointerdown', () => {
      const title = job.kind === 'review'
        ? `Revisão: ${CONCEPTS[job.concept].label}`
        : `Trabalho extra: ${MINIGAME_AREAS[job.area]}, nível ${job.level}`;
      const data: MinigameData = { minigame: job.area, difficulty: job.level, title, job };
      this.scene.start('Minigame', data);
    });
  }
}
