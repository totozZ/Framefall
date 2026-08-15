import Phaser from 'phaser';
import { PIGEON_CONFIG, SURFACE } from '../config/constants';

type FlockState = 'ROOSTING' | 'ALERT' | 'DEPARTING' | 'AWAY' | 'RETURNING';
type PigeonRole = 'peck' | 'still' | 'patrol';
type FacingDirection = -1 | 1;

interface PigeonPlacement {
  x: number;
  role: PigeonRole;
  facing: FacingDirection;
}

interface PigeonBird {
  sprite: Phaser.GameObjects.Sprite;
  role: PigeonRole;
  homeX: number;
  homeY: number;
  groundX: number;
  phase: number;
  facing: FacingDirection;
  nextHopAt: number;
  hopStartedAt: number;
  hopFromX: number;
  hopTargetX: number;
  flightFromX: number;
  flightFromY: number;
  flightTargetX: number;
  flightTargetY: number;
  flightDelay: number;
}

const PLACEMENTS: readonly PigeonPlacement[] = [
  { x: 1184, role: 'peck', facing: 1 },
  { x: 1207, role: 'still', facing: -1 },
  { x: 1231, role: 'patrol', facing: 1 },
  { x: 1254, role: 'still', facing: 1 },
  { x: 1281, role: 'patrol', facing: -1 },
  { x: 1312, role: 'patrol', facing: 1 },
] as const;

export class PigeonFlock {
  private readonly birds: PigeonBird[];
  private readonly centerX: number;
  private state: FlockState = 'ROOSTING';
  private stateStartedAt = 0;
  private calmSince = -Infinity;
  private safeSince = -Infinity;

  public constructor(private readonly scene: Phaser.Scene, groundY: number) {
    this.centerX = PLACEMENTS.reduce((sum, placement) => sum + placement.x, 0) / PLACEMENTS.length;
    this.createFlightAnimation();
    this.birds = PLACEMENTS.map((placement, index) => {
      const sprite = scene.add.sprite(placement.x, groundY, 'pigeon-idle')
        .setOrigin(0.5, 1)
        .setDepth(8 + index * 0.01)
        .setFlipX(placement.facing < 0);
      return {
        sprite,
        role: placement.role,
        homeX: placement.x,
        homeY: groundY,
        groundX: placement.x,
        phase: index * 317,
        facing: placement.facing,
        nextHopAt: scene.time.now + 550 + index * 260,
        hopStartedAt: -Infinity,
        hopFromX: placement.x,
        hopTargetX: placement.x,
        flightFromX: placement.x,
        flightFromY: groundY,
        flightTargetX: placement.x,
        flightTargetY: groundY,
        flightDelay: 0,
      };
    });
  }

  public update(time: number, player: Phaser.GameObjects.Sprite, interactionsEnabled: boolean): void {
    const distance = Phaser.Math.Distance.Between(player.x, player.y, this.centerX, SURFACE.floorY);

    if (this.state === 'ROOSTING') {
      this.updateRoosting(time);
      if (interactionsEnabled && distance <= PIGEON_CONFIG.alertRadius) this.enterAlert(time);
      return;
    }
    if (this.state === 'ALERT') {
      this.updateAlert(time, distance, player.x, interactionsEnabled);
      return;
    }
    if (this.state === 'DEPARTING') {
      this.updateDeparture(time);
      return;
    }
    if (this.state === 'AWAY') {
      this.updateAway(time, distance, interactionsEnabled);
      return;
    }
    this.updateReturn(time, distance, player.x, interactionsEnabled);
  }

  public destroy(): void {
    this.birds.forEach((bird) => bird.sprite.destroy());
    this.birds.length = 0;
  }

  private createFlightAnimation(): void {
    if (this.scene.anims.exists('pigeon-flight')) return;
    this.scene.anims.create({
      key: 'pigeon-flight',
      frames: [
        { key: 'pigeon-fly-0' },
        { key: 'pigeon-fly-1' },
        { key: 'pigeon-fly-2' },
        { key: 'pigeon-fly-1' },
      ],
      frameRate: 14,
      repeat: -1,
    });
  }

  private updateRoosting(time: number): void {
    this.birds.forEach((bird) => {
      if (bird.role === 'peck') {
        this.updatePecker(bird, time);
      } else if (bird.role === 'patrol') {
        this.updatePatrolBird(bird, time);
      } else {
        bird.sprite.setPosition(bird.groundX, bird.homeY).setAngle(0);
        this.setTexture(bird, 'pigeon-idle');
      }
    });
  }

  private updatePecker(bird: PigeonBird, time: number): void {
    const cycle = (time + bird.phase) % 1900;
    const texture = cycle < 460 || cycle > 1430
      ? 'pigeon-idle'
      : Math.floor(cycle / 170) % 2 === 0 ? 'pigeon-peck-0' : 'pigeon-peck-1';
    bird.sprite.setPosition(bird.groundX, bird.homeY).setAngle(0);
    this.setTexture(bird, texture);
  }

  private updatePatrolBird(bird: PigeonBird, time: number): void {
    if (!Number.isFinite(bird.hopStartedAt) && time >= bird.nextHopAt) {
      bird.hopStartedAt = time;
      bird.hopFromX = bird.groundX;
      const offset = Phaser.Math.FloatBetween(-8, 8);
      bird.hopTargetX = Phaser.Math.Clamp(bird.homeX + offset, bird.homeX - 8, bird.homeX + 8);
      if (Math.abs(bird.hopTargetX - bird.hopFromX) < 2) {
        bird.hopTargetX = Phaser.Math.Clamp(
          bird.homeX + (bird.groundX <= bird.homeX ? 6 : -6),
          bird.homeX - 8,
          bird.homeX + 8,
        );
      }
      bird.facing = bird.hopTargetX < bird.hopFromX ? -1 : 1;
      bird.sprite.setFlipX(bird.facing < 0);
    }

    if (Number.isFinite(bird.hopStartedAt)) {
      const progress = Phaser.Math.Clamp((time - bird.hopStartedAt) / 360, 0, 1);
      bird.sprite.x = Phaser.Math.Linear(bird.hopFromX, bird.hopTargetX, progress);
      bird.sprite.y = bird.homeY - Math.sin(progress * Math.PI) * 3;
      this.setTexture(bird, 'pigeon-hop');
      if (progress >= 1) {
        bird.groundX = bird.hopTargetX;
        bird.hopStartedAt = -Infinity;
        bird.nextHopAt = time + Phaser.Math.Between(650, 1450);
        bird.sprite.setPosition(bird.groundX, bird.homeY);
      }
      return;
    }

    bird.sprite.setPosition(bird.groundX, bird.homeY).setAngle(0);
    this.setTexture(bird, 'pigeon-idle');
  }

  private enterAlert(time: number): void {
    this.state = 'ALERT';
    this.stateStartedAt = time;
    this.calmSince = -Infinity;
    this.birds.forEach((bird) => {
      bird.sprite.anims.stop();
      bird.groundX = bird.sprite.x;
      bird.hopStartedAt = -Infinity;
      bird.sprite.setPosition(bird.groundX, bird.homeY).setAngle(0).setVisible(true);
      this.setTexture(bird, 'pigeon-alert');
    });
  }

  private updateAlert(time: number, distance: number, playerX: number, interactionsEnabled: boolean): void {
    if (!interactionsEnabled) return;
    if (distance <= PIGEON_CONFIG.flightRadius && time - this.stateStartedAt >= PIGEON_CONFIG.minimumAlertMs) {
      this.beginDeparture(time, playerX);
      return;
    }
    if (distance <= PIGEON_CONFIG.alertReleaseRadius) {
      this.calmSince = -Infinity;
      return;
    }
    if (!Number.isFinite(this.calmSince)) this.calmSince = time;
    if (time - this.calmSince >= PIGEON_CONFIG.alertRelaxMs) this.resumeRoosting(time);
  }

  private beginDeparture(time: number, playerX: number): void {
    this.state = 'DEPARTING';
    this.stateStartedAt = time;
    const direction: FacingDirection = playerX <= this.centerX ? 1 : -1;
    this.birds.forEach((bird, index) => {
      bird.flightFromX = bird.sprite.x;
      bird.flightFromY = bird.sprite.y;
      bird.flightTargetX = direction > 0
        ? SURFACE.width + 38 + index * 15
        : SURFACE.wellLeft - 88 - index * 15;
      bird.flightTargetY = 30 + (index % 3) * 13;
      bird.flightDelay = (index % 3) * 70 + Math.floor(index / 3) * 45;
      bird.sprite.setFlipX(direction < 0).setAngle(0).setVisible(true).play('pigeon-flight', true);
    });
  }

  private updateDeparture(time: number): void {
    let allGone = true;
    this.birds.forEach((bird) => {
      const progress = Phaser.Math.Clamp(
        (time - this.stateStartedAt - bird.flightDelay) / PIGEON_CONFIG.takeoffDurationMs,
        0,
        1,
      );
      if (progress < 1) allGone = false;
      const eased = Phaser.Math.Easing.Cubic.InOut(progress);
      bird.sprite.x = Phaser.Math.Linear(bird.flightFromX, bird.flightTargetX, eased);
      bird.sprite.y = Phaser.Math.Linear(bird.flightFromY, bird.flightTargetY, eased)
        - Math.sin(progress * Math.PI) * 22;
      bird.sprite.setAngle(Math.sin(progress * Math.PI) * (bird.flightTargetX > bird.flightFromX ? 5 : -5));
      if (progress >= 1) bird.sprite.setVisible(false);
    });
    if (!allGone) return;
    this.state = 'AWAY';
    this.stateStartedAt = time;
    this.safeSince = -Infinity;
  }

  private updateAway(time: number, distance: number, interactionsEnabled: boolean): void {
    if (!interactionsEnabled || distance < PIGEON_CONFIG.returnSafeRadius) {
      this.safeSince = -Infinity;
      return;
    }
    if (!Number.isFinite(this.safeSince)) this.safeSince = time;
    if (time - this.safeSince >= PIGEON_CONFIG.returnDelayMs) this.beginReturn(time);
  }

  private beginReturn(time: number): void {
    this.state = 'RETURNING';
    this.stateStartedAt = time;
    this.birds.forEach((bird, index) => {
      bird.flightFromX = bird.flightTargetX;
      bird.flightFromY = bird.flightTargetY;
      bird.flightTargetX = bird.homeX;
      bird.flightTargetY = bird.homeY;
      bird.flightDelay = (this.birds.length - 1 - index) * 85;
      bird.sprite
        .setPosition(bird.flightFromX, bird.flightFromY)
        .setFlipX(bird.flightTargetX < bird.flightFromX)
        .setAngle(0)
        .setVisible(false)
        .play('pigeon-flight', true);
    });
  }

  private updateReturn(time: number, distance: number, playerX: number, interactionsEnabled: boolean): void {
    if (interactionsEnabled && distance <= PIGEON_CONFIG.alertRadius) {
      this.beginDeparture(time, playerX);
      return;
    }

    let allHome = true;
    this.birds.forEach((bird) => {
      const rawProgress = (time - this.stateStartedAt - bird.flightDelay) / PIGEON_CONFIG.returnDurationMs;
      if (rawProgress < 0) {
        allHome = false;
        return;
      }
      bird.sprite.setVisible(true);
      const progress = Phaser.Math.Clamp(rawProgress, 0, 1);
      if (progress < 1) allHome = false;
      const eased = Phaser.Math.Easing.Sine.InOut(progress);
      bird.sprite.x = Phaser.Math.Linear(bird.flightFromX, bird.flightTargetX, eased);
      bird.sprite.y = Phaser.Math.Linear(bird.flightFromY, bird.flightTargetY, eased)
        - Math.sin(progress * Math.PI) * 18;
      bird.sprite.setAngle(Math.sin(progress * Math.PI) * (bird.flightTargetX > bird.flightFromX ? 4 : -4));
      if (progress >= 1) {
        bird.sprite.anims.stop();
        bird.sprite.setPosition(bird.homeX, bird.homeY).setAngle(0);
        this.setTexture(bird, 'pigeon-alert');
      }
    });
    if (allHome) this.resumeRoosting(time);
  }

  private resumeRoosting(time: number): void {
    this.state = 'ROOSTING';
    this.stateStartedAt = time;
    this.birds.forEach((bird, index) => {
      bird.groundX = bird.homeX;
      bird.hopStartedAt = -Infinity;
      bird.nextHopAt = time + 550 + index * 230;
      bird.sprite.anims.stop();
      bird.sprite
        .setPosition(bird.homeX, bird.homeY)
        .setAngle(0)
        .setFlipX(bird.facing < 0)
        .setVisible(true);
      this.setTexture(bird, 'pigeon-idle');
    });
  }

  private setTexture(bird: PigeonBird, key: string): void {
    if (bird.sprite.texture.key !== key) bird.sprite.setTexture(key);
  }
}
