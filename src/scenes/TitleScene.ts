import Phaser from 'phaser';
import { money } from '../core/fmt';
import { STARTING_MONEY } from '../core/state';
import { game, hasSave } from '../core/store';
import { button, COLORS, HEIGHT, resetEverything, textStyle, WIDTH } from '../ui/widgets';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.drawRain();
    // The conquista pop-up runs alongside every scene from here on.
    if (!this.scene.isActive('ConquistaPopup')) this.scene.launch('ConquistaPopup');

    this.add.text(WIDTH / 2, 190, 'ROOTKIT ACADEMY', textStyle(64, COLORS.accent)).setOrigin(0.5);
    this.add.text(WIDTH / 2, 260, 'monte · conecte · invada — aprenda TI na prática', textStyle(20, COLORS.info)).setOrigin(0.5);
    this.add.text(WIDTH / 2, 330, [
      `Você herdou um gabinete vazio e ${money(STARTING_MONEY)}.`,
      'Descubra o que vai dentro dele e coloque o PC na internet.',
      'Depois, treine invasão no laboratório de segurança da escola: uma rede isolada, só com máquinas simuladas.',
    ].join('\n'), textStyle(18, COLORS.text, { align: 'center', lineSpacing: 8 })).setOrigin(0.5);

    const saved = hasSave();
    if (saved) {
      button(this, WIDTH / 2 - 150, 420, 300, 54, 'Continuar', () => this.scene.start('Hub'), { size: 22 });
    }
    button(this, WIDTH / 2 - 150, saved ? 490 : 440, 300, 54, 'Novo jogo', () => {
      // Certificates are the hardest thing to earn again, so losing them asks first.
      if (game().certificates.length > 0 && !window.confirm('Um jogo novo apaga todo o seu progresso, inclusive os certificados. Começar mesmo assim?')) return;
      resetEverything();
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
