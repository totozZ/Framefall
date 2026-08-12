import Phaser from 'phaser';
import { AudioSystem } from '../systems/AudioSystem';
import { ParticleSystem } from '../systems/ParticleSystem';

export class Candle extends Phaser.GameObjects.Sprite {
  private lit = false;

  public constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'candle-off');
    scene.add.existing(this);
    this.setOrigin(0.5, 1).setDepth(8);
    if (!scene.anims.exists('candle-flame')) {
      scene.anims.create({
        key: 'candle-flame',
        frames: [{ key: 'candle-lit-0' }, { key: 'candle-lit-1' }, { key: 'candle-lit-2' }],
        frameRate: 7,
        repeat: -1,
      });
    }
  }

  public tryIgnite(playerX: number, particles: ParticleSystem, onIgnited: () => void): void {
    if (this.lit || Math.abs(playerX - this.x) > 42) return;
    this.lit = true;
    this.play('candle-flame');
    particles.burst({
      x: this.x,
      y: this.y - 10,
      count: 9,
      textures: ['pixel-gold', 'pixel-ember'],
      speedX: [-18, 18],
      speedY: [-68, -20],
      gravity: -18,
      life: [350, 760],
      scale: [0.55, 1],
      depth: 12,
    });
    AudioSystem.instance.play('candleIgnite');
    onIgnited();
  }
}
