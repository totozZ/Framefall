import Phaser from 'phaser';
import { CAVE, CAMERA_CONFIG, GameState, HAZARD_CONFIG } from '../config/constants';
import { Candle } from '../entities/Candle';
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
}

interface DripSource {
  x: number;
  y: number;
  delay: number;
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
  private spikes!: Phaser.Physics.Arcade.StaticGroup;
  private landed = false;
  private fromWell = false;
  private dizzyStars!: Phaser.GameObjects.Container;
  private respawnPoint = new Phaser.Math.Vector2(58, CAVE.floorY - 4);
  private nextSafeSampleAt = 0;
  private startX = 58;
  private previewLight = false;

  public constructor() {
    super('CaveScene');
  }

  public init(data: CaveSceneData): void {
    this.fromWell = data.fromWell ?? false;
    this.startX = data.previewX ?? 58;
    this.previewLight = data.previewLight ?? false;
  }

  public create(): void {
    this.state = GameState.CAVE_LANDING;
    this.landed = false;
    this.respawnPoint.set(this.startX, CAVE.floorY - 4);
    new CRTSystem().reset();
    this.cardSystem = new CardSystem();
    this.cameraEffects = new CameraEffects(this.cameras.main);
    this.particles = new ParticleSystem(this, 180);
    this.lighting = new LightingSystem(this);

    this.physics.world.setBounds(0, 0, CAVE.width, 230);
    this.cameras.main.setBounds(0, 0, CAVE.width, 180).setRoundPixels(true);
    this.drawCaveWorld();
    const platforms = this.createPlatforms();
    this.spikes = this.createSpikes();

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
    this.createFinalCardAura();
    this.createWaterDrips();
    this.createIncomingTransition();
    AudioSystem.instance.ambience('cave');

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cardSystem.destroy();
      this.particles.destroy();
    });
  }

  public update(time: number, delta: number): void {
    this.player.update(time);
    this.particles.update(delta);
    this.lighting.update(time, this.player);
    this.finalCard.update(time);
    this.updateDizzyStars(time);

    if (!this.landed && this.player.isGrounded()) this.handleLanding();

    if (this.state === GameState.PLAYING) {
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
    add(1135, 160, 370);
    add(350, 143, 34, 7);
    add(650, 137, 38, 7);
    add(925, 144, 42, 7);
    add(1072, 130, 34, 7);
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

    // Floor segments match the physical gaps.
    this.drawGroundSegment(cave, 0, 330);
    this.drawGroundSegment(cave, 370, 254);
    this.drawGroundSegment(cave, 680, 220);
    this.drawGroundSegment(cave, 950, 370);
    this.drawCaveLedge(cave, 333, 139, 34);
    this.drawCaveLedge(cave, 631, 133, 38);
    this.drawCaveLedge(cave, 904, 140, 42);
    this.drawCaveLedge(cave, 1055, 126, 34);

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
    });
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
        this.state = GameState.PLAYING;
        this.player.setControlEnabled(true);
        AudioSystem.instance.play('cardClose');
      });
      this.scene.pause();
    });
  }
}
