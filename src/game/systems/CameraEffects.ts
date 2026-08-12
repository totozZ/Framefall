import Phaser from 'phaser';

export class CameraEffects {
  public constructor(private readonly camera: Phaser.Cameras.Scene2D.Camera) {}

  public lowShake(): void {
    this.camera.shake(90, 0.0015);
  }

  public mediumShake(): void {
    this.camera.shake(210, 0.0045);
  }

  public impactShake(): void {
    this.camera.shake(300, 0.009);
  }

  public flash(color = 0xf2d8a0, duration = 90): void {
    this.camera.flash(duration, (color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff, false);
  }
}
