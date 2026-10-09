import Phaser from 'phaser';
import { isTierOpen } from '../core/certificates';
import { hasLesson, isLessonOpen } from '../core/state';
import { game } from '../core/store';
import { getLesson, LESSONS, TRACK_LABELS, TRACKS, type Lesson } from '../data/lessons';
import { TIERS } from '../data/tiers';
import { money } from '../core/fmt';
import { button, COLORS, fitText, header, objectiveBar, textStyle } from '../ui/widgets';

export type StudyTab = 'course' | 'pos';

export interface StudyData {
  tab?: StudyTab;
}

/**
 * Lesson catalog grouped by track. Once the formatura is presented, a second
 * tab lists the pós-graduação lessons, one column per open tier.
 */
export class StudyScene extends Phaser.Scene {
  constructor() {
    super('Study');
  }

  create(data: StudyData = {}) {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    header(this, 'Estudar', () => this.scene.start('Hub'));
    objectiveBar(this);
    // The tab switch appears only once there is a second tab to switch to.
    const hasPosTab = isTierOpen(game(), TIERS[0].id);
    const tab: StudyTab = hasPosTab && data.tab ? data.tab : 'course';
    if (hasPosTab) {
      this.tab(360, 'Curso', 'course', tab);
      this.tab(580, 'Pós-graduação', 'pos', tab);
    }
    if (tab === 'course') {
      TRACKS.forEach((track, col) => this.column(col, TRACK_LABELS[track].toUpperCase(), LESSONS.filter((l) => l.track === track && !l.tier)));
    } else {
      TIERS.filter((t) => isTierOpen(game(), t.id))
        .forEach((tier, col) => this.column(col, `${tier.title.toUpperCase()} · ${tier.topic}`, tier.lessons.map(getLesson)));
    }
  }

  /** The current tab is a filled label; the other one is a button to it. */
  private tab(x: number, label: string, id: StudyTab, current: StudyTab) {
    if (id !== current) {
      button(this, x, 10, 200, 36, label, () => this.scene.restart({ tab: id }), { size: 16, color: COLORS.info });
      return;
    }
    this.add.rectangle(x, 10, 200, 36, COLORS.accentDim).setOrigin(0).setStrokeStyle(2, COLORS.accent);
    fitText(this.add.text(x + 100, 28, label, textStyle(16, COLORS.text)).setOrigin(0.5), 188);
  }

  private column(col: number, title: string, lessons: Lesson[]) {
    const state = game();
    const x = 20 + col * 420;
    fitText(this.add.text(x, 76, title, textStyle(18, COLORS.muted)), 400);
    lessons.forEach((lesson, row) => {
      const y = 110 + row * 88;
      const done = hasLesson(state, lesson.id);
      const open = isLessonOpen(state, lesson.id);
      const color = done ? COLORS.accent : open ? COLORS.warn : COLORS.muted;
      const bg = this.add.rectangle(x, y, 400, 78, COLORS.panel).setOrigin(0).setStrokeStyle(2, color);
      fitText(this.add.text(x + 14, y + 10, `${done ? '✓' : open ? '●' : '🔒'} ${lesson.title}`, textStyle(19, color)), 372);
      const sub = done
        ? 'Concluída — revise quando quiser'
        : open
          ? `Recompensa: ${money(lesson.reward)}`
          : `Antes, faça: ${lesson.requires.filter((r) => !hasLesson(state, r)).map((r) => getLesson(r).title).join(', ')}`;
      fitText(this.add.text(x + 14, y + 42, sub, textStyle(13, COLORS.text, { wordWrap: { width: 370 } })), 370, 34);
      if (open) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerover', () => bg.setFillStyle(COLORS.accentDim, 0.35));
        bg.on('pointerout', () => bg.setFillStyle(COLORS.panel));
        bg.on('pointerdown', () => this.scene.start('Lesson', { id: lesson.id }));
      }
    });
  }
}
