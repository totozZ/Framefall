import Phaser from 'phaser';
import { Collectible } from '../entities/Collectible';
import { FireHydrant } from '../entities/FireHydrant';
import { PigeonFlock } from '../entities/PigeonFlock';
import { Player } from '../entities/Player';
import { CAMERA_CONFIG, GameState, HYDRANT_CONFIG, LIGHT_CONFIG, SURFACE } from '../config/constants';
import { AudioSystem } from '../systems/AudioSystem';
import { CameraEffects } from '../systems/CameraEffects';
import { CardSystem } from '../systems/CardSystem';
import { CRTSystem } from '../systems/CRTSystem';
import { LightingSystem } from '../systems/LightingSystem';
import { ParticleSystem } from '../systems/ParticleSystem';
import { WaterSystem } from '../systems/WaterSystem';

interface SurfaceSceneData {
  skipIntro?: boolean;
  previewX?: number;
  previewWater?: boolean;
}

interface BackgroundStar {
  sprite: Phaser.GameObjects.Image;
  phase: number;
  baseAlpha: number;
  speed: number;
}

export class SurfaceScene extends Phaser.Scene {
  private state = GameState.INTRO;
  private player!: Player;
  private cassette!: Collectible;
  private hydrant!: FireHydrant;
  private pigeons!: PigeonFlock;
  private particles!: ParticleSystem;
  private water!: WaterSystem;
  private cardSystem!: CardSystem;
  private crt!: CRTSystem;
  private cameraEffects!: CameraEffects;
  private lighting!: LightingSystem;
  private hintTimer?: Phaser.Time.TimerEvent;
  private cloudSprites: Phaser.GameObjects.Sprite[] = [];
  private backgroundStars: BackgroundStar[] = [];
  private skipIntro = false;
  private startX = 64;
  private previewWater = false;

  public constructor() {
    super('SurfaceScene');
  }

  public init(data: SurfaceSceneData): void {
    this.skipIntro = data.skipIntro ?? false;
    this.startX = data.previewX ?? 64;
    this.previewWater = data.previewWater ?? false;
  }

  public create(): void {
    this.state = GameState.INTRO;
    this.cardSystem = new CardSystem();
    this.crt = new CRTSystem();
    this.crt.reset();
    this.cameraEffects = new CameraEffects(this.cameras.main);
    this.particles = new ParticleSystem(this, 150);
    this.water = new WaterSystem(this, this.particles, SURFACE.hydrantX, SURFACE.floorY);
    this.lighting = new LightingSystem(this);

    this.physics.world.setBounds(0, 0, SURFACE.width, 260);
    this.cameras.main.setBounds(0, 0, SURFACE.width, 180).setRoundPixels(true);
    this.drawSurfaceWorld();
    this.createStarLayer();
    this.createCloudLayer();
    const platforms = this.createPlatforms();

    this.player = new Player(this, this.startX, SURFACE.floorY - 4);
    this.player.setCollideWorldBounds(true);
    this.player.setControlEnabled(false);
    this.lighting.attachToPlayer(this.player, {
      radius: LIGHT_CONFIG.surfacePlayerRadius,
      alpha: LIGHT_CONFIG.surfacePlayerAlpha,
    });
    this.player.on('jump-start', () => this.water.splashAt(this.player, 'jump'));
    this.player.on('land', () => this.water.splashAt(this.player, 'land'));
    this.physics.add.collider(this.player, platforms);
    this.pigeons = new PigeonFlock(this, SURFACE.floorY);
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

    if (this.skipIntro) {
      this.state = GameState.PLAYING;
      this.player.setControlEnabled(true);
      AudioSystem.instance.ambience('surface');
    } else {
      this.createIntroReveal();
    }
    if (import.meta.env.DEV && this.previewWater) this.water.start();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cardSystem.destroy();
      this.particles.destroy();
      this.water.destroy();
      this.pigeons.destroy();
      this.hintTimer?.destroy();
    });
  }

  public update(time: number, delta: number): void {
    this.player.update(time);
    this.pigeons.update(time, this.player, this.state === GameState.PLAYING);
    this.cassette.update(time);
    this.particles.update(delta);
    this.water.update(time, delta, this.player);
    this.lighting.update(time, this.player);
    this.updateClouds(time);
    this.updateStars(time);

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
    add(438, 140, 38, 7);
    add(899, 143, 44, 7);
    return platforms;
  }

  private drawSurfaceWorld(): void {
    const sky = this.add.graphics().setDepth(-20).setScrollFactor(0.12);
    sky.fillGradientStyle(0x080a11, 0x080a11, 0x171923, 0x171923, 1);
    sky.fillRect(-80, 0, SURFACE.width + 180, 180);
    for (let index = 0; index < 38; index += 1) {
      const x = (index * 83 + 29) % (SURFACE.width + 120);
      const y = 15 + ((index * 47) % 105);
      const alpha = 0.025 + (index % 4) * 0.011;
      sky.fillStyle(index % 7 === 0 ? 0x766c61 : 0x515763, alpha).fillRect(x, y, index % 5 === 0 ? 2 : 1, 1);
    }

    sky.fillStyle(0x272831, 0.7).fillCircle(245, 38, 13);
    sky.fillStyle(0x11131b, 0.68).fillCircle(249, 35, 12);

    const distant = this.add.graphics().setDepth(-15).setScrollFactor(0.45);
    distant.fillStyle(0x0a0c12, 1);
    for (let x = -30; x < SURFACE.width + 100; x += 58) {
      const height = 22 + ((x * 13) % 25 + 25) % 25;
      distant.fillTriangle(x, SURFACE.floorY, x + 38, SURFACE.floorY - height, x + 84, SURFACE.floorY);
    }
    distant.fillStyle(0x10121a, 1).fillRect(-30, 132, SURFACE.width + 100, 28);
    distant.fillStyle(0x151720, 1);
    for (let x = 34; x < SURFACE.width; x += 117) {
      const trunkHeight = 15 + (x % 11);
      distant.fillRect(x, 129 - trunkHeight, 3, trunkHeight);
      distant.fillTriangle(x - 11, 123 - trunkHeight, x + 2, 98 - trunkHeight, x + 14, 123 - trunkHeight);
      distant.fillTriangle(x - 8, 113 - trunkHeight, x + 3, 91 - trunkHeight, x + 12, 113 - trunkHeight);
    }

    const world = this.add.graphics().setDepth(0);
    world.fillStyle(0x18171b, 1).fillRect(0, SURFACE.floorY, SURFACE.wellLeft, 27);
    world.fillRect(SURFACE.wellRight, SURFACE.floorY, SURFACE.width - SURFACE.wellRight, 27);
    world.fillStyle(0x30262b, 1).fillRect(0, SURFACE.floorY, SURFACE.wellLeft, 2);
    world.fillRect(SURFACE.wellRight, SURFACE.floorY, SURFACE.width - SURFACE.wellRight, 2);
    for (let x = 0; x < SURFACE.width; x += 19) {
      if (x > SURFACE.wellLeft && x < SURFACE.wellRight) continue;
      world.fillStyle(x % 57 === 0 ? 0x47323a : 0x292128, 0.8).fillRect(x, 158 + (x % 3), 7, 2);
    }

    world.fillStyle(0x3e4040, 1);
    for (let x = 24; x < SURFACE.width; x += 43) {
      if (x > SURFACE.wellLeft - 16 && x < SURFACE.wellRight + 16) continue;
      const rockWidth = 3 + (x % 4);
      world.fillRect(x, SURFACE.floorY - 2 - (x % 2), rockWidth, 2 + (x % 2));
      world.fillStyle(0x65635b, 0.65).fillRect(x + 1, SURFACE.floorY - 2 - (x % 2), Math.max(1, rockWidth - 2), 1);
      world.fillStyle(0x3e4040, 1);
    }
    for (let index = 0; index < 78; index += 1) {
      const x = 8 + index * 17;
      if (x > SURFACE.wellLeft - 20 && x < SURFACE.wellRight + 20) continue;
      const height = 2 + (index % 5);
      world.fillStyle(index % 9 === 0 ? 0x4e5042 : 0x28352e, 0.8).fillRect(x, SURFACE.floorY - height, 1, height);
      if (index % 11 === 0) world.fillRect(x - 2, SURFACE.floorY - height + 1, 2, 1);
    }

    this.drawGarden(world);
    this.drawWell(world);
    this.drawStoneLedge(world, 419, 136, 38);
    this.drawStoneLedge(world, 877, 139, 44);
  }

  private createCloudLayer(): void {
    const placements = [
      { x: 132, y: 34, scale: 0.9, factor: 0.18 },
      { x: 418, y: 53, scale: 0.65, factor: 0.22 },
      { x: 710, y: 27, scale: 1.1, factor: 0.16 },
      { x: 1010, y: 48, scale: 0.78, factor: 0.2 },
      { x: 1280, y: 30, scale: 0.95, factor: 0.17 },
    ];
    this.cloudSprites = placements.map((placement, index) => {
      const cloud = this.add.sprite(placement.x, placement.y, `cloud-${index % 2}`)
        .setScale(placement.scale)
        .setAlpha(0.42)
        .setScrollFactor(placement.factor)
        .setDepth(-18);
      this.tweens.add({
        targets: cloud,
        x: cloud.x + 22 + index * 3,
        duration: 18000 + index * 2700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
      return cloud;
    });
  }

  private createStarLayer(): void {
    const placements = [
      [18, 23], [47, 57], [72, 17], [101, 78], [128, 34],
      [151, 18], [177, 62], [202, 30], [226, 88], [254, 19],
      [282, 65], [307, 31], [35, 96], [89, 43], [137, 91],
      [188, 48], [271, 98], [316, 76],
    ] as const;
    this.backgroundStars = placements.map(([x, y], index) => {
      const isCross = index === 2 || index === 9 || index === 15;
      const sprite = this.add.image(x, y, isCross ? 'pixel-star-cross' : 'pixel-star')
        .setScrollFactor(0)
        .setDepth(-19)
        .setTint(index % 5 === 0 ? 0xc1bbb0 : index % 3 === 0 ? 0x8fa4ad : 0xa5adb0);
      const baseAlpha = isCross ? 0.28 : 0.16 + (index % 4) * 0.045;
      sprite.setAlpha(baseAlpha);
      return {
        sprite,
        baseAlpha,
        phase: index * 1.73,
        speed: 0.0011 + (index % 5) * 0.00017,
      };
    });
  }

  private updateClouds(time: number): void {
    this.cloudSprites.forEach((cloud, index) => {
      cloud.setAlpha(0.39 + Math.sin(time * 0.00035 + index) * 0.045);
      if (Math.floor(time / 850) % 2 === index % 2) cloud.setTexture(`cloud-${(index + Math.floor(time / 850)) % 2}`);
    });
  }

  private updateStars(time: number): void {
    this.backgroundStars.forEach((star, index) => {
      const slowPulse = Math.sin(time * star.speed + star.phase) * 0.09;
      const occasionalGlimmer = Math.max(0, Math.sin(time * 0.00043 + index * 2.31)) ** 8 * 0.18;
      star.sprite.setAlpha(Phaser.Math.Clamp(star.baseAlpha + slowPulse + occasionalGlimmer, 0.08, 0.55));
    });
  }

  private drawStoneLedge(graphics: Phaser.GameObjects.Graphics, x: number, y: number, width: number): void {
    graphics.fillStyle(0x101216, 1).fillRect(x, y + 2, width, 7);
    graphics.fillStyle(0x4e5558, 1).fillRect(x, y, width, 2);
    graphics.fillStyle(0x31373a, 1).fillRect(x + 2, y + 2, width - 4, 3);
    graphics.fillStyle(0x777b73, 0.8).fillRect(x + 3, y, 8, 1).fillRect(x + width - 12, y + 1, 7, 1);
    graphics.fillStyle(0x0a0c0e, 1).fillRect(x + Math.floor(width * 0.55), y + 2, 1, 4);
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
    // Keep the iris inside the television glass while covering every canvas pixel.
    const veil = document.createElement('div');
    const program = document.querySelector<HTMLElement>('#tv-program');
    if (!program) throw new Error('Television program element is missing.');
    veil.setAttribute('aria-hidden', 'true');
    Object.assign(veil.style, {
      position: 'absolute',
      inset: '0',
      zIndex: '50',
      pointerEvents: 'none',
      background: '#000',
    });
    program.append(veil);

    const canvas = this.game.canvas;
    const aperture = { x: -40, y: 0, radius: 0 };
    const redrawVeil = (): void => {
      const mask = `radial-gradient(circle ${aperture.radius}px at ${aperture.x}px ${aperture.y}px, transparent 0 ${aperture.radius}px, #000 ${aperture.radius + 1}px)`;
      veil.style.maskImage = mask;
      veil.style.webkitMaskImage = mask;
    };
    redrawVeil();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => veil.remove());

    this.time.delayedCall(420, () => {
      // offset/client dimensions are layout-space values, so unlike
      // getBoundingClientRect they are not squashed by the CRT boot transform.
      let canvasLeft = 0;
      let canvasTop = 0;
      let offsetNode: HTMLElement | null = canvas;
      while (offsetNode && offsetNode !== program) {
        canvasLeft += offsetNode.offsetLeft;
        canvasTop += offsetNode.offsetTop;
        offsetNode = offsetNode.offsetParent as HTMLElement | null;
      }
      const displayWidth = canvas.clientWidth;
      const displayHeight = canvas.clientHeight;
      const camera = this.cameras.main;
      const playerScreenX = this.player.x - camera.worldView.x;
      const playerScreenY = this.player.y - 10 - camera.worldView.y;
      const targetX = canvasLeft + (playerScreenX / canvas.width) * displayWidth;
      const targetY = canvasTop + (playerScreenY / canvas.height) * displayHeight;
      aperture.y = targetY;

      this.tweens.add({
        targets: aperture,
        x: targetX,
        radius: 18 * (displayWidth / canvas.width),
        duration: 820,
        ease: 'Back.Out',
        onUpdate: redrawVeil,
        onComplete: () => {
          this.time.delayedCall(1000, () => {
            AudioSystem.instance.play('introReveal');
            this.tweens.add({
              targets: aperture,
              radius: Math.hypot(program.clientWidth, program.clientHeight),
              duration: 720,
              ease: 'Cubic.In',
              onUpdate: redrawVeil,
              onComplete: () => {
                veil.remove();
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
    const entryX = this.player.x - this.cameras.main.worldView.x;
    const veil = this.add.rectangle(0, 0, 320, 180, 0x000104, 0)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(900);
    this.cameras.main.stopFollow();
    this.tweens.add({
      targets: [veil],
      alpha: 0.88,
      duration: 330,
      ease: 'Sine.In',
    });
    this.tweens.add({
      targets: this.player,
      y: this.player.y + 32,
      scale: 0.76,
      duration: 330,
      ease: 'Quad.In',
      onComplete: () => this.scene.start('WellTransitionScene', { entryX }),
    });
  }
}
