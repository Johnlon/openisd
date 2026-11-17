/**
 * Driver wiring, engine goldens (ticket Johnlon/openisd#519, plan docs/plans/PLAN_20261116_DRIVER_WIRING.md sections 2, 5, 6, 7, 8).
 * Dayton DA215-8 x4 at 2.83 V: Fs 34.9 Hz, Qes 0.45, Qms 1.95, Vas 42.7 L, Sd 211.2 cm2, Re 6.8 ohm
 * (packages/ui/public/drivers/dayton-audio/da215-8.json). Absolute SPL hangs on the air model (0.05 dB); every ratio is 1e-9 dB.
 *
 * Slice 1 is inert: a sweep with no `driverWiring` is today's path, so the first block pins that it equals Parallel
 * with "Impedance of one driver" (WinISD = Parallel plus the one-driver chart).
 */
import {describe, expect, it} from 'vitest';
import type {SweepDriver} from '../../engine/solverTypes.js';
import type {SweepParams} from '../../engine/types.js';
import {createEngine} from '../../engine/Engine.js';
import {REFERENCE_AIR} from '../fixtures/referenceAir.js';
import {solveConsistencyGroup, sweepDriver} from './testSolver.js';

const engine = createEngine();
const N = 4;
const V = 2.83;

const DA215 = sweepDriver(solveConsistencyGroup({
  Fs_hz: 34.9, Qes: 0.45, Qms: 1.95, Vas_m3: 0.0427, Sd_m2: 0.02112, Re_ohm: 6.8, Xmax_m: 0.0065, Pe_W: 100,
}));

const SEALED_160L: SweepParams = {Vb: 0.16, eg: V, nDrivers: N, fmin: 10, fmax: 20000, N: 120, air: REFERENCE_AIR};
// A lossless box: Ql and Qa so high that the impedance peak is Re·(1 + Qms/Qes) whatever the box.
const LOSSLESS: SweepParams = {...SEALED_160L, Ql: 1e12, Qa: 1e12};
// The peak is narrow: a grid fine enough to land on it (20 to 100 Hz, 2000 steps).
const PEAK_GRID: SweepParams = {...LOSSLESS, fmin: 20, fmax: 100, N: 2000};
const VENTED: SweepParams = {Vb: 0.16, eg: V, nDrivers: N, Ql: 7, Sp: 0.0191, Leff: 0.2, Fb: 30, fmin: 10, fmax: 2000, N: 120, air: REFERENCE_AIR};

type Wiring = 'parallel' | 'series';
const on = (over: SweepParams, wiring: Wiring, oneDriverImpedance: boolean): SweepParams =>
  ({...over, driverWiring: wiring, winisdOneDriverImpedance: oneDriverImpedance});

function sweepOf(drv: SweepDriver, box: 'sealed' | 'vented', P: SweepParams) {
  const r = engine.simulation.sweep(drv, undefined, box, P).values;
  if (r === null) throw new Error('sweep refused');
  return r;
}
const max = (a: readonly number[]) => a.reduce((m, v) => Math.max(m, v), -Infinity);
const at = (fs: readonly number[], a: readonly number[], f: number) => a[fs.findIndex((x) => x >= f)];
const GAIN_DB = 20 * Math.log10(N);

describe('absent driverWiring is today\'s path: Parallel plus "Impedance of one driver" gives the same arrays, byte for byte', () => {
  for (const [label, rs, atDriver] of [['Rg 0', 0, true], ['Rg 0.5 at each driver', 0.5, true]] as const) {
    for (const [box, P] of [['sealed', SEALED_160L], ['vented', VENTED]] as const) {
      it(`${box}, ${label}: every output array equals the absent-field sweep`, () => {
        const base: SweepParams = {...P, Rs: rs, rgAtDriverSide: atDriver};
        const today = sweepOf(DA215, box, base);
        const wired = sweepOf(DA215, box, on(base, 'parallel', true));
        expect(wired).toEqual(today);
      });
    }
  }

  it('maximum curves: Parallel at Rg 0 equals the absent-field curves', () => {
    const today = engine.simulation.maxCurves(DA215, undefined, 'sealed', SEALED_160L).values;
    const wired = engine.simulation.maxCurves(DA215, undefined, 'sealed', on(SEALED_160L, 'parallel', false)).values;
    expect(wired).toEqual(today);
  });
});

describe('the "Impedance of one driver" switch changes only zmag', () => {
  for (const [wiring, factor] of [['parallel', 1 / N], ['series', N]] as const) {
    it(`${wiring}: every array but zmag is equal; zmag is x${factor} against unticked`, () => {
      const unticked = sweepOf(DA215, 'sealed', on(SEALED_160L, wiring, false));
      const ticked = sweepOf(DA215, 'sealed', on(SEALED_160L, wiring, true));
      const {zmag: zU, ...restU} = unticked;
      const {zmag: zT, ...restT} = ticked;
      expect(restT).toEqual(restU);
      zT.forEach((z, i) => expect(zU[i] / z).toBeCloseTo(factor, 9));
    });
  }
});

describe('Series against Parallel at the same amplifier voltage (plan section 8)', () => {
  const par = sweepOf(DA215, 'sealed', on(SEALED_160L, 'parallel', false));
  const ser = sweepOf(DA215, 'sealed', on(SEALED_160L, 'series', false));

  it('SPL is 12.041 dB lower at every point', () => {
    par.spl.forEach((v, i) => expect(v - ser.spl[i]).toBeCloseTo(GAIN_DB, 9));
  });
  it('excursion is x0.25 at every point', () => {
    par.exc.forEach((v, i) => expect(ser.exc[i] / v).toBeCloseTo(1 / N, 9));
  });
  it('impedance magnitude is x16 and phase is equal', () => {
    par.zmag.forEach((v, i) => expect(ser.zmag[i] / v).toBeCloseTo(N * N, 8));
    par.zph.forEach((v, i) => expect(ser.zph[i]).toBeCloseTo(v, 9));
  });
  it('vented port velocity is x0.25', () => {
    const p = sweepOf(DA215, 'vented', on(VENTED, 'parallel', false));
    const s = sweepOf(DA215, 'vented', on(VENTED, 'series', false));
    expect(max(p.pv)).toBeGreaterThan(0);
    p.pv.forEach((v, i) => expect(s.pv[i]).toBeCloseTo(v / N, 9));
  });
  it('the amplifier apparent load power: parallel is 16x series', () => {
    par.va.forEach((v, i) => expect(v / ser.va[i]).toBeCloseTo(N * N, 8));
  });
});

describe('absolute numbers, DA215-8 x4, lossless box (plan section 7)', () => {
  const unticked = (wiring: Wiring) => sweepOf(DA215, 'sealed', on(LOSSLESS, wiring, false));
  it('impedance peak: parallel 9.067 ohm, series 145.07 ohm, one driver 36.267 ohm (to 0.1 %)', () => {
    const peak = (wiring: Wiring, one: boolean) => max(sweepOf(DA215, 'sealed', on(PEAK_GRID, wiring, one)).zmag);
    expect(Math.abs(peak('parallel', false) / 9.067 - 1)).toBeLessThan(1e-3);
    expect(Math.abs(peak('series', false) / 145.07 - 1)).toBeLessThan(1e-3);
    expect(Math.abs(peak('parallel', true) / 36.267 - 1)).toBeLessThan(1e-3);
  });
  it('impedance at high frequency: 1.70 and 27.2 ohm (to 1 %), 6.8 ohm one driver', () => {
    const hf = (r: ReturnType<typeof unticked>) => r.zmag[r.zmag.length - 1];
    expect(Math.abs(hf(unticked('parallel')) / 1.7 - 1)).toBeLessThan(0.01);
    expect(Math.abs(hf(unticked('series')) / 27.2 - 1)).toBeLessThan(0.01);
    expect(Math.abs(hf(sweepOf(DA215, 'sealed', on(LOSSLESS, 'series', true))) / 6.8 - 1)).toBeLessThan(0.01);
  });
  it('passband SPL at 1 m: parallel 100.87 dB, series 88.82 dB (to 0.05 dB)', () => {
    const p = unticked('parallel'), s = unticked('series');
    expect(Math.abs(at(p.fs, p.spl, 1000) - 100.87)).toBeLessThan(0.05);
    expect(Math.abs(at(s.fs, s.spl, 1000) - 88.82)).toBeLessThan(0.05);
  });
});

describe('Rg 0.5 ohm, passband level against Rg 0 (plan section 5.3)', () => {
  const level = (wiring: Wiring, rgAtDriverSide: boolean) => {
    const rg = sweepOf(DA215, 'sealed', {...on(SEALED_160L, wiring, false), Rs: 0.5, rgAtDriverSide});
    const zero = sweepOf(DA215, 'sealed', {...on(SEALED_160L, wiring, false), Rs: 0, rgAtDriverSide});
    return at(rg.fs, rg.spl, 10000) - at(zero.fs, zero.spl, 10000);
  };
  it.each([
    ['parallel, Rg at the amplifier (each driver sees 2.0 ohm)', 'parallel', false, -2.239],
    ['series, Rg at the amplifier (0.125 ohm)', 'series', false, -0.158],
    ['parallel, Rg at each driver (0.5 ohm)', 'parallel', true, -0.616],
    ['series, Rg at each driver (0.5 ohm)', 'series', true, -0.616],
  ] as const)('%s', (_n, wiring, rgAtDriverSide, dB) => {
    expect(Math.abs(level(wiring, rgAtDriverSide) - dB)).toBeLessThan(0.01);
  });
});

describe('maximum curves', () => {
  it('maximum SPL and maximum power are equal across both wirings at Rg 0', () => {
    const p = engine.simulation.maxCurves(DA215, undefined, 'sealed', on(SEALED_160L, 'parallel', false)).values!;
    const s = engine.simulation.maxCurves(DA215, undefined, 'sealed', on(SEALED_160L, 'series', false)).values!;
    expect(s.maxspl).toEqual(p.maxspl);
    expect(s.maxpwr).toEqual(p.maxpwr);
  });
  it('with Rg 0.5 at the amplifier the limits are N times one driver\'s in the 2.0 ohm it sees', () => {
    const wired = engine.simulation.maxCurves(DA215, undefined, 'sealed', {...on(SEALED_160L, 'parallel', false), Rs: 0.5, rgAtDriverSide: false}).values!;
    const one = engine.simulation.maxCurves(DA215, undefined, 'sealed', {...SEALED_160L, nDrivers: 1, Vb: 0.04, Rs: 2.0, rgAtDriverSide: false}).values!;
    wired.maxpwr.forEach((v, i) => expect(v / (one.maxpwr[i] * N)).toBeCloseTo(1, 9));
    wired.maxspl.forEach((v, i) => expect(v - (one.maxspl[i] + GAIN_DB)).toBeCloseTo(0, 9));
  });
});

describe('Coil wiring first, Driver wiring second: Dayton MX12-22 x4 (plan section 6)', () => {
  const mx = (Re: number) => sweepDriver(solveConsistencyGroup({
    Fs_hz: 33, Qes: 0.39, Qms: 3.25, Vas_m3: 0.12, Sd_m2: 0.0507, Re_ohm: Re, Re_terminal_ohm: Re,
  }));
  const box: SweepParams = {...LOSSLESS, Vb: 0.4};
  const peak = (Re: number, wiring: Wiring, one: boolean) => max(sweepOf(mx(Re), 'sealed', on({...box, fmin: 20, fmax: 100, N: 2000}, wiring, one)).zmag);
  it.each([
    ['coil series, driver parallel', 3.95, 'parallel', 9.217, 36.867],
    ['coil parallel, driver series', 0.9875, 'series', 36.867, 9.217],
    ['coil parallel, driver parallel', 0.9875, 'parallel', 2.304, 9.217],
    ['coil series, driver series', 3.95, 'series', 147.47, 36.867],
  ] as const)('%s: amp load at the peak %s ohm, switch ticked %s ohm (to 0.2 %%)', (_n, Re, wiring, amp, ticked) => {
    expect(Math.abs(peak(Re, wiring, false) / amp - 1)).toBeLessThan(2e-3);
    expect(Math.abs(peak(Re, wiring, true) / ticked - 1)).toBeLessThan(2e-3);
  });
  it('SPL at 2.83 V, coil parallel + driver series against coil series + driver parallel, is -6.021 dB', () => {
    const a = sweepOf(mx(3.95), 'sealed', on(box, 'parallel', false));
    const b = sweepOf(mx(0.9875), 'sealed', on(box, 'series', false));
    a.spl.forEach((v, i) => expect(b.spl[i] - v).toBeCloseTo(-6.0206, 4));
  });
});
