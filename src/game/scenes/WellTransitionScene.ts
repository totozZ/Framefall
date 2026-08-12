import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { AudioSystem } from '../systems/AudioSystem';
import { CRTSystem } from '../systems/CRTSystem';

interface WellTransitionData {
  entryX?: number;
}

export class WellTransitionScene extends Phaser.Scene {
  private elapsed = 0;
  private entryX = GAME_WIDTH / 2;
  private smokeBack!: Phaser.GameObjects.Graphics;
  private smokeFront!: Phaser.GameObjects.Graphics;
  private streaks!: Phaser.GameObjects.Graphics;
  private rabbit!: Phaser.GameObjects.Image;
  private black!: Phaser.GameObjects.Rectangle;
  private crt!: CRTSystem;
  private distortionPulseAt = 0;
  private initialProgress = 0;
  private readonly curvePointSets: Phaser.Geom.Point[][] = [];
  private curveCursor = 0;

  public constructor() {
    super('WellTransitionScene');
  }

  public init(data: WellTransitionData): void {
    this.entryX = Phaser.Math.Clamp(data.entryX ?? GAME_WIDTH / 2, 24, GAME_WIDTH - 24);
    const preview = import.meta.env.DEV
      ? Number(new URLSearchParams(window.location.search).get('progress'))
      : 0;
    this.initialProgress = Number.isFinite(preview) ? Phaser.Math.Clamp(preview, 0, 0.9) : 0;
  }

  public create(): void {
    this.elapsed = this.initialProgress * 3600;
    this.crt = new CRTSystem();
    this.crt.setDistortion(0.04);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x010207).setOrigin(0).setDepth(-20);
    this.smokeBack = this.add.graphics().setDepth(-10);
    this.streaks = this.add.graphics().setDepth(0);
    this.rabbit = this.add.image(this.entryX, -12, 'player-fall').setDepth(5).setScale(0.86);
    this.smokeFront = this.add.graphics().setDepth(9);
    this.black = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0)
      .setOrigin(0)
      .setDepth(20);
    AudioSystem.instance.play('fallWind');
  }

  public update(_time: number, delta: number): void {
    this.elapsed += delta;
    const progress = Phaser.Math.Clamp(this.elapsed / 3600, 0, 1);
    const acceleration = Phaser.Math.Easing.Quadratic.In(progress);
    const chaos = Phaser.Math.Clamp((progress - 0.32) / 0.68, 0, 1);
    const entryProgress = Phaser.Math.Easing.Cubic.Out(Phaser.Math.Clamp(progress / 0.16, 0, 1));
    const bend = this.calculateBend(progress, chaos);

    this.drawSmokeRoad(progress, chaos, bend);
    this.drawRushingDebris(progress, acceleration, bend);

    const baseX = Phaser.Math.Linear(this.entryX, GAME_WIDTH / 2, entryProgress);
    const sway = Math.sin(this.elapsed * (0.003 + chaos * 0.006)) * chaos * 22
      + Math.sin(this.elapsed * 0.012) * chaos * chaos * 7;
    this.rabbit.x = baseX + sway;
    this.rabbit.y = Phaser.Math.Linear(-12, 70, entryProgress)
      + Math.sin(this.elapsed * 0.017) * (1 + chaos * 4);
    this.rabbit.angle = Math.sin(this.elapsed * (0.005 + chaos * 0.01)) * (4 + chaos * 28);
    this.rabbit.setScale(Phaser.Math.Linear(0.86, 1.22, entryProgress) * (1 + Math.sin(this.elapsed * 0.021) * chaos * 0.045));

    // The whole frame begins to steer like a rapidly tightening road bend.
    this.cameras.main.setRotation(Math.sin(this.elapsed * 0.0045) * chaos * 0.024);
    this.cameras.main.setScroll(
      Math.sin(this.elapsed * 0.011) * chaos * chaos * 5,
      Math.cos(this.elapsed * 0.014) * chaos * 2,
    );
    if (chaos > 0.2) this.cameras.main.shake(70, 0.0008 + chaos * 0.0038, false);
    this.crt.setDistortion(0.04 + chaos ** 2 * 0.96);

    if (progress > 0.58 && this.elapsed > this.distortionPulseAt) {
      this.distortionPulseAt = this.elapsed + Phaser.Math.Between(155, 280);
      AudioSystem.instance.play('crtDistortion');
    }

    const blackout = Phaser.Math.Clamp((progress - 0.925) / 0.075, 0, 1);
    this.black.setAlpha(Phaser.Math.Easing.Sine.InOut(blackout));
    if (progress >= 1) {
      this.cameras.main.setRotation(0).setScroll(0, 0);
      this.crt.reset();
      this.scene.start('CaveScene', { fromWell: true });
    }
  }

  private calculateBend(progress: number, chaos: number): number {
    const slowCurl = Math.sin(this.elapsed * 0.0015 + progress * 4.4) * (8 + chaos * 48);
    const violentCurl = Math.sin(this.elapsed * 0.0052 + 1.7) * chaos * chaos * 34;
    return slowCurl + violentCurl;
  }

  private drawSmokeRoad(progress: number, chaos: number, bend: number): void {
    this.smokeBack.clear();
    this.smokeFront.clear();
    this.curveCursor = 0;

    const vanishingX = GAME_WIDTH / 2 - bend * 0.14;
    const controlX = GAME_WIDTH / 2 - bend * 0.72;
    const bottomX = GAME_WIDTH / 2 + bend;
    const smokeAlpha = 0.1 + progress * 0.22;
    const ribbons = [
      { offset: -154, width: 58, color: 0x10131d, alpha: smokeAlpha },
      { offset: 154, width: 58, color: 0x17121d, alpha: smokeAlpha },
      { offset: -96, width: 34, color: 0x28303a, alpha: smokeAlpha * 0.68 },
      { offset: 96, width: 34, color: 0x302532, alpha: smokeAlpha * 0.62 },
      { offset: -48, width: 15, color: 0x45515a, alpha: smokeAlpha * 0.52 },
      { offset: 48, width: 15, color: 0x513849, alpha: smokeAlpha * 0.46 },
    ];

    ribbons.forEach((ribbon, index) => {
      const front = index >= 4 && chaos > 0.2;
      const target = front ? this.smokeFront : this.smokeBack;
      const perspectiveOffset = ribbon.offset * (0.2 + progress * 0.8);
      target.lineStyle(ribbon.width * (0.45 + progress * 0.75), ribbon.color, ribbon.alpha + chaos * 0.12);
      this.strokeCurve(
        target,
        vanishingX + ribbon.offset * 0.05,
        -18,
        controlX + ribbon.offset * 0.24,
        45,
        GAME_WIDTH / 2 - bend * 0.42 + ribbon.offset * 0.62,
        112,
        bottomX + perspectiveOffset,
        GAME_HEIGHT + 28,
      );
    });

    // Pale internal wisps make the tunnel read as smoke rather than solid walls.
    for (let index = 0; index < 9; index += 1) {
      const phase = this.elapsed * (0.0012 + index * 0.00007) + index * 0.91;
      const side = index % 2 === 0 ? -1 : 1;
      const offset = side * (22 + index * 7) + Math.sin(phase) * (5 + chaos * 10);
      this.smokeFront.lineStyle(2 + (index % 3), index % 3 === 0 ? 0x606c70 : 0x504453, 0.08 + chaos * 0.1);
      this.strokeCurve(
        this.smokeFront,
        vanishingX + offset * 0.12,
        0,
        controlX + offset * 0.3,
        58,
        GAME_WIDTH / 2 - bend * 0.35 + offset * 0.7,
        120,
        bottomX + offset * 1.45,
        GAME_HEIGHT + 12,
      );
    }
  }

  private strokeCurve(
    graphics: Phaser.GameObjects.Graphics,
    startX: number,
    startY: number,
    control1X: number,
    control1Y: number,
    control2X: number,
    control2Y: number,
    endX: number,
    endY: number,
  ): void {
    let points = this.curvePointSets[this.curveCursor];
    if (!points) {
      points = Array.from({ length: 19 }, () => new Phaser.Geom.Point());
      this.curvePointSets.push(points);
    }
    this.curveCursor += 1;
    for (let index = 0; index <= 18; index += 1) {
      const t = index / 18;
      const inverse = 1 - t;
      const x = inverse ** 3 * startX
        + 3 * inverse ** 2 * t * control1X
        + 3 * inverse * t ** 2 * control2X
        + t ** 3 * endX;
      const y = inverse ** 3 * startY
        + 3 * inverse ** 2 * t * control1Y
        + 3 * inverse * t ** 2 * control2Y
        + t ** 3 * endY;
      const point = points[index];
      if (point) point.setTo(x, y);
    }
    graphics.strokePoints(points, false, false);
  }

  private drawRushingDebris(progress: number, acceleration: number, bend: number): void {
    this.streaks.clear();
    const count = 28 + Math.round(progress * 48);
    const travelSpeed = 0.018 + acceleration * 0.14;
    for (let index = 0; index < count; index += 1) {
      const seedX = ((index * 71 + 23) % 320) - 160;
      const travel = (this.elapsed * travelSpeed + index * 19) % 215;
      const perspective = Phaser.Math.Clamp(travel / 180, 0, 1);
      const curveX = GAME_WIDTH / 2
        + seedX * (0.18 + perspective * 0.9)
        + bend * perspective * perspective;
      const y = travel - 22;
      const length = 2 + Math.round(perspective * (4 + acceleration * 22));
      const color = index % 9 === 0 ? 0x82536b : index % 5 === 0 ? 0x4d7b7f : 0x343944;
      this.streaks.fillStyle(color, 0.22 + perspective * 0.52).fillRect(
        Math.round(curveX),
        Math.round(y),
        index % 11 === 0 ? 2 : 1,
        length,
      );
    }
  }
}
