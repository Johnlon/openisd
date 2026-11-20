/**
 * Driver wiring, engine part (ticket Johnlon/openisd#519, plan docs/plans/PLAN_20261116_DRIVER_WIRING.md sections 5.1, 7, 8):
 * what ONE of n identical drivers sees, and the Signal-tab power/voltage relation that follows from it.
 */
import {describe, expect, it} from 'vitest';
import {amplifierVoltage, combinedOfN, driverDrive, eachOfN, oneBoxOfN} from '../../engine/array/driverWiring.js';
import type {SweepParams} from '../../engine/types.js';
import {REFERENCE_AIR} from '../fixtures/referenceAir.js';
import type {PresentSolverField, SignalSolverParams} from '../../engine/solverTypes.js';
import {createEngine} from '../../engine/Engine.js';
import {fakeSolverField} from './testSolver.js';

const engine = createEngine();

describe('driverDrive: what one of n identical drivers sees (plan section 8 table, N 4, 2.83 V, Rg 0.5)', () => {
  it.each([
    ['parallel, Rg at the amplifier', 'parallel', false, 2.83, 2.0, 0.25],
    ['parallel, Rg at each driver', 'parallel', true, 2.83, 0.5, 0.25],
    ['series, Rg at the amplifier', 'series', false, 0.7075, 0.125, 4],
    ['series, Rg at each driver', 'series', true, 0.7075, 0.5, 4],
  ] as const)('%s', (_name, wiring, rgAtDriverSide, eg, Rg, loadScale) => {
    const d = driverDrive(4, wiring, 2.83, 0.5, rgAtDriverSide);
    expect(d.eg_V).toBeCloseTo(eg, 12);
    expect(d.Rg_ohm).toBeCloseTo(Rg, 12);
    expect(d.loadScale).toBeCloseTo(loadScale, 12);
  });

  it.each(['parallel', 'series'] as const)('one driver, %s: the amplifier voltage, Rg and load unchanged', (wiring) => {
    for (const rgAtDriverSide of [true, false]) {
      expect(driverDrive(1, wiring, 2.83, 0.5, rgAtDriverSide)).toEqual({eg_V: 2.83, Rg_ohm: 0.5, loadScale: 1});
    }
  });

  it('amplifierVoltage is the inverse of the voltage each driver gets: x N in series, x 1 in parallel', () => {
    expect(amplifierVoltage(4, 'series', 0.7075)).toBeCloseTo(2.83, 12);
    expect(amplifierVoltage(4, 'parallel', 2.83)).toBe(2.83);
    expect(amplifierVoltage(1, 'series', 2.83)).toBe(2.83);
  });
});

interface FakeVoltage extends PresentSolverField { readonly calculated: boolean }
function voltage(value: number, entered: boolean): FakeVoltage {
  let current = value;
  let isEntered = entered;
  return {
    get value() { return current; },
    get entered() { return isEntered; },
    get calculated() { return !isEntered; },
    setCalculated(v: number) { current = v; isEntered = false; },
  };
}

/** DA215-8 x4 (plan section 7): Re 6.8 ohm. */
function da215Signal(power_W: number | null, V: FakeVoltage, Rs_ohm: number, wiring: 'parallel' | 'series', rgAtDriverSide: boolean): SignalSolverParams & { voltage_V: FakeVoltage } {
  return {
    power_W: fakeSolverField<number>(power_W), Re_ohm: fakeSolverField(6.8), voltage_V: V, Rs_ohm: fakeSolverField(Rs_ohm),
    nDrivers: fakeSolverField(4), driverWiring: wiring, rgAtDriverSide,
  };
}

describe('Signal solve with a driver wiring (plan section 7, DA215-8 x4, Re 6.8 ohm)', () => {
  it.each([
    ['parallel, Rg 0: P = 4 * 2.83^2 / 6.8', 'parallel', 0, true, 4.7111],
    ['series, Rg 0: each driver gets V/4', 'series', 0, true, 0.29444],
    ['parallel, Rg 0.5 at the amplifier: 4 * 2.83^2 / (6.8 + 2.0)', 'parallel', 0.5, false, 3.6404],
    ['series, Rg 0.5 at the amplifier: 4 * 0.7075^2 / (6.8 + 0.125)', 'series', 0.5, false, 0.28913],
  ] as const)('voltage 2.83 entered, %s', (_name, wiring, Rg, rgAtDriverSide, watts) => {
    const p = da215Signal(null, voltage(2.83, true), Rg, wiring, rgAtDriverSide);
    expect(engine.signal.solve(p)).toEqual([]);
    expect(p.power_W.value).toBeCloseTo(watts, 4);
  });

  it.each([
    ['parallel', 2.83],
    ['series', 11.32],
  ] as const)('power 4.7111 W entered, %s: the voltage readout is the amplifier voltage %s V', (wiring, volts) => {
    const p = da215Signal(4.7111, voltage(1, false), 0, wiring, true);
    expect(engine.signal.solve(p)).toEqual([]);
    expect(p.voltage_V.value).toBeCloseTo(volts, 3);
  });

  it('power and voltage are inverse for series with Rg at the amplifier', () => {
    const forward = da215Signal(null, voltage(5, true), 0.5, 'series', false);
    engine.signal.solve(forward);
    const back = da215Signal(forward.power_W.value, voltage(1, false), 0.5, 'series', false);
    engine.signal.solve(back);
    expect(back.voltage_V.value).toBeCloseTo(5, 10);
  });

  it('an absent driverWiring keeps today: P = N * V^2 / (Re + Rg)', () => {
    const p: SignalSolverParams = {power_W: fakeSolverField<number>(null), Re_ohm: fakeSolverField(6.8), voltage_V: voltage(2.83, true), Rs_ohm: fakeSolverField(0.5), nDrivers: fakeSolverField(4)};
    engine.signal.solve(p);
    expect(p.power_W.value).toBeCloseTo(4 * 2.83 * 2.83 / 7.3, 10);
  });
});

// T934 (John, 19 Nov 2026: "remove the dupe and fix the guardrail"): the engine's one home for scaling by the driver count.
describe('combinedOfN and eachOfN: n identical drivers taken together, and one of them', () => {
  it('combinedOfN adds a figure across n drivers: 4 cones of 0.0123 m2 are 0.0492 m2', () => {
    expect(combinedOfN(0.0123, 4)).toBe(0.0123 * 4);
    expect(combinedOfN(40, 1)).toBe(40);
  });
  it('eachOfN gives one driver its share, and n alike elements side by side: 30 L for 3 drivers is 10 L each', () => {
    expect(eachOfN(0.030, 3)).toBe(0.030 / 3);
    expect(eachOfN(1, 4)).toBe(0.25);
  });
});

describe('oneBoxOfN: one of n drivers\' share of the box', () => {
  const P: SweepParams = {Vb: 0.06, Vf: 0.02, Sp: 0.004, prNum: 2, Spr: 0.01, SpIntra: 0.003, nDrivers: 2, eg: 2.83, fmin: 10, fmax: 1000, N: 50, air: REFERENCE_AIR};
  it('divides the volumes, the port areas and the radiator count by n and leaves one driver', () => {
    const one = oneBoxOfN(P, 2);
    expect([one.nDrivers, one.Vb, one.Vf, one.Sp, one.prNum, one.Spr, one.SpIntra]).toEqual([1, 0.03, 0.01, 0.002, 1, 0.005, 0.0015]);
    expect(one.eg).toBe(2.83);
  });
  it('leaves out what the box does not have', () => {
    const sealed: SweepParams = {Vb: 0.06, nDrivers: 3, eg: 2.83, fmin: 10, fmax: 1000, N: 50, air: REFERENCE_AIR};
    const one = oneBoxOfN(sealed, 3);
    expect(one.Vb).toBe(0.06 / 3);
    expect(['Vf', 'Sp', 'prNum', 'Spr', 'SpIntra'].filter(k => k in one)).toEqual([]);
  });
});
