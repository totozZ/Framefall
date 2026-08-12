export type SoundEvent =
  | 'introReveal' | 'footstep' | 'jump' | 'land'
  | 'cassettePickup' | 'cardOpen' | 'cardClose'
  | 'hydrantHit1' | 'hydrantHit2' | 'hydrantHit3' | 'hydrantBreak'
  | 'waterBurst' | 'waterLoop' | 'waterSplash'
  | 'wellEnter' | 'fallWind' | 'crtDistortion' | 'caveImpact' | 'dizzy'
  | 'candleIgnite' | 'finalCardPickup';

type AmbienceKind = 'surface' | 'cave';

interface ToneShape {
  frequency: number;
  endFrequency: number;
  duration: number;
  gain: number;
  type: OscillatorType;
}

export class AudioSystem {
  public static readonly instance = new AudioSystem();

  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambienceNodes: AudioNode[] = [];
  private requestedAmbience: AmbienceKind | null = null;

  private constructor() {}

  public unlock(): void {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.context.destination);
    }
    void this.context.resume();
    if (this.requestedAmbience) this.startAmbienceNow(this.requestedAmbience);
  }

  public play(event: SoundEvent): void {
    const shapes: Record<SoundEvent, ToneShape> = {
      introReveal: { frequency: 90, endFrequency: 180, duration: 0.55, gain: 0.07, type: 'sine' },
      footstep: { frequency: 80, endFrequency: 55, duration: 0.05, gain: 0.022, type: 'square' },
      jump: { frequency: 150, endFrequency: 245, duration: 0.13, gain: 0.055, type: 'triangle' },
      land: { frequency: 92, endFrequency: 42, duration: 0.1, gain: 0.06, type: 'square' },
      cassettePickup: { frequency: 410, endFrequency: 790, duration: 0.22, gain: 0.05, type: 'triangle' },
      cardOpen: { frequency: 260, endFrequency: 520, duration: 0.42, gain: 0.045, type: 'sine' },
      cardClose: { frequency: 240, endFrequency: 90, duration: 0.28, gain: 0.04, type: 'triangle' },
      hydrantHit1: { frequency: 110, endFrequency: 62, duration: 0.16, gain: 0.09, type: 'square' },
      hydrantHit2: { frequency: 95, endFrequency: 48, duration: 0.2, gain: 0.11, type: 'sawtooth' },
      hydrantHit3: { frequency: 76, endFrequency: 34, duration: 0.28, gain: 0.12, type: 'square' },
      hydrantBreak: { frequency: 130, endFrequency: 28, duration: 0.5, gain: 0.14, type: 'sawtooth' },
      waterBurst: { frequency: 340, endFrequency: 85, duration: 0.52, gain: 0.07, type: 'sawtooth' },
      waterLoop: { frequency: 120, endFrequency: 105, duration: 0.2, gain: 0.02, type: 'sine' },
      waterSplash: { frequency: 510, endFrequency: 180, duration: 0.09, gain: 0.035, type: 'triangle' },
      wellEnter: { frequency: 125, endFrequency: 36, duration: 0.68, gain: 0.08, type: 'sine' },
      fallWind: { frequency: 180, endFrequency: 55, duration: 0.7, gain: 0.04, type: 'sawtooth' },
      crtDistortion: { frequency: 55, endFrequency: 680, duration: 0.22, gain: 0.035, type: 'square' },
      caveImpact: { frequency: 72, endFrequency: 25, duration: 0.54, gain: 0.15, type: 'square' },
      dizzy: { frequency: 610, endFrequency: 430, duration: 0.3, gain: 0.035, type: 'sine' },
      candleIgnite: { frequency: 260, endFrequency: 620, duration: 0.18, gain: 0.035, type: 'triangle' },
      finalCardPickup: { frequency: 220, endFrequency: 880, duration: 0.72, gain: 0.06, type: 'sine' },
    };
    this.tone(shapes[event]);
  }

  public ambience(kind: AmbienceKind): void {
    this.requestedAmbience = kind;
    if (this.context?.state === 'running') this.startAmbienceNow(kind);
  }

  public stopAmbience(): void {
    this.ambienceNodes.forEach((node) => {
      try { node.disconnect(); } catch { /* already disconnected */ }
    });
    this.ambienceNodes = [];
  }

  private tone(shape: ToneShape): void {
    const context = this.context;
    const master = this.master;
    if (!context || !master || context.state !== 'running') return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = shape.type;
    oscillator.frequency.setValueAtTime(shape.frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, shape.endFrequency), now + shape.duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(shape.gain, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + shape.duration);
    oscillator.connect(gain).connect(master);
    oscillator.start(now);
    oscillator.stop(now + shape.duration + 0.02);
  }

  private startAmbienceNow(kind: AmbienceKind): void {
    const context = this.context;
    const master = this.master;
    if (!context || !master) return;
    this.stopAmbience();

    const bus = context.createGain();
    const filter = context.createBiquadFilter();
    const now = context.currentTime;
    bus.gain.setValueAtTime(0.0001, now);
    bus.gain.exponentialRampToValueAtTime(kind === 'surface' ? 0.025 : 0.032, now + 2.4);
    filter.type = 'lowpass';
    filter.frequency.value = kind === 'surface' ? 380 : 220;
    bus.connect(filter).connect(master);

    const frequencies = kind === 'surface' ? [48, 73] : [37, 53];
    const oscillators = frequencies.map((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = index === 0 ? 'sine' : 'triangle';
      oscillator.frequency.value = frequency;
      oscillator.detune.value = index * 7 - 3;
      oscillator.connect(bus);
      oscillator.start();
      return oscillator;
    });
    this.ambienceNodes = [bus, filter, ...oscillators];
  }
}
