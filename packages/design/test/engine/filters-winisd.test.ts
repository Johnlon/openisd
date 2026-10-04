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
function filterAt(filter: Filter, f: number) {
  const sw = engine.simulation.sweep(sweepDriver(DRV), LE_H, 'sealed',
    // The captures are WinISD's own, Bessel high-pass quirk included (`winisdBesselHighpass`).
    {Vb: 0.030, eg: 2.83, fmin: f, fmax: f, N: 0, filters: [filter], winisdBesselHighpass: true}).values!;
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
