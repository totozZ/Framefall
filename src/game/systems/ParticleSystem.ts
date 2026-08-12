import Phaser from 'phaser';

interface ParticleData {
  sprite: Phaser.GameObjects.Image;
  velocityX: number;
  velocityY: number;
  gravity: number;
  angularVelocity: number;
  life: number;
  maxLife: number;
  bounce: number;
  groundY: number;
}

export interface BurstOptions {
  x: number;
  y: number;
  count: number;
  textures: string[];
  speedX: [number, number];
  speedY: [number, number];
  gravity?: number;
  life?: [number, number];
  scale?: [number, number];
  bounce?: number;
  groundY?: number;
  depth?: number;
}

export class ParticleSystem {
  private readonly pool: Phaser.GameObjects.Image[] = [];
  private readonly active: ParticleData[] = [];

  public constructor(scene: Phaser.Scene, poolSize = 120) {
    for (let index = 0; index < poolSize; index += 1) {
      const sprite = scene.add.image(0, 0, 'pixel-white').setVisible(false).setActive(false);
      this.pool.push(sprite);
    }
  }

  public burst(options: BurstOptions): void {
    for (let index = 0; index < options.count; index += 1) {
      const sprite = this.pool.pop();
      if (!sprite) break;
      const texture = Phaser.Utils.Array.GetRandom(options.textures);
      const maxLife = Phaser.Math.Between(options.life?.[0] ?? 450, options.life?.[1] ?? 1000);
      sprite
        .setTexture(texture)
        .setPosition(options.x + Phaser.Math.Between(-3, 3), options.y + Phaser.Math.Between(-2, 2))
        .setScale(Phaser.Math.FloatBetween(options.scale?.[0] ?? 0.7, options.scale?.[1] ?? 1.4))
        .setAlpha(1)
        .setAngle(Phaser.Math.Between(0, 359))
        .setDepth(options.depth ?? 8)
        .setVisible(true)
        .setActive(true);
      this.active.push({
        sprite,
        velocityX: Phaser.Math.FloatBetween(options.speedX[0], options.speedX[1]),
        velocityY: Phaser.Math.FloatBetween(options.speedY[0], options.speedY[1]),
        gravity: options.gravity ?? 300,
        angularVelocity: Phaser.Math.FloatBetween(-360, 360),
        life: maxLife,
        maxLife,
        bounce: options.bounce ?? 0.3,
        groundY: options.groundY ?? Number.POSITIVE_INFINITY,
      });
    }
  }

  public update(deltaMs: number): void {
    const dt = Math.min(deltaMs, 40) / 1000;
    for (let index = this.active.length - 1; index >= 0; index -= 1) {
      const particle = this.active[index];
      if (!particle) continue;
      particle.life -= deltaMs;
      particle.velocityY += particle.gravity * dt;
      particle.sprite.x += particle.velocityX * dt;
      particle.sprite.y += particle.velocityY * dt;
      particle.sprite.angle += particle.angularVelocity * dt;

      if (particle.sprite.y >= particle.groundY && particle.velocityY > 0) {
        particle.sprite.y = particle.groundY;
        particle.velocityY *= -particle.bounce;
        particle.velocityX *= 0.72;
        particle.angularVelocity *= 0.62;
      }
      if (particle.life < 260) particle.sprite.setAlpha(Math.max(0, particle.life / 260));
      if (particle.life <= 0) this.recycle(index);
    }
  }

  public destroy(): void {
    this.active.forEach((particle) => particle.sprite.destroy());
    this.pool.forEach((sprite) => sprite.destroy());
    this.active.length = 0;
    this.pool.length = 0;
  }

  private recycle(index: number): void {
    const [particle] = this.active.splice(index, 1);
    if (!particle) return;
    particle.sprite.setVisible(false).setActive(false);
    this.pool.push(particle.sprite);
  }
}
