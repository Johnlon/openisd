import {linearTicks, logTicks} from './ticks.js';

/** Frequency axis end clamps for a drag: 1 Hz … 40 kHz, at least 0.1 decade wide. */
const DRAG_LOG_MIN = 0;
const DRAG_LOG_MAX = Math.log10(40000);
const DRAG_MIN_DECADES = 0.1;

/** Where on a frequency axis a drag started: the low end, the high end, the middle, or either
 *  end symmetrically. */
export type FrequencyDragMode = 'pan' | 'zoomLo' | 'zoomHi' | 'zoomSym';

/** The same for a level axis: the top end, the bottom end, the middle, or both ends. */
export type LevelDragMode = 'pan' | 'zoomTop' | 'zoomBot' | 'zoomSym';

export interface GridLine {
  readonly f: number;
  /** On a decade (1 × 10ⁿ). */
  readonly major: boolean;
  /** Carries a text label (1, 2 or 5 × 10ⁿ). */
  readonly labelled: boolean;
}

export interface FrequencyBand {
  readonly lo: number;
  readonly hi: number;
}

export interface LevelTick {
  readonly value: number;
  readonly major: boolean;
  readonly labelled: boolean;
}

/** A logarithmic frequency axis `fmin … fmax`. Fractions run 0 (fmin) … 1 (fmax). */
export class FrequencyAxis {
  private readonly lx0: number;
  private readonly lx1: number;

  constructor(readonly fmin: number, readonly fmax: number) {
    this.lx0 = Math.log10(fmin);
    this.lx1 = Math.log10(fmax);
  }

  fraction(f: number): number {
    return (Math.log10(f) - this.lx0) / (this.lx1 - this.lx0);
  }

  /** The frequency at `fraction` of the way along the axis. */
  at(fraction: number): number {
    return Math.pow(10, this.lx0 + fraction * (this.lx1 - this.lx0));
  }

  /** Lines at 1…9 × each decade inside the axis. */
  gridLines(): GridLine[] {
    const lines: GridLine[] = [];
    for (let dec = Math.floor(this.lx0); dec <= Math.ceil(this.lx1); dec++)
      for (const mul of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
        const f = mul * Math.pow(10, dec);
        if (f < this.fmin || f > this.fmax) continue;
        lines.push({ f, major: mul === 1, labelled: mul === 1 || mul === 2 || mul === 5 });
      }
    return lines;
  }

  /** A selected band held to the axis ends. */
  clampBand(fLo: number, fHi: number): FrequencyBand {
    return { lo: Math.max(fLo, this.fmin), hi: Math.min(fHi, this.fmax) };
  }

  /** One nudge of the cursor, multiplicative because the axis is logarithmic. `dir` is +1 up,
   *  -1 down. `current` is null when nothing is pinned, so the step starts from the geometric
   *  mean of the axis. Held to the axis. */
  step({ current, dir, factor }: { current: number | null; dir: number; factor: number }): number {
    const from = current ?? Math.sqrt(this.fmin * this.fmax);
    const stepped = dir > 0 ? from * factor : from / factor;
    return Math.max(this.fmin, Math.min(this.fmax, stepped));
  }

  /** A typed frequency held to the axis. Null for anything the axis cannot show — a log axis has
   *  no zero and no negative side, and a half-typed entry parses to NaN. Null means "unpin the
   *  cursor". */
  clampTyped(value: number): number | null {
    if (!isFinite(value) || value <= 0) return null;
    return Math.max(this.fmin, Math.min(this.fmax, value));
  }

  /** The axis after dragging by `dxFraction` (pointer travel ÷ plot width) from this one. Held to
   *  1 Hz … 40 kHz and at least 0.1 decade wide. */
  drag(mode: FrequencyDragMode, dxFraction: number): FrequencyAxis | null {
    const span = this.lx1 - this.lx0;
    let a = this.lx0, b = this.lx1;
    if (mode === 'pan') { const d = -dxFraction * span; a += d; b += d; }
    else if (mode === 'zoomLo') { a += dxFraction * span; }
    else if (mode === 'zoomHi') { b += dxFraction * span; }
    else {
      const c = (this.lx0 + this.lx1) / 2, half = (span / 2) * Math.max(0.05, 1 - dxFraction);
      a = c - half; b = c + half;
    }
    a = Math.max(DRAG_LOG_MIN, Math.min(a, DRAG_LOG_MAX - DRAG_MIN_DECADES));
    b = Math.min(DRAG_LOG_MAX, Math.max(b, a + DRAG_MIN_DECADES));
    if (b - a < DRAG_MIN_DECADES) return null;
    return new FrequencyAxis(Math.pow(10, a), Math.pow(10, b));
  }

  /** Two frequencies within 0.02 decades of each other. */
  isNear(f: number, g: number): boolean {
    return Math.abs(Math.log10(f) - Math.log10(g)) < 0.02;
  }

  /** Nearest sample index to `f` in a log-spaced `xs` grid. */
  nearestIndex(xs: readonly number[], f: number): number {
    let best = 0, bestD = Infinity;
    for (let i = 0; i < xs.length; i++) {
      const d = Math.abs(Math.log10(xs[i]) - Math.log10(f));
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  /** Nearest sample index to `f`, or null when `f` falls outside the series' own plotted range.
   *  The chart axis (presentationState.sweepRange) updates on every drag pixel while the throttled
   *  sweep it's drawn from lags a step behind, so the cursor can sit left of xs[0] for the
   *  ~32ms until the next resweep lands. Snapping to xs[0] there would paint a value at a
   *  frequency the curve hasn't reached yet — QO: "Max power chart, missing below 10Hz but
   *  cursor still shows a value". */
  crosshairIndex(xs: readonly number[], f: number): number | null {
    if (xs.length === 0 || f < xs[0] || f > xs[xs.length - 1]) return null;
    return this.nearestIndex(xs, f);
  }

  /** Grid-line label: `k` from 1 kHz, 2 dp under 10 kHz. */
  tickLabel(f: number): string {
    return f >= 1000 ? (f / 1000).toFixed(f < 10000 ? 2 : 1) + 'k' : f.toFixed(0);
  }

  /** Selected-band edge label: 1 dp under 100 Hz, none above. */
  bandLabel(f: number): string {
    return f >= 100 ? f.toFixed(0) : f.toFixed(1);
  }

  /** Cursor frequency label: 1 dp under 100 Hz, none above. */
  cursorLabel(f: number): string {
    return f.toFixed(f < 100 ? 1 : 0);
  }
}

/** A level axis `min … max`, linear or logarithmic. Fractions run 0 (min) … 1 (max). */
export class LevelAxis {
  private readonly l0: number;
  private readonly l1: number;

  constructor(readonly min: number, readonly max: number, readonly logy: boolean) {
    this.l0 = logy ? Math.log10(min) : min;
    this.l1 = logy ? Math.log10(max) : max;
  }

  fraction(v: number): number {
    const vv = this.logy ? Math.log10(v) : v;
    return (vv - this.l0) / (this.l1 - this.l0);
  }

  /** Ticks for a plot `ph` px tall. Linear: round steps, all labelled, majors every ten steps'
   *  decade. Log: 1, 2, 5 per decade, majors and labels on the decades. */
  ticks(ph: number): LevelTick[] {
    if (this.logy) {
      return logTicks(this.min, this.max).map(value => {
        const major = Math.abs(Math.log10(value) - Math.round(Math.log10(value))) < 1e-9;
        return { value, major, labelled: major };
      });
    }
    const { ticks, step, mag } = linearTicks(this.min, this.max, ph);
    return ticks.map(value => ({
      value,
      major: step >= 10 * mag ? true : Math.abs(value / (10 * mag) - Math.round(value / (10 * mag))) < 1e-9,
      labelled: true,
    }));
  }

  /** The axis after dragging by `dyFraction` (pointer travel ÷ plot height, down positive) from
   *  this one, in display space. Null when the span would collapse below 5 % or leave the finite
   *  (log: positive) range. */
  drag(mode: LevelDragMode, dyFraction: number): LevelAxis | null {
    const span = this.l1 - this.l0;
    let a = this.l0, b = this.l1;
    if (mode === 'pan') { const d = -dyFraction * span; a += d; b += d; }
    else if (mode === 'zoomTop') { b += -dyFraction * span; }
    else if (mode === 'zoomBot') { a += -dyFraction * span; }
    else {
      const c = (this.l0 + this.l1) / 2, half = (span / 2) * Math.max(0.05, 1 + dyFraction);
      a = c - half; b = c + half;
    }
    if (b - a < span * 0.05) return null;
    const min = this.logy ? Math.pow(10, a) : a, max = this.logy ? Math.pow(10, b) : b;
    if (!isFinite(min) || !isFinite(max) || (this.logy && min <= 0)) return null;
    return new LevelAxis(min, max, this.logy);
  }

  /** This axis with a user-set range, or null when that range is unusable: not finite, not
   *  ascending, or not positive on a log axis. */
  overridden(min: number, max: number): LevelAxis | null {
    if (!(isFinite(min) && isFinite(max) && min < max && !(this.logy && min <= 0))) return null;
    return new LevelAxis(min, max, this.logy);
  }

  /** Grid-line label: `k` from 1000, fewer decimals as the magnitude grows. */
  tickLabel(v: number): string {
    const a = Math.abs(v);
    if (a >= 1000) return (v / 1000).toFixed(1) + 'k';
    if (a >= 10) return v.toFixed(0);
    if (a >= 1) return v.toFixed(1);
    return v.toFixed(2);
  }

  /** A cursor readout value with its unit; a dash when `v` is not finite. */
  readout(v: number, unit: string): string {
    if (!isFinite(v)) return '—';
    const a = Math.abs(v);
    return v.toFixed(a >= 100 ? 0 : a >= 10 ? 1 : 2) + ' ' + unit;
  }

  /** A selected-band statistic (ripple, peak, trough): 1 dp. */
  statLabel(v: number): string {
    return v.toFixed(1);
  }
}
