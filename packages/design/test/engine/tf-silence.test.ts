/**
 * The −200 dB silence sentinel (|p| = 0 exactly) versus real levels below −190 dB, which a steep
 * filter reaches (BUG_20261001_transfer-function-jumps-80db-where-spl-drops-below-190db).
 */
import {describe, expect, it} from 'vitest';
import {createEngine, type Filter, type SweepParams} from '../../engine/index.js';
import {sweepDriver, solveConsistencyGroup} from './testSolver.js';

const engine = createEngine();
const SILENCE = engine.simulation.silentCurve(1)[0];

describe('realLevels', () => {
  it('keeps every real level, however low, and drops only silence', () => {
    expect(engine.simulation.realLevels([-150, -189, -191, -199.9, -250, -400, SILENCE, NaN]))
      .toEqual([-150, -189, -191, -199.9, -250, -400]);
  });

  it('a silent curve has no real levels', () => {
    expect(engine.simulation.realLevels(engine.simulation.silentCurve(3))).toEqual([]);
  });
});

// A sealed box through LP Butterworth n=10 at 50 Hz: SPL falls past −190 dB inside the sweep
// (about −270 dB TF at 1.1 kHz), so every consumer below meets real levels under the old cutoff.
const DRV = solveConsistencyGroup({
  Fs_hz: 37, Qts: 0.378, Qes: 0.40, Qms: 7.0, Vas_m3: 0.0300,
  Sd_m2: 0.0133, Re_ohm: 5.6, Le_H: 0.70e-3, Xmax_m: 0.0050, Pe_W: 60, Znom_ohm: 8});
const LE_H = 0.70e-3;
const STEEP: Filter[] = [{ type: 'lowpass', family: 'butterworth', order: 10, fc: 50, Q: Math.SQRT1_2, enabled: true }];
const SEALED: SweepParams = { Vb: 0.030, eg: 2.83, fmin: 10, fmax: 20000, N: 400, filters: STEEP };
const sweep = (P: SweepParams) => engine.simulation.sweep(sweepDriver(DRV), LE_H, 'sealed', P).values!;

describe('levels below −190 dB in a real sweep', () => {
  const sw = sweep(SEALED);

  it('the sweep does reach below −190 dB SPL (the case under test exists)', () => {
    expect(Math.min(...sw.spl)).toBeLessThan(-190);
  });

  it('the transfer function falls without a step above fc', () => {
    for (let i = 1; i < sw.fs.length; i++)
      if (sw.fs[i] > 100) expect(sw.tfMag[i], `${sw.fs[i].toFixed(0)} Hz`).toBeLessThan(sw.tfMag[i - 1]);
  });

  it('the passband reference counts a real level below −190 dB', () => {
    expect(engine.simulation.passbandRef([-250, -195, SILENCE])).toBe(-195);
  });

  it('force flat lifts levels below −190 dB to 0 dB transfer function too', () => {
    const flat = sweep({ ...SEALED, forceFlatResponse: true });
    for (let i = 0; i < flat.fs.length; i++)
      expect(Math.abs(flat.tfMag[i]), `${flat.fs[i].toFixed(0)} Hz`).toBeLessThan(1e-9);
  });

  it('WinISD driver count adds 20·log10(N) to levels below −190 dB too', () => {
    const two = sweep({ ...SEALED, Vb: 0.060, nDrivers: 2 });
    const one = sweep({ ...SEALED, eg: 2.83 / Math.SQRT2 });
    for (let i = 0; i < two.fs.length; i++)
      expect(two.spl[i] - one.spl[i], `${two.fs[i].toFixed(0)} Hz`).toBeCloseTo(20 * Math.log10(2), 9);
  });
});
