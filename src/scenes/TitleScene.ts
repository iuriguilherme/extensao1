import Phaser from 'phaser';
import { hasSave, resetGame } from '../core/store';
import { button, COLORS, HEIGHT, textStyle, WIDTH } from '../ui/widgets';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.drawRain();

    this.add.text(WIDTH / 2, 190, 'ROOTKIT ACADEMY', textStyle(64, COLORS.accent)).setOrigin(0.5);
    this.add.text(WIDTH / 2, 260, 'build it · wire it · breach it — learn IT the hands-on way', textStyle(20, COLORS.info)).setOrigin(0.5);
    this.add.text(WIDTH / 2, 330, [
      'You inherited an empty computer case and $300.',
      'Learn what goes inside, get it online, then explore the network.',
    ].join('\n'), textStyle(18, COLORS.text, { align: 'center', lineSpacing: 8 })).setOrigin(0.5);

    const saved = hasSave();
    if (saved) {
      button(this, WIDTH / 2 - 150, 420, 300, 54, 'Continue', () => this.scene.start('Hub'), { size: 22 });
    }
    button(this, WIDTH / 2 - 150, saved ? 490 : 440, 300, 54, 'New Game', () => {
      resetGame();
      this.scene.start('Hub');
    }, { size: 22, color: saved ? COLORS.warn : COLORS.accent });
  }

  private drawRain() {
    const glyphs = '01';
    for (let i = 0; i < 60; i++) {
      const x = Phaser.Math.Between(0, WIDTH);
      const t = this.add.text(x, Phaser.Math.Between(-HEIGHT, 0), glyphs[i % 2], textStyle(16, COLORS.accentDim)).setAlpha(0.5);
      this.tweens.add({
        targets: t,
        y: HEIGHT + 20,
        duration: Phaser.Math.Between(4000, 9000),
        repeat: -1,
        delay: Phaser.Math.Between(0, 4000),
      });
    }
  }
}
