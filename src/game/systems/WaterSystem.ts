import Phaser from 'phaser';
import { WATER_CONFIG } from '../config/constants';
import { AudioSystem } from './AudioSystem';
import { ParticleSystem } from './ParticleSystem';

type WaterSplashKind = 'movement' | 'jump' | 'land';

export class WaterSystem {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private active = false;
  private elapsed = 0;
  private currentRadius = 0;
  private lastSplashAt = -Infinity;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly particles: ParticleSystem,
    private readonly sourceX: number,
    private readonly floorY: number,
  ) {
    this.graphics = scene.add.graphics().setDepth(5);
  }

  public start(): void {
    this.active = true;
    this.elapsed = 0;
    this.currentRadius = 0;
    AudioSystem.instance.play('waterBurst');
  }

  public splashAt(player: Phaser.Physics.Arcade.Sprite, kind: Exclude<WaterSplashKind, 'movement'>): void {
    if (!this.hasWaterAt(player.x)) return;
    this.createSplash(player.x, kind, true);
  }

  public update(time: number, delta: number, player?: Phaser.Physics.Arcade.Sprite): void {
    if (!this.active) return;
    this.elapsed += delta;
    this.currentRadius = Math.min(
      WATER_CONFIG.cellCount * WATER_CONFIG.cellSize * 0.5,
      (this.elapsed / 1000) * WATER_CONFIG.spreadPixelsPerSecond,
    );
    const left = this.sourceX - this.currentRadius;
    const right = this.sourceX + this.currentRadius;
    this.graphics.clear();
    this.graphics.fillStyle(0x183c50, 0.82);

    for (let x = left; x < right; x += WATER_CONFIG.cellSize) {
      const distance = Math.abs(x - this.sourceX);
      const normalized = this.currentRadius > 0 ? distance / this.currentRadius : 1;
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

    if (
      player
      && player.body
      && player.body.blocked.down
      && this.hasWaterAt(player.x)
      && Math.abs(player.body.velocity.x) > 24
    ) {
      this.createSplash(player.x, 'movement');
    }
  }

  public destroy(): void {
    this.graphics.destroy();
  }

  private hasWaterAt(x: number): boolean {
    return this.active && Math.abs(x - this.sourceX) < this.currentRadius - WATER_CONFIG.cellSize;
  }

  private createSplash(x: number, kind: WaterSplashKind, force = false): void {
    const now = this.scene.time.now;
    if (!force && now - this.lastSplashAt < WATER_CONFIG.splashCooldownMs) return;
    this.lastSplashAt = now;

    if (kind === 'movement') {
      this.particles.burst({
        x,
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
      this.createRipple(x, 0.65, 260);
    } else {
      const isLanding = kind === 'land';
      const count = isLanding ? WATER_CONFIG.landSplashCount : WATER_CONFIG.jumpSplashCount;
      const outwardSpeed = isLanding ? 94 : 72;
      const upwardRange: [number, number] = isLanding ? [-132, -52] : [-92, -38];

      // Two directional fans leave the rabbit silhouette visible between them.
      this.particles.burst({
        x: x - 5,
        y: this.floorY - 3,
        count: Math.floor(count / 2),
        textures: ['pixel-water', 'pixel-water-bright'],
        speedX: [-outwardSpeed, -18],
        speedY: upwardRange,
        gravity: 245,
        life: isLanding ? [420, 780] : [340, 640],
        groundY: this.floorY,
        bounce: 0.08,
        scale: [0.65, isLanding ? 1.35 : 1.1],
        depth: 12,
      });
      this.particles.burst({
        x: x + 5,
        y: this.floorY - 3,
        count: Math.ceil(count / 2),
        textures: ['pixel-water', 'pixel-water-bright'],
        speedX: [18, outwardSpeed],
        speedY: upwardRange,
        gravity: 245,
        life: isLanding ? [420, 780] : [340, 640],
        groundY: this.floorY,
        bounce: 0.08,
        scale: [0.65, isLanding ? 1.35 : 1.1],
        depth: 12,
      });
      this.createRipple(x, isLanding ? 1.35 : 0.95, isLanding ? 430 : 320);
      if (isLanding) {
        this.scene.time.delayedCall(85, () => this.createRipple(x, 0.85, 360));
      }
    }
    AudioSystem.instance.play('waterSplash');
  }

  private createRipple(x: number, targetScale: number, duration: number): void {
    const ripple = this.scene.add.image(x, this.floorY - 2, 'water-ripple')
      .setDepth(6)
      .setAlpha(0.72)
      .setScale(0.35, 0.7);
    this.scene.tweens.add({
      targets: ripple,
      scaleX: targetScale,
      scaleY: 1,
      alpha: 0,
      duration,
      ease: 'Quad.Out',
      onComplete: () => ripple.destroy(),
    });
  }
}
