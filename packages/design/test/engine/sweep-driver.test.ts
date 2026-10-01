/**
 * `SweepDriver` — the plain driver input `SimulationEngine.sweep`/`maxCurves` take: one value per
 * solver quantity plus the BL WinISD's entered-BL mix uses. Plain data, so it crosses a Worker
 * boundary (structured clone) and the sweep it gives is unchanged.
 */
import {describe, expect, it} from 'vitest';
import {createEngine, type SweepDriver, type SweepParams} from '../../engine/index.js';
import {ProjectBuilder} from '../../domain/index.js';
import {solveConsistencyGroup, sweepDriver} from './testSolver.js';

const engine = createEngine();
const DRV = solveConsistencyGroup({
  Fs_hz: 37, Qts: 0.378, Qes: 0.40, Qms: 7.0, Vas_m3: 0.0300,
  Sd_m2: 0.0133, Re_ohm: 5.6, Le_H: 0.70e-3, Xmax_m: 0.0050, Pe_W: 60, Znom_ohm: 8});
const SEALED: SweepParams = { Vb: 0.030, eg: 2.83, fmin: 10, fmax: 2000, N: 200 };

describe('SweepDriver crosses a structured-clone boundary unchanged', () => {
  const driver: SweepDriver = sweepDriver(DRV);

  it('is plain data: a structured clone equals it', () => {
    expect(structuredClone(driver)).toEqual(driver);
  });

  it('a sweep and max curves of the clone equal those of the original', () => {
    const clone = structuredClone(driver);
    expect(engine.simulation.sweep(clone, 0.7e-3, 'sealed', SEALED))
      .toEqual(engine.simulation.sweep(driver, 0.7e-3, 'sealed', SEALED));
    expect(engine.simulation.maxCurves(clone, 0.7e-3, 'sealed', SEALED))
      .toEqual(engine.simulation.maxCurves(driver, 0.7e-3, 'sealed', SEALED));
  });
});

describe('OpenIsdDriverSpec.sweepDriver — the projection at the project seam', () => {
  function specs() {
    const p = ProjectBuilder.empty(engine);
    const s = p.driver.specs;
    s.Fs_hz.set(37); s.Qts.set(0.378); s.Qes.set(0.40); s.Qms.set(7.0); s.Vas_m3.set(0.03);
    s.Sd_m2.set(0.0133); s.Re_ohm.set(5.6); s.Le_H.set(0.7e-3);
    return s;
  }

  it('carries each quantity\'s value as the solver handles hold it', () => {
    const s = specs();
    const d = s.sweepDriver(false, null);
    const handles = s.solverParams(false, null);
    expect(d.values.Fs_hz).toBe(handles.Fs_hz.value);
    expect(d.values.Qes).toBe(handles.Qes.value);
    expect(d.values.wiring).toBe(handles.wiring.value);
    expect(d.values.Re_terminal_ohm).toBe(handles.Re_terminal_ohm.value);
  });

  it('winisdBL_Tm is the entered BL, null when BL is not entered', () => {
    const s = specs();
    expect(s.sweepDriver(false, null).winisdBL_Tm).toBeNull();
    s.BL_Tm.set(7.17);
    expect(s.sweepDriver(false, null).winisdBL_Tm).toBe(7.17);
  });
});
