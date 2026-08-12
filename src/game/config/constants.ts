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
  bodyWidth: 19,
  bodyHeight: 10,
  bodyOffsetX: 3,
  bodyOffsetY: 7,
} as const;

export const CARD_CONFIG = {
  closeDurationMs: 520,
  openDurationMs: 720,
} as const;

export const CRT_CONFIG = {
  scanlineOpacity: 0.1,
  noiseOpacity: 0.035,
  vignetteOpacity: 0.72,
  flickerDurationMs: 4100,
  baseAberrationPx: 0.35,
  maxDistortionPx: 9,
} as const;

export const LIGHT_CONFIG = {
  playerRadius: 54,
  playerAlpha: 0.36,
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
  wellLeft: 1100,
  wellRight: 1152,
} as const;

export const CAVE = {
  width: 1320,
  floorY: 155,
  finalCardX: 1215,
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
}
