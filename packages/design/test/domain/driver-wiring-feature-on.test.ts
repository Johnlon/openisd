/**
 * Several-driver wiring, slice 3 "Feature on" (plan docs/plans/PLAN_20261116_DRIVER_WIRING.md sections 3, 5.2, 7; ticket 519;
 * QO946.c129-c131, c153): the project's Driver wiring and "Impedance of one driver" reach the sweep and the signal readout.
 * Ratios are exact physics for identical drivers (DA215-8-like, Rg 0), not pinned figures.
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/Engine.js';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import type {FrequencyGrid} from '../../domain/box/frequencyGrid.js';
import type {OpenISDProject} from '../../domain/project/openISDProject.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';

const GRID: FrequencyGrid = {fmin: 10, fmax: 5000, N: 80};
const DRIVER = {Fs_hz: 34.9, Mms_kg: 0.03081, Cms_m_per_N: 0.000675, Sd_m2: 0.02112, Qms: 1.95, Re_ohm: 6.8, BL_Tm: 10.104, Xmax_m: 0.0065};
const N = 4;
// Each driver has 0.04 L of the box (project volume 0.04 x nDrivers), Rg 0.

function project(wiring: 'parallel' | 'series' | null, oneDriverImpedance: boolean, nDrivers: number): OpenISDProject {
  const engine = createEngine();
  const p = new ProjectBuilder(driverFromSpec(engine, DRIVER), engine).sealed().volume_m3(0.04 * nDrivers).build();
  p.Rs_ohm.set(0);
  p.nDrivers.set(nDrivers);
  if (wiring !== null) p.driverWiring.set(wiring);
  p.winisdOneDriverImpedance.set(oneDriverImpedance);
  p.driveVoltage_V.set(2.83);
  return p;
}

function curves(p: OpenISDProject) {
  const r = p.sweep(GRID).values;
  if (r === null) throw new Error('no sweep');
  return r;
}
const worst = (a: readonly number[], b: readonly number[], f: (x: number, y: number) => number): number =>
  Math.max(...a.map((x, i) => Math.abs(f(x, b[i]!))));

describe('the project passes Driver wiring and "Impedance of one driver" to the sweep', () => {
  it('Series against Parallel at the same amplifier voltage: SPL -12.041 dB, excursion x0.25, zmag x16, phase equal', () => {
    const par = curves(project('parallel', false, N));
    const ser = curves(project('series', false, N));
    expect(worst(ser.spl, par.spl, (s, p) => s - p + 20 * Math.log10(N))).toBeLessThan(1e-9);
    expect(worst(ser.exc!, par.exc!, (s, p) => s / p - 1 / N)).toBeLessThan(1e-9);
    expect(worst(ser.zmag, par.zmag, (s, p) => s / p - N * N)).toBeLessThan(1e-6);
    expect(worst(ser.zph, par.zph, (s, p) => s - p)).toBeLessThan(1e-9);
  });

  it('a project that never chose a wiring is Parallel (the saved default), so its zmag is the amplifier load, one driver / N', () => {
    const chosen = curves(project('parallel', false, N));
    const unchosen = curves(project(null, false, N));
    expect(unchosen).toEqual(chosen);
    const one = curves(project(null, false, 1));
    expect(worst(unchosen.zmag, one.zmag, (a, b) => a * N / b - 1)).toBeLessThan(1e-6);
  });

  it.each(['parallel', 'series'] as const)('"Impedance of one driver" ticked, %s: only zmag changes, and it is one driver\'s', (wiring) => {
    const off = curves(project(wiring, false, N));
    const on = curves(project(wiring, true, N));
    const {zmag: zOn, ...restOn} = on;
    const {zmag: zOff, ...restOff} = off;
    expect(restOn).toEqual(restOff);
    const one = curves(project('parallel', false, 1));
    expect(worst(zOn, one.zmag, (a, b) => a / b - 1)).toBeLessThan(1e-6);
    expect(zOn).not.toEqual(zOff);
  });
});

describe('the Signal tab follows Driver wiring (plan 3.3, 7)', () => {
  it('voltage 2.83 entered: power 4.7111 W Parallel, 0.29444 W Series (Re 6.8, 4 drivers)', () => {
    const par = project('parallel', false, N);
    const ser = project('series', false, N);
    expect(par.powerDrive_W.value).toBeCloseTo(4.7111, 3);
    expect(ser.powerDrive_W.value).toBeCloseTo(0.29444, 4);
  });

  it('power 4.7111 W entered: the voltage readout is 2.83 V Parallel, 11.32 V Series, and the SPL is equal', () => {
    const make = (wiring: 'parallel' | 'series') => {
      const p = project(wiring, false, N);
      p.powerDrive_W.set(4.7111);
      return p;
    };
    const par = make('parallel');
    const ser = make('series');
    expect(par.driveVoltage_V.value).toBeCloseTo(2.83, 3);
    expect(ser.driveVoltage_V.value).toBeCloseTo(11.32, 3);
    expect(worst(curves(ser).spl, curves(par).spl, (a, b) => a - b)).toBeLessThan(1e-6);
  });

  it('the "Impedance of one driver" switch does not touch the Signal tab', () => {
    expect(project('series', true, N).powerDrive_W.value).toBe(project('series', false, N).powerDrive_W.value);
  });
});

describe('where the Driver wiring control and the "Impedance of one driver" switch apply (plan 3.1, 3.2)', () => {
  it.each([[1, false], [2, true], [4, true]])('%i driver(s): the control and the switch apply = %s', (n, applies) => {
    const p = project(null, false, n);
    expect(p.driverWiringApplies).toBe(applies);
    expect(p.winisdOneDriverImpedanceApplies).toBe(applies);
  });

  it('changing the driver count never changes the stored wiring: 4 to 1 to 4 brings Series back', () => {
    const p = project('series', false, 4);
    p.nDrivers.set(1);
    expect(p.driverWiring.value).toBe('series');
    p.nDrivers.set(4);
    expect(p.driverWiring.value).toBe('series');
  });

  it('a one-driver project is the same whatever its wiring or switch (nothing to wire)', () => {
    expect(curves(project('series', true, 1))).toEqual(curves(project('parallel', false, 1)));
  });
});
