import Phaser from 'phaser';
import { CAVE } from '../config/constants';
import { Player } from './Player';

export class ClockAltar {
  private readonly root: Phaser.GameObjects.Container;
  private readonly glow: Phaser.GameObjects.Image;
  private readonly minuteHand: Phaser.GameObjects.Rectangle;
  private active = false;
  private triggered = false;
  private minuteStartedAtEpochMs = 0;

  public constructor(
    private readonly scene: Phaser.Scene,
    public readonly x: number,
    private readonly floorY: number,
    private readonly onTriggered: () => void,
  ) {
    this.glow = scene.add.image(x, floorY - 49, 'organic-light')
      .setTint(0xc5f2ef)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.72)
      .setAlpha(0.02)
      .setDepth(4);

    const stone = scene.add.graphics();
    stone.fillStyle(0x05070a, 1).fillRect(-47, -18, 94, 18);
    stone.fillStyle(0x252b2f, 1).fillRect(-42, -16, 84, 13);
    stone.fillStyle(0x4a5553, 1).fillRect(-38, -15, 76, 3);
    stone.fillStyle(0x11151a, 1)
      .fillRect(-32, -12, 10, 9)
      .fillRect(22, -11, 9, 8)
      .fillRect(-4, -16, 6, 5);
    stone.fillStyle(0x687570, 0.5).fillRect(-34, -14, 20, 1).fillRect(9, -14, 18, 1);
    stone.fillStyle(0x07090c, 1).fillRect(-34, -82, 68, 9);
    stone.fillStyle(0x252c30, 1).fillRect(-31, -78, 62, 31);
    stone.fillStyle(0x4c5756, 0.7).fillRect(-28, -76, 4, 23);
    stone.fillStyle(0x101419, 1).fillRect(24, -75, 5, 25);
    stone.fillStyle(0x07090c, 1)
      .fillRect(-37, -50, 12, 35)
      .fillRect(25, -50, 12, 35);
    stone.fillStyle(0x30383a, 1)
      .fillRect(-33, -49, 8, 32)
      .fillRect(25, -49, 8, 32);

    const face = scene.add.graphics();
    face.fillStyle(0x05090d, 1).fillCircle(0, -50, 31);
    face.fillStyle(0x1c272d, 1).fillCircle(0, -50, 27);
    face.lineStyle(3, 0x596966, 0.8).strokeCircle(0, -50, 24);
    face.lineStyle(1, 0x9ab6af, 0.42).strokeCircle(0, -50, 20);
    face.fillStyle(0x091118, 1).fillCircle(0, -50, 18);
    face.fillStyle(0xa6c7bf, 0.8).fillRect(-1, -79, 3, 5);

    const ticks: Phaser.GameObjects.Rectangle[] = [];
    for (let index = 0; index < 12; index += 1) {
      const angle = index * Math.PI / 6 - Math.PI / 2;
      ticks.push(scene.add.rectangle(
        Math.cos(angle) * 21,
        -50 + Math.sin(angle) * 21,
        index % 3 === 0 ? 4 : 2,
        1,
        index === 0 ? 0xe3f6ef : 0x6b7a76,
        index === 0 ? 0.95 : 0.68,
      ).setRotation(angle));
    }

    // Midnight is straight up. The hour hand is fixed; real elapsed time drives
    // the minute hand so losing focus cannot reset its 25 s lap.
    const hourHand = scene.add.rectangle(0, -50, 3, 13, 0xc5ddd6, 1)
      .setOrigin(0.5, 1)
      .setAngle(0);
    this.minuteHand = scene.add.rectangle(0, -50, 1, 20, 0xf0fffb, 1)
      .setOrigin(0.5, 1)
      .setAngle(0);
    const pin = scene.add.rectangle(0, -50, 3, 3, 0xf2fff9, 1);
    this.root = scene.add.container(x, floorY, [stone, face, ...ticks, hourHand, this.minuteHand, pin])
      .setDepth(5)
      .setAlpha(0.38);
  }

  public setActive(active: boolean): void {
    if (this.active === active) return;
    this.active = active;
    if (active && this.minuteStartedAtEpochMs === 0) this.minuteStartedAtEpochMs = Date.now();
    this.scene.tweens.add({
      targets: this.root,
      alpha: active ? 1 : 0.38,
      duration: 720,
      ease: 'Sine.Out',
    });
    this.scene.tweens.add({
      targets: this.glow,
      alpha: active ? 0.15 : 0.02,
      duration: 900,
      ease: 'Sine.Out',
    });
  }

  public update(time: number, player: Player, canTrigger: boolean): void {
    let alignmentDistance = 180;
    if (this.active && !this.triggered) {
      const elapsedMs = Date.now() - this.minuteStartedAtEpochMs;
      const lapProgress = (elapsedMs % CAVE.clockRotationMs) / CAVE.clockRotationMs;
      const minuteAngle = Phaser.Math.Wrap(lapProgress * 360, 0, 360);
      this.minuteHand.setAngle(minuteAngle);
      alignmentDistance = Math.min(minuteAngle, 360 - minuteAngle);
    }

    const nearby = Math.abs(player.x - this.x) < 27 && player.y < this.floorY - 7 && player.isGrounded();
    const anticipation = 1 - Phaser.Math.Clamp(alignmentDistance / 48, 0, 1);
    const pulse = Math.sin(time * 0.0021) * 0.022;
    this.glow.setAlpha((this.active ? 0.13 : 0.02) + pulse + anticipation * 0.18 + (nearby ? 0.045 : 0));
    if (!this.active || !canTrigger || this.triggered || !nearby) return;
    if (alignmentDistance > CAVE.clockAlignmentWindowDegrees) return;

    this.triggered = true;
    this.minuteHand.setAngle(0);
    this.glow.setAlpha(0.48);
    this.scene.tweens.add({
      targets: this.root,
      scale: 1.045,
      duration: 110,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.InOut',
      onComplete: this.onTriggered,
    });
  }

  public destroy(): void {
    this.root.destroy(true);
    this.glow.destroy();
  }
}
