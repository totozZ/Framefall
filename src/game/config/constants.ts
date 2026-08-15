export const GAME_WIDTH = 320;
export const GAME_HEIGHT = 180;

export const PLAYER_CONFIG = {
  acceleration: 760,
  deceleration: 920,
  maxSpeed: 102,
  slowSpeed: 45,
  deadZone: 11,
  slowZone: 55,
  jumpVelocity: -238,
  coyoteTimeMs: 105,
  jumpBufferMs: 115,
  turnDurationMs: 250,
  turnFlipDelayMs: 125,
  bodyWidth: 19,
  bodyHeight: 10,
  bodyOffsetX: 3,
  bodyOffsetY: 7,
} as const;

export const PIGEON_CONFIG = {
  alertRadius: 104,
  flightRadius: 62,
  minimumAlertMs: 260,
  alertReleaseRadius: 138,
  alertRelaxMs: 900,
  returnSafeRadius: 160,
  returnDelayMs: 4200,
  takeoffDurationMs: 900,
  returnDurationMs: 1150,
} as const;

export const CARD_CONFIG = {
  closeDurationMs: 520,
  openDurationMs: 720,
} as const;

export const CRT_CONFIG = {
  scanlineOpacity: 0.18,
  noiseOpacity: 0.05,
  vignetteOpacity: 0.78,
  phosphorMaskOpacity: 0.055,
  rollingBandOpacity: 0.14,
  flickerDurationMs: 4100,
  baseAberrationPx: 0.35,
  maxDistortionPx: 9,
} as const;

export const LIGHT_CONFIG = {
  playerRadius: 54,
  playerAlpha: 0.36,
  surfacePlayerRadius: 36,
  surfacePlayerAlpha: 0.11,
  candleRadius: 43,
  candleAlpha: 0.48,
  flickerAmount: 0.07,
} as const;

export const HAZARD_CONFIG = {
  vanishDelayMs: 150,
  recoveryMs: 720,
  safeGroundSampleMs: 180,
  fallThresholdY: 198,
} as const;

export const WATER_CONFIG = {
  cellSize: 4,
  cellCount: 94,
  spreadPixelsPerSecond: 52,
  maxDepth: 6,
  splashCooldownMs: 150,
  jumpSplashCount: 10,
  landSplashCount: 16,
} as const;

export const HYDRANT_CONFIG = {
  hitsToBreak: 3,
  bounceVelocity: -205,
  horizontalKick: 66,
  hitCooldownMs: 260,
  freezeFrameMs: 105,
  cardDelayMs: 900,
} as const;

export const CAMERA_CONFIG = {
  followLerpX: 0.075,
  followLerpY: 0.1,
  lookAhead: 42,
  deadzoneWidth: 92,
  deadzoneHeight: 64,
} as const;

export const SURFACE = {
  width: 1380,
  floorY: 153,
  cassetteX: 320,
  hydrantX: 690,
  meteorTriggerX: 632,
  wellLeft: 1100,
  wellRight: 1152,
} as const;

export const CAVE = {
  width: 1900,
  floorY: 155,
  finalCardX: 1215,
  clockAltarX: 1740,
  hiddenWalkDurationMs: 2000,
  altarCameraPanMs: 1900,
  clockRotationMs: 25_000,
  clockAlignmentWindowDegrees: 5,
} as const;

export const METEOR_CONFIG = {
  totalDurationMs: 180_000,
  fractureAtMs: 90_000,
  reentryAtMs: 135_000,
  lockPlayerAtMs: 178_000,
  pathSamples: 48,
  initialSpeed: 1.4,
  path: {
    start: { x: 28, y: 17 },
    control: { x: 142, y: 31 },
    end: { x: 342, y: 151 },
  },
  nucleusSize: 9,
  comaRadius: 16,
  gasTailLength: 68,
  gasTailWidth: 7,
  ionTailLength: 94,
  ionTailOpacity: 0.065,
  fragmentCount: 3,
  particlePoolSize: 180,
  particleLifetimeMs: 720,
  particleIntervalMs: {
    cold: 180,
    fracture: 96,
    reentry: 58,
  },
  flameParticleEvery: 2,
  sceneGrade: {
    coldMultiply: 0x17354a,
    fractureMultiply: 0x6f5b2d,
    reentryMultiply: 0x5c1719,
    coldOpacity: 0.055,
    fractureOpacity: 0.08,
    reentryOpacity: 0.15,
    coldAddOpacity: 0.012,
    fractureAddOpacity: 0.03,
    reentryAddOpacity: 0.068,
  },
  impactScreenX: 310,
  impactScreenY: 148,
  impactRingRadius: 28,
  impactRingDurationMs: 1050,
  pageWaveScale: 95,
  pageWaveDurationMs: 1150,
  blackoutDurationMs: 1650,
  colors: {
    deepIce: 0x203b48,
    blueGrey: 0x3e6570,
    teal: 0x43c5bf,
    cyan: 0x57d8ef,
    paleBlue: 0xbcefff,
    icyGreen: 0x8de2c5,
    paleYellow: 0xf2e49a,
    gold: 0xe2ac45,
    orange: 0xe8672f,
    ember: 0xc7352b,
    darkRed: 0x641a20,
    whiteHot: 0xfff4dc,
  },
} as const;

export enum GameState {
  INTRO = 'INTRO',
  PLAYING = 'PLAYING',
  CARD_OPEN = 'CARD_OPEN',
  HYDRANT_EVENT = 'HYDRANT_EVENT',
  WELL_FALL = 'WELL_FALL',
  CAVE_LANDING = 'CAVE_LANDING',
  HAZARD_RECOVERY = 'HAZARD_RECOVERY',
  END_CARD = 'END_CARD',
  ALTAR_REVEAL = 'ALTAR_REVEAL',
  CLOCK_ALTAR = 'CLOCK_ALTAR',
  TELEPORTING = 'TELEPORTING',
  METEOR_IMPACT = 'METEOR_IMPACT',
}
