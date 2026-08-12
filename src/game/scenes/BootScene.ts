import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  public constructor() {
    super('BootScene');
  }

  public create(): void {
    this.createPlayerTextures();
    this.createWorldTextures();
    this.createOrganicLightTexture();
    this.scene.start('SurfaceScene');
  }

  private createPlayerTextures(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    const frames: Array<{ key: string; pose: 'idle' | 'run' | 'jump' | 'fall' | 'land' | 'dizzy'; index: number }> = [
      { key: 'player-idle-0', pose: 'idle', index: 0 },
      { key: 'player-idle-1', pose: 'idle', index: 1 },
      { key: 'player-run-0', pose: 'run', index: 0 },
      { key: 'player-run-1', pose: 'run', index: 1 },
      { key: 'player-run-2', pose: 'run', index: 2 },
      { key: 'player-run-3', pose: 'run', index: 3 },
      { key: 'player-jump', pose: 'jump', index: 0 },
      { key: 'player-fall', pose: 'fall', index: 0 },
      { key: 'player-land', pose: 'land', index: 0 },
      { key: 'player-dizzy-0', pose: 'dizzy', index: 0 },
      { key: 'player-dizzy-1', pose: 'dizzy', index: 1 },
    ];

    frames.forEach(({ key, pose, index }) => {
      graphics.clear();
      this.drawRabbit(graphics, pose, index);
      graphics.generateTexture(key, 14, 23);
    });
    graphics.destroy();
  }

  private drawRabbit(
    graphics: Phaser.GameObjects.Graphics,
    pose: 'idle' | 'run' | 'jump' | 'fall' | 'land' | 'dizzy',
    index: number,
  ): void {
    const bob = pose === 'idle' && index === 1 ? 1 : 0;
    const compressed = pose === 'land';
    const bodyY = compressed ? 13 : 10 + bob;
    const bodyHeight = compressed ? 7 : 10;
    graphics.fillStyle(0x05030b, 1);
    graphics.fillRect(3, bodyY - 1, 9, bodyHeight + 2);
    graphics.fillRect(4, 2 + bob, 3, pose === 'jump' ? 9 : 8);
    graphics.fillRect(9, 1 + bob, 3, pose === 'fall' ? 10 : 9);
    graphics.fillStyle(0x241337, 1);
    graphics.fillRect(4, bodyY, 7, bodyHeight);
    graphics.fillRect(5, 3 + bob, 1, 6);
    graphics.fillRect(10, 2 + bob, 1, 7);
    graphics.fillStyle(0x533369, 1);
    graphics.fillRect(5, bodyY + 1, 5, 3);
    graphics.fillStyle(pose === 'dizzy' ? 0xd1ad50 : 0xa6e3dd, 1);
    graphics.fillRect(9, bodyY + 1, 1, 1);
    graphics.fillStyle(0x12091e, 1);

    if (pose === 'run') {
      const stride = index % 2 === 0;
      graphics.fillRect(stride ? 2 : 5, 20, 4, 2);
      graphics.fillRect(stride ? 9 : 7, 20, 4, 2);
    } else if (pose === 'jump') {
      graphics.fillRect(1, 17, 5, 2);
      graphics.fillRect(9, 18, 4, 2);
    } else if (pose === 'fall') {
      graphics.fillRect(3, 20, 3, 2);
      graphics.fillRect(9, 20, 3, 2);
    } else {
      graphics.fillRect(3, compressed ? 19 : 20, 4, 2);
      graphics.fillRect(9, compressed ? 19 : 20, 4, 2);
    }
    if (pose === 'dizzy' && index === 1) {
      graphics.fillStyle(0x7e6733, 1);
      graphics.fillRect(2, 11, 2, 1);
    }
  }

  private createWorldTextures(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    const solid = (key: string, color: number, width: number, height: number): void => {
      graphics.clear().fillStyle(color, 1).fillRect(0, 0, width, height).generateTexture(key, width, height);
    };
    solid('pixel-white', 0xdde5df, 2, 2);
    solid('pixel-red', 0x8e302c, 3, 3);
    solid('pixel-red-dark', 0x531f20, 3, 2);
    solid('pixel-rust', 0x68412c, 2, 2);
    solid('pixel-water', 0x3f7288, 2, 3);
    solid('pixel-water-bright', 0x82bbc2, 2, 2);
    solid('pixel-gold', 0xd4aa4c, 2, 2);
    solid('pixel-ember', 0x8f532e, 1, 2);
    solid('pixel-dust', 0x5b5247, 2, 2);

    graphics.clear();
    graphics.fillStyle(0x17151c, 1).fillRect(0, 0, 16, 8);
    graphics.fillStyle(0x29232a, 1).fillRect(0, 0, 16, 2);
    graphics.fillStyle(0x332a30, 1).fillRect(2, 2, 5, 1).fillRect(11, 4, 3, 1);
    graphics.generateTexture('platform', 16, 8);

    for (let frame = 0; frame < 4; frame += 1) {
      graphics.clear();
      graphics.fillStyle(0x08080c, 1).fillRect(0, 3, 16, 9);
      graphics.fillStyle(0x614a69, 1).fillRect(2, 4, 12, 7);
      graphics.fillStyle(0x17121a, 1).fillRect(4, 5, 8, 4);
      graphics.fillStyle(0xb08c50, 1).fillRect(3 + (frame % 2), 3, 3, 1);
      graphics.fillStyle(0x8ca3a0, 1).fillRect(12, 5 + (frame % 2), 1, 3);
      graphics.generateTexture(`cassette-${frame}`, 16, 13);
    }

    for (let frame = 0; frame < 3; frame += 1) {
      graphics.clear();
      const squash = frame * 2;
      graphics.fillStyle(0x231317, 1).fillRect(2, 2 + squash, 17, 22 - squash);
      graphics.fillStyle(0x722a29, 1).fillRect(5, 4 + squash, 11, 19 - squash);
      graphics.fillStyle(0x3c2020, 1).fillRect(2, 8 + squash, 17, 5);
      graphics.fillStyle(0x9b3a30, 1).fillRect(0, 5 + squash, 6, 6).fillRect(15, 5 + squash, 6, 6);
      graphics.fillStyle(0x5e3e2b, 1).fillRect(6, 2 + squash, 9, 3).fillRect(10, 14 + squash, 3, 4);
      graphics.fillStyle(0xa05a39, 1).fillRect(7, 6 + squash, 2, 6);
      graphics.generateTexture(`hydrant-${frame}`, 21, 25);
    }

    graphics.clear();
    graphics.fillStyle(0x6f6657, 1).fillRect(3, 6, 3, 7);
    graphics.fillStyle(0x342e28, 1).fillRect(2, 11, 5, 2);
    graphics.generateTexture('candle-off', 9, 14);
    const flameColors = [0xd4a542, 0xf0c866, 0xb57931];
    flameColors.forEach((color, frame) => {
      graphics.clear();
      graphics.fillStyle(0x6f6657, 1).fillRect(3, 6, 3, 7);
      graphics.fillStyle(0x342e28, 1).fillRect(2, 11, 5, 2);
      graphics.fillStyle(color, 1).fillRect(frame === 1 ? 3 : 4, 1, 2, 5);
      graphics.fillStyle(0xffe5a1, 1).fillRect(4, frame === 2 ? 3 : 2, 1, 2);
      graphics.generateTexture(`candle-lit-${frame}`, 9, 14);
    });

    graphics.clear();
    graphics.fillStyle(0x33281b, 1).fillRect(0, 2, 23, 14);
    graphics.fillStyle(0xb88a38, 1).fillRect(1, 1, 21, 14);
    graphics.fillStyle(0x17131a, 1).fillRect(3, 3, 17, 10);
    graphics.fillStyle(0xe3c271, 1).fillRect(5, 5, 9, 1).fillRect(5, 8, 12, 1);
    graphics.generateTexture('world-card', 23, 16);
    graphics.destroy();
  }

  private createOrganicLightTexture(): void {
    const size = 96;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) return;
    const image = context.createImageData(size, size);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const dx = x - size / 2;
        const dy = y - size / 2;
        const angle = Math.atan2(dy, dx);
        const irregularRadius = 43 + Math.sin(angle * 5) * 3 + Math.sin(angle * 9 + 1.7) * 2;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const noise = ((x * 17 + y * 31) % 13) / 13;
        const strength = Phaser.Math.Clamp(1 - distance / irregularRadius, 0, 1) ** 1.8;
        const offset = (y * size + x) * 4;
        image.data[offset] = 77;
        image.data[offset + 1] = 189;
        image.data[offset + 2] = 184;
        image.data[offset + 3] = Math.round(255 * strength * (0.82 + noise * 0.18));
      }
    }
    context.putImageData(image, 0, 0);
    this.textures.addCanvas('organic-light', canvas);
  }
}
