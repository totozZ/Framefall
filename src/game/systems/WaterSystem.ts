import Phaser from 'phaser';
import { WATER_CONFIG } from '../config/constants';
import { AudioSystem } from './AudioSystem';
import { ParticleSystem } from './ParticleSystem';

export class WaterSystem {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private active = false;
  private elapsed = 0;
  private lastSplashAt = -Infinity;

  public constructor(
    scene: Phaser.Scene,
    private readonly particles: ParticleSystem,
    private readonly sourceX: number,
    private readonly floorY: number,
  ) {
    this.graphics = scene.add.graphics().setDepth(5);
  }

  public start(): void {
    this.active = true;
    this.elapsed = 0;
    AudioSystem.instance.play('waterBurst');
  }

  public update(time: number, delta: number, player?: Phaser.Physics.Arcade.Sprite): void {
    if (!this.active) return;
    this.elapsed += delta;
    const radius = Math.min(
      WATER_CONFIG.cellCount * WATER_CONFIG.cellSize * 0.5,
      (this.elapsed / 1000) * WATER_CONFIG.spreadPixelsPerSecond,
    );
    const left = this.sourceX - radius;
    const right = this.sourceX + radius;
    this.graphics.clear();
    this.graphics.fillStyle(0x183c50, 0.82);

    for (let x = left; x < right; x += WATER_CONFIG.cellSize) {
      const distance = Math.abs(x - this.sourceX);
      const normalized = radius > 0 ? distance / radius : 1;
      const centerDepth = WATER_CONFIG.maxDepth * (1 - normalized * 0.65);
      const wave = Math.sin(x * 0.19 + time * 0.006) * 0.8 + Math.sin(x * 0.07 - time * 0.003) * 0.5;
      const depth = Math.max(1, Math.round(centerDepth + wave));
      this.graphics.fillRect(Math.round(x), this.floorY - depth + 1, WATER_CONFIG.cellSize + 1, depth);
      if ((Math.round(x) + Math.round(time / 120)) % 29 === 0) {
        this.graphics.fillStyle(0x4f8291, 0.75);
        this.graphics.fillRect(Math.round(x), this.floorY - depth, 3, 1);
        this.graphics.fillStyle(0x183c50, 0.82);
      }
    }

    if (player && player.body && player.body.blocked.down && player.x > left && player.x < right && Math.abs(player.body.velocity.x) > 24) {
      if (time - this.lastSplashAt > WATER_CONFIG.splashCooldownMs) {
        this.lastSplashAt = time;
        this.particles.burst({
          x: player.x,
          y: this.floorY - 2,
          count: 4,
          textures: ['pixel-water'],
          speedX: [-34, 34],
          speedY: [-55, -22],
          gravity: 210,
          life: [260, 480],
          groundY: this.floorY,
          scale: [0.6, 1],
        });
        AudioSystem.instance.play('waterSplash');
      }
    }
  }

  public destroy(): void {
    this.graphics.destroy();
  }
}
