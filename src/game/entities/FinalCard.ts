import Phaser from 'phaser';

export class FinalCard extends Phaser.Physics.Arcade.Sprite {
  private readonly baseY: number;
  private claimed = false;

  public constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'world-card');
    this.baseY = y;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(9).setAngle(-13);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false).setImmovable(true).setSize(19, 13);
  }

  public update(time: number): void {
    if (this.claimed) return;
    this.y = this.baseY + Math.sin(time * 0.0022) * 2.2;
    this.angle = -13 + Math.sin(time * 0.0013) * 5;
  }

  public flyToCamera(onComplete: () => void): void {
    if (this.claimed) return;
    this.claimed = true;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = false;
    const camera = this.scene.cameras.main;
    this.scene.tweens.add({
      targets: this,
      x: camera.worldView.centerX,
      y: camera.worldView.centerY,
      angle: 360,
      scale: 7.5,
      alpha: { from: 1, to: 0.15 },
      duration: 760,
      ease: 'Cubic.In',
      onComplete: () => {
        this.setVisible(false);
        onComplete();
      },
    });
  }
}
