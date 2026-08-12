import type Phaser from 'phaser';
import { AudioSystem } from '../game/systems/AudioSystem';

export type TelevisionPowerState = 'OFF' | 'POWERING_ON' | 'ON' | 'POWERING_OFF';

interface TelevisionPowerOptions {
  createGame: () => Phaser.Game;
}

class TelevisionStaticRenderer {
  private readonly context: CanvasRenderingContext2D;
  private readonly image: ImageData;
  private animationFrame: number | null = null;
  private lastDrawAt = -Infinity;
  private interferenceY = 0;

  public constructor(canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Could not create the television static canvas.');
    this.context = context;
    this.image = context.createImageData(canvas.width, canvas.height);
  }

  public start(): void {
    if (this.animationFrame !== null) return;
    this.animationFrame = requestAnimationFrame(this.draw);
  }

  public stop(): void {
    if (this.animationFrame !== null) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
  }

  public destroy(): void {
    this.stop();
  }

  private readonly draw = (time: number): void => {
    this.animationFrame = requestAnimationFrame(this.draw);
    if (time - this.lastDrawAt < 38) return;
    this.lastDrawAt = time;

    const { data, width, height } = this.image;
    if (Math.random() < 0.17) this.interferenceY = Math.floor(Math.random() * height);
    for (let y = 0; y < height; y += 1) {
      const bandDistance = Math.abs(y - this.interferenceY);
      const bandLift = bandDistance < 2 ? 64 : bandDistance < 5 ? 20 : 0;
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4;
        const salt = Math.random();
        let level = salt > 0.965 ? 242 : salt < 0.08 ? 5 : Math.floor(Math.random() * 156 + 30);
        level = Math.min(255, level + bandLift);
        data[offset] = Math.max(0, level - 5);
        data[offset + 1] = level;
        data[offset + 2] = Math.min(255, level + 3);
        data[offset + 3] = 255;
      }
    }
    this.context.putImageData(this.image, 0, 0);
  };
}

export class TelevisionPowerSystem {
  private readonly tvSet: HTMLElement;
  private readonly screen: HTMLElement;
  private readonly staticLayer: HTMLElement;
  private readonly statusLabel: HTMLElement;
  private readonly switchButton: HTMLButtonElement;
  private readonly staticRenderer: TelevisionStaticRenderer;
  private state: TelevisionPowerState = 'OFF';
  private game: Phaser.Game | null = null;
  private hasPoweredOn = false;

  public constructor(private readonly options: TelevisionPowerOptions) {
    this.tvSet = this.requireElement<HTMLElement>('#tv-set');
    this.screen = this.requireElement<HTMLElement>('#tv-screen');
    this.staticLayer = this.requireElement<HTMLElement>('#tv-static');
    this.statusLabel = this.requireElement<HTMLElement>('.tv-power-status span');
    this.switchButton = this.requireElement<HTMLButtonElement>('#tv-power-switch');
    const staticCanvas = this.requireElement<HTMLCanvasElement>('#tv-static canvas');
    this.staticRenderer = new TelevisionStaticRenderer(staticCanvas);

    this.screen.inert = true;
    this.staticRenderer.start();
    this.setState('OFF');
    this.switchButton.addEventListener('click', this.togglePower);
    this.switchButton.addEventListener('pointerdown', this.showMechanicalPress);
  }

  public destroy(): void {
    this.switchButton.removeEventListener('click', this.togglePower);
    this.switchButton.removeEventListener('pointerdown', this.showMechanicalPress);
    this.staticRenderer.destroy();
    this.game?.destroy(true);
    this.game = null;
    AudioSystem.instance.suspendForTelevision();
  }

  private readonly togglePower = (): void => {
    if (this.state === 'OFF') void this.powerOn();
    else if (this.state === 'ON') void this.powerOff();
  };

  private readonly showMechanicalPress = (): void => {
    this.switchButton.classList.remove('is-switching');
    void this.switchButton.offsetWidth;
    this.switchButton.classList.add('is-switching');
    window.setTimeout(() => this.switchButton.classList.remove('is-switching'), 190);
  };

  private async powerOn(): Promise<void> {
    this.setState('POWERING_ON');
    this.screen.inert = true;
    this.staticLayer.classList.add('is-visible', 'is-surging');
    this.staticRenderer.start();

    const audio = AudioSystem.instance;
    audio.unlock(false);
    audio.play('tvSwitch');
    audio.startTelevisionStatic();
    await this.wait(90);
    audio.play('tvPowerOn');
    await this.wait(430);
    await this.wait(230);
    this.staticLayer.classList.remove('is-visible', 'is-surging');
    audio.stopTelevisionStatic();
    await this.wait(230);

    // Let the CRT picture return to its full, untransformed layout before
    // Phaser measures its parent. Creating it during the thin-line phase would
    // make Scale Manager size the canvas to only a few pixels.
    this.screen.dataset.powerState = 'ON';
    await this.wait(32);
    if (!this.game) {
      this.game = this.options.createGame();
    } else {
      this.game.input.enabled = true;
      this.game.isPaused = false;
      this.game.scale.refresh();
      audio.resumeForTelevision();
    }

    this.hasPoweredOn = true;
    this.screen.inert = false;
    this.setState('ON');
  }

  private async powerOff(): Promise<void> {
    this.setState('POWERING_OFF');
    this.screen.inert = true;
    if (this.game) {
      this.game.input.enabled = false;
      // Pause the core step while leaving Phaser's TimeStep alive. This avoids
      // a delta spike and keeps repeated hardware-style power cycles stable.
      this.game.isPaused = true;
    }

    const audio = AudioSystem.instance;
    audio.play('tvSwitch');
    audio.play('tvPowerOff');
    audio.suspendForTelevision();
    this.staticLayer.classList.remove('is-visible', 'is-surging');
    this.staticRenderer.stop();
    await this.wait(740);
    this.setState('OFF');
  }

  private setState(state: TelevisionPowerState): void {
    this.state = state;
    this.tvSet.dataset.powerState = state;
    this.screen.dataset.powerState = state;
    const isOnSide = state === 'ON' || state === 'POWERING_ON';
    const isTransitioning = state === 'POWERING_ON' || state === 'POWERING_OFF';
    this.switchButton.classList.toggle('is-on', isOnSide);
    this.switchButton.disabled = isTransitioning;
    this.switchButton.setAttribute('aria-pressed', String(isOnSide));
    this.switchButton.setAttribute('aria-label', isOnSide ? 'Turn television off' : 'Turn television on');

    const labels: Record<TelevisionPowerState, string> = {
      OFF: this.hasPoweredOn ? 'OFF' : 'STANDBY',
      POWERING_ON: 'WARMING',
      ON: 'ON AIR',
      POWERING_OFF: 'POWER DOWN',
    };
    this.statusLabel.textContent = labels[state];
  }

  private wait(duration: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, duration));
  }

  private requireElement<T extends Element>(selector: string): T {
    const element = document.querySelector<T>(selector);
    if (!element) throw new Error(`Required television element is missing: ${selector}`);
    return element;
  }
}
