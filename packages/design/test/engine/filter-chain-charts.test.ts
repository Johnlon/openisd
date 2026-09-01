/**
 * Unit tests for the EQ/filter chain's OWN response — the three arrays behind WinISD's
 * "Transfer function magnitude (EQ/Filter)", "Transfer function phase (EQ/Filter)" and
 * "Group Delay (EQ/Filter)" charts.
 *
 * The behaviour under test is fixed by WinISD Pro's help, "Filter/equalizer behavioral
 * simulator": the chain is an ELECTRICAL block ahead of the driver, and
 *   "0 dB gain at filter chain means that voltage at driver terminal is equal that is
 *    specified at 'signal'-tab."
 * Two consequences are asserted directly: unity is 0 dB, and the chain's response is a
 * property of the FILTERS ALONE (no driver term, no box term).
 *
 * Run: npm run test:unit
 */

import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { Engine } from '../../engine/index.js';
import type { SweepParams, Filter } from '../../engine/index.js';

/** Voice-coil inductance for the fixtures below. Not a solver quantity — nothing
 *  derives it — so it reaches `sweep` on its own, and only the impedance plot reads it. */
const LE_H = 0.70e-3;

/** The engine's one door: every calculation below is a method on this object. */
const engine = new Engine();

// Same reference driver as the other engine tests, so a failure here is about the filter
// chain and not about the driver.
const RAW: Record<string, number> = {
  Fs: 37, Qts: 0.378, Qes: 0.40, Qms: 7.0, Vas: 0.0300,
  Sd: 0.0133, Re: 5.6, Le: 0.70e-3, Xmax: 0.0050, Pe: 60, Znom: 8,
};
const { value: DRV } = engine.deriveEngineDriver(RAW);
assert.ok(DRV, 'reference driver failed to derive');

const SEALED: SweepParams = { Vb: 0.030, eg: 2.83, fmin: 10, fmax: 2000, N: 400 };
const SP     = Math.PI * (0.05 / 2) ** 2;
const VENTED: SweepParams = { Vb: 0.030, eg: 2.83, Sp: SP, Leff: 0.30 + 0.732 * 0.05, fmin: 10, fmax: 2000, N: 400 };

/** Index of the grid point nearest a frequency, so a claim can name the frequency it tests. */
const nearest = (fs: number[], f: number) =>
  fs.reduce((best, v, i) => Math.abs(v - f) < Math.abs(fs[best] - f) ? i : best, 0);

describe('EQ/filter chain charts — no filters means unity, exactly', () => {
  it('an empty chain is 0 dB, 0 rad and 0 ms at every frequency', () => {
    const sw = engine.sweep(DRV, LE_H, 'sealed', SEALED).value!;
    assert.equal(sw.fltMag.length, sw.fs.length);
    for (let i = 0; i < sw.fs.length; i++) {
      assert.equal(sw.fltMag[i], 0, `fltMag[${i}] at ${sw.fs[i]} Hz`);
      assert.equal(sw.fltPhase[i], 0, `fltPhase[${i}] at ${sw.fs[i]} Hz`);
      // Strict, i.e. Object.is: τg = −(Δφ)/Δω makes a flat phase yield IEEE NEGATIVE zero,
      // and `groupDelayMs` normalises it away. There is no such delay as −0 ms.
      assert.equal(sw.fltGd[i], 0, `fltGd[${i}] at ${sw.fs[i]} Hz`);
    }
  });

  it('a chain whose only filter is DISABLED is also unity — enabled is what counts', () => {
    const filters: Filter[] = [{ type: 'peaking', fc: 60, Q: 2, gain: 9, enabled: false }];
    const sw = engine.sweep(DRV, LE_H, 'sealed', { ...SEALED, filters }).value!;
    assert.ok(sw.fltMag.every(v => v === 0), 'a disabled filter still moved the chain');
  });
});

describe('EQ/filter chain charts — the magnitude is the chain\'s own gain in dB', () => {
  it('a 2nd-order Butterworth low-pass is −3.01 dB at its own fc', () => {
    // |H(fc)| = 1/√2 for Q = 1/√2, independent of everything else in the model.
    const filters: Filter[] = [{ type: 'lowpass', fc: 100, Q: Math.SQRT1_2, enabled: true }];
    const sw = engine.sweep(DRV, LE_H, 'sealed', { ...SEALED, filters }).value!;
    const i = nearest(sw.fs, 100);
    assert.ok(Math.abs(sw.fltMag[i] - 20 * Math.log10(Math.SQRT1_2)) < 0.05,
      `expected ≈ −3.01 dB at ${sw.fs[i].toFixed(2)} Hz, got ${sw.fltMag[i].toFixed(3)} dB`);
  });

  it('a +6 dB parametric EQ peaks at +6 dB on its centre frequency', () => {
    const filters: Filter[] = [{ type: 'peaking', fc: 60, Q: 3, gain: 6, enabled: true }];
    const sw = engine.sweep(DRV, LE_H, 'sealed', { ...SEALED, filters }).value!;
    const i = nearest(sw.fs, 60);
    assert.ok(Math.abs(sw.fltMag[i] - 6) < 0.1,
      `expected ≈ +6 dB at ${sw.fs[i].toFixed(2)} Hz, got ${sw.fltMag[i].toFixed(3)} dB`);
    assert.ok(Math.max(...sw.fltMag) <= 6.01, 'a +6 dB peak must not exceed +6 dB anywhere');
  });

  it('cascaded filters multiply, i.e. their dB gains add', () => {
    const a: Filter = { type: 'peaking', fc: 40, Q: 4, gain: 4, enabled: true };
    const b: Filter = { type: 'peaking', fc: 400, Q: 4, gain: 3, enabled: true };
    const swA  = engine.sweep(DRV, LE_H, 'sealed', { ...SEALED, filters: [a] }).value!;
    const swB  = engine.sweep(DRV, LE_H, 'sealed', { ...SEALED, filters: [b] }).value!;
    const swAB = engine.sweep(DRV, LE_H, 'sealed', { ...SEALED, filters: [a, b] }).value!;
    for (let i = 0; i < swAB.fs.length; i++)
      assert.ok(Math.abs(swAB.fltMag[i] - (swA.fltMag[i] + swB.fltMag[i])) < 1e-9,
        `cascade ≠ sum of dB at ${swAB.fs[i].toFixed(2)} Hz`);
  });
});

describe('EQ/filter chain charts — the chain is electrical, so driver and box do not enter it', () => {
  const filters: Filter[] = [{ type: 'highpass', fc: 30, Q: Math.SQRT1_2, enabled: true }];

  it('the same filters give the same chain response in a sealed and a vented box', () => {
    const s = engine.sweep(DRV, LE_H, 'sealed', { ...SEALED, filters }).value!;
    const v = engine.sweep(DRV, LE_H, 'vented', { ...VENTED, filters }).value!;
    for (let i = 0; i < s.fs.length; i++) {
      assert.equal(s.fltMag[i], v.fltMag[i],   `fltMag differs at ${s.fs[i].toFixed(2)} Hz`);
      assert.equal(s.fltPhase[i], v.fltPhase[i], `fltPhase differs at ${s.fs[i].toFixed(2)} Hz`);
      assert.equal(s.fltGd[i], v.fltGd[i],     `fltGd differs at ${s.fs[i].toFixed(2)} Hz`);
    }
    // Guard the guard: the SYSTEM curve must differ between those two boxes, or the
    // assertion above would pass for a trivially broken sweep.
    assert.notEqual(s.spl[nearest(s.fs, 30)], v.spl[nearest(v.fs, 30)]);
  });

  it('a different driver leaves the chain response untouched', () => {
    // Vary only params that are free of the Q identity 1/Qts = 1/Qes + 1/Qms — changing
    const other = engine.solveConsistencyGroup({ ...RAW, Fs_hz: 55, Vas_m3: 0.012, Sd_m2: 0.0090 });
    assert.ok(other, 'comparison driver failed to derive');
    const a = engine.sweep(DRV, LE_H,   'sealed', { ...SEALED, filters }).value!;
    const b = engine.sweep(other, LE_H, 'sealed', { ...SEALED, filters }).value!;
    for (let i = 0; i < a.fs.length; i++)
      assert.equal(a.fltMag[i], b.fltMag[i], `fltMag differs at ${a.fs[i].toFixed(2)} Hz`);
  });

  it('force-flat does not appear in the chain — it is a real gain applied downstream', () => {
    const off = engine.sweep(DRV, LE_H, 'sealed', { ...SEALED, filters }).value!;
    const on  = engine.sweep(DRV, LE_H, 'sealed', { ...SEALED, filters, forceFlatResponse: true }).value!;
    for (let i = 0; i < off.fs.length; i++)
      assert.equal(off.fltMag[i], on.fltMag[i], `force-flat leaked into the chain at ${off.fs[i].toFixed(2)} Hz`);
    // Guard the guard: force-flat must actually have done something to the output curve.
    assert.notEqual(off.spl[0], on.spl[0]);
  });
});

describe('EQ/filter chain charts — phase and group delay', () => {
  it('a 2nd-order high-pass leads in phase (positive) below its corner', () => {
    const filters: Filter[] = [{ type: 'highpass', fc: 40, Q: Math.SQRT1_2, enabled: true }];
    const sw = engine.sweep(DRV, LE_H, 'sealed', { ...SEALED, filters }).value!;
    const i = nearest(sw.fs, 12);
    const deg = sw.fltPhase[i] * 180 / Math.PI;
    assert.ok(deg > 90, `expected a large phase lead well below fc, got ${deg.toFixed(1)}° at ${sw.fs[i].toFixed(2)} Hz`);
  });
});
