import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  public constructor() {
    super('BootScene');
  }

  public create(): void {
    this.createPlayerTextures();
    this.createWorldTextures();
    this.createOrganicLightTexture();
    const previewParams = new URLSearchParams(window.location.search);
    const previewScene = import.meta.env.DEV ? previewParams.get('scene') : null;
    if (previewScene === 'cave') {
      this.scene.start('CaveScene', {
        previewX: Number(previewParams.get('x')) || undefined,
        previewLight: previewParams.get('light') === '1',
      });
    } else if (previewScene === 'well') {
      this.scene.start('WellTransitionScene', { entryX: 160 });
    } else if (previewScene === 'surface') {
      this.scene.start('SurfaceScene', {
        skipIntro: true,
        previewX: Number(previewParams.get('x')) || undefined,
        previewWater: previewParams.get('water') === '1',
      });
    } else {
      this.scene.start('SurfaceScene');
    }
  }

  private createPlayerTextures(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    const frames: Array<{ key: string; pose: 'idle' | 'turn' | 'run' | 'jump' | 'fall' | 'land' | 'dizzy'; index: number }> = [
      { key: 'player-idle-0', pose: 'idle', index: 0 },
      { key: 'player-idle-1', pose: 'idle', index: 1 },
      { key: 'player-turn-0', pose: 'turn', index: 0 },
      { key: 'player-turn-1', pose: 'turn', index: 1 },
      { key: 'player-turn-2', pose: 'turn', index: 2 },
      { key: 'player-run-0', pose: 'run', index: 0 },
      { key: 'player-run-1', pose: 'run', index: 1 },
      { key: 'player-run-2', pose: 'run', index: 2 },
      { key: 'player-run-3', pose: 'run', index: 3 },
      { key: 'player-run-4', pose: 'run', index: 4 },
      { key: 'player-run-5', pose: 'run', index: 5 },
      { key: 'player-jump', pose: 'jump', index: 0 },
      { key: 'player-fall', pose: 'fall', index: 0 },
      { key: 'player-land', pose: 'land', index: 0 },
      { key: 'player-dizzy-0', pose: 'dizzy', index: 0 },
      { key: 'player-dizzy-1', pose: 'dizzy', index: 1 },
    ];

    frames.forEach(({ key, pose, index }) => {
      graphics.clear();
      this.drawRabbit(graphics, pose, index);
      graphics.generateTexture(key, 25, 18);
    });
    graphics.destroy();
  }

  private drawRabbit(
    graphics: Phaser.GameObjects.Graphics,
    pose: 'idle' | 'turn' | 'run' | 'jump' | 'fall' | 'land' | 'dizzy',
    index: number,
  ): void {
    if (pose === 'run') {
      this.drawRunningRabbit(graphics, index);
      return;
    }
    if (pose === 'turn') {
      this.drawTurningRabbit(graphics, index);
      return;
    }

    const bob = pose === 'idle' && index === 1 ? 1 : 0;
    const compressed = pose === 'land';
    const airborne = pose === 'jump' || pose === 'fall';
    const bodyY = compressed ? 9 : 7 + bob;
    const bellyY = compressed ? 13 : 14 + bob;

    // A low, four-footed silhouette. The nearly-black outline keeps the rabbit
    // readable as a creature without turning it into a bright mascot.
    const bodyHeight = compressed ? 7 : 9;
    const innerBodyHeight = compressed ? 5 : 7;
    graphics.fillStyle(0x020207, 1);
    // Stepped corners shorten the rump and keep it round at native pixel size.
    graphics.fillRect(5, bodyY - 1, 14, 1);
    graphics.fillRect(4, bodyY, 15, bodyHeight - 2);
    graphics.fillRect(5, bodyY + bodyHeight - 2, 14, 1);
    graphics.fillRect(17, bodyY - 3, 7, compressed ? 7 : 9);
    if (pose === 'jump') {
      graphics.fillRect(15, 3, 6, 2);
      graphics.fillRect(16, 1, 6, 2);
    } else if (pose === 'fall') {
      graphics.fillRect(18, 0, 2, 7);
      graphics.fillRect(21, 1, 2, 6);
    } else {
      graphics.fillRect(18, 1 + bob, 2, 6);
      graphics.fillRect(index === 1 ? 20 : 21, index === 1 ? 1 : 2, 2, index === 1 ? 6 : 5);
    }
    graphics.fillRect(2, bodyY + 1, 3, 1);
    graphics.fillRect(1, bodyY + 2, 4, 2);
    graphics.fillRect(2, bodyY + 4, 3, 1);

    graphics.fillStyle(0x12091c, 1);
    graphics.fillRect(6, bodyY, 12, 1);
    graphics.fillRect(5, bodyY + 1, 13, innerBodyHeight - 2);
    graphics.fillRect(6, bodyY + innerBodyHeight - 1, 12, 1);
    graphics.fillRect(18, bodyY - 2, 5, compressed ? 5 : 7);
    if (pose === 'jump') {
      graphics.fillRect(16, 4, 5, 1);
      graphics.fillRect(17, 2, 5, 1);
    } else {
      graphics.fillRect(19, 2 + bob, 1, 5);
      graphics.fillRect(index === 1 ? 21 : 22, 2 + bob, 1, 5);
    }
    graphics.fillStyle(0x281237, 1);
    graphics.fillRect(7, bodyY + 1, 9, 3);
    graphics.fillRect(19, bodyY - 1, 3, 2);
    graphics.fillStyle(pose === 'dizzy' ? 0xc9a64b : 0x82c9c7, 1);
    graphics.fillRect(22, bodyY, 1, 1);

    graphics.fillStyle(0x06030c, 1);
    if (airborne) {
      const tucked = pose === 'jump';
      graphics.fillRect(tucked ? 4 : 3, tucked ? 13 : 14, 5, 2);
      graphics.fillRect(tucked ? 10 : 9, tucked ? 14 : 15, 4, 2);
      graphics.fillRect(tucked ? 16 : 17, tucked ? 13 : 14, 3, 2);
      graphics.fillRect(tucked ? 20 : 21, tucked ? 12 : 15, 3, 2);
    } else {
      [5, 9, 16, 21].forEach((x) => {
        graphics.fillRect(x, bellyY, 2, compressed ? 2 : 3);
        graphics.fillRect(x - 1, 16, 4, 1);
      });
    }

    if (pose === 'dizzy') {
      graphics.fillStyle(0x38253f, 1);
      graphics.fillRect(index === 0 ? 2 : 3, bodyY + 2, 2, 1);
    }
  }

  private drawTurningRabbit(graphics: Phaser.GameObjects.Graphics, index: number): void {
    // The silhouette narrows toward a head-on pose. Player flips the texture at
    // the middle frame, so the same artwork opens naturally into either side.
    const bodyX = [5, 7, 8][index] ?? 5;
    const bodyWidth = [14, 11, 9][index] ?? 14;
    const headX = [16, 14, 10][index] ?? 16;
    const headWidth = [7, 7, 6][index] ?? 7;
    const bodyY = index === 0 ? 8 : 9;

    graphics.fillStyle(0x020207, 1);
    graphics.fillRect(bodyX, bodyY - 1, bodyWidth, 1);
    graphics.fillRect(bodyX - 1, bodyY, bodyWidth + 2, 6);
    graphics.fillRect(bodyX, bodyY + 6, bodyWidth, 1);
    graphics.fillRect(headX, 6, headWidth, 7);

    if (index === 0) {
      graphics.fillRect(16, 2, 3, 5);
      graphics.fillRect(19, 1, 3, 6);
      graphics.fillRect(2, 10, 4, 3);
    } else if (index === 1) {
      graphics.fillRect(14, 1, 3, 6);
      graphics.fillRect(18, 1, 3, 6);
      graphics.fillRect(5, 10, 3, 3);
    } else {
      graphics.fillRect(10, 1, 2, 6);
      graphics.fillRect(14, 1, 2, 6);
      graphics.fillRect(7, 10, 2, 3);
      graphics.fillRect(17, 10, 2, 3);
    }

    graphics.fillStyle(0x12091c, 1);
    graphics.fillRect(bodyX, bodyY, bodyWidth, 5);
    graphics.fillRect(bodyX + 1, bodyY + 5, Math.max(1, bodyWidth - 2), 1);
    graphics.fillRect(headX + 1, 7, Math.max(1, headWidth - 2), 5);
    graphics.fillStyle(0x281237, 1);
    graphics.fillRect(bodyX + 2, bodyY + 1, Math.max(2, bodyWidth - 5), 3);

    graphics.fillStyle(0x82c9c7, 1);
    if (index < 2) {
      graphics.fillRect(headX + headWidth - 2, 8, 1, 1);
    } else {
      graphics.fillRect(11, 8, 1, 1);
      graphics.fillRect(14, 8, 1, 1);
    }

    // Four compact paws shift inward as the rabbit pivots toward the camera.
    const pawStarts = index === 0 ? [4, 8, 16, 20] : index === 1 ? [6, 9, 15, 18] : [7, 10, 14, 17];
    graphics.fillStyle(0x080310, 1);
    pawStarts.forEach((x, pawIndex) => {
      const lift = index === 1 && (pawIndex === 0 || pawIndex === 3) ? 1 : 0;
      graphics.fillRect(x, 14 - lift, 2, 2);
      graphics.fillRect(x - 1, 16 - lift, 4, 1);
    });
  }

  private drawRunningRabbit(graphics: Phaser.GameObjects.Graphics, index: number): void {
    interface GallopFrame {
      bodyX: number;
      bodyY: number;
      bodyWidth: number;
      headY: number;
      tailY: number;
      earPose: 'upright' | 'back' | 'flat' | 'rebound';
      legs: Array<{
        upperX: number;
        upperY: number;
        jointX: number;
        jointY: number;
        pawX: number;
        pawY: number;
        far: boolean;
      }>;
    }

    // Contact → push → full flight → tuck → front landing → recovery.
    // Separating near/far legs by one shade keeps all four readable in profile.
    const frames: GallopFrame[] = [
      {
        bodyX: 4, bodyY: 8, bodyWidth: 15, headY: 6, tailY: 9, earPose: 'upright',
        legs: [
          { upperX: 4, upperY: 13, jointX: 3, jointY: 14, pawX: 1, pawY: 16, far: false },
          { upperX: 8, upperY: 13, jointX: 8, jointY: 15, pawX: 7, pawY: 16, far: true },
          { upperX: 16, upperY: 13, jointX: 16, jointY: 15, pawX: 15, pawY: 16, far: true },
          { upperX: 20, upperY: 13, jointX: 21, jointY: 14, pawX: 21, pawY: 16, far: false },
        ],
      },
      {
        bodyX: 5, bodyY: 7, bodyWidth: 14, headY: 5, tailY: 8, earPose: 'back',
        legs: [
          { upperX: 5, upperY: 12, jointX: 2, jointY: 13, pawX: 0, pawY: 15, far: false },
          { upperX: 8, upperY: 12, jointX: 6, jointY: 14, pawX: 4, pawY: 16, far: true },
          { upperX: 17, upperY: 12, jointX: 19, jointY: 13, pawX: 20, pawY: 14, far: true },
          { upperX: 20, upperY: 11, jointX: 22, jointY: 12, pawX: 21, pawY: 13, far: false },
        ],
      },
      {
        bodyX: 5, bodyY: 6, bodyWidth: 15, headY: 4, tailY: 7, earPose: 'flat',
        legs: [
          { upperX: 5, upperY: 11, jointX: 2, jointY: 11, pawX: 0, pawY: 12, far: false },
          { upperX: 8, upperY: 11, jointX: 5, jointY: 12, pawX: 2, pawY: 13, far: true },
          { upperX: 18, upperY: 10, jointX: 21, jointY: 10, pawX: 21, pawY: 11, far: true },
          { upperX: 20, upperY: 9, jointX: 22, jointY: 9, pawX: 21, pawY: 10, far: false },
        ],
      },
      {
        bodyX: 6, bodyY: 6, bodyWidth: 13, headY: 5, tailY: 7, earPose: 'back',
        legs: [
          { upperX: 7, upperY: 11, jointX: 8, jointY: 12, pawX: 7, pawY: 13, far: false },
          { upperX: 10, upperY: 11, jointX: 10, jointY: 13, pawX: 8, pawY: 14, far: true },
          { upperX: 15, upperY: 11, jointX: 15, jointY: 13, pawX: 14, pawY: 14, far: true },
          { upperX: 18, upperY: 11, jointX: 17, jointY: 12, pawX: 16, pawY: 13, far: false },
        ],
      },
      {
        bodyX: 5, bodyY: 7, bodyWidth: 14, headY: 5, tailY: 8, earPose: 'rebound',
        legs: [
          { upperX: 6, upperY: 12, jointX: 5, jointY: 13, pawX: 3, pawY: 14, far: true },
          { upperX: 9, upperY: 12, jointX: 8, jointY: 14, pawX: 7, pawY: 15, far: false },
          { upperX: 18, upperY: 12, jointX: 20, jointY: 14, pawX: 20, pawY: 16, far: true },
          { upperX: 21, upperY: 12, jointX: 22, jointY: 14, pawX: 21, pawY: 16, far: false },
        ],
      },
      {
        bodyX: 4, bodyY: 8, bodyWidth: 15, headY: 6, tailY: 8, earPose: 'upright',
        legs: [
          { upperX: 4, upperY: 13, jointX: 2, jointY: 15, pawX: 0, pawY: 16, far: true },
          { upperX: 8, upperY: 13, jointX: 6, jointY: 15, pawX: 5, pawY: 16, far: false },
          { upperX: 17, upperY: 13, jointX: 18, jointY: 14, pawX: 17, pawY: 15, far: false },
          { upperX: 21, upperY: 12, jointX: 22, jointY: 13, pawX: 21, pawY: 14, far: true },
        ],
      },
    ];
    const frame = frames[index % frames.length] ?? frames[0];
    if (!frame) return;

    this.drawRunningEars(graphics, frame.earPose, frame.headY);

    // Far-side legs render behind the torso.
    frame.legs.filter((leg) => leg.far).forEach((leg) => this.drawGallopLeg(graphics, leg, 0x3a194b));

    graphics.fillStyle(0x020207, 1);
    graphics.fillRect(frame.bodyX, frame.bodyY - 1, frame.bodyWidth, 1);
    graphics.fillRect(frame.bodyX - 1, frame.bodyY, frame.bodyWidth + 1, 7);
    graphics.fillRect(frame.bodyX, frame.bodyY + 7, frame.bodyWidth, 1);
    graphics.fillRect(17, frame.headY, 7, 8);
    graphics.fillRect(2, frame.tailY, 3, 1);
    graphics.fillRect(1, frame.tailY + 1, 4, 2);
    graphics.fillRect(2, frame.tailY + 3, 3, 1);
    graphics.fillStyle(0x11091b, 1);
    graphics.fillRect(frame.bodyX + 1, frame.bodyY, frame.bodyWidth - 2, 1);
    graphics.fillRect(frame.bodyX, frame.bodyY + 1, frame.bodyWidth, 5);
    graphics.fillRect(frame.bodyX + 1, frame.bodyY + 6, frame.bodyWidth - 2, 1);
    graphics.fillRect(18, frame.headY + 1, 5, 6);
    graphics.fillRect(2, frame.tailY + 1, 2, 2);
    graphics.fillStyle(0x271137, 1);
    graphics.fillRect(frame.bodyX + 3, frame.bodyY + 1, frame.bodyWidth - 5, 3);
    graphics.fillRect(19, frame.headY + 2, 3, 2);
    graphics.fillStyle(0x82c9c7, 1);
    graphics.fillRect(22, frame.headY + 2, 1, 1);

    // Near-side legs finish the silhouette and visibly cross the far pair.
    frame.legs.filter((leg) => !leg.far).forEach((leg) => this.drawGallopLeg(graphics, leg, 0x210c2d));
  }

  private drawRunningEars(
    graphics: Phaser.GameObjects.Graphics,
    pose: 'upright' | 'back' | 'flat' | 'rebound',
    headY: number,
  ): void {
    graphics.fillStyle(0x020207, 1);
    if (pose === 'upright') {
      graphics.fillRect(18, headY - 5, 2, 6);
      graphics.fillRect(21, headY - 4, 2, 5);
      graphics.fillStyle(0x29123a, 1).fillRect(19, headY - 4, 1, 4).fillRect(22, headY - 3, 1, 3);
    } else if (pose === 'rebound') {
      graphics.fillRect(17, headY - 4, 3, 5);
      graphics.fillRect(20, headY - 6, 2, 7);
      graphics.fillStyle(0x29123a, 1).fillRect(18, headY - 3, 1, 3).fillRect(21, headY - 5, 1, 5);
    } else if (pose === 'back') {
      graphics.fillRect(14, headY - 3, 7, 2);
      graphics.fillRect(12, headY - 1, 8, 2);
      graphics.fillStyle(0x29123a, 1).fillRect(15, headY - 2, 5, 1).fillRect(13, headY, 6, 1);
    } else {
      graphics.fillRect(11, headY - 2, 10, 2);
      graphics.fillRect(13, headY, 8, 2);
      graphics.fillStyle(0x29123a, 1).fillRect(12, headY - 1, 8, 1).fillRect(14, headY + 1, 6, 1);
    }
  }

  private drawGallopLeg(
    graphics: Phaser.GameObjects.Graphics,
    leg: { upperX: number; upperY: number; jointX: number; jointY: number; pawX: number; pawY: number },
    color: number,
  ): void {
    graphics.fillStyle(color, 1);
    graphics.fillRect(leg.upperX, leg.upperY, 3, 2);
    graphics.fillRect(leg.jointX, leg.jointY, 2, 2);
    graphics.fillRect(leg.pawX, leg.pawY, 4, 1);
  }

  private createWorldTextures(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    const solid = (key: string, color: number, width: number, height: number): void => {
      graphics.clear().fillStyle(color, 1).fillRect(0, 0, width, height).generateTexture(key, width, height);
    };
    solid('pixel-white', 0xdde5df, 2, 2);
    solid('pixel-red', 0x8e302c, 3, 3);
    solid('pixel-red-dark', 0x531f20, 3, 2);
    solid('pixel-rust', 0x68412c, 2, 2);
    solid('pixel-water', 0x3f7288, 2, 3);
    solid('pixel-water-bright', 0x82bbc2, 2, 2);
    solid('pixel-gold', 0xd4aa4c, 2, 2);
    solid('pixel-ember', 0x8f532e, 1, 2);
    solid('pixel-dust', 0x5b5247, 2, 2);
    solid('pixel-star', 0xaeb7bb, 1, 1);

    graphics.clear();
    graphics.fillStyle(0xaeb7bb, 1).fillRect(1, 0, 1, 3).fillRect(0, 1, 3, 1);
    graphics.fillStyle(0xe1ded2, 1).fillRect(1, 1, 1, 1);
    graphics.generateTexture('pixel-star-cross', 3, 3);

    graphics.clear();
    graphics.fillStyle(0x315d70, 0.75).fillRect(1, 2, 14, 1);
    graphics.fillStyle(0x78abb6, 0.9).fillRect(4, 1, 8, 1);
    graphics.fillStyle(0x142f3e, 0.65).fillRect(4, 3, 8, 1);
    graphics.generateTexture('water-ripple', 16, 4);

    graphics.clear();
    graphics.fillStyle(0x15171a, 1).fillRect(0, 0, 16, 8);
    graphics.fillStyle(0x596063, 1).fillRect(0, 0, 16, 2);
    graphics.fillStyle(0x343a3d, 1).fillRect(1, 2, 14, 2);
    graphics.fillStyle(0x24282c, 1).fillRect(2, 4, 13, 3);
    graphics.fillStyle(0x747a76, 1).fillRect(2, 0, 4, 1).fillRect(11, 1, 3, 1);
    graphics.fillStyle(0x0a0c0e, 1).fillRect(6, 3, 1, 3).fillRect(7, 5, 3, 1);
    graphics.generateTexture('platform', 16, 8);

    graphics.clear();
    graphics.fillStyle(0x171a1c, 1).fillRect(0, 7, 8, 1);
    graphics.fillStyle(0x687074, 1).fillTriangle(0, 7, 2, 0, 4, 7);
    graphics.fillStyle(0x3d4549, 1).fillTriangle(4, 7, 6, 2, 8, 7);
    graphics.fillStyle(0x9aa09b, 1).fillRect(2, 2, 1, 3);
    graphics.generateTexture('spike', 8, 8);

    for (let frame = 0; frame < 2; frame += 1) {
      graphics.clear();
      graphics.fillStyle(0x17191e, 1).fillRect(4, 5, 32, 7);
      graphics.fillStyle(0x242731, 1).fillRect(9, 2 + frame, 17, 8);
      graphics.fillStyle(0x31353d, 1).fillRect(14, 0 + frame, 13, 6);
      graphics.fillStyle(0x3c4149, 1).fillRect(20, 4 + frame, 19, 7);
      graphics.fillStyle(0x20232b, 1).fillRect(2, 8, 40, 4);
      graphics.fillStyle(0x555962, 0.8).fillRect(11, 3 + frame, 12, 1).fillRect(23, 6 + frame, 12, 1);
      graphics.generateTexture(`cloud-${frame}`, 42, 13);
    }

    for (let frame = 0; frame < 4; frame += 1) {
      graphics.clear();
      graphics.fillStyle(0x08080c, 1).fillRect(0, 3, 16, 9);
      graphics.fillStyle(0x614a69, 1).fillRect(2, 4, 12, 7);
      graphics.fillStyle(0x17121a, 1).fillRect(4, 5, 8, 4);
      graphics.fillStyle(0xb08c50, 1).fillRect(3 + (frame % 2), 3, 3, 1);
      graphics.fillStyle(0x8ca3a0, 1).fillRect(12, 5 + (frame % 2), 1, 3);
      graphics.generateTexture(`cassette-${frame}`, 16, 13);
    }

    for (let frame = 0; frame < 3; frame += 1) {
      graphics.clear();
      const squash = frame * 2;
      const top = 2 + squash;
      // Stepped dome, cap nut, side nozzles, barrel and bolted foot make the
      // silhouette unmistakably read as an old fire hydrant at 320x180.
      graphics.fillStyle(0x251215, 1).fillRect(9, top, 7, 3);
      graphics.fillStyle(0x51201f, 1).fillRect(10, top - 1, 5, 2);
      graphics.fillStyle(0x351719, 1).fillRect(5, top + 3, 15, 2);
      graphics.fillStyle(0x7d2b29, 1).fillRect(3, top + 5, 19, 3);
      graphics.fillStyle(0x9a3931, 1).fillRect(5, top + 4, 15, 2);
      graphics.fillStyle(0x301719, 1).fillRect(6, top + 8, 13, 15 - squash);
      graphics.fillStyle(0x702725, 1).fillRect(7, top + 8, 11, 14 - squash);
      graphics.fillStyle(0x9b3930, 1).fillRect(8, top + 9, 3, 10 - squash);
      graphics.fillStyle(0x2c1718, 1).fillRect(0, top + 9, 7, 8).fillRect(18, top + 9, 7, 8);
      graphics.fillStyle(0x82302b, 1).fillRect(1, top + 10, 6, 6).fillRect(18, top + 10, 6, 6);
      graphics.fillStyle(0x3a2020, 1).fillRect(0, top + 12, 3, 2).fillRect(22, top + 12, 3, 2);
      graphics.fillStyle(0x9c4932, 1).fillRect(3, top + 11, 2, 3).fillRect(20, top + 11, 2, 3);
      graphics.fillStyle(0x351a1a, 1).fillRect(4, 26, 17, 2);
      graphics.fillStyle(0x6b2926, 1).fillRect(2, 24, 21, 3);
      graphics.fillStyle(0x8e3a2e, 1).fillRect(6, 23, 13, 2);
      graphics.fillStyle(0x5d3c29, 1).fillRect(14, top + 7, 3, 2).fillRect(7, top + 17, 4, 2);
      graphics.fillStyle(0xb0643d, 1).fillRect(9, top + 5, 5, 1).fillRect(8, top + 10, 1, 5);
      graphics.generateTexture(`hydrant-${frame}`, 25, 29);
    }

    graphics.clear();
    graphics.fillStyle(0x6f6657, 1).fillRect(3, 6, 3, 7);
    graphics.fillStyle(0x342e28, 1).fillRect(2, 11, 5, 2);
    graphics.generateTexture('candle-off', 9, 14);
    const flameColors = [0xd4a542, 0xf0c866, 0xb57931];
    flameColors.forEach((color, frame) => {
      graphics.clear();
      graphics.fillStyle(0x6f6657, 1).fillRect(3, 6, 3, 7);
      graphics.fillStyle(0x342e28, 1).fillRect(2, 11, 5, 2);
      graphics.fillStyle(color, 1).fillRect(frame === 1 ? 3 : 4, 1, 2, 5);
      graphics.fillStyle(0xffe5a1, 1).fillRect(4, frame === 2 ? 3 : 2, 1, 2);
      graphics.generateTexture(`candle-lit-${frame}`, 9, 14);
    });

    graphics.clear();
    graphics.fillStyle(0x33281b, 1).fillRect(0, 2, 23, 14);
    graphics.fillStyle(0xb88a38, 1).fillRect(1, 1, 21, 14);
    graphics.fillStyle(0x17131a, 1).fillRect(3, 3, 17, 10);
    graphics.fillStyle(0xe3c271, 1).fillRect(5, 5, 9, 1).fillRect(5, 8, 12, 1);
    graphics.generateTexture('world-card', 23, 16);
    this.createBatTextures(graphics);
    this.createPigeonTextures(graphics);
    graphics.destroy();
  }

  private createPigeonTextures(graphics: Phaser.GameObjects.Graphics): void {
    const outline = 0x25262b;
    const shadow = 0xaeb1ae;
    const white = 0xe8e7df;
    const highlight = 0xf7f3e8;
    const beak = 0xb98755;
    const foot = 0x9a6658;

    const drawGroundBody = (): void => {
      graphics.fillStyle(outline, 1)
        .fillRect(3, 5, 8, 5)
        .fillRect(2, 6, 2, 3)
        .fillRect(1, 7, 2, 2);
      graphics.fillStyle(white, 1).fillRect(4, 5, 6, 4).fillRect(3, 6, 2, 3);
      graphics.fillStyle(shadow, 1).fillRect(4, 7, 5, 3);
      graphics.fillStyle(highlight, 1).fillRect(5, 5, 4, 1);
    };

    const drawFeet = (lift = 0): void => {
      graphics.fillStyle(foot, 1)
        .fillRect(5, 10 - lift, 1, 2)
        .fillRect(8, 10 - lift, 1, 2)
        .fillRect(4, 11 - lift, 3, 1)
        .fillRect(7, 11 - lift, 3, 1);
    };

    graphics.clear();
    drawGroundBody();
    graphics.fillStyle(outline, 1).fillRect(9, 3, 4, 4).fillRect(8, 4, 3, 3);
    graphics.fillStyle(white, 1).fillRect(9, 4, 3, 3).fillRect(10, 3, 2, 1);
    graphics.fillStyle(0x111217, 1).fillRect(11, 4, 1, 1);
    graphics.fillStyle(beak, 1).fillRect(13, 5, 2, 1);
    drawFeet();
    graphics.generateTexture('pigeon-idle', 16, 12);

    graphics.clear();
    drawGroundBody();
    graphics.fillStyle(outline, 1).fillRect(9, 5, 4, 4).fillRect(8, 5, 2, 3);
    graphics.fillStyle(white, 1).fillRect(10, 6, 3, 3);
    graphics.fillStyle(0x111217, 1).fillRect(12, 7, 1, 1);
    graphics.fillStyle(beak, 1).fillRect(13, 8, 2, 1);
    drawFeet();
    graphics.generateTexture('pigeon-peck-0', 16, 12);

    graphics.clear();
    drawGroundBody();
    graphics.fillStyle(outline, 1).fillRect(10, 7, 4, 3).fillRect(9, 6, 2, 3);
    graphics.fillStyle(white, 1).fillRect(11, 7, 3, 2);
    graphics.fillStyle(0x111217, 1).fillRect(13, 7, 1, 1);
    graphics.fillStyle(beak, 1).fillRect(14, 9, 2, 1);
    drawFeet();
    graphics.generateTexture('pigeon-peck-1', 16, 12);

    graphics.clear();
    drawGroundBody();
    graphics.fillStyle(outline, 1).fillRect(9, 1, 4, 5).fillRect(8, 3, 3, 4);
    graphics.fillStyle(white, 1).fillRect(10, 2, 3, 4).fillRect(9, 4, 2, 2);
    graphics.fillStyle(highlight, 1).fillRect(10, 1, 2, 1);
    graphics.fillStyle(0x111217, 1).fillRect(11, 2, 1, 1);
    graphics.fillStyle(beak, 1).fillRect(13, 3, 2, 1);
    drawFeet();
    graphics.generateTexture('pigeon-alert', 16, 12);

    graphics.clear();
    drawGroundBody();
    graphics.fillStyle(outline, 1).fillRect(9, 3, 4, 4).fillRect(7, 3, 4, 3);
    graphics.fillStyle(white, 1).fillRect(9, 4, 3, 3);
    graphics.fillStyle(highlight, 1).fillRect(6, 3, 4, 1);
    graphics.fillStyle(0x111217, 1).fillRect(11, 4, 1, 1);
    graphics.fillStyle(beak, 1).fillRect(13, 5, 2, 1);
    drawFeet(1);
    graphics.generateTexture('pigeon-hop', 16, 12);

    for (let frame = 0; frame < 3; frame += 1) {
      graphics.clear();
      graphics.fillStyle(outline, 1)
        .fillRect(4, 5, 8, 5)
        .fillRect(2, 6, 3, 3)
        .fillRect(11, 4, 4, 4);
      graphics.fillStyle(white, 1)
        .fillRect(5, 6, 7, 3)
        .fillRect(12, 5, 3, 3)
        .fillRect(3, 7, 3, 2);
      graphics.fillStyle(shadow, 1).fillRect(5, 8, 6, 2);
      if (frame === 0) {
        graphics.fillStyle(outline, 1).fillRect(5, 0, 3, 7).fillRect(8, 2, 3, 5);
        graphics.fillStyle(highlight, 1).fillRect(6, 1, 1, 5).fillRect(8, 3, 2, 3);
      } else if (frame === 1) {
        graphics.fillStyle(outline, 1).fillRect(4, 3, 8, 4).fillRect(2, 4, 5, 3);
        graphics.fillStyle(highlight, 1).fillRect(3, 4, 7, 1).fillRect(5, 5, 5, 1);
      } else {
        graphics.fillStyle(outline, 1).fillRect(5, 7, 3, 5).fillRect(8, 8, 3, 4);
        graphics.fillStyle(highlight, 1).fillRect(6, 8, 1, 3).fillRect(8, 9, 2, 2);
      }
      graphics.fillStyle(0x111217, 1).fillRect(13, 5, 1, 1);
      graphics.fillStyle(beak, 1).fillRect(15, 6, 1, 1);
      graphics.generateTexture(`pigeon-fly-${frame}`, 16, 12);
    }
  }

  private createBatTextures(graphics: Phaser.GameObjects.Graphics): void {
    const outline = 0x050609;
    const body = 0x111218;
    const wing = 0x1a151b;
    const wingEdge = 0x292029;
    const eyeColors = {
      yellow: 0x8d742d,
      red: 0x772925,
    } as const;

    (Object.keys(eyeColors) as Array<keyof typeof eyeColors>).forEach((eyeColor) => {
      for (let frame = 0; frame < 2; frame += 1) {
        graphics.clear();
        graphics.fillStyle(outline, 1)
          .fillRect(4, 0, 2, 3)
          .fillRect(9, 0, 2, 3)
          .fillRect(3, 2, 9, 7)
          .fillRect(1, 3 + frame, 4, 6)
          .fillRect(10, 3 + frame, 4, 6)
          .fillRect(5, 7, 5, 5);
        graphics.fillStyle(body, 1)
          .fillRect(5, 2, 5, 7 + frame)
          .fillRect(6, 8, 3, 3);
        graphics.fillStyle(wing, 1)
          .fillRect(2, 4 + frame, 3, 4)
          .fillRect(10, 4 + frame, 3, 4)
          .fillRect(3, 3 + frame, 3, 2)
          .fillRect(9, 3 + frame, 3, 2);
        graphics.fillStyle(wingEdge, 0.82)
          .fillRect(2, 5 + frame, 1, 3)
          .fillRect(12, 5 + frame, 1, 3)
          .fillRect(4, 4 + frame, 1, 3)
          .fillRect(10, 4 + frame, 1, 3);
        graphics.fillStyle(outline, 1)
          .fillTriangle(5, 8, 6, 11, 7, 8)
          .fillTriangle(8, 8, 9, 11, 10, 8);
        graphics.fillStyle(eyeColors[eyeColor], 1)
          .fillRect(6, 9 + frame, 1, 1)
          .fillRect(9, 9 + frame, 1, 1);
        graphics.generateTexture(`bat-hanging-${eyeColor}-${frame}`, 15, 12);
      }

      graphics.clear();
      graphics.fillStyle(outline, 1)
        .fillRect(4, 0, 2, 3)
        .fillRect(9, 0, 2, 3)
        .fillRect(3, 2, 9, 7)
        .fillRect(1, 3, 4, 6)
        .fillRect(10, 3, 4, 6)
        .fillRect(5, 7, 5, 5);
      graphics.fillStyle(body, 1).fillRect(5, 2, 5, 8).fillRect(6, 8, 3, 3);
      graphics.fillStyle(wing, 1)
        .fillRect(2, 4, 3, 4)
        .fillRect(10, 4, 3, 4)
        .fillRect(3, 3, 3, 2)
        .fillRect(9, 3, 3, 2);
      graphics.fillStyle(wingEdge, 0.82)
        .fillRect(2, 5, 1, 3)
        .fillRect(12, 5, 1, 3)
        .fillRect(4, 4, 1, 3)
        .fillRect(10, 4, 1, 3);
      graphics.fillStyle(outline, 1)
        .fillTriangle(5, 8, 6, 11, 7, 8)
        .fillTriangle(8, 8, 9, 11, 10, 8);
      graphics.fillStyle(eyeColors[eyeColor], 0.42)
        .fillRect(6, 10, 1, 1)
        .fillRect(9, 10, 1, 1);
      graphics.generateTexture(`bat-hanging-${eyeColor}-blink`, 15, 12);
    });
  }

  private createOrganicLightTexture(): void {
    const size = 96;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) return;
    const image = context.createImageData(size, size);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const dx = x - size / 2;
        const dy = y - size / 2;
        const angle = Math.atan2(dy, dx);
        const irregularRadius = 43 + Math.sin(angle * 5) * 3 + Math.sin(angle * 9 + 1.7) * 2;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const noise = ((x * 17 + y * 31) % 13) / 13;
        const strength = Phaser.Math.Clamp(1 - distance / irregularRadius, 0, 1) ** 1.8;
        const offset = (y * size + x) * 4;
        image.data[offset] = 77;
        image.data[offset + 1] = 189;
        image.data[offset + 2] = 184;
        image.data[offset + 3] = Math.round(255 * strength * (0.82 + noise * 0.18));
      }
    }
    context.putImageData(image, 0, 0);
    this.textures.addCanvas('organic-light', canvas);
    this.createWarmLightTexture();
  }

  private createWarmLightTexture(): void {
    const size = 96;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) return;
    const image = context.createImageData(size, size);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const dx = x - size / 2;
        const dy = y - size / 2;
        const angle = Math.atan2(dy, dx);
        const irregularRadius = 42 + Math.sin(angle * 4 + 0.8) * 4 + Math.sin(angle * 7) * 2;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const strength = Phaser.Math.Clamp(1 - distance / irregularRadius, 0, 1) ** 1.7;
        const offset = (y * size + x) * 4;
        image.data[offset] = 255;
        image.data[offset + 1] = 166;
        image.data[offset + 2] = 62;
        image.data[offset + 3] = Math.round(255 * strength);
      }
    }
    context.putImageData(image, 0, 0);
    this.textures.addCanvas('warm-light', canvas);
  }
}
