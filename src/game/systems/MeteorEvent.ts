import Phaser from 'phaser';
import { METEOR_CONFIG } from '../config/constants';
import { AudioSystem } from './AudioSystem';
import { CRTSystem } from './CRTSystem';

export enum MeteorPhase {
  COLD = 'COLD',
  FRACTURE = 'FRACTURE',
  REENTRY = 'REENTRY',
  IMPACT = 'IMPACT',
}

export interface MeteorEventOptions {
  startedAtEpochMs: number;
  crt: CRTSystem;
  onLockPlayer: () => void;
  onImpact: () => void;
}

interface PathSample {
  t: number;
  x: number;
  y: number;
  distance: number;
}

interface NucleusLayers {
  container: Phaser.GameObjects.Container;
  cold: Phaser.GameObjects.Graphics;
  warm: Phaser.GameObjects.Graphics;
  hot: Phaser.GameObjects.Graphics;
}

interface MeteorVisual {
  root: Phaser.GameObjects.Container;
  coldTails: Phaser.GameObjects.Graphics[];
  warmTails: Phaser.GameObjects.Graphics[];
  hotTails: Phaser.GameObjects.Graphics[];
  ionTail: Phaser.GameObjects.Graphics;
  coldComa: Phaser.GameObjects.Image;
  warmComa: Phaser.GameObjects.Image;
  hotComa: Phaser.GameObjects.Image;
  mist: Phaser.GameObjects.Graphics;
  nucleus: NucleusLayers;
}

interface MeteorFragment {
  root: Phaser.GameObjects.Container;
  coldTail: Phaser.GameObjects.Graphics;
  warmTail: Phaser.GameObjects.Graphics;
  hotTail: Phaser.GameObjects.Graphics;
  core: Phaser.GameObjects.Graphics;
  index: number;
}

interface ParticleSlot {
  sprite: Phaser.GameObjects.Image;
  active: boolean;
  velocityX: number;
  velocityY: number;
  life: number;
  maxLife: number;
  growthX: number;
  growthY: number;
  spin: number;
}

interface ParticleEmission {
  texture: string;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  life: number;
  scaleX: number;
  scaleY: number;
  growthX?: number;
  growthY?: number;
  spin?: number;
  tint: number;
  alpha: number;
  depth: number;
}

class MeteorParticlePool {
  private readonly slots: ParticleSlot[] = [];

  public constructor(scene: Phaser.Scene) {
    for (let index = 0; index < METEOR_CONFIG.particlePoolSize; index += 1) {
      const sprite = scene.add.image(0, 0, 'pixel-star')
        .setScrollFactor(0)
        .setVisible(false)
        .setActive(false);
      this.slots.push({
        sprite,
        active: false,
        velocityX: 0,
        velocityY: 0,
        life: 0,
        maxLife: 0,
        growthX: 0,
        growthY: 0,
        spin: 0,
      });
    }
  }

  public emit(options: ParticleEmission): void {
    const slot = this.slots.find((candidate) => !candidate.active);
    if (!slot) return;
    slot.active = true;
    slot.velocityX = options.velocityX;
    slot.velocityY = options.velocityY;
    slot.life = options.life;
    slot.maxLife = options.life;
    slot.growthX = options.growthX ?? 0;
    slot.growthY = options.growthY ?? 0;
    slot.spin = options.spin ?? 0;
    slot.sprite
      .setTexture(options.texture)
      .setPosition(options.x, options.y)
      .setScale(options.scaleX, options.scaleY)
      .setTint(options.tint)
      .setAlpha(options.alpha)
      .setDepth(options.depth)
      .setAngle(0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(true)
      .setActive(true);
  }

  public update(deltaMs: number): void {
    const dt = Math.min(deltaMs, 50) / 1000;
    this.slots.forEach((slot) => {
      if (!slot.active) return;
      slot.life -= deltaMs;
      slot.sprite.x += slot.velocityX * dt;
      slot.sprite.y += slot.velocityY * dt;
      slot.sprite.scaleX = Math.max(0.05, slot.sprite.scaleX + slot.growthX * dt);
      slot.sprite.scaleY = Math.max(0.05, slot.sprite.scaleY + slot.growthY * dt);
      slot.sprite.angle += slot.spin * dt;
      const lifeRatio = Phaser.Math.Clamp(slot.life / slot.maxLife, 0, 1);
      slot.sprite.setAlpha(Math.min(slot.sprite.alpha, lifeRatio ** 0.8));
      if (slot.life <= 0) this.recycle(slot);
    });
  }

  public destroy(): void {
    this.slots.forEach((slot) => slot.sprite.destroy());
    this.slots.length = 0;
  }

  private recycle(slot: ParticleSlot): void {
    slot.active = false;
    slot.sprite.setVisible(false).setActive(false);
  }
}

export class MeteorEvent {
  private readonly visual: MeteorVisual;
  private readonly particles: MeteorParticlePool;
  private readonly pathSamples: PathSample[];
  private readonly pathLength: number;
  private readonly acceleration: number;
  private readonly gradeMultiply: Phaser.GameObjects.Rectangle;
  private readonly gradeAdd: Phaser.GameObjects.Rectangle;
  private fragments: MeteorFragment[] = [];
  private nextParticleAt = 0;
  private lastSceneTime = 0;
  private particleIndex = 0;
  private fractured = false;
  private playerLocked = false;
  private impactStarted = false;
  private currentPhase = MeteorPhase.COLD;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: MeteorEventOptions,
  ) {
    this.visual = this.createVisual();
    this.particles = new MeteorParticlePool(scene);
    this.pathSamples = this.createPathSamples();
    const finalSample = this.pathSamples[this.pathSamples.length - 1];
    this.pathLength = finalSample?.distance ?? 1;
    const durationSeconds = METEOR_CONFIG.totalDurationMs / 1000;
    this.acceleration = Math.max(
      0,
      2 * (this.pathLength - METEOR_CONFIG.initialSpeed * durationSeconds) / durationSeconds ** 2,
    );
    this.gradeMultiply = scene.add.rectangle(0, 0, 320, 180, 0x17354a, 0.06)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(600)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.gradeAdd = scene.add.rectangle(0, 0, 320, 180, METEOR_CONFIG.colors.cyan, 0.012)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(601)
      .setBlendMode(Phaser.BlendModes.ADD);

    if (this.elapsedMs >= METEOR_CONFIG.fractureAtMs) this.createFragments(false);
  }

  public get phase(): MeteorPhase {
    return this.currentPhase;
  }

  public get elapsedMs(): number {
    return Math.max(0, Date.now() - this.options.startedAtEpochMs);
  }

  public update(sceneTime: number): void {
    const elapsed = Math.min(this.elapsedMs, METEOR_CONFIG.totalDurationMs);
    const deltaMs = this.lastSceneTime > 0 ? sceneTime - this.lastSceneTime : 16;
    if (deltaMs > 250) this.nextParticleAt = sceneTime;
    this.lastSceneTime = sceneTime;
    this.particles.update(deltaMs);

    if (elapsed >= METEOR_CONFIG.totalDurationMs) {
      this.startImpact();
      return;
    }
    if (elapsed >= METEOR_CONFIG.lockPlayerAtMs && !this.playerLocked) {
      this.playerLocked = true;
      this.options.onLockPlayer();
    }

    this.currentPhase = elapsed >= METEOR_CONFIG.reentryAtMs
      ? MeteorPhase.REENTRY
      : elapsed >= METEOR_CONFIG.fractureAtMs ? MeteorPhase.FRACTURE : MeteorPhase.COLD;
    if (elapsed >= METEOR_CONFIG.fractureAtMs && !this.fractured) this.createFragments(true);

    const elapsedSeconds = elapsed / 1000;
    const travelled = Math.min(
      this.pathLength,
      METEOR_CONFIG.initialSpeed * elapsedSeconds + 0.5 * this.acceleration * elapsedSeconds ** 2,
    );
    const pathT = this.getPathT(travelled);
    const point = this.getPathPoint(pathT);
    const tangent = this.getPathTangent(pathT);
    const rotation = Math.atan2(tangent.y, tangent.x);
    const progress = elapsed / METEOR_CONFIG.totalDurationMs;
    this.visual.root.setPosition(point.x, point.y).setRotation(rotation);

    const warmBlend = this.smoothStep(
      METEOR_CONFIG.fractureAtMs - 10_000,
      METEOR_CONFIG.fractureAtMs + 22_000,
      elapsed,
    );
    const hotBlend = this.smoothStep(
      METEOR_CONFIG.reentryAtMs - 8_000,
      METEOR_CONFIG.reentryAtMs + 30_000,
      elapsed,
    );
    const coldWeight = 1 - warmBlend;
    const warmWeight = warmBlend * (1 - hotBlend);
    const hotWeight = hotBlend;
    this.updateVisual(sceneTime, progress, coldWeight, warmWeight, hotWeight);
    this.updateFragments(elapsed, point, rotation, warmWeight, hotWeight);
    this.updateSceneGrade(coldWeight, warmWeight, hotWeight);
    this.emitTrailParticles(sceneTime, point, rotation, warmWeight, hotWeight);

    const heat = Phaser.Math.Clamp((elapsed - METEOR_CONFIG.fractureAtMs) / 90_000, 0, 1);
    AudioSystem.instance.setMeteorRumble(heat);
  }

  public destroy(): void {
    this.visual.root.destroy(true);
    this.fragments.forEach((fragment) => fragment.root.destroy(true));
    this.fragments.length = 0;
    this.particles.destroy();
    this.gradeMultiply.destroy();
    this.gradeAdd.destroy();
    AudioSystem.instance.stopMeteorRumble();
    if (!this.impactStarted) this.options.crt.reset();
  }

  private createVisual(): MeteorVisual {
    const coldTails = [
      this.createTail(METEOR_CONFIG.gasTailLength, METEOR_CONFIG.gasTailWidth, METEOR_CONFIG.colors.teal, 0.12, 0),
      this.createTail(52, 4.7, METEOR_CONFIG.colors.cyan, 0.2, 1),
      this.createTail(34, 2.5, METEOR_CONFIG.colors.paleBlue, 0.4, 2),
    ];
    const warmTails = [
      this.createTail(61, 6.5, METEOR_CONFIG.colors.paleYellow, 0.18, 1).setAlpha(0),
      this.createTail(38, 3.2, METEOR_CONFIG.colors.gold, 0.42, 2).setAlpha(0),
    ];
    const hotTails = [
      this.createTail(66, 7.2, METEOR_CONFIG.colors.orange, 0.2, 1).setAlpha(0),
      this.createTail(42, 3.5, METEOR_CONFIG.colors.ember, 0.48, 2).setAlpha(0),
    ];
    const ionTail = this.createTail(
      METEOR_CONFIG.ionTailLength,
      3.2,
      METEOR_CONFIG.colors.paleBlue,
      METEOR_CONFIG.ionTailOpacity,
      3,
    ).setPosition(-3, -5);
    const coldComa = this.scene.add.image(0, 0, 'organic-light')
      .setTint(METEOR_CONFIG.colors.cyan)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(METEOR_CONFIG.comaRadius / 96, METEOR_CONFIG.comaRadius / 112)
      .setAlpha(0.22);
    const warmComa = this.scene.add.image(0, 0, 'organic-light')
      .setTint(METEOR_CONFIG.colors.paleYellow)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.18, 0.13)
      .setAlpha(0);
    const hotComa = this.scene.add.image(0, 0, 'warm-light')
      .setTint(METEOR_CONFIG.colors.orange)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.22, 0.16)
      .setAlpha(0);
    const mist = this.createMist();
    const nucleus = this.createNucleus();
    const root = this.scene.add.container(
      METEOR_CONFIG.path.start.x,
      METEOR_CONFIG.path.start.y,
      [
        ionTail,
        ...coldTails,
        ...warmTails,
        ...hotTails,
        coldComa,
        warmComa,
        hotComa,
        mist,
        nucleus.container,
      ],
    ).setScrollFactor(0).setDepth(700);
    return {
      root,
      coldTails,
      warmTails,
      hotTails,
      ionTail,
      coldComa,
      warmComa,
      hotComa,
      mist,
      nucleus,
    };
  }

  private createTail(
    length: number,
    width: number,
    color: number,
    alpha: number,
    variant: number,
  ): Phaser.GameObjects.Graphics {
    const graphics = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    const points = [
      new Phaser.Geom.Point(1, -1),
      new Phaser.Geom.Point(-Math.round(length * 0.2), -Math.max(1, Math.round(width * 0.2))),
      new Phaser.Geom.Point(-Math.round(length * 0.43), -Math.round(width * (0.36 + variant * 0.02))),
      new Phaser.Geom.Point(-Math.round(length * 0.7), -Math.round(width * (0.68 - variant * 0.04))),
      new Phaser.Geom.Point(-length, -Math.round(width * 0.56)),
      new Phaser.Geom.Point(-length + 5 + variant, Math.round(width * 0.7)),
      new Phaser.Geom.Point(-Math.round(length * 0.73), Math.round(width * (0.85 - variant * 0.06))),
      new Phaser.Geom.Point(-Math.round(length * 0.46), Math.round(width * 0.48)),
      new Phaser.Geom.Point(-Math.round(length * 0.2), Math.max(1, Math.round(width * 0.22))),
      new Phaser.Geom.Point(1, 1),
    ];
    graphics.fillStyle(color, alpha).fillPoints(points, true);
    return graphics;
  }

  private createMist(): Phaser.GameObjects.Graphics {
    const mist = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    mist.fillStyle(METEOR_CONFIG.colors.cyan, 0.1)
      .fillEllipse(-2, -1, 17, 9)
      .fillEllipse(3, 1, 10, 11);
    mist.fillStyle(METEOR_CONFIG.colors.icyGreen, 0.08)
      .fillEllipse(-5, 2, 7, 6)
      .fillRect(3, -4, 4, 1);
    return mist;
  }

  private createNucleus(): NucleusLayers {
    const base = this.scene.add.graphics();
    base.fillStyle(0x08141c, 1).fillPoints([
      new Phaser.Geom.Point(-7, -1), new Phaser.Geom.Point(-3, -5),
      new Phaser.Geom.Point(2, -5), new Phaser.Geom.Point(6, -2),
      new Phaser.Geom.Point(6, 2), new Phaser.Geom.Point(2, 5),
      new Phaser.Geom.Point(-3, 4), new Phaser.Geom.Point(-6, 2),
    ], true);
    base.fillStyle(METEOR_CONFIG.colors.deepIce, 1).fillPoints([
      new Phaser.Geom.Point(-5, -1), new Phaser.Geom.Point(-2, -4),
      new Phaser.Geom.Point(2, -4), new Phaser.Geom.Point(5, -2),
      new Phaser.Geom.Point(5, 1), new Phaser.Geom.Point(2, 4),
      new Phaser.Geom.Point(-2, 3), new Phaser.Geom.Point(-5, 1),
    ], true);
    base.fillStyle(METEOR_CONFIG.colors.blueGrey, 0.9).fillPoints([
      new Phaser.Geom.Point(-2, -3), new Phaser.Geom.Point(2, -4),
      new Phaser.Geom.Point(4, -1), new Phaser.Geom.Point(1, 1),
      new Phaser.Geom.Point(-3, 1),
    ], true);
    const cold = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    cold.fillStyle(METEOR_CONFIG.colors.icyGreen, 0.82)
      .fillRect(-1, -3, 3, 1).fillRect(1, -2, 1, 3).fillRect(-2, 1, 3, 1);
    cold.fillStyle(METEOR_CONFIG.colors.whiteHot, 0.8).fillRect(3, -2, 1, 2);
    const warm = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    warm.fillStyle(METEOR_CONFIG.colors.paleYellow, 0.9)
      .fillRect(-2, -3, 4, 1).fillRect(1, -2, 1, 4).fillRect(-3, 1, 4, 1);
    warm.fillStyle(METEOR_CONFIG.colors.gold, 0.75).fillRect(-1, 2, 3, 1);
    const hot = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    hot.fillStyle(METEOR_CONFIG.colors.orange, 0.95)
      .fillRect(-2, -3, 4, 1).fillRect(0, -2, 2, 4).fillRect(-3, 1, 4, 1);
    hot.fillStyle(METEOR_CONFIG.colors.whiteHot, 0.9).fillRect(2, -2, 1, 2);
    const container = this.scene.add.container(0, 0, [base, cold, warm, hot])
      .setScale(METEOR_CONFIG.nucleusSize / 10);
    return { container, cold, warm, hot };
  }

  private updateVisual(
    sceneTime: number,
    progress: number,
    coldWeight: number,
    warmWeight: number,
    hotWeight: number,
  ): void {
    const flow = sceneTime * 0.0045;
    this.visual.coldTails.forEach((tail, index) => {
      tail.setAlpha(coldWeight * (0.75 + Math.sin(flow + index) * 0.12));
    });
    this.visual.warmTails.forEach((tail, index) => {
      tail.setAlpha(warmWeight * (0.78 + Math.sin(flow * 1.3 + index) * 0.16));
    });
    this.visual.hotTails.forEach((tail, index) => {
      tail.setAlpha(hotWeight * (0.82 + Math.sin(flow * 1.9 + index) * 0.18));
    });
    this.visual.ionTail.setAlpha(METEOR_CONFIG.ionTailOpacity * (0.75 + Math.sin(flow * 0.42) * 0.18));
    this.visual.coldComa.setAlpha(coldWeight * 0.22);
    this.visual.warmComa.setAlpha(warmWeight * 0.27);
    this.visual.hotComa.setAlpha(hotWeight * 0.38);
    this.visual.nucleus.cold.setAlpha(coldWeight);
    this.visual.nucleus.warm.setAlpha(warmWeight);
    this.visual.nucleus.hot.setAlpha(hotWeight);
    this.visual.nucleus.container.setRotation(progress * 0.24 + Math.sin(flow * 0.25) * 0.03);
    this.visual.mist.setAlpha(coldWeight * 0.8 + warmWeight * 0.32).setRotation(-progress * 0.8);
    this.visual.coldTails[0]?.setScale(1 + Math.sin(flow * 0.5) * 0.035, 1 + Math.sin(flow * 0.36) * 0.08);
  }

  private createFragments(playSound: boolean): void {
    if (this.fractured) return;
    this.fractured = true;
    if (playSound) AudioSystem.instance.play('meteorSplit');
    for (let index = 0; index < METEOR_CONFIG.fragmentCount; index += 1) {
      const coldTail = this.createTail(22 - index * 3, 2.4, METEOR_CONFIG.colors.cyan, 0.14, index);
      const warmTail = this.createTail(27 - index * 2, 3, METEOR_CONFIG.colors.gold, 0.32, index).setAlpha(0);
      const hotTail = this.createTail(30 - index * 2, 3.4, METEOR_CONFIG.colors.ember, 0.4, index).setAlpha(0);
      const core = this.scene.add.graphics();
      core.fillStyle(0x111b20, 1).fillPoints([
        new Phaser.Geom.Point(-3, -2), new Phaser.Geom.Point(2, -3),
        new Phaser.Geom.Point(4, 0), new Phaser.Geom.Point(1, 3),
        new Phaser.Geom.Point(-3, 2),
      ], true);
      core.fillStyle(METEOR_CONFIG.colors.paleYellow, 0.75).fillRect(1, -2, 1, 3);
      const root = this.scene.add.container(0, 0, [coldTail, warmTail, hotTail, core])
        .setScrollFactor(0)
        .setDepth(699)
        .setScale(0.72 - index * 0.08);
      this.fragments.push({ root, coldTail, warmTail, hotTail, core, index });
    }
    this.visual.nucleus.container.setScale(METEOR_CONFIG.nucleusSize / 12);
  }

  private updateFragments(
    elapsed: number,
    point: { x: number; y: number },
    rotation: number,
    warmWeight: number,
    hotWeight: number,
  ): void {
    if (!this.fractured) return;
    const splitProgress = Phaser.Math.Clamp(
      (elapsed - METEOR_CONFIG.fractureAtMs) / (METEOR_CONFIG.totalDurationMs - METEOR_CONFIG.fractureAtMs),
      0,
      1,
    );
    this.fragments.forEach((fragment) => {
      let offsetX = -5 - splitProgress * (fragment.index + 1) * 5;
      let offsetY = 0;
      let alpha = 1;
      if (fragment.index === 0) {
        offsetY = -splitProgress * 30;
        alpha = 1 - this.smoothStep(0.48, 0.76, splitProgress);
      } else if (fragment.index === 1) {
        offsetY = splitProgress * 24;
        alpha = 1 - this.smoothStep(0.55, 0.82, splitProgress);
      } else {
        offsetX = -7 - Math.sin(splitProgress * Math.PI) * 6;
        offsetY = 7 * (1 - splitProgress) + Math.sin(splitProgress * Math.PI * 2) * 2;
      }
      fragment.root
        .setPosition(point.x + offsetX, point.y + offsetY)
        .setRotation(rotation + (fragment.index - 1) * 0.08)
        .setAlpha(alpha);
      fragment.coldTail.setAlpha(Math.max(0, 1 - warmWeight * 1.6));
      fragment.warmTail.setAlpha(warmWeight * (1 - hotWeight));
      fragment.hotTail.setAlpha(hotWeight);
      fragment.core.setAngle(splitProgress * (fragment.index % 2 === 0 ? 160 : -130));
    });
  }

  private updateSceneGrade(coldWeight: number, warmWeight: number, hotWeight: number): void {
    const grade = METEOR_CONFIG.sceneGrade;
    const warmColor = this.lerpColor(grade.coldMultiply, grade.fractureMultiply, warmWeight);
    const gradeColor = this.lerpColor(warmColor, grade.reentryMultiply, hotWeight);
    const addWarm = this.lerpColor(METEOR_CONFIG.colors.cyan, METEOR_CONFIG.colors.gold, warmWeight);
    const addColor = this.lerpColor(addWarm, METEOR_CONFIG.colors.ember, hotWeight);
    const multiplyOpacity = Phaser.Math.Linear(
      Phaser.Math.Linear(grade.coldOpacity, grade.fractureOpacity, warmWeight),
      grade.reentryOpacity,
      hotWeight,
    );
    const addOpacity = Phaser.Math.Linear(
      Phaser.Math.Linear(grade.coldAddOpacity, grade.fractureAddOpacity, warmWeight),
      grade.reentryAddOpacity,
      hotWeight,
    );
    this.gradeMultiply.setFillStyle(gradeColor, multiplyOpacity);
    this.gradeAdd.setFillStyle(addColor, addOpacity);
    this.gradeMultiply.setAlpha(0.8 + coldWeight * 0.2);
  }

  private emitTrailParticles(
    sceneTime: number,
    point: { x: number; y: number },
    rotation: number,
    warmWeight: number,
    hotWeight: number,
  ): void {
    const interval = hotWeight > 0.5
      ? METEOR_CONFIG.particleIntervalMs.reentry
      : warmWeight > 0.25
        ? METEOR_CONFIG.particleIntervalMs.fracture
        : METEOR_CONFIG.particleIntervalMs.cold;
    if (sceneTime < this.nextParticleAt) return;
    this.nextParticleAt = sceneTime + interval;
    const index = this.particleIndex;
    this.particleIndex += 1;
    const backwardsX = -Math.cos(rotation);
    const backwardsY = -Math.sin(rotation);
    const normalX = -backwardsY;
    const normalY = backwardsX;
    const spread = ((index % 7) - 3) * 0.72;
    const warm = warmWeight > 0.2;
    const hot = hotWeight > 0.25;
    const tint = hot
      ? index % 3 === 0 ? METEOR_CONFIG.colors.whiteHot : METEOR_CONFIG.colors.ember
      : warm ? index % 2 === 0 ? METEOR_CONFIG.colors.paleYellow : METEOR_CONFIG.colors.gold
        : index % 2 === 0 ? METEOR_CONFIG.colors.icyGreen : METEOR_CONFIG.colors.cyan;
    const x = point.x + backwardsX * 8 + normalX * spread;
    const y = point.y + backwardsY * 8 + normalY * spread;
    this.particles.emit({
      texture: index % 9 === 0 ? 'pixel-star-cross' : 'pixel-star',
      x,
      y,
      velocityX: backwardsX * (7 + index % 5) + normalX * spread * 0.8,
      velocityY: backwardsY * (7 + index % 5) + normalY * spread * 0.8,
      life: METEOR_CONFIG.particleLifetimeMs + index % 5 * 70,
      scaleX: index % 6 === 0 ? 2 : 1,
      scaleY: 1,
      tint,
      alpha: hot ? 0.92 : 0.72,
      depth: 698,
    });
    if ((warm || hot) && index % METEOR_CONFIG.flameParticleEvery === 0) {
      this.particles.emit({
        texture: 'warm-light',
        x: x + backwardsX * 3,
        y: y + backwardsY * 3,
        velocityX: backwardsX * 5,
        velocityY: backwardsY * 5 - 1,
        life: 520 + index % 4 * 90,
        scaleX: 0.035,
        scaleY: 0.022,
        growthX: 0.035,
        growthY: 0.024,
        tint: hot ? METEOR_CONFIG.colors.ember : METEOR_CONFIG.colors.gold,
        alpha: 0.14,
        depth: 697,
      });
    }
  }

  private createPathSamples(): PathSample[] {
    const samples: PathSample[] = [];
    let previous = this.getPathPoint(0);
    let distance = 0;
    samples.push({ t: 0, ...previous, distance });
    for (let index = 1; index <= METEOR_CONFIG.pathSamples; index += 1) {
      const t = index / METEOR_CONFIG.pathSamples;
      const point = this.getPathPoint(t);
      distance += Phaser.Math.Distance.Between(previous.x, previous.y, point.x, point.y);
      samples.push({ t, ...point, distance });
      previous = point;
    }
    return samples;
  }

  private getPathT(travelled: number): number {
    const nextIndex = this.pathSamples.findIndex((sample) => sample.distance >= travelled);
    if (nextIndex <= 0) return nextIndex === 0 ? 0 : 1;
    const previous = this.pathSamples[nextIndex - 1];
    const next = this.pathSamples[nextIndex];
    if (!previous || !next) return 1;
    const segmentLength = next.distance - previous.distance;
    const segmentProgress = segmentLength > 0 ? (travelled - previous.distance) / segmentLength : 0;
    return Phaser.Math.Linear(previous.t, next.t, segmentProgress);
  }

  private getPathPoint(t: number): { x: number; y: number } {
    const { start, control, end } = METEOR_CONFIG.path;
    const inverse = 1 - t;
    return {
      x: inverse ** 2 * start.x + 2 * inverse * t * control.x + t ** 2 * end.x,
      y: inverse ** 2 * start.y + 2 * inverse * t * control.y + t ** 2 * end.y,
    };
  }

  private getPathTangent(t: number): { x: number; y: number } {
    const { start, control, end } = METEOR_CONFIG.path;
    return {
      x: 2 * (1 - t) * (control.x - start.x) + 2 * t * (end.x - control.x),
      y: 2 * (1 - t) * (control.y - start.y) + 2 * t * (end.y - control.y),
    };
  }

  private startImpact(): void {
    if (this.impactStarted) return;
    this.impactStarted = true;
    this.currentPhase = MeteorPhase.IMPACT;
    if (!this.playerLocked) {
      this.playerLocked = true;
      this.options.onLockPlayer();
    }
    AudioSystem.instance.play('meteorImpact');
    AudioSystem.instance.stopAllLoops();
    this.options.crt.setDistortion(1);
    this.scene.cameras.main.shake(1100, 0.018);
    this.scene.cameras.main.flash(120, 255, 232, 205, false);

    const ring = this.scene.add.graphics().setScrollFactor(0).setDepth(950);
    ring.lineStyle(2, METEOR_CONFIG.colors.whiteHot, 1).strokeCircle(0, 0, 8);
    ring.setPosition(METEOR_CONFIG.impactScreenX, METEOR_CONFIG.impactScreenY);
    this.scene.tweens.add({
      targets: ring,
      scale: METEOR_CONFIG.impactRingRadius,
      alpha: 0,
      duration: METEOR_CONFIG.impactRingDurationMs,
      ease: 'Cubic.Out',
      onComplete: () => ring.destroy(),
    });
    this.createPermanentPageBlackout();
    this.options.onImpact();
  }

  private createPermanentPageBlackout(): void {
    if (document.querySelector('.meteor-page-blackout')) return;
    const screen = document.querySelector<HTMLElement>('#tv-screen');
    const screenRect = screen?.getBoundingClientRect();
    const impactX = screenRect
      ? screenRect.left + screenRect.width * (METEOR_CONFIG.impactScreenX / 320)
      : window.innerWidth * 0.72;
    const impactY = screenRect
      ? screenRect.top + screenRect.height * (METEOR_CONFIG.impactScreenY / 180)
      : window.innerHeight * 0.7;
    const overlay = document.createElement('div');
    overlay.className = 'meteor-page-blackout';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.setProperty('--meteor-impact-x', `${impactX}px`);
    overlay.style.setProperty('--meteor-impact-y', `${impactY}px`);
    overlay.style.setProperty('--meteor-blackout-duration', `${METEOR_CONFIG.blackoutDurationMs}ms`);
    overlay.style.setProperty('--meteor-wave-duration', `${METEOR_CONFIG.pageWaveDurationMs}ms`);
    overlay.style.setProperty('--meteor-wave-scale', `${METEOR_CONFIG.pageWaveScale}`);
    overlay.innerHTML = '<i class="meteor-page-wave"></i><i class="meteor-page-darkness"></i>';
    document.body.classList.add('meteor-impacting');
    document.body.append(overlay);
    overlay.tabIndex = -1;
    overlay.focus({ preventScroll: true });
    const blockInput = (event: Event): void => {
      if (event instanceof KeyboardEvent && (event.key === 'F5' || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'r'))) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    ['keydown', 'keyup'].forEach((type) => window.addEventListener(type, blockInput, { capture: true }));
    ['pointerdown', 'pointerup', 'click', 'wheel', 'touchstart', 'touchmove'].forEach((type) => {
      overlay.addEventListener(type, blockInput, { passive: false });
    });
  }

  private smoothStep(edge0: number, edge1: number, value: number): number {
    const t = Phaser.Math.Clamp((value - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  private lerpColor(from: number, to: number, amount: number): number {
    const t = Phaser.Math.Clamp(amount, 0, 1);
    const fromR = (from >> 16) & 0xff;
    const fromG = (from >> 8) & 0xff;
    const fromB = from & 0xff;
    const toR = (to >> 16) & 0xff;
    const toG = (to >> 8) & 0xff;
    const toB = to & 0xff;
    return (
      Math.round(Phaser.Math.Linear(fromR, toR, t)) << 16
      | Math.round(Phaser.Math.Linear(fromG, toG, t)) << 8
      | Math.round(Phaser.Math.Linear(fromB, toB, t))
    );
  }
}
