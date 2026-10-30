import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/Engine.js';
import type {Filter, SweepParams} from '../../engine/types.js';
import {REFERENCE_AIR} from '../fixtures/referenceAir.js';
import {solveConsistencyGroup, sweepDriver} from './testSolver.js';

const engine = createEngine();
const SILENCE = engine.simulation.silentCurve(1)[0]!;
const LE_H = 0.5e-3;
const DRV = solveConsistencyGroup({Fs_hz: 40, Qes: 0.45, Qms: 4, Vas_m3: 0.03, Sd_m2: 0.0133, Re_ohm: 6});

/** Twelve steep low-passes: 1e-30 each at 20 kHz, so the product underflows to exactly 0 there. */
const DEAD_ABOVE_KILOHERTZ: Filter[] = Array.from({length: 12}, () =>
  ({type: 'lowpass', family: 'butterworth', order: 10, fc: 20, Q: Math.SQRT1_2, enabled: true}));

const SEALED: SweepParams = {Vb: 0.06, eg: 2.83, fmin: 10, fmax: 20000, N: 40, air: REFERENCE_AIR, nDrivers: 2};
const ABC: SweepParams = {
  Vb: 0.02, Vf: 0.015, eg: 2.83, fmin: 20, fmax: 20000, N: 40,
  Fr: 42, Ff: 60, Sp: 0.004, Spr: 0.004, SpIntra: 0.002, LeffIntra: 0.12,
  Qlr: 7, Qar: 30, Qpr: 100, Qiclfr: 20, Qlf: 9, Qaf: 40, Qpf: 15, air: REFERENCE_AIR,
};

describe('SimulationEngine with several drivers', () => {
  it('sweep keeps silence as silence instead of adding the driver-count gain to it', () => {
    const two = engine.simulation.sweep(sweepDriver(DRV), LE_H, 'sealed', {...SEALED, filters: DEAD_ABOVE_KILOHERTZ}).values!;
    expect(two.spl[two.spl.length - 1]).toBe(SILENCE);
  });

  it('sweep returns the single driver issues untouched when the driver cannot be swept', () => {
    const result = engine.simulation.sweep(sweepDriver({}), LE_H, 'sealed', SEALED);
    expect(result.values).toBeNull();
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('maxCurves returns the single driver issues untouched when the driver cannot be swept', () => {
    const result = engine.simulation.maxCurves(sweepDriver({}), LE_H, 'sealed', SEALED);
    expect(result.values).toBeNull();
    expect(result.issues.length).toBeGreaterThan(0);
  });
});

describe('SimulationEngine ABC sweep edges', () => {
  it('draws the rear port gain as silence where the filters leave no signal', () => {
    const r = engine.simulation.sweep(sweepDriver(DRV), LE_H, 'abc', {...ABC, filters: DEAD_ABOVE_KILOHERTZ}).values!;
    expect(r.rearPortGain![r.rearPortGain!.length - 1]).toBe(SILENCE);
  });

  it('gives a zero intra-port velocity when the intra port area is not stated', () => {
    const {SpIntra: _unstated, ...noIntraArea} = ABC;
    const r = engine.simulation.sweep(sweepDriver(DRV), LE_H, 'abc', noIntraArea).values!;
    expect(r.pvIntra!.every((v) => v === 0)).toBe(true);
  });
});

describe('SimulationEngine option edges', () => {
  const ONE: SweepParams = {Vb: 0.03, eg: 2.83, fmin: 20, fmax: 2000, N: 20, air: REFERENCE_AIR, Rs: 1};

  it('the conventional VA model with Rg at the amplifier side differs from the WinISD VA model', () => {
    const winisd = engine.simulation.sweep(sweepDriver(DRV), LE_H, 'sealed', {...ONE, rgAtDriverSide: true}).values!;
    const conventional = engine.simulation.sweep(sweepDriver(DRV), LE_H, 'sealed',
      {...ONE, rgAtDriverSide: true, winisdVaModel: false}).values!;
    expect(conventional.va).not.toEqual(winisd.va);
  });

  it('with no Rg stated, where Rg sits makes no difference to the transfer function', () => {
    const {Rs: _none, ...noRg} = ONE;
    const driverSide = engine.simulation.sweep(sweepDriver(DRV), LE_H, 'sealed', noRg).values!;
    const ampSide = engine.simulation.sweep(sweepDriver(DRV), LE_H, 'sealed', {...noRg, rgAtDriverSide: false}).values!;
    expect(ampSide.tfMag).toEqual(driverSide.tfMag);
  });

  it('the conventional force-flat model limits its boost to the default when no limit is stated', () => {
    const flat = engine.simulation.sweep(sweepDriver(DRV), LE_H, 'sealed',
      {...ONE, forceFlatResponse: true, winisdFlatModel: false}).values!;
    const limited = engine.simulation.sweep(sweepDriver(DRV), LE_H, 'sealed',
      {...ONE, forceFlatResponse: true, winisdFlatModel: false, flatMaxBoostDb: 1}).values!;
    expect(Math.max(...limited.spl)).toBeLessThanOrEqual(Math.max(...flat.spl));
  });
});
