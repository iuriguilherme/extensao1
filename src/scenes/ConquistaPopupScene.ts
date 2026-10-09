import Phaser from 'phaser';
import { achievements, onUnlock } from '../core/achievementStore';
import { getAchievement } from '../data/achievements';
import { badge, COLORS, fitText, panel, textStyle, WIDTH } from '../ui/widgets';

const CARD_W = 360;
const CARD_H = 66;
const VISIBLE_MS = 3000;

/**
 * Corner card for each new conquista. Runs above every other scene for the
 * whole session, so a card survives the scene change that usually follows an
 * unlock. It has no interactive objects: clicks reach the scene underneath.
 */
export class ConquistaPopupScene extends Phaser.Scene {
  private static subscribed = false;
  private static queue: string[] = [];
  private showing = false;

  constructor() {
    super('ConquistaPopup');
  }

  create() {
    this.showing = false;
    if (!ConquistaPopupScene.subscribed) {
      ConquistaPopupScene.subscribed = true;
      onUnlock((ids) => {
        if (!achievements().popups) return;
        ConquistaPopupScene.queue.push(...ids);
        this.showNext();
      });
    }
    this.showNext();
  }

  private showNext() {
    if (this.showing) return;
    const id = ConquistaPopupScene.queue.shift();
    if (id === undefined) return;
    this.showing = true;
    const achievement = getAchievement(id);
    const x = WIDTH - CARD_W - 16;
    const y = 64;
    const card = this.add.container(0, 0, [
      panel(this, x, y, CARD_W, CARD_H, COLORS.accent),
      ...badge(this, x + 10, y + 10, 46, achievement, true),
      this.add.text(x + 68, y + 10, 'Conquista desbloqueada', textStyle(13, COLORS.accent)),
      fitText(this.add.text(x + 68, y + 30, achievement.name, textStyle(20, COLORS.text)), CARD_W - 80),
    ]).setAlpha(0);
    this.tweens.chain({
      targets: card,
      tweens: [
        { alpha: 1, duration: 200 },
        { alpha: 0, delay: VISIBLE_MS, duration: 400 },
      ],
      onComplete: () => {
        card.destroy();
        this.showing = false;
        this.showNext();
      },
    });
  }
}
