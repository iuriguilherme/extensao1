import Phaser from 'phaser';
import { completeLesson } from '../core/state';
import { game, save } from '../core/store';
import { getLesson, QUIZ_PASS_RATIO, type Lesson } from '../data/lessons';
import { COLORS, header, Layer, textStyle, WIDTH } from '../ui/widgets';

/** Reads a lesson page by page, then runs its quiz. */
export class LessonScene extends Phaser.Scene {
  private lesson!: Lesson;
  private layer!: Layer;
  private refreshHeader!: () => void;

  constructor() {
    super('Lesson');
  }

  create(data: { id: string }) {
    this.lesson = getLesson(data.id);
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.refreshHeader = header(this, this.lesson.title, () => this.scene.start('Study')).refresh;
    this.layer = new Layer(this);
    this.showPage(0);
  }

  private showPage(index: number) {
    this.layer.clear();
    const pages = this.lesson.pages;
    this.layer.text(60, 80, `${this.lesson.track} · page ${index + 1} of ${pages.length}`, textStyle(15, COLORS.muted));
    this.layer.rect(40, 110, WIDTH - 80, 440);
    this.layer.text(80, 150, pages[index], textStyle(26, COLORS.text, { wordWrap: { width: WIDTH - 160 }, lineSpacing: 12 }));

    if (index > 0) this.layer.button(40, 580, 200, 52, '< Previous', () => this.showPage(index - 1));
    const last = index === pages.length - 1;
    this.layer.button(WIDTH - 280, 580, 240, 52, last ? 'Take the quiz >' : 'Next >', () => {
      if (last) this.showQuestion(0, 0);
      else this.showPage(index + 1);
    }, { color: last ? COLORS.warn : COLORS.accent });
  }

  private showQuestion(index: number, correct: number) {
    this.layer.clear();
    const quiz = this.lesson.quiz;
    const q = quiz[index];
    this.layer.text(60, 80, `Quiz · question ${index + 1} of ${quiz.length}`, textStyle(15, COLORS.muted));
    this.layer.text(60, 120, q.question, textStyle(26, COLORS.text, { wordWrap: { width: WIDTH - 120 } }));

    let answered = false;
    q.options.forEach((option, i) => {
      const b = this.layer.button(60, 210 + i * 72, WIDTH - 120, 58, option, () => {
        if (answered) return;
        answered = true;
        const right = i === q.answer;
        b.label.setText(`${right ? '✓' : '✗'} ${option}`);
        b.label.setColor(right ? '#39ff88' : '#ff4d6a');
        this.layer.text(60, 520, `${right ? 'Correct!' : 'Not quite.'} ${q.explain}`, textStyle(19, right ? COLORS.accent : COLORS.warn, { wordWrap: { width: WIDTH - 120 } }));
        const total = correct + (right ? 1 : 0);
        const lastQ = index === quiz.length - 1;
        this.layer.button(WIDTH - 280, 590, 240, 52, lastQ ? 'See result >' : 'Next >', () => {
          if (lastQ) this.showResult(total);
          else this.showQuestion(index + 1, total);
        });
      }, { size: 20, color: COLORS.info });
    });
  }

  private showResult(correct: number) {
    this.layer.clear();
    const total = this.lesson.quiz.length;
    const passed = correct / total >= QUIZ_PASS_RATIO;
    let message = `You got ${correct} of ${total} right.\n\n`;
    if (passed) {
      const reward = completeLesson(game(), this.lesson.id);
      save();
      this.refreshHeader();
      message += reward > 0
        ? `Lesson complete! +$${reward}\nNew parts, settings or targets may now be unlocked.`
        : 'Lesson reviewed. Knowledge refreshed!';
    } else {
      message += 'Not enough to pass. Review the pages and try again.';
    }
    this.layer.text(WIDTH / 2, 260, message, textStyle(28, passed ? COLORS.accent : COLORS.warn, { align: 'center' })).setOrigin(0.5);
    if (!passed) this.layer.button(WIDTH / 2 - 310, 460, 300, 56, 'Review lesson', () => this.showPage(0));
    this.layer.button(passed ? WIDTH / 2 - 150 : WIDTH / 2 + 10, 460, 300, 56, 'Back to Study', () => this.scene.start('Study'), { color: COLORS.info });
  }
}
