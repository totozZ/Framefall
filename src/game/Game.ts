import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config/constants';
import { BootScene } from './scenes/BootScene';
import { SurfaceScene } from './scenes/SurfaceScene';
import { WellTransitionScene } from './scenes/WellTransitionScene';
import { CaveScene } from './scenes/CaveScene';

export const createGameConfig = (): Phaser.Types.Core.GameConfig => ({
  type: Phaser.WEBGL,
  parent: 'game-container',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#020309',
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  transparent: false,
  render: {
    pixelArt: true,
    antialias: false,
    roundPixels: true,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 640 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  scene: [BootScene, SurfaceScene, WellTransitionScene, CaveScene],
});
