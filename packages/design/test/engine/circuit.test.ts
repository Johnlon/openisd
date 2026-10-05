import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import type {SweepParams} from '../../engine/index.js';
import {createEngine} from '../../engine/index.js';
import {sweepDriver, solveConsistencyGroup} from './testSolver.js';

/**
 * `solve()` (engine/circuit.ts) branches not reached by the rest of the engine suite. Reached
 * only through `Engine.sweep` — the engine's one door forbids importing circuit.ts directly.
 */
describe('circuit — acoustic circuit branches', () => {
  const engine = createEngine();
  const LE_H = 0.7e-3;
  const DRV = sweepDriver(solveConsistencyGroup({
    Fs_hz: 37, Qts: 0.378, Qes: 0.40, Qms: 7.0, Vas_m3: 0.0300,
    Sd_m2: 0.0133, Re_ohm: 5.6, Xmax_m: 0.0050, Pe_W: 60, Znom_ohm: 8,
  }));
  const P_SEALED: SweepParams = {Vb: 0.030, eg: 2.83, Ql: 10, fmin: 10, fmax: 1000, N: 20};

  it('circuitModel "gyrator" folds Le into the acoustic circuit — differs from the WinISD split when Le > 0', () => {
    const winisd = engine.simulation.sweep(DRV, LE_H, 'sealed', P_SEALED).values!;
    const gyrator = engine.simulation.sweep(DRV, LE_H, 'sealed', {...P_SEALED, circuitModel: 'gyrator'}).values!;
    assert.notEqual(gyrator.spl[gyrator.spl.length - 1], winisd.spl[winisd.spl.length - 1],
      'at the top of the sweep, Le is no longer negligible — the gyrator model must diverge from WinISD\'s Le-excluded acoustic circuit');
  });

  // Regression for bugs/archive/BUG_20260924*.md
  it('circuitModel "winisd" excludes Le from both SPL and impedance (zmag); "gyrator" includes Le in both', () => {
    const P_HI: SweepParams = {...P_SEALED, fmax: 20000};
    const winisd = engine.simulation.sweep(DRV, LE_H, 'sealed', P_HI).values!;
    const gyrator = engine.simulation.sweep(DRV, LE_H, 'sealed', {...P_HI, circuitModel: 'gyrator'}).values!;
    const topIdx = winisd.zmag.length - 1;
    assert.ok(gyrator.zmag[topIdx] > winisd.zmag[topIdx] + 10.0, 'gyrator zmag at 20kHz reflects Le reactance');
    assert.ok(winisd.zmag[topIdx] < (DRV.values.Re_ohm ?? 5.6) + 2.0, 'winisd zmag at 20kHz excludes Le reactance');
  });

  it('circuitModel "gyrator" matches the WinISD split exactly when Le = 0 (nothing left for the gyrator to fold in)', () => {
    const winisd = engine.simulation.sweep(DRV, 0, 'sealed', P_SEALED).values!;
    const gyrator = engine.simulation.sweep(DRV, 0, 'sealed', {...P_SEALED, circuitModel: 'gyrator'}).values!;
    assert.deepEqual(gyrator.spl, winisd.spl);
  });

  // Regression for bugs/archive/BUG_20260926*.md
  it('circuitModel "winisdGyrator" reproduces WinISD\'s traced inductance roll-off on the W5-1138SMF', () => {
    // WinISD 0.7.0.950, VCInd on − off, transfer-function chart traced from pixels
    // (winisd_research/runs/vcind_default). Driver as entered in the .wdr: BL 7.17 disagrees with
    // the 7.38 its Fs/Qes/Vas/Re imply — the disagreement WinISD's model turns into extra roll-off.
    const w5 = sweepDriver(solveConsistencyGroup({
      Fs_hz: 45, Qes: 0.57, Qms: 3.56, Vas_m3: 0.00485, Sd_m2: 0.0094, Re_ohm: 3.4, BL_Tm: 7.17,
    }));
    const P: SweepParams = {Vb: 0.00448, eg: 2.83, Rs: 0.1, N: 1};
    const winisdTraced: ReadonlyArray<readonly [number, number]> =
      [[1000, -1.212], [2000, -4.152], [5000, -10.617], [10000, -16.373], [20000, -22.314]];
    for (const [f, traced] of winisdTraced) {
      const at: SweepParams = {...P, fmin: f, fmax: f * 1.0001};
      const off = engine.simulation.sweep(w5, 0.34e-3, 'sealed', at).values!.spl[0];
      const on = engine.simulation.sweep(w5, 0.34e-3, 'sealed', {...at, circuitModel: 'winisdGyrator'}).values!.spl[0];
      assert.ok(Math.abs((on - off) - traced) < 0.1, `${f} Hz: on − off ${(on - off).toFixed(3)} dB vs WinISD ${traced} dB`);
    }
  });

  it('passive radiator: an absent prRms defaults its mechanical resistance to 0, still a finite sweep', () => {
    // Fr is the box's own tuning — an absent Fr poisons Ral/Raa with NaN regardless of prRms
    // (BUG_20260927_spl-maps-nan-to-silence's own origin case), so it must be stated here to
    // isolate what this test actually checks: prRms's absence alone, not Fr's.
    const PR_BOX = {Vb: P_SEALED.Vb, prSd: 0.0133, prMmd: 0.030, prMadd: 0, prCms: 0.0008, prNum: 1};
    const P_PR: SweepParams = {
      ...P_SEALED, ...PR_BOX, prNum: 1,
      Fr: engine.pr.tuning(PR_BOX, engine.environment.solve({}).values),
    };
    const sw = engine.simulation.sweep(DRV, LE_H, 'box-passive-radiator', P_PR).values!;
    assert.ok(sw.spl.every(Number.isFinite), 'a passive radiator with no mechanical resistance specified must still produce a finite sweep');
  });

  it('passive radiator: prNum > 1 combines n radiators in parallel — differs from a single radiator', () => {
    // Fr is the box's own tuning (winisd-lossy's Ral/Raa, BUG_20260927_passive-radiator-losses-
    // not-winisd-form.md) — computed here, not left absent, or it poisons Ral/Raa with NaN and
    // both sweeps below fall to the same -200 dB silence sentinel, masking the very difference
    // this test checks for.
    const {rho, c} = engine.environment.solve({}).values;
    const Fr = engine.pr.tuning({Vb: 0.030, prMmd: 0.030, prMadd: 0, prSd: 0.0133, prCms: 0.0008, prNum: 1}, {rho, c});
    const single: SweepParams = {...P_SEALED, prSd: 0.0133, prNum: 1, prMmd: 0.030, prMadd: 0, prCms: 0.0008, prRms: 1.0, Fr};
    const pair: SweepParams = {...single, prNum: 2};
    const swSingle = engine.simulation.sweep(DRV, LE_H, 'box-passive-radiator', single).values!;
    const swPair = engine.simulation.sweep(DRV, LE_H, 'box-passive-radiator', pair).values!;
    assert.notEqual(swPair.spl[swPair.spl.length - 1], swSingle.spl[swSingle.spl.length - 1],
      'two radiators in parallel must load the box differently than one');
  });

  it('bandpass6/abc are simulatable, but still refuse to draw a curve missing Fr/Ff — NaN, caught by the postcondition, never a throw', () => {
    // `Bandpass6Box`/`AbcBox` read Fr/Ff off `SweepParams` with `?? NaN` (their own doc), never
    // a `!`/throw — the standard "poison, don't crash" contract every box class follows. `P_SEALED`
    // states neither, so the sweep runs to completion (no exception) but every value is NaN, which
    // `classifyFinite` names as a postcondition issue rather than a false "clean" result.
    const result = engine.simulation.sweep(DRV, LE_H, 'bandpass6', P_SEALED);
    assert.ok(result.values, 'sweep itself must not refuse — the precondition layer is solveBoxParams, not this');
    assert.notEqual(engine.simulation.classifyFinite(result.values!), null,
      'a design missing Fr/Ff must be classified as non-finite, not silently drawn');
  });
});
