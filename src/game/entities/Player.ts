import Phaser from 'phaser';
import { PLAYER_CONFIG } from '../config/constants';
import { AudioSystem } from '../systems/AudioSystem';

type PlayerAnimation = 'idle' | 'run' | 'jump' | 'fall' | 'land' | 'dizzy';

export class Player extends Phaser.Physics.Arcade.Sprite {
  private controlsEnabled = false;
  private jumpBufferedAt = -Infinity;
  private lastGroundedAt = -Infinity;
  private wasGrounded = false;
  private landingUntil = -Infinity;
  private dizzy = false;
  private lastFootstepAt = -Infinity;
  private readonly pointerDownHandler: () => void;

  public constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player-idle-0');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10).setOrigin(0.5, 1).setCollideWorldBounds(false);
    this.bodyRef
      .setSize(PLAYER_CONFIG.bodyWidth, PLAYER_CONFIG.bodyHeight)
      .setOffset(PLAYER_CONFIG.bodyOffsetX, PLAYER_CONFIG.bodyOffsetY);
    this.bodyRef.setMaxVelocity(PLAYER_CONFIG.maxSpeed, 480);
    this.bodyRef.setDragX(PLAYER_CONFIG.deceleration);
    this.createAnimations();

    this.pointerDownHandler = (): void => {
      if (this.controlsEnabled) this.jumpBufferedAt = this.scene.time.now;
    };
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.pointerDownHandler);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.pointerDownHandler);
    });
  }

  public setControlEnabled(enabled: boolean): void {
    this.controlsEnabled = enabled;
    if (!enabled) this.jumpBufferedAt = -Infinity;
  }

  public setDizzy(value: boolean): void {
    this.dizzy = value;
    if (value) this.playState('dizzy');
  }

  public isGrounded(): boolean {
    return this.bodyRef.blocked.down || this.bodyRef.touching.down;
  }

  public bounceFrom(x: number): void {
    const direction = this.x < x ? -1 : 1;
    this.setVelocity(direction * 66, -205);
    this.lastGroundedAt = -Infinity;
  }

  public update(time: number): void {
    const grounded = this.bodyRef.blocked.down || this.bodyRef.touching.down;
    if (grounded) this.lastGroundedAt = time;

    if (this.controlsEnabled) {
      this.updateHorizontalMovement();
      this.tryJump(time);
    } else if (grounded) {
      this.setAccelerationX(0);
      this.setVelocityX(Phaser.Math.Linear(this.bodyRef.velocity.x, 0, 0.22));
    }

    if (grounded && !this.wasGrounded && this.bodyRef.velocity.y >= 0) {
      this.landingUntil = time + 110;
      AudioSystem.instance.play('land');
      this.emit('land', this.x, this.y);
    }
    this.updateAnimation(time, grounded);
    this.wasGrounded = grounded;
  }

  private get bodyRef(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  private updateHorizontalMovement(): void {
    const pointerX = this.scene.input.activePointer.x;
    const screenX = this.x - this.scene.cameras.main.worldView.x;
    const distance = pointerX - screenX;
    const magnitude = Math.abs(distance);

    if (magnitude < PLAYER_CONFIG.deadZone) {
      this.setAccelerationX(0);
      this.setDragX(PLAYER_CONFIG.deceleration);
      return;
    }

    const direction = Math.sign(distance);
    const speedScale = Phaser.Math.Clamp(
      (magnitude - PLAYER_CONFIG.deadZone) / (PLAYER_CONFIG.slowZone - PLAYER_CONFIG.deadZone),
      0,
      1,
    );
    const targetSpeed = Phaser.Math.Linear(PLAYER_CONFIG.slowSpeed, PLAYER_CONFIG.maxSpeed, speedScale) * direction;
    const velocityDelta = targetSpeed - this.bodyRef.velocity.x;
    this.setDragX(0);
    this.setAccelerationX(Math.sign(velocityDelta) * PLAYER_CONFIG.acceleration);

    if (Math.abs(velocityDelta) < 6) {
      this.setAccelerationX(0);
      this.setVelocityX(targetSpeed);
    }
    this.setFlipX(direction < 0);
  }

  private tryJump(time: number): void {
    const buffered = time - this.jumpBufferedAt <= PLAYER_CONFIG.jumpBufferMs;
    const canJump = time - this.lastGroundedAt <= PLAYER_CONFIG.coyoteTimeMs;
    if (!buffered || !canJump) return;
    this.jumpBufferedAt = -Infinity;
    this.lastGroundedAt = -Infinity;
    this.emit('jump-start', this.x, this.y);
    this.setVelocityY(PLAYER_CONFIG.jumpVelocity);
    AudioSystem.instance.play('jump');
  }

  private updateAnimation(time: number, grounded: boolean): void {
    if (this.dizzy) {
      this.anims.timeScale = 1;
      this.playState('dizzy');
      return;
    }
    if (!grounded) {
      this.anims.timeScale = 1;
      this.playState(this.bodyRef.velocity.y < 5 ? 'jump' : 'fall');
      return;
    }
    if (time < this.landingUntil) {
      this.anims.timeScale = 1;
      this.playState('land');
      return;
    }
    if (Math.abs(this.bodyRef.velocity.x) > 9) {
      this.anims.timeScale = Phaser.Math.Clamp(Math.abs(this.bodyRef.velocity.x) / 72, 0.72, 1.38);
      this.playState('run');
      if (time - this.lastFootstepAt > 230) {
        this.lastFootstepAt = time;
        AudioSystem.instance.play('footstep');
      }
      return;
    }
    this.anims.timeScale = 1;
    this.playState('idle');
  }

  private playState(state: PlayerAnimation): void {
    const key = `player-${state}`;
    if (this.anims.currentAnim?.key !== key) this.play(key, true);
  }

  private createAnimations(): void {
    const animations: Array<{ key: PlayerAnimation; frames: string[]; frameRate: number; repeat: number }> = [
      { key: 'idle', frames: ['player-idle-0', 'player-idle-1'], frameRate: 2, repeat: -1 },
      {
        key: 'run',
        frames: [
          'player-run-0', 'player-run-1', 'player-run-2',
          'player-run-3', 'player-run-4', 'player-run-5',
        ],
        frameRate: 13,
        repeat: -1,
      },
      { key: 'jump', frames: ['player-jump'], frameRate: 1, repeat: -1 },
      { key: 'fall', frames: ['player-fall'], frameRate: 1, repeat: -1 },
      { key: 'land', frames: ['player-land'], frameRate: 1, repeat: -1 },
      { key: 'dizzy', frames: ['player-dizzy-0', 'player-dizzy-1'], frameRate: 4, repeat: -1 },
    ];
    animations.forEach((definition) => {
      const animationKey = `player-${definition.key}`;
      if (this.scene.anims.exists(animationKey)) return;
      this.scene.anims.create({
        key: animationKey,
        frames: definition.frames.map((key) => ({ key })),
        frameRate: definition.frameRate,
        repeat: definition.repeat,
      });
    });
  }
}
