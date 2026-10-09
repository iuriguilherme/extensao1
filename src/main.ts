import Phaser from 'phaser';
import { CertificateScene } from './scenes/CertificateScene';
import { CityListScene } from './scenes/CityListScene';
import { CityMapScene } from './scenes/CityMapScene';
import { FormaturaScene } from './scenes/FormaturaScene';
import { HubScene } from './scenes/HubScene';
import { JobBoardScene } from './scenes/JobBoardScene';
import { LessonScene } from './scenes/LessonScene';
import { MinigameScene } from './scenes/MinigameScene';
import { NetMapScene } from './scenes/NetMapScene';
import { NetSetupScene } from './scenes/NetSetupScene';
import { RouteScene } from './scenes/RouteScene';
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
  // The formatura's name field is an HTML input over the canvas.
  dom: { createContainer: true },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [TitleScene, HubScene, StudyScene, LessonScene, ShopScene, WorkbenchScene, NetSetupScene, NetMapScene, MinigameScene, JobBoardScene,
    CityListScene, CityMapScene, RouteScene, FormaturaScene, CertificateScene],
});
