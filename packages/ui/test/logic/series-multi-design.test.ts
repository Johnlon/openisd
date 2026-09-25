/**
 * `buildPlotData`'s legend naming and emphasis when comparing two or more projects on one
 * chart — QO: the legend read "Current: Max power" for the focused project instead of its
 * real name, with no visual distinction from an overlay's own trace.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {Engine} from '@openisd/design/engine';
import type {DqIssue, DriverSolverParams, SolverField, SweepParams} from '@openisd/design/engine';
import {buildPlotData} from '../../src/logic/series.js';
import type {Design, PlotParams} from '../../src/types.js';

function fakeField<T>(value: T | null): SolverField<T> {
  let current: T | null = value;
  let state: 'entered' | 'calculated' | 'not-available' = value === null ? 'not-available' : 'entered';
  return {
    get value() { return current; },
    get entered() { return state === 'entered'; },
    get calculated() { return state === 'calculated'; },
    get dq() { return [] as DqIssue[]; },
    get precision() { return null; },
    setCalculated(v: T) { current = v; state = 'calculated'; },
    setDq() {},
    setNotAvailable() { current = null; state = 'not-available'; },
  };
}

const RAW: Record<string, number> = {
  Fs: 37, Qts: 0.378, Qes: 0.40, Qms: 7.0, Vas: 0.0300,
  Sd: 0.0133, Re: 5.6, Le: 0.70e-3, Xmax: 0.0050, Pe: 60, Znom: 8,
};
const driverParams: DriverSolverParams = {
  Fs_hz: fakeField(RAW.Fs), Re_ohm: fakeField(RAW.Re), Znom_ohm: fakeField(RAW.Znom),
  Le_H: fakeField(RAW.Le), fLe_hz: fakeField<number>(null), KLe_H_sqrtHz: fakeField<number>(null),
  Qes: fakeField(RAW.Qes), Qms: fakeField(RAW.Qms), Qts: fakeField(RAW.Qts), Vas_m3: fakeField(RAW.Vas),
  Sd_m2: fakeField(RAW.Sd), Dd_m: fakeField<number>(null), BL_Tm: fakeField<number>(null), Mms_kg: fakeField<number>(null),
  Cms_m_per_N: fakeField<number>(null), Rms_kg_per_s: fakeField<number>(null), EBP_hz: fakeField<number>(null),
  Xmax_m: fakeField(RAW.Xmax), Vd_m3: fakeField<number>(null), Hc_m: fakeField<number>(null), Hg_m: fakeField<number>(null),
  Pe_W: fakeField(RAW.Pe), no: fakeField<number>(null), SPLref_dB: fakeField<number>(null), SPL_dB: fakeField<number>(null),
  USPL_dB: fakeField<number>(null), SPLmax_dB: fakeField<number>(null), SPLmaxLF_dB: fakeField<number>(null),
  Rme_kg_per_s: fakeField<number>(null), Mpow_N_per_sqrtW: fakeField<number>(null), Mcost_kg_per_s: fakeField<number>(null),
  gamma_m_per_s2_A: fakeField<number>(null), Gloss: fakeField<number>(null), Vcd_m: fakeField<number>(null), Depth_m: fakeField<number>(null),
  MagDepth_m: fakeField<number>(null), Magnet_m: fakeField<number>(null), DVol_m3: fakeField<number>(null),
  c_m_per_s: fakeField(new Engine().solveEnvironment({}).values.c),
  roo_kg_per_m3: fakeField(new Engine().solveEnvironment({}).values.rho),
  Re_terminal_ohm: fakeField<number>(null), BL_terminal_Tm: fakeField<number>(null), numVC: fakeField<number>(null),
  wiring: fakeField('parallel'),
};
new Engine().solveDriver(driverParams, new Engine().solveEnvironment({}).values);
const LE_H = 0.70e-3;
const SP: SweepParams = { Vb: 0.030, eg: 2.83, fmin: 10, fmax: 2000, N: 200, filters: [] };
const PP = SP as unknown as PlotParams;
const SW = new Engine().sweep(driverParams, LE_H, 'sealed', SP).values!;
const MX = new Engine().maxCurves(driverParams, LE_H, 'sealed', SP).values!;

function design(name: string, color: string, sortIndex?: number): Design {
  return { driver: driverParams, box: 'sealed', P: PP, curves: SW, maxCurves: MX, name, color, sortIndex };
}

describe('buildPlotData — comparing two or more designs', () => {
  it('names the focused design\'s legend entry after the project, not the literal "Current"', () => {
    const out = buildPlotData('Zmag', 10, 2000, design('W5 sealed', '#4fb0ff'), [design('p1', '#ffb454')]).value!;
    assert.equal(out.series[0].name, 'W5 sealed: |Z|');
    assert.equal(out.series[1].name, 'p1: |Z|');
  });

  it('marks the focused design\'s own series as current; overlays are not', () => {
    const out = buildPlotData('Zmag', 10, 2000, design('W5 sealed', '#4fb0ff'), [design('p1', '#ffb454')]).value!;
    assert.equal(out.series[0].current, true);
    assert.ok(!out.series[1].current);
  });

  it('leaves the single-design case unmarked (no legend is drawn for it anyway)', () => {
    const out = buildPlotData('Zmag', 10, 2000, design('W5 sealed', '#4fb0ff'), []).value!;
    assert.equal(out.series[0].name, '|Z|');
  });

  it('orders series by sortIndex, not by current-first — matches the sidebar project list', () => {
    // Focused project sits below the overlay in the sidebar (sortIndex 1 vs 0): its own
    // trace must draw/legend second, matching that list, not first just because it's focused.
    const out = buildPlotData(
      'Zmag', 10, 2000,
      design('W5 sealed', '#4fb0ff', 1),
      [design('p1', '#ffb454', 0)],
    ).value!;
    assert.equal(out.series[0].name, 'p1: |Z|');
    assert.equal(out.series[1].name, 'W5 sealed: |Z|');
    assert.equal(out.series[1].current, true);
  });
});
