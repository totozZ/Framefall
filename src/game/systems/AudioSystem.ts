export type SoundEvent =
  | 'introReveal' | 'footstep' | 'jump' | 'land'
  | 'cassettePickup' | 'cardOpen' | 'cardClose'
  | 'hydrantHit1' | 'hydrantHit2' | 'hydrantHit3' | 'hydrantBreak'
  | 'waterBurst' | 'waterLoop' | 'waterSplash'
  | 'wellEnter' | 'fallWind' | 'crtDistortion' | 'caveImpact' | 'dizzy'
  | 'candleIgnite' | 'finalCardPickup'
  | 'tvSwitch' | 'tvPowerOn' | 'tvPowerOff'
  | 'clockAlign' | 'timeWarp' | 'meteorSplit' | 'meteorImpact';

type AmbienceKind = 'surface' | 'cave';

interface ToneShape {
  frequency: number;
  endFrequency: number;
  duration: number;
  gain: number;
  type: OscillatorType;
  harmonic?: number;
  noise?: number;
}

export class AudioSystem {
  public static readonly instance = new AudioSystem();

  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambienceNodes: AudioNode[] = [];
  private requestedAmbience: AmbienceKind | null = null;
  private ambienceTimer: number | null = null;
  private musicStep = 0;
  private televisionNoiseNodes: AudioNode[] = [];
  private televisionNoiseGain: GainNode | null = null;
  private televisionNoiseSource: AudioBufferSourceNode | null = null;
  private meteorRumbleNodes: AudioNode[] = [];
  private meteorRumbleGain: GainNode | null = null;
  private meteorRumbleFilter: BiquadFilterNode | null = null;
  private meteorRumbleOscillator: OscillatorNode | null = null;

  private constructor() {}

  public unlock(resumeAmbience = true): void {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.42;
      this.master.connect(this.context.destination);
    }
    void this.context.resume().then(() => {
      if (resumeAmbience && this.requestedAmbience && this.ambienceNodes.length === 0) {
        this.startAmbienceNow(this.requestedAmbience);
      }
    });
  }

  public play(event: SoundEvent): void {
    const shapes: Record<SoundEvent, ToneShape> = {
      introReveal: { frequency: 90, endFrequency: 180, duration: 0.55, gain: 0.09, type: 'sine', harmonic: 2 },
      footstep: { frequency: 86, endFrequency: 52, duration: 0.065, gain: 0.045, type: 'square', noise: 0.25 },
      jump: { frequency: 145, endFrequency: 275, duration: 0.16, gain: 0.09, type: 'triangle', harmonic: 2 },
      land: { frequency: 105, endFrequency: 38, duration: 0.14, gain: 0.105, type: 'square', noise: 0.42 },
      cassettePickup: { frequency: 410, endFrequency: 790, duration: 0.22, gain: 0.075, type: 'triangle', harmonic: 2 },
      cardOpen: { frequency: 260, endFrequency: 520, duration: 0.42, gain: 0.065, type: 'sine', harmonic: 2 },
      cardClose: { frequency: 240, endFrequency: 90, duration: 0.28, gain: 0.06, type: 'triangle' },
      hydrantHit1: { frequency: 110, endFrequency: 62, duration: 0.16, gain: 0.12, type: 'square', noise: 0.32 },
      hydrantHit2: { frequency: 95, endFrequency: 48, duration: 0.2, gain: 0.135, type: 'sawtooth', noise: 0.38 },
      hydrantHit3: { frequency: 76, endFrequency: 34, duration: 0.28, gain: 0.15, type: 'square', noise: 0.46 },
      hydrantBreak: { frequency: 130, endFrequency: 28, duration: 0.5, gain: 0.17, type: 'sawtooth', noise: 0.65 },
      waterBurst: { frequency: 340, endFrequency: 85, duration: 0.52, gain: 0.1, type: 'sawtooth', noise: 0.7 },
      waterLoop: { frequency: 120, endFrequency: 105, duration: 0.2, gain: 0.02, type: 'sine' },
      waterSplash: { frequency: 620, endFrequency: 160, duration: 0.14, gain: 0.075, type: 'triangle', noise: 0.8 },
      wellEnter: { frequency: 125, endFrequency: 36, duration: 0.68, gain: 0.11, type: 'sine', harmonic: 0.5 },
      fallWind: { frequency: 180, endFrequency: 55, duration: 0.7, gain: 0.065, type: 'sawtooth', noise: 0.32 },
      crtDistortion: { frequency: 55, endFrequency: 680, duration: 0.22, gain: 0.065, type: 'square', noise: 0.4 },
      caveImpact: { frequency: 72, endFrequency: 25, duration: 0.54, gain: 0.18, type: 'square', harmonic: 0.5, noise: 0.55 },
      dizzy: { frequency: 610, endFrequency: 430, duration: 0.3, gain: 0.06, type: 'sine', harmonic: 1.5 },
      candleIgnite: { frequency: 260, endFrequency: 620, duration: 0.18, gain: 0.065, type: 'triangle', noise: 0.18 },
      finalCardPickup: { frequency: 220, endFrequency: 880, duration: 0.72, gain: 0.09, type: 'sine', harmonic: 2 },
      tvSwitch: { frequency: 145, endFrequency: 48, duration: 0.075, gain: 0.13, type: 'square', harmonic: 0.5, noise: 0.72 },
      tvPowerOn: { frequency: 42, endFrequency: 155, duration: 0.76, gain: 0.1, type: 'sawtooth', harmonic: 2, noise: 0.34 },
      tvPowerOff: { frequency: 210, endFrequency: 26, duration: 0.68, gain: 0.12, type: 'sawtooth', harmonic: 0.5, noise: 0.48 },
      clockAlign: { frequency: 92, endFrequency: 740, duration: 1.8, gain: 0.085, type: 'triangle', harmonic: 2, noise: 0.08 },
      timeWarp: { frequency: 48, endFrequency: 1250, duration: 2.35, gain: 0.12, type: 'sine', harmonic: 1.5, noise: 0.34 },
      meteorSplit: { frequency: 560, endFrequency: 46, duration: 0.72, gain: 0.15, type: 'sawtooth', harmonic: 0.5, noise: 0.82 },
      meteorImpact: { frequency: 84, endFrequency: 18, duration: 1.6, gain: 0.22, type: 'sawtooth', harmonic: 0.5, noise: 0.92 },
    };
    if (this.context?.state === 'suspended') void this.context.resume();
    this.tone(shapes[event]);
  }

  public ambience(kind: AmbienceKind): void {
    this.requestedAmbience = kind;
    if (this.context?.state === 'running') this.startAmbienceNow(kind);
  }

  public stopAmbience(): void {
    if (this.ambienceTimer !== null) {
      window.clearInterval(this.ambienceTimer);
      this.ambienceTimer = null;
    }
    this.ambienceNodes.forEach((node) => {
      try { (node as AudioScheduledSourceNode).stop(); } catch { /* not a source or already stopped */ }
      try { node.disconnect(); } catch { /* already disconnected */ }
    });
    this.ambienceNodes = [];
  }

  public startMeteorRumble(): void {
    const context = this.context;
    const master = this.master;
    if (!context || !master || this.meteorRumbleGain) return;
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    const oscillator = context.createOscillator();
    const noise = context.createBufferSource();
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * 1.5), context.sampleRate);
    const samples = buffer.getChannelData(0);
    let previous = 0;
    for (let index = 0; index < samples.length; index += 1) {
      previous = previous * 0.88 + (Math.random() * 2 - 1) * 0.12;
      samples[index] = previous;
    }
    const now = context.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(180, now);
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(38, now);
    noise.buffer = buffer;
    noise.loop = true;
    oscillator.connect(gain);
    noise.connect(filter).connect(gain);
    gain.connect(master);
    oscillator.start();
    noise.start();
    this.meteorRumbleGain = gain;
    this.meteorRumbleFilter = filter;
    this.meteorRumbleOscillator = oscillator;
    this.meteorRumbleNodes = [gain, filter, oscillator, noise];
  }

  public setMeteorRumble(heat: number): void {
    if (!this.meteorRumbleGain && this.context?.state === 'running') this.startMeteorRumble();
    const context = this.context;
    const gain = this.meteorRumbleGain;
    const filter = this.meteorRumbleFilter;
    const oscillator = this.meteorRumbleOscillator;
    if (!context || !gain || !filter || !oscillator) return;
    const amount = Math.max(0, Math.min(1, heat));
    const now = context.currentTime;
    gain.gain.cancelScheduledValues(now);
    filter.frequency.cancelScheduledValues(now);
    oscillator.frequency.cancelScheduledValues(now);
    gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
    filter.frequency.setValueAtTime(filter.frequency.value, now);
    oscillator.frequency.setValueAtTime(oscillator.frequency.value, now);
    gain.gain.linearRampToValueAtTime(0.004 + amount * 0.075, now + 0.18);
    filter.frequency.linearRampToValueAtTime(190 + amount * 980, now + 0.2);
    oscillator.frequency.linearRampToValueAtTime(38 + amount * 34, now + 0.2);
  }

  public stopAllLoops(): void {
    this.requestedAmbience = null;
    this.stopAmbience();
    this.stopTelevisionStatic();
    this.stopMeteorRumble();
  }

  public stopMeteorRumble(): void {
    const context = this.context;
    const gain = this.meteorRumbleGain;
    const nodes = this.meteorRumbleNodes;
    this.meteorRumbleGain = null;
    this.meteorRumbleFilter = null;
    this.meteorRumbleOscillator = null;
    this.meteorRumbleNodes = [];
    if (!context || !gain) return;
    const now = context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    window.setTimeout(() => {
      nodes.forEach((node) => {
        try { (node as AudioScheduledSourceNode).stop(); } catch { /* not a source or already stopped */ }
        try { node.disconnect(); } catch { /* already disconnected */ }
      });
    }, 280);
  }

  public suspendForTelevision(): void {
    this.stopAmbience();
    this.stopTelevisionStatic();
    this.stopMeteorRumble();
  }

  public resumeForTelevision(): void {
    if (this.requestedAmbience && this.context?.state === 'running') {
      this.startAmbienceNow(this.requestedAmbience);
    }
  }

  public startTelevisionStatic(): void {
    const context = this.context;
    const master = this.master;
    if (!context || !master || this.televisionNoiseSource) return;

    const duration = 1.5;
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * duration), context.sampleRate);
    const samples = buffer.getChannelData(0);
    let previous = 0;
    for (let index = 0; index < samples.length; index += 1) {
      const white = Math.random() * 2 - 1;
      previous = previous * 0.12 + white * 0.88;
      samples[index] = previous;
    }

    const source = context.createBufferSource();
    const highpass = context.createBiquadFilter();
    const lowpass = context.createBiquadFilter();
    const gain = context.createGain();
    const now = context.currentTime;
    source.buffer = buffer;
    source.loop = true;
    highpass.type = 'highpass';
    highpass.frequency.value = 540;
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 6200;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.085, now + 0.08);
    source.connect(highpass).connect(lowpass).connect(gain).connect(master);
    source.start(now);
    this.televisionNoiseSource = source;
    this.televisionNoiseGain = gain;
    this.televisionNoiseNodes = [source, highpass, lowpass, gain];
  }

  public stopTelevisionStatic(): void {
    const context = this.context;
    const source = this.televisionNoiseSource;
    const gain = this.televisionNoiseGain;
    const nodes = this.televisionNoiseNodes;
    this.televisionNoiseSource = null;
    this.televisionNoiseGain = null;
    this.televisionNoiseNodes = [];
    if (!context || !source || !gain) return;

    const now = context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
    try { source.stop(now + 0.12); } catch { /* already stopped */ }
    window.setTimeout(() => {
      nodes.forEach((node) => {
        try { node.disconnect(); } catch { /* already disconnected */ }
      });
    }, 160);
  }

  private tone(shape: ToneShape): void {
    const context = this.context;
    const master = this.master;
    if (!context || !master) return;
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

    if (shape.harmonic) {
      const harmonic = context.createOscillator();
      const harmonicGain = context.createGain();
      harmonic.type = 'sine';
      harmonic.frequency.setValueAtTime(Math.max(1, shape.frequency * shape.harmonic), now);
      harmonic.frequency.exponentialRampToValueAtTime(Math.max(1, shape.endFrequency * shape.harmonic), now + shape.duration);
      harmonicGain.gain.setValueAtTime(0.0001, now);
      harmonicGain.gain.exponentialRampToValueAtTime(shape.gain * 0.28, now + 0.01);
      harmonicGain.gain.exponentialRampToValueAtTime(0.0001, now + shape.duration);
      harmonic.connect(harmonicGain).connect(master);
      harmonic.start(now);
      harmonic.stop(now + shape.duration + 0.02);
    }

    if (shape.noise) this.noiseBurst(shape.duration, shape.gain * shape.noise);
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
    // 1.8x the previous ambience bus level: clearly audible while SFX stay in front.
    bus.gain.exponentialRampToValueAtTime(kind === 'surface' ? 0.432 : 0.36, now + 1.8);
    filter.type = 'lowpass';
    filter.frequency.value = kind === 'surface' ? 1450 : 760;
    bus.connect(filter).connect(master);

    const droneGain = context.createGain();
    droneGain.gain.value = kind === 'surface' ? 0.045 : 0.06;
    droneGain.connect(bus);
    const frequencies = kind === 'surface' ? [48, 73] : [37, 53];
    const oscillators = frequencies.map((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = index === 0 ? 'sine' : 'triangle';
      oscillator.frequency.value = frequency;
      oscillator.detune.value = index * 7 - 3;
      oscillator.connect(droneGain);
      oscillator.start();
      return oscillator;
    });
    this.ambienceNodes = [bus, filter, droneGain, ...oscillators];
    this.musicStep = 0;
    const playNextNote = (): void => this.scheduleMusicStep(kind, bus);
    playNextNote();
    this.ambienceTimer = window.setInterval(playNextNote, kind === 'surface' ? 460 : 620);
  }

  private scheduleMusicStep(kind: AmbienceKind, bus: GainNode): void {
    const context = this.context;
    if (!context || context.state !== 'running') return;
    const patterns: Record<AmbienceKind, Array<number | null>> = {
      surface: [220, 277.18, 329.63, null, 246.94, 329.63, 369.99, null, 220, 329.63, 277.18, 246.94, null, 185, 220, null],
      cave: [110, null, 123.47, null, 98, 146.83, null, 82.41, 110, null, 73.42, null],
    };
    const pattern = patterns[kind];
    const frequency = pattern[this.musicStep % pattern.length];
    this.musicStep += 1;
    if (!frequency) return;

    const now = context.currentTime;
    const duration = kind === 'surface' ? 0.7 : 1.05;
    const oscillator = context.createOscillator();
    const noteGain = context.createGain();
    oscillator.type = kind === 'surface' ? 'triangle' : 'sine';
    oscillator.frequency.value = frequency;
    oscillator.detune.value = Math.sin(this.musicStep * 1.7) * 3;
    noteGain.gain.setValueAtTime(0.0001, now);
    noteGain.gain.exponentialRampToValueAtTime(kind === 'surface' ? 0.22 : 0.18, now + 0.035);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(noteGain).connect(bus);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
  }

  private noiseBurst(duration: number, peakGain: number): void {
    const context = this.context;
    const master = this.master;
    if (!context || !master) return;
    const frameCount = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, frameCount, context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = Math.random() * 2 - 1;
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const now = context.currentTime;
    source.buffer = buffer;
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    filter.Q.value = 0.7;
    gain.gain.setValueAtTime(Math.max(0.0001, peakGain), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter).connect(gain).connect(master);
    source.start(now);
    source.stop(now + duration + 0.02);
  }
}
