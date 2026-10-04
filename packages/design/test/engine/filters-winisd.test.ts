/**
 * Every WinISD Filter Editor type, matched to WinISD's own logged response and group delay.
 *
 * Golden data: `../fixtures/winisdFilterCaptures.ts` (`WINISD_FILTER_CAPTURES`) — one filter
 * per capture, its response and group delay logged live from WinISD 0.7.0.950 by debugger.
 * Formulas and quirks: winisd_research/GHIDRA_FINDINGS.md "EQ/Filter chain — every filter
 * type's response and group delay".
 *
 * The engine has one door (`Engine`); a single filter's own response/group delay is read off
 * `SimulationEngine.sweep`'s "(EQ/Filter)" outputs (`fltMag`/`fltPhase`/`fltGd`) at a one-point grid
 * (`fmin === fmax`, `N: 0`) rather than by importing `evalFilter`/`groupDelayAtMs` past the
 * door — the same pattern `tl-port-model.test.ts` uses to reach `cTanh` through `SimulationEngine.sweep`.
 * `fltGd` IS `groupDelayAtMs(filterChain, f)` (`sweep.ts`), so this is the same computation the
 * brief names, not an approximation of it.
 */
import type {TestSolverQuantities} from './testSolver.js';
import {sweepDriver, solveConsistencyGroup} from './testSolver.js';
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import type {Filter} from '../../engine/index.js';
import {createEngine} from '../../engine/index.js';
import {WINISD_FILTER_CAPTURES} from '../fixtures/winisdFilterCaptures.js';

const engine = createEngine();

// The filter chain's own response does not depend on the driver or box (proved directly in
// filter-chain-charts.test.ts) — any solvable reference driver does.
const RAW: TestSolverQuantities = {
  Fs_hz: 37, Qts: 0.378, Qes: 0.40, Qms: 7.0, Vas_m3: 0.0300,
  Sd_m2: 0.0133, Re_ohm: 5.6, Le_H: 0.70e-3, Xmax_m: 0.0050, Pe_W: 60, Znom_ohm: 8};
const DRV = solveConsistencyGroup(RAW);
const LE_H = 0.70e-3;

/** This filter alone, at exactly one frequency — `fmin === fmax`, `N: 0` makes `sweep`'s grid
 *  a single point at `f` (`f0 * (f1/f0)^(i/N)`, and `Math.pow(1, NaN)` is 1). */
/** `allpass`: the "WinISD allpass order" flag, `null` to leave it out of the params. */
function filterAt(filter: Filter, f: number, allpass: boolean | null = true) {
  const sw = engine.simulation.sweep(sweepDriver(DRV), LE_H, 'sealed',
    // The captures are WinISD's own, Bessel high-pass and allpass errors included
    // (`winisdBesselHighpass`, `winisdAllpassOrder`).
    {Vb: 0.030, eg: 2.83, fmin: f, fmax: f, N: 0, filters: [filter], winisdBesselHighpass: true,
      ...(allpass === null ? {} : {winisdAllpassOrder: allpass})}).values!;
  return {mag: sw.fltMag[0], phase: sw.fltPhase[0], gdMs: sw.fltGd[0]};
}

describe('every WinISD filter type, matched to WinISD\'s own logged response', () => {
  for (const capture of WINISD_FILTER_CAPTURES) {
    it(capture.wpr, () => {
      for (const point of capture.points) {
        const {mag, phase, gdMs} = filterAt(capture.filter, point.f);
        const magLin = Math.pow(10, mag / 20);
        const actualRe = magLin * Math.cos(phase), actualIm = magLin * Math.sin(phase);
        const expectedMag = Math.hypot(point.re, point.im);
        const relErr = Math.hypot(actualRe - point.re, actualIm - point.im) / expectedMag;
        assert.ok(relErr <= 1e-12,
          `${capture.wpr} @ ${point.f} Hz: relative error ${relErr.toExponential(3)} ` +
          `(got ${actualRe}${actualIm >= 0 ? '+' : ''}${actualIm}j, want ${point.re}${point.im >= 0 ? '+' : ''}${point.im}j)`);

        const gdS = gdMs / 1000;
        const gdTol = Math.max(5e-4 * Math.abs(point.gd_s), 1e-6);
        assert.ok(Math.abs(gdS - point.gd_s) <= gdTol,
          `${capture.wpr} @ ${point.f} Hz: group delay ${gdS}s, want ${point.gd_s}s (tol ${gdTol}s)`);
      }
    });
  }
});

describe('applyFilters skips a disabled filter', () => {
  it('a disabled filter of any captured type is unity — WinISD never evaluates one', () => {
    for (const capture of WINISD_FILTER_CAPTURES) {
      const f = capture.points[0]!.f;
      const {mag, phase, gdMs} = filterAt({...capture.filter, enabled: false}, f);
      assert.equal(mag, 0, `${capture.wpr}: a disabled filter must read 0 dB`);
      assert.equal(phase, 0, `${capture.wpr}: a disabled filter must read 0 rad`);
      assert.equal(gdMs, 0, `${capture.wpr}: a disabled filter must read 0 ms group delay`);
    }
  });
});

/**
 * Allpass and the "WinISD allpass order" error switch (`winisdAllpassOrder`).
 * WinISD: order 1 delays t; order 2 and above draw one 2nd-order section with ω0 = 2/t, so the
 * delay is t/Q and orders 3–10 equal order 2 (bugs/archive/BUG_20260927_winisd-allpass-t-not-delay-order-above-2-ignored.md).
 * Off (the default): the order-n Bessel (maximally flat delay) allpass θn(−s·t/2)/θn(s·t/2), its
 * low-frequency delay t at every order; Q is not used.
 */
describe('Allpass, switch off: the order-n Bessel allpass, delay t', () => {
  const T = 0.003;
  const allpass = (order: number, Q = 0.6): Filter => ({type: 'allpass', enabled: true, order, t: T, Q});

  it('low-frequency delay is t at every order 1..20 (phase/ω to 1e-6, group delay to 1e-3)', () => {
    for (let order = 1; order <= 20; order++) {
      const f = 0.1;
      const {mag, phase, gdMs} = filterAt(allpass(order), f, false);
      assert.ok(Math.abs(mag) < 1e-9, `order ${order}: |H| = 1 (got ${mag} dB)`);
      const delay = -phase / (2 * Math.PI * f);
      assert.ok(Math.abs(delay - T) / T < 1e-6, `order ${order}: −φ/ω ${delay}, want ${T}`);
      assert.ok(Math.abs(gdMs / 1000 - T) / T < 1e-3, `order ${order}: group delay ${gdMs} ms, want ${T * 1000} ms`);
    }
  });

  it('Q is not used', () => {
    for (const f of [1, 30, 200]) assert.deepEqual(filterAt(allpass(3, 0.6), f, false), filterAt(allpass(3, 2.5), f, false));
  });

  it('the order is honoured: order 4 differs from order 2, and a higher order holds the delay to a higher frequency', () => {
    const at = (order: number, f: number) => filterAt(allpass(order), f, false).gdMs / 1000;
    assert.ok(Math.abs(filterAt(allpass(4), 100, false).phase - filterAt(allpass(2), 100, false).phase) > 0.01);
    // At f·t = 0.6 (200 Hz, 3 ms) order 2 has lost more than 30 % of its delay, order 8 under 0.1 %.
    assert.ok(Math.abs(at(2, 200) - T) / T > 0.3, `order 2 at 200 Hz: ${at(2, 200)}`);
    assert.ok(Math.abs(at(8, 200) - T) / T < 1e-3, `order 8 at 200 Hz: ${at(8, 200)}`);
  });

  it('order 1 is WinISD\'s own (switch on and off agree)', () => {
    for (const f of [1, 30, 200, 2000]) assert.deepEqual(filterAt(allpass(1), f, false), filterAt(allpass(1), f, true));
  });

  it('absent flag means off', () => {
    assert.deepEqual(filterAt(allpass(4), 40, null), filterAt(allpass(4), 40, false));
  });
});

describe('Allpass, switch on: WinISD\'s', () => {
  it('order 4 draws exactly order 2 (t/Q delay)', () => {
    const ap = (order: number): Filter => ({type: 'allpass', enabled: true, order, t: 0.003, Q: 0.6});
    for (const f of [1, 30, 200, 2000]) assert.deepEqual(filterAt(ap(4), f, true), filterAt(ap(2), f, true));
    const {gdMs} = filterAt(ap(4), 1, true);
    assert.ok(Math.abs(gdMs - 5) < 5e-3, `order 4 delay ${gdMs} ms, want 5 ms (t/Q)`);
  });
});
