import Phaser from 'phaser';
import { CAVE, CAMERA_CONFIG, GameState, HAZARD_CONFIG, PLAYER_CONFIG } from '../config/constants';
import { Candle } from '../entities/Candle';
import { ClockAltar } from '../entities/ClockAltar';
import { FinalCard } from '../entities/FinalCard';
import { Player } from '../entities/Player';
import { AudioSystem } from '../systems/AudioSystem';
import { CameraEffects } from '../systems/CameraEffects';
import { CardSystem } from '../systems/CardSystem';
import { CRTSystem } from '../systems/CRTSystem';
import { LightingSystem } from '../systems/LightingSystem';
import { ParticleSystem } from '../systems/ParticleSystem';

const CAVE_LANDING_DIZZY_MS = 1900;

interface CaveSceneData {
  fromWell?: boolean;
  previewX?: number;
  previewLight?: boolean;
  previewAltarReady?: boolean;
  previewAltarReveal?: boolean;
}

interface DripSource {
  x: number;
  y: number;
  delay: number;
}

type BatEyeColor = 'yellow' | 'red';

interface HangingBat {
  sprite: Phaser.GameObjects.Sprite;
  eyeColor: BatEyeColor;
  phase: number;
  index: number;
  blinkCount: number;
  blinkUntil: number;
  nextBlinkAt: number;
}

interface SpikeWarning {
  glints: Phaser.GameObjects.Image[];
  sparks: Phaser.GameObjects.Image[];
  phase: number;
}

export class CaveScene extends Phaser.Scene {
  private state = GameState.CAVE_LANDING;
  private player!: Player;
  private candles: Candle[] = [];
  private finalCard!: FinalCard;
  private particles!: ParticleSystem;
  private lighting!: LightingSystem;
  private cardSystem!: CardSystem;
  private cameraEffects!: CameraEffects;
  private crt!: CRTSystem;
  private clockAltar!: ClockAltar;
  private spikes!: Phaser.Physics.Arcade.StaticGroup;
  private spikeWarnings: SpikeWarning[] = [];
  private hangingBats: HangingBat[] = [];
  private landed = false;
  private fromWell = false;
  private dizzyStars!: Phaser.GameObjects.Container;
  private respawnPoint = new Phaser.Math.Vector2(58, CAVE.floorY - 4);
  private nextSafeSampleAt = 0;
  private startX = 58;
  private previewLight = false;
  private previewAltarReady = false;
  private previewAltarReveal = false;
  private finalCardCollected = false;
  private altarPassageArmed = false;
  private altarRoomRevealed = false;
  private offscreenWalkMs = 0;
  private offscreenAutoWalk = false;

  public constructor() {
    super('CaveScene');
  }

  public init(data: CaveSceneData): void {
    this.fromWell = data.fromWell ?? false;
    this.startX = data.previewX ?? 58;
    this.previewLight = data.previewLight ?? false;
    this.previewAltarReady = data.previewAltarReady ?? false;
    this.previewAltarReveal = data.previewAltarReveal ?? false;
  }

  public create(): void {
    this.state = GameState.CAVE_LANDING;
    this.landed = false;
    this.finalCardCollected = this.previewAltarReady || this.previewAltarReveal;
    this.altarPassageArmed = false;
    this.altarRoomRevealed = false;
    this.offscreenWalkMs = 0;
    this.offscreenAutoWalk = false;
    this.respawnPoint.set(this.startX, CAVE.floorY - 4);
    this.crt = new CRTSystem();
    this.crt.reset();
    this.cardSystem = new CardSystem();
    this.cameraEffects = new CameraEffects(this.cameras.main);
    this.particles = new ParticleSystem(this, 180);
    this.lighting = new LightingSystem(this);

    this.physics.world.setBounds(0, 0, CAVE.width, 230);
    this.cameras.main.setBounds(0, 0, CAVE.width, 180).setRoundPixels(true);
    this.drawCaveWorld();
    this.hangingBats = this.createHangingBats();
    const platforms = this.createPlatforms();
    this.spikes = this.createSpikes();
    this.spikeWarnings = this.createSpikeWarnings();

    this.player = new Player(this, this.startX, 22);
    this.player.setCollideWorldBounds(true);
    this.player.setControlEnabled(false);
    this.physics.add.collider(this.player, platforms);
    this.physics.add.overlap(this.player, this.spikes, () => this.handleHazard());
    this.player.on('jump-start', (x: number, y: number) => {
      if (this.state === GameState.PLAYING && !this.isNearHazard(x)) this.respawnPoint.set(x, y);
    });

    this.cameras.main.startFollow(this.player, true, CAMERA_CONFIG.followLerpX, CAMERA_CONFIG.followLerpY);
    this.cameras.main.setDeadzone(CAMERA_CONFIG.deadzoneWidth, CAMERA_CONFIG.deadzoneHeight);
    this.lighting.attachToPlayer(this.player);
    this.dizzyStars = this.createDizzyStars();

    this.candles = [
      new Candle(this, 260, CAVE.floorY - 1),
      new Candle(this, 478, CAVE.floorY - 1),
      new Candle(this, 735, CAVE.floorY - 1),
      new Candle(this, 1005, CAVE.floorY - 1),
    ];
    if (this.previewLight) {
      const previewCandle = this.candles.find((candle) => Math.abs(candle.x - this.player.x) < 48);
      previewCandle?.tryIgnite(this.player.x, this.particles, () => this.lighting.addCandle(previewCandle.x, previewCandle.y));
    }

    this.finalCard = new FinalCard(this, CAVE.finalCardX, CAVE.floorY - 13);
    this.physics.add.overlap(this.player, this.finalCard, () => this.collectFinalCard());
    this.clockAltar = new ClockAltar(this, CAVE.clockAltarX, CAVE.floorY, () => this.beginClockAltar());
    this.clockAltar.setActive(this.finalCardCollected);
    this.createFinalCardAura();
    this.createWaterDrips();
    this.createIncomingTransition();
    AudioSystem.instance.ambience('cave');

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cardSystem.destroy();
      this.particles.destroy();
      this.hangingBats.forEach((bat) => bat.sprite.destroy());
      this.hangingBats.length = 0;
      this.spikeWarnings.forEach((warning) => {
        warning.glints.forEach((glint) => glint.destroy());
        warning.sparks.forEach((spark) => spark.destroy());
      });
      this.spikeWarnings.length = 0;
      this.clockAltar.destroy();
    });
  }

  public update(time: number, delta: number): void {
    this.player.update(time);
    this.particles.update(delta);
    this.lighting.update(time, this.player);
    this.finalCard.update(time);
    this.updateDizzyStars(time);
    this.updateHangingBats(time);
    this.updateSpikeWarnings(time);
    this.clockAltar.update(
      time,
      this.player,
      this.state === GameState.PLAYING && this.finalCardCollected && this.altarRoomRevealed,
    );
    this.updateHiddenAltarReveal(delta);

    if (!this.landed && this.player.isGrounded()) this.handleLanding();

    if (this.state === GameState.PLAYING) {
      // CARD_03 is the cave's narrative gate. A horizontal crossing check keeps
      // a high jump from bypassing its short physical overlap body and leaving
      // the camera in normal follow mode beyond the intended end composition.
      if (!this.finalCardCollected && this.player.x >= CAVE.finalCardX - 10) {
        this.collectFinalCard();
      }
      this.candles.forEach((candle) => {
        candle.tryIgnite(this.player.x, this.particles, () => this.lighting.addCandle(candle.x, candle.y));
      });
      this.sampleSafeGround(time);
      if (this.player.y > HAZARD_CONFIG.fallThresholdY) this.handleHazard();
    }

    const velocityX = (this.player.body as Phaser.Physics.Arcade.Body).velocity.x;
    this.cameras.main.setFollowOffset(-Math.sign(velocityX) * CAMERA_CONFIG.lookAhead, 0);
  }

  private createPlatforms(): Phaser.Physics.Arcade.StaticGroup {
    const platforms = this.physics.add.staticGroup();
    const add = (x: number, y: number, width: number, height = 8): void => {
      const platform = platforms.create(x, y, 'platform') as Phaser.Physics.Arcade.Image;
      platform.setDisplaySize(width, height).refreshBody().setVisible(false);
    };

    // Segmented ground introduces three forgiving gaps. Each gap has a short,
    // clearly lit stepping stone, so this reads as exploration rather than a trial.
    add(165, 160, 330);
    add(497, 160, 254);
    add(790, 160, 220);
    add(1425, 160, 950);
    add(350, 143, 34, 7);
    add(650, 137, 38, 7);
    add(925, 144, 42, 7);
    add(1072, 130, 34, 7);
    add(CAVE.clockAltarX, 140, 84, 7);
    return platforms;
  }

  private createSpikes(): Phaser.Physics.Arcade.StaticGroup {
    const spikes = this.physics.add.staticGroup();
    [558, 566, 838, 846, 1098, 1106].forEach((x) => {
      const spike = spikes.create(x, CAVE.floorY + 1, 'spike') as Phaser.Physics.Arcade.Image;
      spike.setOrigin(0.5, 1).refreshBody().setDepth(7);
      const body = spike.body as Phaser.Physics.Arcade.StaticBody;
      body.setSize(7, 6).setOffset(0.5, 2);
    });
    return spikes;
  }

  private createSpikeWarnings(): SpikeWarning[] {
    const spikePairs = [[558, 566], [838, 846], [1098, 1106]];
    return spikePairs.map((pair, pairIndex) => ({
      glints: pair.map((x) => this.add.image(x, CAVE.floorY + 1, 'spike')
        .setOrigin(0.5, 1)
        .setDepth(8)
        .setTint(0xdce7e9)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0)),
      sparks: pair.map((x) => this.add.image(x, CAVE.floorY - 7, 'pixel-star-cross')
        .setDepth(9)
        .setTint(0xf1f6f7)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0)),
      phase: pairIndex * 370,
    }));
  }

  private updateSpikeWarnings(time: number): void {
    const period = 2400;
    const flashDuration = 320;

    this.spikeWarnings.forEach((warning) => {
      const localTime = (time + warning.phase) % period;
      const glintPulse = localTime < flashDuration
        ? Math.sin((localTime / flashDuration) * Math.PI)
        : 0;

      warning.glints.forEach((glint, index) => {
        const staggeredPulse = Phaser.Math.Clamp(glintPulse - index * 0.12, 0, 1);
        glint.setAlpha(staggeredPulse * 0.78);
      });

      warning.sparks.forEach((spark, index) => {
        const peakAt = 132 + index * 42;
        const sparkPulse = Phaser.Math.Clamp(1 - Math.abs(localTime - peakAt) / 68, 0, 1);
        spark.setAlpha(sparkPulse * 0.95).setScale(sparkPulse > 0.55 ? 1 : 0.75);
      });
    });
  }

  private drawCaveWorld(): void {
    this.add.rectangle(0, 0, CAVE.width, 180, 0x010203).setOrigin(0).setDepth(-30);
    const far = this.add.graphics().setDepth(-12);
    const cave = this.add.graphics().setDepth(0);

    // Sealed cave roof and receding rock shelves.
    far.fillStyle(0x07090c, 1).fillRect(0, 0, CAVE.width, 37);
    for (let x = -20; x < CAVE.width + 40; x += 54) {
      const depth = 14 + ((x * 7 % 23) + 23) % 23;
      far.fillStyle(0x0b0d11, 1).fillTriangle(x, 22, x + 22, 22 + depth, x + 48, 20);
      far.fillStyle(0x11141a, 0.75).fillRect(x + 7, 12 + (x % 5), 28, 2);
    }
    for (let index = 0; index < 19; index += 1) {
      const x = 35 + index * 69;
      const y = 64 + (index % 4) * 17;
      far.fillStyle(index % 3 === 0 ? 0x0c1115 : 0x090c10, 0.9)
        .fillEllipse(x, y, 70 + (index % 5) * 12, 20 + (index % 3) * 7);
      far.fillStyle(0x172027, 0.32).fillRect(x - 18, y - 4, 32, 1);
    }

    cave.fillStyle(0x090b0e, 1).fillRect(0, 0, CAVE.width, 22);
    cave.fillStyle(0x15181c, 1).fillRect(0, 20, CAVE.width, 2);
    for (let x = 0; x < CAVE.width; x += 27) {
      const length = 8 + ((x * 13) % 27 + 27) % 27;
      cave.fillStyle(x % 81 === 0 ? 0x171a1c : 0x0d0f12, 1)
        .fillTriangle(x, 20, x + 7 + (x % 5), 20 + length, x + 17, 20);
      cave.fillStyle(0x26292a, 0.55).fillRect(x + 2, 21, 5, Math.max(2, Math.floor(length * 0.35)));
    }

    // The altar chamber sits beyond the final-card composition. Its heavy
    // stone throat only becomes visible once the camera pans into this range.
    const chamberLeft = CAVE.clockAltarX - 160;
    cave.fillStyle(0x010305, 1).fillRect(chamberLeft, 27, 320, CAVE.floorY - 27);
    cave.fillStyle(0x11161a, 1)
      .fillRect(chamberLeft, 27, 15, CAVE.floorY - 27)
      .fillRect(chamberLeft + 305, 27, 15, CAVE.floorY - 27)
      .fillRect(chamberLeft, 27, 320, 9);
    cave.fillStyle(0x30383a, 0.68)
      .fillRect(chamberLeft + 4, 31, 4, 104)
      .fillRect(chamberLeft + 309, 34, 3, 101)
      .fillRect(chamberLeft + 18, 31, 284, 2);
    cave.fillStyle(0x070b0e, 1)
      .fillTriangle(chamberLeft, 27, chamberLeft + 33, 63, chamberLeft + 58, 27)
      .fillTriangle(chamberLeft + 262, 27, chamberLeft + 286, 57, chamberLeft + 320, 27);
    for (let index = 0; index < 7; index += 1) {
      const runeX = chamberLeft + 42 + index * 38;
      cave.fillStyle(index % 2 === 0 ? 0x3e5552 : 0x2d4140, 0.34)
        .fillRect(runeX, 57 + index % 3 * 8, 1, 10)
        .fillRect(runeX - 3, 61 + index % 3 * 8, 7, 1);
    }

    // Floor segments match the physical gaps.
    this.drawGroundSegment(cave, 0, 330);
    this.drawGroundSegment(cave, 370, 254);
    this.drawGroundSegment(cave, 680, 220);
    this.drawGroundSegment(cave, 950, 950);
    this.drawCaveLedge(cave, 333, 139, 34);
    this.drawCaveLedge(cave, 631, 133, 38);
    this.drawCaveLedge(cave, 904, 140, 42);
    this.drawCaveLedge(cave, 1055, 126, 34);
    this.drawCaveLedge(cave, CAVE.clockAltarX - 42, 136, 84);

    // Dark wells beneath the stepping stones, with dim teeth far below.
    const pits: Array<[number, number]> = [[330, 40], [624, 56], [900, 50]];
    pits.forEach(([x, width]) => {
      cave.fillStyle(0x000102, 1).fillRect(x, CAVE.floorY, width, 25);
      for (let spikeX = x + 3; spikeX < x + width - 3; spikeX += 8) {
        cave.fillStyle(0x252a2d, 0.65).fillTriangle(spikeX, 180, spikeX + 3, 171, spikeX + 6, 180);
      }
    });

    // Mineral seams, broken columns, moss, and scattered stones enrich close range.
    for (let index = 0; index < 34; index += 1) {
      const x = 26 + index * 37;
      const y = 76 + (index % 5) * 13;
      cave.fillStyle(index % 7 === 0 ? 0x27352f : 0x1a1d21, 0.62)
        .fillRect(x, y, 7 + (index % 9), 1);
      if (index % 6 === 0) cave.fillRect(x + 5, y, 1, 7);
    }
    for (let index = 0; index < 30; index += 1) {
      const x = 18 + index * 43;
      if (this.isInsidePit(x)) continue;
      const width = 4 + (index % 6);
      cave.fillStyle(index % 5 === 0 ? 0x303638 : 0x1a1e20, 1)
        .fillRect(x, CAVE.floorY - 2 - (index % 3), width, 2 + (index % 3));
      cave.fillStyle(0x56605d, 0.35).fillRect(x + 1, CAVE.floorY - 2 - (index % 3), Math.max(1, width - 2), 1);
    }
    for (let index = 0; index < 22; index += 1) {
      const x = 64 + index * 53;
      if (this.isInsidePit(x)) continue;
      const height = 2 + (index % 7);
      cave.fillStyle(index % 5 === 0 ? 0x244139 : 0x12221e, 0.82).fillRect(x, CAVE.floorY - height, 1, height);
    }

    const flora = this.add.graphics().setDepth(1);
    this.drawBioluminescentGrass(flora);

    const foreground = this.add.graphics().setDepth(18);
    foreground.fillStyle(0x020305, 0.82);
    for (let x = -10; x < CAVE.width + 30; x += 88) {
      const height = 8 + (x % 17 + 17) % 17;
      foreground.fillTriangle(x, 180, x + 18, 180 - height, x + 43, 180);
    }
  }

  private drawGroundSegment(graphics: Phaser.GameObjects.Graphics, x: number, width: number): void {
    graphics.fillStyle(0x090b0d, 1).fillRect(x, CAVE.floorY, width, 25);
    graphics.fillStyle(0x313638, 1).fillRect(x, CAVE.floorY, width, 2);
    graphics.fillStyle(0x171a1c, 1).fillRect(x, CAVE.floorY + 2, width, 5);
    for (let crackX = x + 11; crackX < x + width - 8; crackX += 29) {
      graphics.fillStyle(0x080a0c, 1).fillRect(crackX, CAVE.floorY + 3, 1, 6);
      graphics.fillRect(crackX, CAVE.floorY + 8, 5, 1);
    }
  }

  private drawCaveLedge(graphics: Phaser.GameObjects.Graphics, x: number, y: number, width: number): void {
    graphics.fillStyle(0x0b0d10, 1).fillRect(x, y, width, 8);
    graphics.fillStyle(0x5c6668, 1).fillRect(x, y, width, 2);
    graphics.fillStyle(0x2d3437, 1).fillRect(x + 2, y + 2, width - 4, 3);
    graphics.fillStyle(0x84908b, 0.65).fillRect(x + 3, y, 7, 1).fillRect(x + width - 10, y + 1, 5, 1);
    graphics.fillStyle(0x07090a, 1).fillRect(x + Math.floor(width * 0.42), y + 2, 1, 5);
  }

  private drawBioluminescentGrass(graphics: Phaser.GameObjects.Graphics): void {
    const clusters: Array<{ x: number; groundY: number }> = [
      { x: 82, groundY: CAVE.floorY },
      { x: 116, groundY: CAVE.floorY },
      { x: 169, groundY: CAVE.floorY },
      { x: 219, groundY: CAVE.floorY },
      { x: 298, groundY: CAVE.floorY },
      { x: 391, groundY: CAVE.floorY },
      { x: 431, groundY: CAVE.floorY },
      { x: 518, groundY: CAVE.floorY },
      { x: 601, groundY: CAVE.floorY },
      { x: 704, groundY: CAVE.floorY },
      { x: 767, groundY: CAVE.floorY },
      { x: 808, groundY: CAVE.floorY },
      { x: 873, groundY: CAVE.floorY },
      { x: 977, groundY: CAVE.floorY },
      { x: 1031, groundY: CAVE.floorY },
      { x: 1148, groundY: CAVE.floorY },
      { x: 1262, groundY: CAVE.floorY },
      { x: 343, groundY: 139 },
      { x: 654, groundY: 133 },
      { x: 918, groundY: 140 },
      { x: 1068, groundY: 126 },
    ];
    const green = 0x1b422f;
    const greenEdge = 0x315a38;
    const yellow = 0x625c28;
    const yellowTip = 0x817739;

    clusters.forEach((cluster, index) => {
      const bladeCount = 2 + (index % 4);
      graphics.fillStyle(0x0d1d17, 0.9).fillRect(cluster.x - 3, cluster.groundY - 1, 7, 1);
      for (let blade = 0; blade < bladeCount; blade += 1) {
        const offsetX = (blade - Math.floor(bladeCount / 2)) * 2;
        const height = 2 + ((index * 3 + blade * 2) % 4);
        const isYellow = (index + blade * 2) % 5 === 0;
        graphics.fillStyle(isYellow ? yellow : green, 0.92)
          .fillRect(cluster.x + offsetX, cluster.groundY - height, 1, height);
        const lean = (index + blade) % 2 === 0 ? -1 : 1;
        graphics.fillStyle(isYellow ? yellowTip : greenEdge, isYellow ? 0.62 : 0.7)
          .fillRect(cluster.x + offsetX + lean, cluster.groundY - height, 1, 1);
      }
    });
  }

  private createHangingBats(): HangingBat[] {
    const placements: Array<{ x: number; y: number; eyeColor: BatEyeColor }> = [
      { x: 142, y: 21, eyeColor: 'yellow' },
      { x: 238, y: 22, eyeColor: 'red' },
      { x: 430, y: 20, eyeColor: 'yellow' },
      { x: 704, y: 23, eyeColor: 'yellow' },
      { x: 942, y: 20, eyeColor: 'yellow' },
      { x: 1164, y: 22, eyeColor: 'red' },
    ];
    return placements.map((placement, index) => ({
      sprite: this.add.sprite(placement.x, placement.y, `bat-hanging-${placement.eyeColor}-0`)
        .setOrigin(0.5, 0)
        .setDepth(2),
      eyeColor: placement.eyeColor,
      phase: index * 317,
      index,
      blinkCount: 0,
      blinkUntil: -Infinity,
      nextBlinkAt: this.time.now + 3000 + index * 420,
    }));
  }

  private updateHangingBats(time: number): void {
    this.hangingBats.forEach((bat) => {
      if (time >= bat.nextBlinkAt) {
        bat.blinkUntil = time + 130;
        bat.blinkCount += 1;
        bat.nextBlinkAt = bat.blinkUntil + 3000 + ((bat.index * 733 + bat.blinkCount * 617) % 2600);
      }
      const breathingFrame = Math.floor((time + bat.phase) / 760) % 2;
      const texture = time < bat.blinkUntil
        ? `bat-hanging-${bat.eyeColor}-blink`
        : `bat-hanging-${bat.eyeColor}-${breathingFrame}`;
      if (bat.sprite.texture.key !== texture) bat.sprite.setTexture(texture);
    });
  }

  private createWaterDrips(): void {
    const sources: DripSource[] = [
      { x: 206, y: 42, delay: 1380 },
      { x: 463, y: 35, delay: 1840 },
      { x: 782, y: 45, delay: 1570 },
      { x: 1038, y: 38, delay: 2110 },
    ];
    sources.forEach((source, index) => {
      this.time.addEvent({
        delay: source.delay,
        startAt: index * 310,
        loop: true,
        callback: () => {
          this.particles.burst({
            x: source.x,
            y: source.y,
            count: 1,
            textures: [index % 2 === 0 ? 'pixel-water-bright' : 'pixel-water'],
            speedX: [-1, 1],
            speedY: [18, 25],
            gravity: 105,
            life: [1450, 1750],
            groundY: CAVE.floorY - 1,
            bounce: 0.08,
            scale: [0.6, 0.9],
            depth: 6,
          });
        },
      });
    });
  }

  private createIncomingTransition(): void {
    if (!this.fromWell) return;
    const veil = this.add.rectangle(0, 0, 320, 180, 0x000000, 1)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(1000);
    this.tweens.add({
      targets: veil,
      alpha: 0,
      duration: 520,
      delay: 70,
      ease: 'Sine.Out',
      onComplete: () => veil.destroy(),
    });
  }

  private handleLanding(): void {
    this.landed = true;
    this.showDizzy();
    this.cameraEffects.impactShake();
    AudioSystem.instance.play('caveImpact');
    this.particles.burst({
      x: this.player.x,
      y: CAVE.floorY - 2,
      count: 24,
      textures: ['pixel-dust'],
      speedX: [-85, 85],
      speedY: [-75, -15],
      gravity: 190,
      life: [450, 1000],
      groundY: CAVE.floorY,
      bounce: 0.18,
      scale: [0.7, 1.5],
    });
    this.time.delayedCall(CAVE_LANDING_DIZZY_MS, () => {
      this.hideDizzy();
      this.player.setControlEnabled(true);
      this.state = GameState.PLAYING;
      if (this.previewAltarReveal) this.revealHiddenAltar(true);
      else if (this.previewAltarReady) this.armHiddenAltarPassage();
    });
  }

  private armHiddenAltarPassage(): void {
    if (this.altarPassageArmed || this.altarRoomRevealed) return;
    this.cameras.main.stopFollow();
    this.cameras.main.setFollowOffset(0, 0);
    this.altarPassageArmed = true;
    this.offscreenWalkMs = 0;
    this.offscreenAutoWalk = false;
  }

  private updateHiddenAltarReveal(delta: number): void {
    if (!this.altarPassageArmed || this.state !== GameState.PLAYING) return;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (
      !this.offscreenAutoWalk
      && this.player.x > this.cameras.main.worldView.right - 14
      && body.velocity.x > 20
    ) {
      this.offscreenAutoWalk = true;
      this.player.setControlEnabled(false);
    }
    if (this.offscreenAutoWalk) {
      this.player.setAccelerationX(0).setVelocityX(PLAYER_CONFIG.maxSpeed);
    }
    const playerBeyondFrame = this.player.x - this.cameras.main.worldView.right > this.player.displayWidth * 0.35;
    if (playerBeyondFrame && this.offscreenAutoWalk) {
      this.offscreenWalkMs += Math.min(delta, 50);
    }
    if (this.offscreenWalkMs >= CAVE.hiddenWalkDurationMs) this.revealHiddenAltar(false);
  }

  private revealHiddenAltar(instant: boolean): void {
    if (this.altarRoomRevealed) return;
    this.altarPassageArmed = false;
    this.altarRoomRevealed = true;
    this.cameras.main.stopFollow();

    if (instant) {
      this.player.setPosition(CAVE.clockAltarX - 82, CAVE.floorY - 4).setVelocity(0);
      this.cameras.main.centerOn(CAVE.clockAltarX, 90);
      this.state = GameState.PLAYING;
      this.player.setControlEnabled(true);
      return;
    }

    this.state = GameState.ALTAR_REVEAL;
    this.player.setControlEnabled(false);
    this.player.setAcceleration(0).setVelocity(0);
    AudioSystem.instance.play('crtDistortion');
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.PAN_COMPLETE, () => {
      this.state = GameState.PLAYING;
      this.player.setControlEnabled(true);
    });
    this.cameras.main.pan(
      CAVE.clockAltarX,
      90,
      CAVE.altarCameraPanMs,
      'Sine.easeInOut',
      true,
    );
  }

  private handleHazard(): void {
    if (this.state !== GameState.PLAYING) return;
    this.state = GameState.HAZARD_RECOVERY;
    this.player.setControlEnabled(false);
    this.player.setAcceleration(0).setVelocity(0);
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    playerBody.setAllowGravity(false);
    this.cameraEffects.mediumShake();
    AudioSystem.instance.play('dizzy');
    this.particles.burst({
      x: this.player.x,
      y: this.player.y - 5,
      count: 12,
      textures: ['pixel-dust', 'pixel-gold'],
      speedX: [-55, 55],
      speedY: [-72, -22],
      gravity: 180,
      life: [360, 720],
      groundY: CAVE.floorY,
      scale: [0.55, 1],
      depth: 12,
    });
    this.tweens.add({
      targets: this.player,
      alpha: 0,
      y: this.player.y + 6,
      duration: HAZARD_CONFIG.vanishDelayMs,
      ease: 'Quad.In',
      onComplete: () => {
        playerBody.reset(this.respawnPoint.x, this.respawnPoint.y - 2);
        playerBody.setAllowGravity(true);
        this.player.setVelocity(0).setAlpha(1).setDizzy(true);
        this.dizzyStars.setVisible(true);
        this.cameras.main.centerOn(this.respawnPoint.x, CAVE.floorY - 35);
        this.time.delayedCall(HAZARD_CONFIG.recoveryMs, () => {
          this.hideDizzy();
          this.player.setControlEnabled(true);
          this.state = GameState.PLAYING;
        });
      },
    });
  }

  private sampleSafeGround(time: number): void {
    if (!this.player.isGrounded() || time < this.nextSafeSampleAt || this.isNearHazard(this.player.x)) return;
    this.nextSafeSampleAt = time + HAZARD_CONFIG.safeGroundSampleMs;
    this.respawnPoint.set(this.player.x, this.player.y);
  }

  private isNearHazard(x: number): boolean {
    const nearSpikes = (x > 540 && x < 582) || (x > 820 && x < 862) || (x > 1080 && x < 1122);
    const nearPit = (x > 316 && x < 384) || (x > 610 && x < 694) || (x > 886 && x < 964);
    return nearSpikes || nearPit;
  }

  private isInsidePit(x: number): boolean {
    return (x >= 330 && x < 370) || (x >= 624 && x < 680) || (x >= 900 && x < 950);
  }

  private showDizzy(): void {
    this.player.setDizzy(true);
    this.dizzyStars.setVisible(true);
    AudioSystem.instance.play('dizzy');
  }

  private hideDizzy(): void {
    this.dizzyStars.setVisible(false);
    this.player.setDizzy(false);
  }

  private createDizzyStars(): Phaser.GameObjects.Container {
    const stars = this.add.container(58, 10).setDepth(15).setVisible(false);
    for (let index = 0; index < 3; index += 1) {
      const star = this.add.image(0, 0, 'pixel-gold').setScale(index === 1 ? 1.2 : 0.8);
      stars.add(star);
    }
    return stars;
  }

  private updateDizzyStars(time: number): void {
    if (!this.dizzyStars.visible) return;
    this.dizzyStars.setPosition(this.player.x, this.player.y - 22);
    this.dizzyStars.list.forEach((object, index) => {
      const star = object as Phaser.GameObjects.Image;
      const angle = time * 0.006 + index * (Math.PI * 2 / 3);
      star.setPosition(Math.cos(angle) * 11, Math.sin(angle) * 3);
      star.setAlpha(0.6 + Math.sin(angle * 2) * 0.2);
    });
  }

  private createFinalCardAura(): void {
    this.add.image(CAVE.finalCardX, CAVE.floorY - 13, 'warm-light')
      .setScale(0.72)
      .setAlpha(0.28)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(4);
    this.time.addEvent({
      delay: 260,
      loop: true,
      callback: () => {
        this.particles.burst({
          x: CAVE.finalCardX + Phaser.Math.Between(-11, 11),
          y: CAVE.floorY - 15,
          count: 1,
          textures: ['pixel-gold'],
          speedX: [-6, 6],
          speedY: [-22, -8],
          gravity: -5,
          life: [600, 1100],
          scale: [0.5, 0.9],
          depth: 10,
        });
      },
    });
  }

  private collectFinalCard(): void {
    if (this.state !== GameState.PLAYING) return;
    this.state = GameState.END_CARD;
    this.player.setControlEnabled(false);
    this.player.setVelocityX(0);
    AudioSystem.instance.play('finalCardPickup');
    this.finalCard.flyToCamera(() => {
      AudioSystem.instance.play('cardOpen');
      this.cardSystem.open('CARD_03', () => {
        this.scene.resume(this.scene.key);
        this.finalCardCollected = true;
        this.clockAltar.setActive(true);
        this.state = GameState.PLAYING;
        this.player.setControlEnabled(true);
        this.armHiddenAltarPassage();
        AudioSystem.instance.play('cardClose');
      });
      this.scene.pause();
    });
  }

  private beginClockAltar(): void {
    if (this.state !== GameState.PLAYING || !this.finalCardCollected) return;
    this.state = GameState.CLOCK_ALTAR;
    this.player.setControlEnabled(false);
    this.player.setAcceleration(0).setVelocity(0);
    AudioSystem.instance.play('clockAlign');
    this.beginTimeWarp();
  }

  private beginTimeWarp(): void {
    if (this.state !== GameState.CLOCK_ALTAR) return;
    this.state = GameState.TELEPORTING;
    AudioSystem.instance.play('timeWarp');
    AudioSystem.instance.stopAmbience();
    const camera = this.cameras.main;
    camera.stopFollow();
    const focusX = this.player.x;
    const focusY = this.player.y - 9;
    const clockFaceY = CAVE.floorY - CAVE.clockFaceOffsetY;

    // A broken clock dial folds inward instead of covering the whole scene in
    // a generic white fade. Its uneven arcs retain the cave's pixel language.
    for (let ringIndex = 0; ringIndex < 4; ringIndex += 1) {
      const ring = this.add.graphics().setPosition(focusX, focusY).setDepth(1101 + ringIndex);
      for (let segment = 0; segment < 8; segment += 1) {
        const start = segment * Math.PI / 4 + ringIndex * 0.11;
        const gap = 0.17 + ((segment + ringIndex) % 3) * 0.04;
        ring.lineStyle(
          ringIndex % 2 === 0 ? 2 : 1,
          segment % 3 === 0 ? 0xe8fff7 : 0x74c9c8,
          0.7 - ringIndex * 0.1,
        ).beginPath().arc(0, 0, 19 + ringIndex * 9, start + gap, start + Math.PI / 4 - gap).strokePath();
      }
      ring.setScale(1.65 + ringIndex * 0.18).setAlpha(0);
      this.tweens.add({
        targets: ring,
        scale: 0.14,
        rotation: (ringIndex % 2 === 0 ? 1 : -1) * (1.4 + ringIndex * 0.35),
        alpha: { from: 0.78 - ringIndex * 0.08, to: 0 },
        delay: ringIndex * 90,
        duration: 1550 + ringIndex * 100,
        ease: 'Cubic.In',
        onComplete: () => ring.destroy(),
      });
    }

    for (let index = 0; index < 20; index += 1) {
      const angle = index * Math.PI / 10;
      const radius = 42 + index % 4 * 6;
      const tick = this.add.rectangle(
        focusX + Math.cos(angle) * radius,
        focusY + Math.sin(angle) * radius,
        index % 5 === 0 ? 5 : 3,
        1,
        index % 3 === 0 ? 0xdbfff6 : 0x689f9f,
        0.72,
      ).setRotation(angle).setDepth(1105);
      this.tweens.add({
        targets: tick,
        x: focusX + ((index % 3) - 1) * 2,
        y: focusY + ((index % 4) - 2),
        rotation: angle + (index % 2 === 0 ? 2.4 : -2.1),
        alpha: 0,
        delay: 120 + index * 22,
        duration: 1180 + index * 18,
        ease: 'Cubic.In',
        onComplete: () => tick.destroy(),
      });
    }

    const slit = this.add.graphics().setPosition(focusX, focusY + 4).setDepth(1100);
    slit.fillStyle(0x6acbc9, 0.13).fillPoints([
      new Phaser.Geom.Point(-18, 48),
      new Phaser.Geom.Point(-3, -72),
      new Phaser.Geom.Point(3, -72),
      new Phaser.Geom.Point(18, 48),
    ], true);
    slit.fillStyle(0xeafff9, 0.78).fillRect(-1, -74, 2, 122);
    slit.setScale(1, 0.02).setAlpha(0);
    this.tweens.add({
      targets: slit,
      scaleY: 1,
      alpha: { from: 0, to: 1 },
      duration: 720,
      ease: 'Cubic.Out',
    });

    const portalGlow = this.add.image(focusX, focusY, 'organic-light')
      .setTint(0xa9eee0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(1099)
      .setScale(0.16, 0.55)
      .setAlpha(0);
    this.tweens.add({
      targets: portalGlow,
      alpha: 0.52,
      scaleX: 0.38,
      scaleY: 0.78,
      duration: 920,
      yoyo: true,
      hold: 380,
      ease: 'Sine.InOut',
      onComplete: () => portalGlow.destroy(),
    });

    for (let index = 0; index < 9; index += 1) {
      const afterimage = this.add.image(focusX, this.player.y, this.player.texture.key)
        .setOrigin(this.player.originX, this.player.originY)
        .setDepth(1106)
        .setTint(index % 3 === 0 ? 0xf0fff9 : index % 2 === 0 ? 0x71d8d2 : 0x7396b8)
        .setAlpha(0.1 + index * 0.025);
      this.tweens.add({
        targets: afterimage,
        x: CAVE.clockAltarX + ((index % 3) - 1) * 2,
        y: clockFaceY + (index % 2 === 0 ? -3 : 3),
        scaleX: 0.08,
        scaleY: 0.22,
        alpha: 0,
        duration: 980 + index * 70,
        delay: 280 + index * 55,
        ease: 'Cubic.In',
        onComplete: () => afterimage.destroy(),
      });
    }

    const localFlash = this.add.rectangle(0, 0, 320, 180, 0xeafff8, 0)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(1200)
      .setBlendMode(Phaser.BlendModes.ADD);
    const warp = { amount: 0 };
    this.tweens.add({
      targets: warp,
      amount: 0.76,
      duration: 980,
      yoyo: true,
      ease: 'Sine.InOut',
      onUpdate: () => this.crt.setDistortion(warp.amount),
    });
    this.tweens.add({
      targets: localFlash,
      alpha: 0.72,
      delay: 1430,
      duration: 110,
      yoyo: true,
      hold: 45,
      ease: 'Cubic.Out',
      onYoyo: () => {
        this.player.setVisible(false);
        const body = this.player.body as Phaser.Physics.Arcade.Body;
        body.enable = false;
        camera.shake(260, 0.012);
      },
      onComplete: () => localFlash.destroy(),
    });
    this.tweens.add({
      targets: slit,
      scaleX: 0.04,
      scaleY: 0.1,
      alpha: 0,
      delay: 1540,
      duration: 680,
      ease: 'Cubic.In',
      onComplete: () => {
        slit.destroy();
        this.crt.reset();
      },
    });
  }
}
