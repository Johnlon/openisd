/**
 * Bessel high-pass and the "Enable WinISD Bessel high-pass bug" error switch (`winisdBesselHighpass`).
 *
 * WinISD's Bessel high-pass keeps the low-pass's own denominator and swaps the numerator to
 * (k·s)^n, which is not the mirror of its low-pass (a Bessel high-pass is the low-pass with
 * s → 1/s). Off (the default) OpenISD draws the mirror, H_hp(jx) = H_lp(1/(jx)) = conj(H_lp(j/x));
 * on, WinISD's form.
 * Evidence: bugs/archive/BUG_20260927_winisd-bessel-highpass-not-mirror-of-lowpass.md and the
 * captures pinned in filters-winisd.test.ts (which run with the switch on).
 */
import {describe, expect, it} from 'vitest';
import type {Filter, SweepParams} from '../../engine/index.js';
import {createEngine} from '../../engine/index.js';
import {solveConsistencyGroup, sweepDriver} from './testSolver.js';

const engine = createEngine();
const DRV = solveConsistencyGroup({
  Fs_hz: 37, Qts: 0.378, Qes: 0.40, Qms: 7.0, Vas_m3: 0.0300, Sd_m2: 0.0133, Re_ohm: 5.6, Le_H: 0.70e-3,
  Xmax_m: 0.0050, Pe_W: 60, Znom_ohm: 8,
});
const LE_H = 0.70e-3;

function pass(type: 'lowpass' | 'highpass', family: 'bessel' | 'butterworth', order: number, fc: number): Filter {
  return {type, enabled: true, family, order, fc, Q: 0.707};
}

/** This filter alone at one frequency, as a complex number. */
function responseAt(filter: Filter, f: number, flag: boolean | undefined): {re: number; im: number} {
  const P: SweepParams = {Vb: 0.030, eg: 2.83, fmin: f, fmax: f, N: 0, filters: [filter],
    ...(flag === undefined ? {} : {winisdBesselHighpass: flag})};
  const sw = engine.simulation.sweep(sweepDriver(DRV), LE_H, 'sealed', P).values!;
  const mag = Math.pow(10, sw.fltMag[0]! / 20);
  return {re: mag * Math.cos(sw.fltPhase[0]!), im: mag * Math.sin(sw.fltPhase[0]!)};
}

function relative(a: {re: number; im: number}, b: {re: number; im: number}): number {
  return Math.hypot(a.re - b.re, a.im - b.im) / Math.hypot(b.re, b.im);
}

const FC = 25;
const POINTS = [3, 8, 14, 25, 40, 90, 300];

describe('Bessel high-pass, switch off: the mirror of the low-pass', () => {
  for (const order of [2, 3, 4, 7, 10]) {
    it(`order ${order}: H_hp(f) = conj(H_lp(fc²/f)) to 1e-9`, () => {
      for (const f of POINTS) {
        const hp = responseAt(pass('highpass', 'bessel', order, FC), f, false);
        const lp = responseAt(pass('lowpass', 'bessel', order, FC), FC * FC / f, false);
        expect(relative(hp, {re: lp.re, im: -lp.im}), `${f} Hz`).toBeLessThan(1e-9);
      }
    });
  }

  it('absent flag means off', () => {
    const f = pass('highpass', 'bessel', 4, FC);
    expect(responseAt(f, 14, undefined)).toEqual(responseAt(f, 14, false));
  });
});

describe('Bessel high-pass, switch on: WinISD\'s form', () => {
  it('order 4 differs from the mirror by several percent in complex response', () => {
    const f = pass('highpass', 'bessel', 4, FC);
    const worst = Math.max(...POINTS.map(p => relative(responseAt(f, p, true), responseAt(f, p, false))));
    expect(worst).toBeGreaterThan(0.01);
  });

  it('order 1: on and off agree (a first-order Bessel is symmetric)', () => {
    const f = pass('highpass', 'bessel', 1, FC);
    for (const p of POINTS) expect(relative(responseAt(f, p, true), responseAt(f, p, false)), `${p} Hz`).toBeLessThan(1e-12);
  });
});

describe('the switch touches nothing else', () => {
  it('Butterworth high-pass: on and off agree', () => {
    const f = pass('highpass', 'butterworth', 4, FC);
    for (const p of POINTS) expect(relative(responseAt(f, p, true), responseAt(f, p, false)), `${p} Hz`).toBeLessThan(1e-12);
  });

  it('Bessel low-pass: on and off agree', () => {
    const f = pass('lowpass', 'bessel', 4, FC);
    for (const p of POINTS) expect(relative(responseAt(f, p, true), responseAt(f, p, false)), `${p} Hz`).toBeLessThan(1e-12);
  });
});
