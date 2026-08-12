import Phaser from 'phaser';
import { createGameConfig } from './game/Game';
import { AudioSystem } from './game/systems/AudioSystem';
import './styles/global.css';
import './ui/cards.css';

const game = new Phaser.Game(createGameConfig());

const unlockAudio = (): void => {
  AudioSystem.instance.unlock();
  window.removeEventListener('pointerdown', unlockAudio, true);
};

// Capture runs before Phaser's pointer handler, so the very first jump can be heard.
window.addEventListener('pointerdown', unlockAudio, { capture: true, passive: true });
window.addEventListener('beforeunload', () => game.destroy(true));

if (navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches) {
  document.body.classList.add('touch-device');
}
