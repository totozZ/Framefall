import Phaser from 'phaser';
import { AudioSystem } from '../systems/AudioSystem';
import { CameraEffects } from '../systems/CameraEffects';
import { CRTSystem } from '../systems/CRTSystem';

export class WellTransitionScene extends Phaser.Scene {
  private elapsed = 0;
  private streaks!: Phaser.GameObjects.Graphics;
  private rabbit!: Phaser.GameObjects.Image;
  private black!: Phaser.GameObjects.Rectangle;
  private crt!: CRTSystem;
  private cameraEffects!: CameraEffects;
  private distortionPulseAt = 0;

  public constructor() {
    super('WellTransitionScene');
  }

  public create(): void {
    this.elapsed = 0;
    this.crt = new CRTSystem();
    this.cameraEffects = new CameraEffects(this.cameras.main);
    this.add.rectangle(0, 0, 320, 180, 0x020207).setOrigin(0);
    this.streaks = this.add.graphics();
    this.rabbit = this.add.image(160, 72, 'player-fall').setDepth(4).setScale(1.2);
    this.black = this.add.rectangle(0, 0, 320, 180, 0x000000, 0).setOrigin(0).setDepth(20);
    AudioSystem.instance.play('fallWind');
    this.cameraEffects.mediumShake();
  }

  public update(_time: number, delta: number): void {
    this.elapsed += delta;
    const progress = Phaser.Math.Clamp(this.elapsed / 2700, 0, 1);
    const speed = 1 + progress * progress * 12;
    this.drawStreaks(progress, speed);
    this.rabbit.y = 72 + Math.sin(this.elapsed * 0.018) * (1 + progress * 3);
    this.rabbit.angle = Math.sin(this.elapsed * 0.008) * (3 + progress * 8);
    this.crt.setDistortion(progress ** 2.2);

    if (progress > 0.62 && this.elapsed > this.distortionPulseAt) {
      this.distortionPulseAt = this.elapsed + Phaser.Math.Between(150, 260);
      AudioSystem.instance.play('crtDistortion');
    }
    if (progress > 0.88) this.black.setAlpha((progress - 0.88) / 0.12);
    if (progress >= 1) {
      this.crt.reset();
      this.scene.start('CaveScene');
    }
  }

  private drawStreaks(progress: number, speed: number): void {
    this.streaks.clear();
    const count = 26 + Math.round(progress * 30);
    for (let index = 0; index < count; index += 1) {
      const x = (index * 67 + 19) % 320;
      const offset = (this.elapsed * speed * 0.035 + index * 23) % 220;
      const y = 190 - offset;
      const length = 3 + Math.round(progress * 16) + (index % 5);
      const color = index % 7 === 0 ? 0x8d4766 : index % 5 === 0 ? 0x426d76 : 0x242535;
      this.streaks.fillStyle(color, 0.25 + progress * 0.42).fillRect(x, y, index % 9 === 0 ? 2 : 1, length);
    }
  }
}
