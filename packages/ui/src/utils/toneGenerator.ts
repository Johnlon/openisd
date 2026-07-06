/**
 * Signal-generator tone — a framework-free Web Audio wrapper shared by every skin
 * (the classic skin's "Signal Generator" box; available to modern/mobile too).
 *
 * WinISD's Signal Generator emits a real tone from the speakers; this matches that.
 * One oscillator → gain → destination. It is gesture-gated by design — construction
 * touches nothing; the AudioContext is created lazily on the first start() (which a
 * browser only permits from a user action). Frequency is clamped to the audible range,
 * gain is modest, and a short ramp avoids clicks. CSP-safe: no external assets.
 */

/**
 * The minimal Web-Audio surface this needs, described as our OWN interfaces rather than
 * `Pick<AudioContext>`. A real `AudioContext` satisfies it structurally, and a test fake
 * satisfies it too — so neither side needs an `as`-cast. (Owning the shape is what avoids
 * the type dodge; casting a fake to `AudioContext` would be lying to the compiler.)
 */
export interface ToneParam {
  value: number;
  setValueAtTime(value: number, when: number): void;
  linearRampToValueAtTime(value: number, when: number): void;
  cancelScheduledValues(when: number): void;
}
export interface ToneOsc {
  type: string;
  frequency: ToneParam;
  connect(dest: unknown): void;
  start(): void;
  stop(): void;
  disconnect(): void;
}
export interface ToneGain {
  gain: ToneParam;
  connect(dest: unknown): void;
  disconnect(): void;
}
export interface ToneCtx {
  createOscillator(): ToneOsc;
  createGain(): ToneGain;
  destination: unknown;
  currentTime: number;
  state: string;
  resume(): Promise<void>;
}

export interface ToneGenerator {
  /** Start (or restart) the tone at the given frequency. Safe to call when already playing. */
  start(freqHz: number): void;
  /** Update the live frequency without restarting the tone. */
  setFrequency(freqHz: number): void;
  /** Stop and tear down the oscillator. */
  stop(): void;
  /** Whether a tone is currently sounding. */
  playing(): boolean;
}

const MIN_HZ = 20;
const MAX_HZ = 20000;
const GAIN = 0.15;        // modest — never blast the user
const RAMP = 0.015;       // seconds; short attack/release avoids clicks

const clampHz = (f: number): number => {
  if (!Number.isFinite(f)) return MIN_HZ;
  return Math.min(MAX_HZ, Math.max(MIN_HZ, f));
};

export function createToneGenerator(makeCtx: () => ToneCtx = () => new AudioContext()): ToneGenerator {
  let ctx: ToneCtx | null = null;
  let osc: ToneOsc | null = null;
  let gain: ToneGain | null = null;

  return {
    start(freqHz: number): void {
      if (osc) { this.setFrequency(freqHz); return; }   // already playing → just retune
      ctx ??= makeCtx();
      if (ctx.state === 'suspended') void ctx.resume();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(clampHz(freqHz), ctx.currentTime);
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(GAIN, ctx.currentTime + RAMP);   // fade in
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      osc = o; gain = g;
    },

    setFrequency(freqHz: number): void {
      if (osc && ctx) osc.frequency.setValueAtTime(clampHz(freqHz), ctx.currentTime);
    },

    stop(): void {
      if (!osc || !ctx || !gain) return;
      const t = ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0, t + RAMP);   // fade out
      osc.stop();
      osc.disconnect();
      gain.disconnect();
      osc = null; gain = null;
    },

    playing(): boolean {
      return osc !== null;
    },
  };
}
