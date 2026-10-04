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

/** These filters alone, at exactly one frequency — `fmin === fmax`, `N: 0` makes `sweep`'s grid
 *  a single point at `f` (`f0 * (f1/f0)^(i/N)`, and `Math.pow(1, NaN)` is 1). The captures are
 *  WinISD's own, Bessel high-pass error included (`winisdBesselHighpass`). */
function chainAt(filters: Filter[], f: number) {
  const sw = engine.simulation.sweep(sweepDriver(DRV), LE_H, 'sealed',
    {Vb: 0.030, eg: 2.83, fmin: f, fmax: f, N: 0, filters, winisdBesselHighpass: true}).values!;
  return {mag: sw.fltMag[0], phase: sw.fltPhase[0], gdMs: sw.fltGd[0]};
}
function filterAt(filter: Filter, f: number) { return chainAt([filter], f); }

/** What WinISD draws for an input it ignores (a recorded deviation, OpenISD honours the input):
 *  an allpass above order 2 is drawn as order 2, a Linkwitz-Riley of any order as order 4. */
function winisdDrawn(filter: Filter): Filter {
  if (filter.type === 'allpass' && filter.order > 2) return {...filter, order: 2};
  if ((filter.type === 'lowpass' || filter.type === 'highpass') && filter.family === 'linkwitzRiley' && filter.order !== 4) return {...filter, order: 4};
  return filter;
}

describe('every WinISD filter type, matched to WinISD\'s own logged response', () => {
  for (const capture of WINISD_FILTER_CAPTURES) {
    it(capture.wpr, () => {
      for (const point of capture.points) {
        const {mag, phase, gdMs} = filterAt(winisdDrawn(capture.filter), point.f);
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

describe('a capture whose input WinISD ignores is a recorded deviation: OpenISD honours the input', () => {
  for (const capture of WINISD_FILTER_CAPTURES.filter(c => winisdDrawn(c.filter) !== c.filter)) {
    it(capture.wpr, () => {
      const worst = Math.max(...capture.points.map(point => {
        const {mag, phase} = filterAt(capture.filter, point.f);
        const m = Math.pow(10, mag / 20);
        return Math.hypot(m * Math.cos(phase) - point.re, m * Math.sin(phase) - point.im) / Math.hypot(point.re, point.im);
      }));
      assert.ok(worst > 1e-3, `${capture.wpr}: OpenISD should differ from WinISD's capture (worst ${worst})`);
    });
  }
});

/**
 * Allpass. Order 1 delays t (WinISD's and the Bessel allpass agree); order 2 is WinISD's own
 * 2nd-order section, ω0 = 2/t and Q, delay t/Q. Above order 2 WinISD ignores the order and draws
 * order 2; OpenISD draws the order-n Bessel (maximally flat delay) allpass θn(−s·t/2)/θn(s·t/2),
 * delay t, and Q is not used (bugs/archive/BUG_20260927_winisd-allpass-t-not-delay-order-above-2-ignored.md).
 */
describe('Allpass above order 2: the order-n Bessel allpass, delay t', () => {
  const T = 0.003;
  const allpass = (order: number, Q = 0.6): Filter => ({type: 'allpass', enabled: true, order, t: T, Q});

  it('low-frequency delay is t at order 1 and every order 3..20 (phase/ω to 1e-6, group delay to 1e-3)', () => {
    for (const order of [1, ...Array.from({length: 18}, (_, i) => i + 3)]) {
      const f = 0.1;
      const {mag, phase, gdMs} = filterAt(allpass(order), f);
      assert.ok(Math.abs(mag) < 1e-9, `order ${order}: |H| = 1 (got ${mag} dB)`);
      const delay = -phase / (2 * Math.PI * f);
      assert.ok(Math.abs(delay - T) / T < 1e-6, `order ${order}: −φ/ω ${delay}, want ${T}`);
      assert.ok(Math.abs(gdMs / 1000 - T) / T < 1e-3, `order ${order}: group delay ${gdMs} ms, want ${T * 1000} ms`);
    }
  });

  it('order 2 is WinISD\'s: delay t/Q', () => {
    const {gdMs} = filterAt(allpass(2), 1);
    assert.ok(Math.abs(gdMs - 5) < 5e-3, `order 2 delay ${gdMs} ms, want 5 ms (t/Q)`);
  });

  it('Q is not used above order 2', () => {
    for (const f of [1, 30, 200]) assert.deepEqual(filterAt(allpass(3, 0.6), f), filterAt(allpass(3, 2.5), f));
  });

  it('the order is honoured: order 4 differs from order 2, and a higher order holds the delay to a higher frequency', () => {
    const at = (order: number, f: number) => filterAt(allpass(order), f).gdMs / 1000;
    assert.ok(Math.abs(filterAt(allpass(4), 100).phase - filterAt(allpass(2), 100).phase) > 0.01);
    // At f·t = 0.6 (200 Hz, 3 ms) order 3 has lost more than 5 % of its delay, order 8 under 0.1 %.
    assert.ok(Math.abs(at(3, 200) - T) / T > 0.05, `order 3 at 200 Hz: ${at(3, 200)}`);
    assert.ok(Math.abs(at(8, 200) - T) / T < 1e-3, `order 8 at 200 Hz: ${at(8, 200)}`);
  });
});

/** Linkwitz-Riley. WinISD ignores the order and always draws LR4; OpenISD honours it: an LR of even
 *  order n is Butterworth(n/2) squared (bugs/archive/BUG_20260927_winisd-linkwitz-riley-and-sos-ignore-order.md). */
describe('Linkwitz-Riley of order n: Butterworth(n/2) squared', () => {
  for (const type of ['lowpass', 'highpass'] as const) {
    for (const order of [2, 4, 6, 8]) {
      it(`${type} LR${order}`, () => {
        const lr: Filter = {type, enabled: true, family: 'linkwitzRiley', order, fc: 60, Q: 0.707};
        const bw: Filter = {type, enabled: true, family: 'butterworth', order: order / 2, fc: 60, Q: 0.707};
        for (const f of [10, 45, 60, 80, 300]) {
          const a = filterAt(lr, f), b = chainAt([bw, bw], f);
          assert.ok(Math.abs(a.mag - b.mag) < 1e-9 && Math.abs(a.phase - b.phase) < 1e-9, `${type} LR${order} @ ${f} Hz`);
        }
      });
    }
  }

  it('LR2 at fc is −6.02 dB, not LR4\'s shape (the order is honoured)', () => {
    const lr = (order: number): Filter => ({type: 'lowpass', enabled: true, family: 'linkwitzRiley', order, fc: 60, Q: 0.707});
    assert.ok(Math.abs(filterAt(lr(2), 60).mag + 6.0206) < 1e-3);
    assert.ok(Math.abs(filterAt(lr(2), 120).mag - filterAt(lr(4), 120).mag) > 1);
  });
});
