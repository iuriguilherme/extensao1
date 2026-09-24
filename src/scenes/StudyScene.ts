import Phaser from 'phaser';
import { hasLesson, isLessonOpen } from '../core/state';
import { game } from '../core/store';
import { getLesson, LESSONS, type LessonTrack } from '../data/lessons';
import { COLORS, header, objectiveBar, textStyle } from '../ui/widgets';

/** Lesson catalog grouped by track. */
export class StudyScene extends Phaser.Scene {
  constructor() {
    super('Study');
  }

  create() {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    header(this, 'Study', () => this.scene.start('Hub'));
    objectiveBar(this);
    const state = game();

    const tracks: LessonTrack[] = ['Hardware', 'Networking', 'Field Knowledge'];
    tracks.forEach((track, col) => {
      const x = 20 + col * 420;
      this.add.text(x, 76, track.toUpperCase(), textStyle(18, COLORS.muted));
      LESSONS.filter((l) => l.track === track).forEach((lesson, row) => {
        const y = 110 + row * 88;
        const done = hasLesson(state, lesson.id);
        const open = isLessonOpen(state, lesson.id);
        const color = done ? COLORS.accent : open ? COLORS.warn : COLORS.muted;
        const bg = this.add.rectangle(x, y, 400, 78, COLORS.panel).setOrigin(0).setStrokeStyle(2, color);
        this.add.text(x + 14, y + 10, `${done ? '✓' : open ? '●' : '🔒'} ${lesson.title}`, textStyle(19, color));
        const sub = done
          ? 'Completed — review anytime'
          : open
            ? `Reward: $${lesson.reward}`
            : `Requires: ${lesson.requires.filter((r) => !hasLesson(state, r)).map((r) => getLesson(r).title).join(', ')}`;
        this.add.text(x + 14, y + 42, sub, textStyle(13, COLORS.text, { wordWrap: { width: 370 } }));
        if (open) {
          bg.setInteractive({ useHandCursor: true });
          bg.on('pointerover', () => bg.setFillStyle(COLORS.accentDim, 0.35));
          bg.on('pointerout', () => bg.setFillStyle(COLORS.panel));
          bg.on('pointerdown', () => this.scene.start('Lesson', { id: lesson.id }));
        }
      });
    });
  }
}
