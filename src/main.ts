import Phaser from 'phaser';
import { HubScene } from './scenes/HubScene';
import { LessonScene } from './scenes/LessonScene';
import { MinigameScene } from './scenes/MinigameScene';
import { NetMapScene } from './scenes/NetMapScene';
import { NetSetupScene } from './scenes/NetSetupScene';
import { ShopScene } from './scenes/ShopScene';
import { StudyScene } from './scenes/StudyScene';
import { TitleScene } from './scenes/TitleScene';
import { WorkbenchScene } from './scenes/WorkbenchScene';
import { COLORS, HEIGHT, WIDTH } from './ui/widgets';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: COLORS.bg,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [TitleScene, HubScene, StudyScene, LessonScene, ShopScene, WorkbenchScene, NetSetupScene, NetMapScene, MinigameScene],
});
