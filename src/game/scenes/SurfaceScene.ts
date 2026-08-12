import Phaser from 'phaser';
import { Collectible } from '../entities/Collectible';
import { FireHydrant } from '../entities/FireHydrant';
import { Player } from '../entities/Player';
import { CAMERA_CONFIG, GameState, HYDRANT_CONFIG, SURFACE } from '../config/constants';
import { AudioSystem } from '../systems/AudioSystem';
import { CameraEffects } from '../systems/CameraEffects';
import { CardSystem } from '../systems/CardSystem';
import { CRTSystem } from '../systems/CRTSystem';
import { ParticleSystem } from '../systems/ParticleSystem';
import { WaterSystem } from '../systems/WaterSystem';

export class SurfaceScene extends Phaser.Scene {
  private state = GameState.INTRO;
  private player!: Player;
  private cassette!: Collectible;
  private hydrant!: FireHydrant;
  private particles!: ParticleSystem;
  private water!: WaterSystem;
  private cardSystem!: CardSystem;
  private crt!: CRTSystem;
  private cameraEffects!: CameraEffects;
  private hintTimer?: Phaser.Time.TimerEvent;

  public constructor() {
    super('SurfaceScene');
  }

  public create(): void {
    this.state = GameState.INTRO;
    this.cardSystem = new CardSystem();
    this.crt = new CRTSystem();
    this.crt.reset();
    this.cameraEffects = new CameraEffects(this.cameras.main);
    this.particles = new ParticleSystem(this, 150);
    this.water = new WaterSystem(this, this.particles, SURFACE.hydrantX, SURFACE.floorY);

    this.physics.world.setBounds(0, 0, SURFACE.width, 260);
    this.cameras.main.setBounds(0, 0, SURFACE.width, 180).setRoundPixels(true);
    this.drawSurfaceWorld();
    const platforms = this.createPlatforms();

    this.player = new Player(this, 64, SURFACE.floorY - 4);
    this.player.setCollideWorldBounds(true);
    this.player.setControlEnabled(false);
    this.physics.add.collider(this.player, platforms);
    this.cameras.main.startFollow(this.player, true, CAMERA_CONFIG.followLerpX, CAMERA_CONFIG.followLerpY);
    this.cameras.main.setDeadzone(CAMERA_CONFIG.deadzoneWidth, CAMERA_CONFIG.deadzoneHeight);

    this.cassette = new Collectible(this, SURFACE.cassetteX, SURFACE.floorY - 11, 'cassette-0');
    this.anims.create({
      key: 'cassette-float',
      frames: [0, 1, 2, 3].map((frame) => ({ key: `cassette-${frame}` })),
      frameRate: 5,
      repeat: -1,
    });
    this.cassette.play('cassette-float');
    this.physics.add.overlap(this.player, this.cassette, () => this.collectCassette());

    this.hydrant = new FireHydrant(
      this,
      SURFACE.hydrantX,
      SURFACE.floorY,
      this.particles,
      this.cameraEffects,
    );
    this.physics.add.collider(this.player, this.hydrant, () => this.handleHydrantCollision());

    this.createIntroReveal();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cardSystem.destroy();
      this.particles.destroy();
      this.water.destroy();
      this.hintTimer?.destroy();
    });
  }

  public update(time: number, delta: number): void {
    this.player.update(time);
    this.cassette.update(time);
    this.particles.update(delta);
    this.water.update(time, delta, this.player);

    const velocityX = (this.player.body as Phaser.Physics.Arcade.Body).velocity.x;
    this.cameras.main.setFollowOffset(-Math.sign(velocityX) * CAMERA_CONFIG.lookAhead, 0);

    if (this.state === GameState.PLAYING && this.player.x > SURFACE.wellLeft && this.player.x < SURFACE.wellRight && this.player.y > 168) {
      this.enterWell();
    }
  }

  private createPlatforms(): Phaser.Physics.Arcade.StaticGroup {
    const platforms = this.physics.add.staticGroup();
    const add = (x: number, y: number, width: number, height = 8): void => {
      const platform = platforms.create(x, y, 'platform') as Phaser.Physics.Arcade.Image;
      platform.setDisplaySize(width, height).refreshBody().setVisible(false);
    };
    add(SURFACE.wellLeft / 2, 158, SURFACE.wellLeft);
    add((SURFACE.wellRight + SURFACE.width) / 2, 158, SURFACE.width - SURFACE.wellRight);
    add(442, 139, 54, 7);
    add(905, 142, 62, 7);
    return platforms;
  }

  private drawSurfaceWorld(): void {
    const sky = this.add.graphics().setDepth(-20).setScrollFactor(0.12);
    sky.fillGradientStyle(0x090b16, 0x090b16, 0x12131d, 0x12131d, 1);
    sky.fillRect(-80, 0, SURFACE.width + 180, 180);
    for (let index = 0; index < 72; index += 1) {
      const x = (index * 83 + 29) % (SURFACE.width + 120);
      const y = 15 + ((index * 47) % 105);
      const alpha = 0.05 + (index % 4) * 0.018;
      sky.fillStyle(index % 7 === 0 ? 0x88735a : 0x51576c, alpha).fillRect(x, y, index % 5 === 0 ? 2 : 1, 1);
    }

    const distant = this.add.graphics().setDepth(-15).setScrollFactor(0.45);
    distant.fillStyle(0x0b0c13, 1);
    for (let x = -30; x < SURFACE.width + 100; x += 58) {
      const height = 22 + ((x * 13) % 25 + 25) % 25;
      distant.fillTriangle(x, SURFACE.floorY, x + 38, SURFACE.floorY - height, x + 84, SURFACE.floorY);
    }
    distant.fillStyle(0x10121a, 1).fillRect(-30, 132, SURFACE.width + 100, 28);

    const world = this.add.graphics().setDepth(0);
    world.fillStyle(0x19171d, 1).fillRect(0, SURFACE.floorY, SURFACE.wellLeft, 27);
    world.fillRect(SURFACE.wellRight, SURFACE.floorY, SURFACE.width - SURFACE.wellRight, 27);
    world.fillStyle(0x30262b, 1).fillRect(0, SURFACE.floorY, SURFACE.wellLeft, 2);
    world.fillRect(SURFACE.wellRight, SURFACE.floorY, SURFACE.width - SURFACE.wellRight, 2);
    for (let x = 0; x < SURFACE.width; x += 19) {
      if (x > SURFACE.wellLeft && x < SURFACE.wellRight) continue;
      world.fillStyle(x % 57 === 0 ? 0x47323a : 0x292128, 0.8).fillRect(x, 158 + (x % 3), 7, 2);
    }

    this.drawGarden(world);
    this.drawWell(world);
    world.fillStyle(0x25222b, 1).fillRect(415, 136, 54, 4);
    world.fillStyle(0x30272e, 1).fillRect(874, 139, 62, 4);
  }

  private drawGarden(graphics: Phaser.GameObjects.Graphics): void {
    graphics.fillStyle(0x151a18, 1).fillRect(SURFACE.hydrantX - 74, 145, 148, 9);
    graphics.fillStyle(0x353029, 1);
    for (let x = SURFACE.hydrantX - 76; x < SURFACE.hydrantX + 76; x += 12) {
      graphics.fillRect(x, 143 + (x % 3), 10, 3);
    }
    for (let index = 0; index < 22; index += 1) {
      const x = SURFACE.hydrantX - 68 + index * 6;
      const height = 3 + (index % 5);
      graphics.fillStyle(index % 6 === 0 ? 0x594437 : 0x233329, 1).fillRect(x, 145 - height, 1, height);
      if (index % 7 === 0) graphics.fillStyle(0x6f493f, 1).fillRect(x - 1, 140 - (index % 3), 3, 2);
    }
  }

  private drawWell(graphics: Phaser.GameObjects.Graphics): void {
    graphics.fillStyle(0x020205, 1).fillRect(SURFACE.wellLeft, 145, SURFACE.wellRight - SURFACE.wellLeft, 35);
    graphics.fillStyle(0x37343a, 1).fillRect(SURFACE.wellLeft - 11, 143, 14, 13);
    graphics.fillRect(SURFACE.wellRight - 3, 143, 14, 13);
    graphics.fillStyle(0x514b4b, 1).fillRect(SURFACE.wellLeft - 13, 140, 18, 4);
    graphics.fillRect(SURFACE.wellRight - 5, 140, 18, 4);
    graphics.fillStyle(0x19171d, 1).fillRect(SURFACE.wellLeft - 5, 137, SURFACE.wellRight - SURFACE.wellLeft + 10, 3);
    graphics.fillStyle(0x26352a, 1).fillRect(SURFACE.wellLeft - 16, 136, 1, 5).fillRect(SURFACE.wellRight + 15, 138, 1, 4);
  }

  private createIntroReveal(): void {
    const curtain = this.add.rectangle(0, 0, 320, 180, 0x000000, 1)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(1000);
    const aperture = this.make.graphics({ x: -26, y: this.player.y - 10 }, false);
    aperture.fillStyle(0xffffff).fillCircle(0, 0, 18);
    const mask = aperture.createGeometryMask();
    mask.setInvertAlpha(true);
    curtain.setMask(mask);

    this.time.delayedCall(420, () => {
      this.tweens.add({
        targets: aperture,
        x: this.player.x,
        duration: 820,
        ease: 'Back.Out',
        onComplete: () => {
          this.time.delayedCall(1000, () => {
            AudioSystem.instance.play('introReveal');
            this.tweens.add({
              targets: aperture,
              scale: 18,
              duration: 720,
              ease: 'Cubic.In',
              onComplete: () => {
                curtain.destroy();
                aperture.destroy();
                this.state = GameState.PLAYING;
                this.player.setControlEnabled(true);
                AudioSystem.instance.ambience('surface');
                this.showControlsHint();
              },
            });
          });
        },
      });
    });
  }

  private showControlsHint(): void {
    const hint = document.querySelector<HTMLElement>('#controls-hint');
    hint?.classList.remove('is-hidden');
    this.hintTimer = this.time.delayedCall(5600, () => hint?.classList.add('is-hidden'));
  }

  private collectCassette(): void {
    if (this.state !== GameState.PLAYING || !this.cassette.active) return;
    this.cassette.collect();
    AudioSystem.instance.play('cassettePickup');
    this.openCard('CARD_01');
  }

  private handleHydrantCollision(): void {
    if (this.state !== GameState.PLAYING || !this.hydrant.active) return;
    if (!this.hydrant.canBeStomped(this.player, this.time.now)) return;
    this.player.bounceFrom(this.hydrant.x);
    const hit = this.hydrant.stomp(() => this.finishHydrantBreak());
    if (hit >= HYDRANT_CONFIG.hitsToBreak) {
      this.state = GameState.HYDRANT_EVENT;
      this.player.setControlEnabled(false);
    }
  }

  private finishHydrantBreak(): void {
    this.water.start();
    this.createGeyser();
    this.time.delayedCall(HYDRANT_CONFIG.cardDelayMs, () => this.openCard('CARD_02'));
  }

  private createGeyser(): void {
    this.time.addEvent({
      delay: 72,
      repeat: 20,
      callback: () => {
        this.particles.burst({
          x: SURFACE.hydrantX,
          y: SURFACE.floorY - 4,
          count: 5,
          textures: ['pixel-water', 'pixel-water-bright'],
          speedX: [-44, 44],
          speedY: [-250, -105],
          gravity: 280,
          life: [650, 1250],
          groundY: SURFACE.floorY,
          bounce: 0.08,
          depth: 11,
        });
      },
    });
  }

  private openCard(id: 'CARD_01' | 'CARD_02'): void {
    this.state = GameState.CARD_OPEN;
    this.player.setControlEnabled(false);
    AudioSystem.instance.play('cardOpen');
    this.cardSystem.open(id, () => {
      this.scene.resume(this.scene.key);
      this.state = GameState.PLAYING;
      this.player.setControlEnabled(true);
      AudioSystem.instance.play('cardClose');
    });
    this.scene.pause();
  }

  private enterWell(): void {
    this.state = GameState.WELL_FALL;
    this.player.setControlEnabled(false);
    AudioSystem.instance.play('wellEnter');
    AudioSystem.instance.stopAmbience();
    this.scene.start('WellTransitionScene');
  }
}
