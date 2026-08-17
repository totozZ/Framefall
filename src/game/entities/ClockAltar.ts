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
    const faceY = -CAVE.clockFaceOffsetY;
    this.glow = scene.add.image(x, floorY + faceY, 'organic-light')
      .setTint(0xc5f2ef)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.95, 0.82)
      .setAlpha(0.02)
      .setDepth(4);

    const stone = scene.add.graphics();
    // A broad, stepped plinth and tall buttresses give the clock a monumental
    // silhouette while keeping the same compact pixel-art language.
    stone.fillStyle(0x030508, 1).fillRect(-62, -9, 124, 9);
    stone.fillStyle(0x1c2226, 1).fillRect(-59, -18, 118, 10);
    stone.fillStyle(0x343d3e, 1).fillRect(-55, -24, 110, 7);
    stone.fillStyle(0x596461, 0.72).fillRect(-51, -23, 102, 2);
    stone.fillStyle(0x11161a, 1).fillRect(-48, -21, 96, 12);
    stone.fillStyle(0x11151a, 1)
      .fillRect(-42, -16, 13, 7)
      .fillRect(29, -15, 12, 6)
      .fillRect(-6, -22, 9, 6);
    stone.fillStyle(0x6b7873, 0.48).fillRect(-47, -20, 25, 1).fillRect(15, -20, 28, 1);

    stone.fillStyle(0x05080b, 1)
      .fillRect(-53, -84, 15, 62)
      .fillRect(38, -84, 15, 62)
      .fillRect(-47, -99, 94, 9);
    stone.fillStyle(0x252d30, 1)
      .fillRect(-49, -81, 11, 56)
      .fillRect(38, -81, 11, 56)
      .fillRect(-43, -95, 86, 7);
    stone.fillStyle(0x4e5a58, 0.72)
      .fillRect(-46, -79, 3, 49)
      .fillRect(42, -78, 3, 48)
      .fillRect(-39, -93, 52, 2);
    stone.fillStyle(0x0d1216, 1)
      .fillTriangle(-61, -22, -51, -59, -38, -22)
      .fillTriangle(38, -22, 51, -59, 61, -22);
    stone.fillStyle(0x30393a, 0.9)
      .fillTriangle(-55, -23, -49, -49, -42, -23)
      .fillTriangle(42, -23, 49, -49, 55, -23);

    const face = scene.add.graphics();
    for (let segment = 0; segment < 8; segment += 1) {
      const start = segment * Math.PI / 4;
      const gap = 0.09 + (segment % 3) * 0.035;
      face.lineStyle(segment % 2 === 0 ? 3 : 2, 0x4c5a59, 0.76)
        .beginPath()
        .arc(0, faceY, 41, start + gap, start + Math.PI / 4 - gap)
        .strokePath();
    }
    face.fillStyle(0x04080c, 1).fillCircle(0, faceY, 38);
    face.fillStyle(0x1b262c, 1).fillCircle(0, faceY, 35);
    face.lineStyle(3, 0x667774, 0.9).strokeCircle(0, faceY, 32);
    face.lineStyle(1, 0xa4c0b8, 0.42).strokeCircle(0, faceY, 29);
    face.fillStyle(0x081117, 1).fillCircle(0, faceY, 27);

    const ticks: Phaser.GameObjects.Rectangle[] = [];
    for (let index = 0; index < 60; index += 1) {
      const angle = index * Math.PI / 30 - Math.PI / 2;
      const isQuarter = index % 15 === 0;
      const isHour = index % 5 === 0;
      const radius = isQuarter ? 25 : isHour ? 26 : 27;
      ticks.push(scene.add.rectangle(
        Math.cos(angle) * radius,
        faceY + Math.sin(angle) * radius,
        isQuarter ? 5 : isHour ? 3 : 1,
        isQuarter ? 2 : 1,
        isQuarter ? 0xdff6ef : isHour ? 0x8ba29c : 0x52625f,
        isQuarter ? 0.94 : isHour ? 0.78 : 0.58,
      ).setRotation(angle));
    }

    // Midnight is straight up. The hour hand is fixed; real elapsed time drives
    // the minute hand so losing focus cannot reset its 25 s lap.
    const hourHand = scene.add.rectangle(0, faceY, 4, 17, 0xc5ddd6, 1)
      .setOrigin(0.5, 1)
      .setAngle(0);
    this.minuteHand = scene.add.rectangle(0, faceY, 1, 27, 0xf0fffb, 1)
      .setOrigin(0.5, 1)
      .setAngle(0);
    const pin = scene.add.rectangle(0, faceY, 4, 4, 0xf2fff9, 1);
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
