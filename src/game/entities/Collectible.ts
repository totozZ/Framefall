import Phaser from 'phaser';

export class Collectible extends Phaser.Physics.Arcade.Sprite {
  private readonly baseY: number;
  private readonly phase = Math.random() * Math.PI * 2;

  public constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
    super(scene, x, y, texture);
    this.baseY = y;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(7);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false).setImmovable(true);
  }

  public update(time: number): void {
    if (!this.active) return;
    this.y = this.baseY + Math.sin(time * 0.003 + this.phase) * 2;
    this.setAngle(Math.sin(time * 0.0017 + this.phase) * 2);
  }

  public collect(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = false;
    this.setActive(false).setVisible(false);
  }
}
