import Phaser from 'phaser';
import { CRT_CONFIG } from '../config/constants';

export class CRTSystem {
  private readonly root = document.documentElement;
  private distortion = 0;

  public constructor() {
    this.root.style.setProperty('--crt-scanline', String(CRT_CONFIG.scanlineOpacity));
    this.root.style.setProperty('--crt-noise', String(CRT_CONFIG.noiseOpacity));
    this.root.style.setProperty('--crt-vignette', String(CRT_CONFIG.vignetteOpacity));
    this.root.style.setProperty('--crt-shift', `${CRT_CONFIG.baseAberrationPx}px`);
  }

  public setDistortion(amount: number): void {
    this.distortion = Phaser.Math.Clamp(amount, 0, 1);
    this.root.style.setProperty('--crt-distortion', this.distortion.toFixed(3));
    this.root.style.setProperty(
      '--crt-shift',
      `${CRT_CONFIG.baseAberrationPx + this.distortion * CRT_CONFIG.maxDistortionPx}px`,
    );
    document.body.classList.toggle('crt-distorting', this.distortion > 0.08);
  }

  public reset(): void {
    this.setDistortion(0);
  }
}
