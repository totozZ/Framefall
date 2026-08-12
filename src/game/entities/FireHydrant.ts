import Phaser from 'phaser';
import { HYDRANT_CONFIG } from '../config/constants';
import { AudioSystem } from '../systems/AudioSystem';
import { CameraEffects } from '../systems/CameraEffects';
import { ParticleSystem } from '../systems/ParticleSystem';

export class FireHydrant extends Phaser.Physics.Arcade.Sprite {
  private hitCount = 0;
  private lastHitAt = -Infinity;
  private breaking = false;

  public constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly particles: ParticleSystem,
    private readonly cameraEffects: CameraEffects,
  ) {
    super(scene, x, y, 'hydrant-0');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 1).setDepth(7).setImmovable(true);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false).setSize(18, 26).setOffset(3, 2);
  }

  public canBeStomped(player: Phaser.Physics.Arcade.Sprite, time: number): boolean {
    const playerBody = player.body as Phaser.Physics.Arcade.Body;
    const hydrantBody = this.body as Phaser.Physics.Arcade.Body;
    // The collider callback runs after separation, so previous-frame geometry is
    // the reliable way to distinguish a stomp from a side collision.
    const previousBottom = playerBody.prev.y + playerBody.height;
    const approachingFromAbove = playerBody.deltaY() >= 0 && previousBottom <= hydrantBody.top + 8;
    return !this.breaking && time - this.lastHitAt > HYDRANT_CONFIG.hitCooldownMs && approachingFromAbove;
  }

  public stomp(onBroken: () => void): number {
    if (this.breaking) return this.hitCount;
    this.lastHitAt = this.scene.time.now;
    this.hitCount += 1;
    const hit = this.hitCount;
    this.setTexture(`hydrant-${Math.min(hit, 2)}`);
    AudioSystem.instance.play(`hydrantHit${hit}` as 'hydrantHit1' | 'hydrantHit2' | 'hydrantHit3');
    if (hit === 1) this.cameraEffects.lowShake();
    if (hit === 2) this.cameraEffects.mediumShake();

    this.scene.tweens.add({
      targets: this,
      scaleY: hit === 1 ? 0.76 : 0.63,
      scaleX: hit === 1 ? 1.14 : 1.25,
      duration: 65,
      yoyo: hit < HYDRANT_CONFIG.hitsToBreak,
      ease: 'Quad.Out',
    });
    this.particles.burst({
      x: this.x,
      y: this.y - 9,
      count: 4 + hit * 2,
      textures: ['pixel-rust', 'pixel-red'],
      speedX: [-55, 55],
      speedY: [-95, -35],
      gravity: 360,
      life: [500, 1100],
      groundY: this.y - 1,
      bounce: 0.35,
    });

    if (hit === 2) this.startLeak();
    if (hit >= HYDRANT_CONFIG.hitsToBreak) {
      this.breaking = true;
      this.scene.physics.world.pause();
      this.scene.time.delayedCall(HYDRANT_CONFIG.freezeFrameMs, () => {
        this.scene.physics.world.resume();
        this.breakApart();
        onBroken();
      });
    }
    return hit;
  }

  private startLeak(): void {
    this.scene.time.addEvent({
      delay: 85,
      repeat: 8,
      callback: () => {
        if (!this.active) return;
        this.particles.burst({
          x: this.x + 7,
          y: this.y - 12,
          count: 1,
          textures: ['pixel-water'],
          speedX: [35, 72],
          speedY: [-44, -10],
          gravity: 185,
          life: [240, 480],
          groundY: this.y,
        });
      },
    });
  }

  private breakApart(): void {
    AudioSystem.instance.play('hydrantBreak');
    this.cameraEffects.impactShake();
    this.cameraEffects.flash(0xe8d5b2, 100);
    this.particles.burst({
      x: this.x,
      y: this.y - 10,
      count: 42,
      textures: ['pixel-red', 'pixel-red-dark', 'pixel-rust'],
      speedX: [-150, 150],
      speedY: [-220, -48],
      gravity: 420,
      life: [1100, 2600],
      groundY: this.y - 1,
      bounce: 0.42,
      scale: [0.65, 1.6],
      depth: 12,
    });
    this.particles.burst({
      x: this.x,
      y: this.y - 8,
      count: 34,
      textures: ['pixel-water', 'pixel-water-bright'],
      speedX: [-92, 92],
      speedY: [-260, -110],
      gravity: 300,
      life: [650, 1300],
      groundY: this.y,
      bounce: 0.15,
      depth: 11,
    });
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = false;
    this.setVisible(false).setActive(false);
  }
}
