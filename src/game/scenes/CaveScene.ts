import Phaser from 'phaser';
import { CAVE, CAMERA_CONFIG, GameState } from '../config/constants';
import { Candle } from '../entities/Candle';
import { FinalCard } from '../entities/FinalCard';
import { Player } from '../entities/Player';
import { AudioSystem } from '../systems/AudioSystem';
import { CameraEffects } from '../systems/CameraEffects';
import { CardSystem } from '../systems/CardSystem';
import { CRTSystem } from '../systems/CRTSystem';
import { LightingSystem } from '../systems/LightingSystem';
import { ParticleSystem } from '../systems/ParticleSystem';

export class CaveScene extends Phaser.Scene {
  private state = GameState.CAVE_LANDING;
  private player!: Player;
  private candles: Candle[] = [];
  private finalCard!: FinalCard;
  private particles!: ParticleSystem;
  private lighting!: LightingSystem;
  private cardSystem!: CardSystem;
  private cameraEffects!: CameraEffects;
  private landed = false;
  private dizzyStars!: Phaser.GameObjects.Container;

  public constructor() {
    super('CaveScene');
  }

  public create(): void {
    this.state = GameState.CAVE_LANDING;
    this.landed = false;
    new CRTSystem().reset();
    this.cardSystem = new CardSystem();
    this.cameraEffects = new CameraEffects(this.cameras.main);
    this.particles = new ParticleSystem(this, 130);
    this.lighting = new LightingSystem(this);

    this.physics.world.setBounds(0, 0, CAVE.width, 230);
    this.cameras.main.setBounds(0, 0, CAVE.width, 180).setRoundPixels(true);
    this.drawCaveWorld();
    const platforms = this.createPlatforms();
    this.player = new Player(this, 58, 32);
    this.player.setCollideWorldBounds(true);
    this.player.setControlEnabled(false);
    this.physics.add.collider(this.player, platforms);
    this.cameras.main.startFollow(this.player, true, CAMERA_CONFIG.followLerpX, CAMERA_CONFIG.followLerpY);
    this.cameras.main.setDeadzone(CAMERA_CONFIG.deadzoneWidth, CAMERA_CONFIG.deadzoneHeight);
    this.lighting.attachToPlayer(this.player);
    this.dizzyStars = this.createDizzyStars();

    const candlePositions = [278, 515, 748, 985];
    this.candles = candlePositions.map((x, index) => new Candle(this, x, CAVE.floorY - (index === 2 ? 18 : 1)));

    this.finalCard = new FinalCard(this, CAVE.finalCardX, CAVE.floorY - 13);
    this.physics.add.overlap(this.player, this.finalCard, () => this.collectFinalCard());
    this.createFinalCardAura();
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

    if (!this.landed && (this.player.body as Phaser.Physics.Arcade.Body).blocked.down) this.handleLanding();

    if (this.state === GameState.PLAYING) {
      this.candles.forEach((candle) => {
        candle.tryIgnite(this.player.x, this.particles, () => this.lighting.addCandle(candle.x, candle.y));
      });
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
    add(CAVE.width / 2, 160, CAVE.width);
    add(420, 142, 70, 7);
    add(748, 139, 58, 7);
    add(1085, 145, 76, 7);
    return platforms;
  }

  private drawCaveWorld(): void {
    this.add.rectangle(0, 0, CAVE.width, 180, 0x010204).setOrigin(0).setDepth(-30);
    const cave = this.add.graphics().setDepth(0);
    cave.fillStyle(0x080a0d, 1).fillRect(0, CAVE.floorY, CAVE.width, 25);
    cave.fillStyle(0x17191c, 1).fillRect(0, CAVE.floorY, CAVE.width, 2);
    for (let x = 0; x < CAVE.width; x += 31) {
      const ceiling = 8 + ((x * 11) % 28);
      cave.fillStyle(0x050609, 1).fillTriangle(x, 0, x + 18, ceiling, x + 38, 0);
      cave.fillStyle(x % 93 === 0 ? 0x171919 : 0x101214, 1).fillRect(x, 161 + (x % 5), 18, 2);
    }
    cave.fillStyle(0x111316, 1).fillRect(385, 139, 70, 4);
    cave.fillRect(719, 136, 58, 4);
    cave.fillRect(1047, 142, 76, 4);

    for (let index = 0; index < 24; index += 1) {
      const x = 90 + index * 47;
      const height = 2 + (index % 8);
      cave.fillStyle(index % 6 === 0 ? 0x172121 : 0x0c1111, 1).fillRect(x, CAVE.floorY - height, 1, height);
    }
  }

  private handleLanding(): void {
    this.landed = true;
    this.player.setDizzy(true);
    this.dizzyStars.setVisible(true);
    this.cameraEffects.impactShake();
    AudioSystem.instance.play('caveImpact');
    AudioSystem.instance.play('dizzy');
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
    this.time.delayedCall(900, () => {
      this.dizzyStars.setVisible(false);
      this.player.setDizzy(false);
      this.player.setControlEnabled(true);
      this.state = GameState.PLAYING;
    });
  }

  private createDizzyStars(): Phaser.GameObjects.Container {
    const stars = this.add.container(this.player?.x ?? 58, 10).setDepth(15).setVisible(false);
    for (let index = 0; index < 3; index += 1) {
      const star = this.add.image(0, 0, 'pixel-gold').setScale(index === 1 ? 1.2 : 0.8);
      stars.add(star);
    }
    return stars;
  }

  private updateDizzyStars(time: number): void {
    if (!this.dizzyStars.visible) return;
    this.dizzyStars.setPosition(this.player.x, this.player.y - 26);
    this.dizzyStars.list.forEach((object, index) => {
      const star = object as Phaser.GameObjects.Image;
      const angle = time * 0.006 + index * (Math.PI * 2 / 3);
      star.setPosition(Math.cos(angle) * 10, Math.sin(angle) * 3);
      star.setAlpha(0.6 + Math.sin(angle * 2) * 0.2);
    });
  }

  private createFinalCardAura(): void {
    this.add.image(CAVE.finalCardX, CAVE.floorY - 13, 'organic-light')
      .setScale(0.72)
      .setAlpha(0.25)
      .setTint(0xd6a744)
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
