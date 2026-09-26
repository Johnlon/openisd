import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import type {BoxType, SweepParams} from '../../engine/index.js';
import {Engine} from '../../engine/index.js';
import {driverParams, solveConsistencyGroup} from './testSolver.js';

/**
 * `solve()` (engine/circuit.ts) branches not reached by the rest of the engine suite. Reached
 * only through `Engine.sweep` — the engine's one door forbids importing circuit.ts directly.
 */
describe('circuit — acoustic circuit branches', () => {
  const engine = new Engine();
  const LE_H = 0.7e-3;
  const DRV = driverParams(solveConsistencyGroup({
    Fs_hz: 37, Qts: 0.378, Qes: 0.40, Qms: 7.0, Vas_m3: 0.0300,
    Sd_m2: 0.0133, Re_ohm: 5.6, Xmax_m: 0.0050, Pe_W: 60, Znom_ohm: 8,
  }));
  const P_SEALED: SweepParams = {Vb: 0.030, eg: 2.83, Ql: 10, fmin: 10, fmax: 1000, N: 20};

  it('circuitModel "gyrator" folds Le into the acoustic circuit — differs from the WinISD split when Le > 0', () => {
    const winisd = engine.sweep(DRV, LE_H, 'sealed', P_SEALED).values!;
    const gyrator = engine.sweep(DRV, LE_H, 'sealed', {...P_SEALED, circuitModel: 'gyrator'}).values!;
    assert.notEqual(gyrator.spl[gyrator.spl.length - 1], winisd.spl[winisd.spl.length - 1],
      'at the top of the sweep, Le is no longer negligible — the gyrator model must diverge from WinISD\'s Le-excluded acoustic circuit');
  });

  it('circuitModel "winisd" excludes Le from both SPL and impedance (zmag); "gyrator" includes Le in both (BUG_20260924)', () => {
    const P_HI: SweepParams = {...P_SEALED, fmax: 20000};
    const winisd = engine.sweep(DRV, LE_H, 'sealed', P_HI).values!;
    const gyrator = engine.sweep(DRV, LE_H, 'sealed', {...P_HI, circuitModel: 'gyrator'}).values!;
    const topIdx = winisd.zmag.length - 1;
    assert.ok(gyrator.zmag[topIdx] > winisd.zmag[topIdx] + 10.0, 'gyrator zmag at 20kHz reflects Le reactance');
    assert.ok(winisd.zmag[topIdx] < (DRV.Re_ohm.value ?? 5.6) + 2.0, 'winisd zmag at 20kHz excludes Le reactance');
  });

  it('circuitModel "gyrator" matches the WinISD split exactly when Le = 0 (nothing left for the gyrator to fold in)', () => {
    const winisd = engine.sweep(DRV, 0, 'sealed', P_SEALED).values!;
    const gyrator = engine.sweep(DRV, 0, 'sealed', {...P_SEALED, circuitModel: 'gyrator'}).values!;
    assert.deepEqual(gyrator.spl, winisd.spl);
  });

  it('circuitModel "winisdGyrator" reproduces WinISD\'s traced inductance roll-off on the W5-1138SMF (BUG_20260926)', () => {
    // WinISD 0.7.0.950, VCInd on − off, transfer-function chart traced from pixels
    // (winisd_research/runs/vcind_default). Driver as entered in the .wdr: BL 7.17 disagrees with
    // the 7.38 its Fs/Qes/Vas/Re imply — the disagreement WinISD's model turns into extra roll-off.
    const w5 = driverParams(solveConsistencyGroup({
      Fs_hz: 45, Qes: 0.57, Qms: 3.56, Vas_m3: 0.00485, Sd_m2: 0.0094, Re_ohm: 3.4, BL_Tm: 7.17,
    }));
    const P: SweepParams = {Vb: 0.00448, eg: 2.83, Rs: 0.1, N: 1};
    const winisdTraced: ReadonlyArray<readonly [number, number]> =
      [[1000, -1.212], [2000, -4.152], [5000, -10.617], [10000, -16.373], [20000, -22.314]];
    for (const [f, traced] of winisdTraced) {
      const at: SweepParams = {...P, fmin: f, fmax: f * 1.0001};
      const off = engine.sweep(w5, 0.34e-3, 'sealed', at).values!.spl[0];
      const on = engine.sweep(w5, 0.34e-3, 'sealed', {...at, circuitModel: 'winisdGyrator'}).values!.spl[0];
      assert.ok(Math.abs((on - off) - traced) < 0.1, `${f} Hz: on − off ${(on - off).toFixed(3)} dB vs WinISD ${traced} dB`);
    }
  });

  it('passive radiator: an absent prRms defaults its mechanical resistance to 0, still a finite sweep', () => {
    const P_PR: SweepParams = {...P_SEALED, prSd: 0.0133, prNum: 1, prMmd: 0.030, prMadd: 0, prCms: 0.0008};
    const sw = engine.sweep(DRV, LE_H, 'box-passive-radiator', P_PR).values!;
    assert.ok(sw.spl.every(Number.isFinite), 'a passive radiator with no mechanical resistance specified must still produce a finite sweep');
  });

  it('passive radiator: prNum > 1 combines n radiators in parallel — differs from a single radiator', () => {
    const single: SweepParams = {...P_SEALED, prSd: 0.0133, prNum: 1, prMmd: 0.030, prMadd: 0, prCms: 0.0008, prRms: 1.0};
    const pair: SweepParams = {...single, prNum: 2};
    const swSingle = engine.sweep(DRV, LE_H, 'box-passive-radiator', single).values!;
    const swPair = engine.sweep(DRV, LE_H, 'box-passive-radiator', pair).values!;
    assert.notEqual(swPair.spl[swPair.spl.length - 1], swSingle.spl[swSingle.spl.length - 1],
      'two radiators in parallel must load the box differently than one');
  });

  it('an unsimulatable box type (bandpass6, abc) is not refused by solve() itself — it throws reading an unassigned Complex', () => {
    // types.ts documents simulatableBoxType() as the ONE place that narrows BoxType and expects
    // every engine entry point to refuse a non-simulatable type by name. Engine.sweep/solve do
    // not perform that check themselves (the caller is expected to via
    // Engine.simulatableBoxType() first) — this test documents the actual, current failure mode
    // of calling through anyway, it does not endorse it as the desired behaviour.
    assert.throws(
      () => engine.sweep(DRV, LE_H, 'bandpass6' as BoxType, P_SEALED),
      /Cannot read properties of undefined/,
    );
  });

  it('sealed box lossMode: "winisd-lossy" produces higher low-frequency group delay than "conventional-lossy"', () => {
    const pWinisd: SweepParams = { ...P_SEALED, lossMode: 'winisd-lossy', fmin: 10, fmax: 50, N: 50 };
    const pConv: SweepParams = { ...P_SEALED, lossMode: 'conventional-lossy', fmin: 10, fmax: 50, N: 50 };
    const swWinisd = engine.sweep(DRV, LE_H, 'sealed', pWinisd).values!;
    const swConv = engine.sweep(DRV, LE_H, 'sealed', pConv).values!;

    // At 10 Hz, WinISD lossy model's leak subtraction raises group delay (>4 ms vs ~3 ms)
    assert.ok(swWinisd.gd[0] > swConv.gd[0] + 0.5,
      `winisd-lossy GD@10Hz (${swWinisd.gd[0].toFixed(2)} ms) should exceed conventional-lossy GD@10Hz (${swConv.gd[0].toFixed(2)} ms)`);
  });

  it('sealed box lossMode: "lossless" ignores Ql/Qa losses and matches lossless sweep', () => {
    const pLosslessMode: SweepParams = { ...P_SEALED, lossMode: 'lossless' };
    const pLosslessQ: SweepParams = { ...P_SEALED, lossMode: 'lossless', Ql: 1e6, Qa: 1e6 };
    const sw1 = engine.sweep(DRV, LE_H, 'sealed', pLosslessMode).values!;
    const sw2 = engine.sweep(DRV, LE_H, 'sealed', pLosslessQ).values!;

    assert.deepEqual(sw1.spl, sw2.spl, 'lossMode "lossless" must produce identical SPL to infinite Ql/Qa');
  });
});
