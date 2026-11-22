/**
 * Iso-Barik loading: the motor's push is ONE driver's BL whether the driver's BL is typed or not.
 *
 * The app's default (Two-BL driver switch off) passes no typed BL (`projectSweep.ts`: `winisdBL_Tm:
 * null`), so the push BL falls back to the circuit's terminal BL. Taken after the pair was formed
 * that is the PAIR's √2·BL, which put every SPL point 3.01 dB high and the excursion 41 % high
 * (T928; ultra review 1 finding 1). With BL typed, the path WinISD's capture checks
 * (`isobarik-loading-winisd.test.ts`), the push was already one driver's. For a driver whose BL
 * agrees with its Qes the two paths are the same driver, so every chart must be the same.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import type {SweepParams, SweepResult} from '../../engine/types.js';
import {createEngine} from '../../engine/Engine.js';
import {solveConsistencyGroup, sweepDriver} from './testSolver.js';
import {REFERENCE_AIR} from '../fixtures/referenceAir.js';

const engine = createEngine();
const LE_H = 0.5e-3;
/** A driver whose BL is the one its Fs, Qes, Vas, Sd and Re imply. */
const D = solveConsistencyGroup({Fs_hz: 40, Qes: 0.45, Qms: 4, Vas_m3: 0.03, Sd_m2: 0.0133, Re_ohm: 6, Xmax_m: 0.005});
const P: SweepParams = {Vb: 0.02, eg: 2.83, fmin: 10, fmax: 1000, N: 200, Ql: 1e6, Qa: 1e6, air: REFERENCE_AIR, loading: 'isobaric', winisdIsobarik: true};

function run(winisdBL_Tm: number | null): SweepResult {
  const r = engine.simulation.sweep({...sweepDriver(D), winisdBL_Tm}, LE_H, 'sealed', P);
  if (r.values === null) throw new Error(JSON.stringify(r.issues));
  return r.values;
}

function assertSame(name: string, untyped: readonly number[], typed: readonly number[], fs: readonly number[]): void {
  typed.forEach((want, i) => {
    const got = untyped[i]!;
    assert.ok(Math.abs(got - want) <= 1e-9 * Math.max(1, Math.abs(want)),
      `${name} at ${fs[i]!.toFixed(2)} Hz: BL not typed ${got}, BL typed ${want}`);
  });
}

describe('Iso-Barik push BL is one driver\'s, BL typed or not (T928)', () => {
  it('the driver states a BL that agrees with its Qes', () => {
    assert.ok(D.BL_Tm !== undefined && D.BL_terminal_Tm !== undefined);
    assert.ok(Math.abs(D.BL_Tm - D.BL_terminal_Tm) < 1e-12);
  });

  const typed = run(D.BL_Tm!);
  const untyped = run(null);

  it('SPL is the same', () => assertSame('SPL', untyped.spl, typed.spl, typed.fs));
  it('excursion is the same', () => assertSame('excursion', untyped.exc, typed.exc, typed.fs));
  it('impedance is the same', () => assertSame('impedance', untyped.zmag, typed.zmag, typed.fs));
  it('transfer function is the same', () => assertSame('transfer function', untyped.tfMag, typed.tfMag, typed.fs));
});
