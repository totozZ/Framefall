import Phaser from 'phaser';
import { LIGHT_CONFIG } from '../config/constants';

interface LightSource {
  glow: Phaser.GameObjects.Image;
  phase: number;
  baseScale: number;
  baseAlpha: number;
}

export class LightingSystem {
  private readonly lights: LightSource[] = [];
  private playerLight: LightSource | null = null;

  public constructor(private readonly scene: Phaser.Scene) {}

  public attachToPlayer(player: Phaser.GameObjects.Sprite): void {
    const glow = this.scene.add.image(player.x, player.y, 'organic-light')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(3)
      .setAlpha(LIGHT_CONFIG.playerAlpha)
      .setScale(LIGHT_CONFIG.playerRadius / 48);
    this.playerLight = { glow, phase: Math.random() * 10, baseScale: LIGHT_CONFIG.playerRadius / 48, baseAlpha: LIGHT_CONFIG.playerAlpha };
  }

  public addCandle(x: number, y: number): void {
    const glow = this.scene.add.image(x, y - 8, 'warm-light')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(3)
      .setAlpha(0)
      .setScale(0.1);
    const light = { glow, phase: Math.random() * 10, baseScale: LIGHT_CONFIG.candleRadius / 48, baseAlpha: LIGHT_CONFIG.candleAlpha };
    this.lights.push(light);
    this.scene.tweens.add({ targets: glow, alpha: light.baseAlpha, scale: light.baseScale, duration: 650, ease: 'Cubic.Out' });
  }

  public update(time: number, player: Phaser.GameObjects.Sprite): void {
    if (this.playerLight) {
      this.playerLight.glow.setPosition(player.x, player.y - 2);
      this.flicker(this.playerLight, time);
    }
    this.lights.forEach((light) => this.flicker(light, time));
  }

  private flicker(light: LightSource, time: number): void {
    const wave = Math.sin(time * 0.003 + light.phase) * LIGHT_CONFIG.flickerAmount;
    const noise = Math.sin(time * 0.013 + light.phase * 3) * 0.025;
    light.glow.setScale(light.baseScale * (1 + wave + noise));
    light.glow.setAlpha(light.baseAlpha * (1 + wave * 0.6));
  }
}
