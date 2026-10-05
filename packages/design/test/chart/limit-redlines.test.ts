/**
 * The chart limit lines — the driver's Xmax, the passive radiator's Xmax and the port air-velocity
 * limit — are all the same red, so a trace touching one reads as over its limit.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createEngine} from '@openisd/design/engine';
import type {ChartId, SweepDriver, SweepParams} from '@openisd/design/engine';
import {ProjectBuilder} from '@openisd/design';
import {seriesFor, type PlotParams} from '@openisd/design/chart';

const engine = createEngine();
const RAW: Record<string, number> = {
  Fs: 37, Qts: 0.378, Qes: 0.40, Qms: 7.0, Vas: 0.0300,
  Sd: 0.0133, Re: 5.6, Le: 0.70e-3, Xmax: 0.0050, Pe: 60, Znom: 8,
};
function solvedDriver(): SweepDriver {
  const specs = ProjectBuilder.empty(engine).driver.specs;
  specs.Fs_hz.set(RAW.Fs); specs.Qts.set(RAW.Qts); specs.Qes.set(RAW.Qes); specs.Qms.set(RAW.Qms);
  specs.Vas_m3.set(RAW.Vas); specs.Sd_m2.set(RAW.Sd); specs.Re_ohm.set(RAW.Re); specs.Le_H.set(RAW.Le);
  specs.Xmax_m.set(RAW.Xmax); specs.Pe_W.set(RAW.Pe); specs.Znom_ohm.set(RAW.Znom);
  return specs.sweepDriver();
}
const DRV = solvedDriver();
const SP: SweepParams = {Vb: 0.030, eg: 2.83, fmin: 10, fmax: 2000, N: 200, filters: []};
const SW = engine.simulation.sweep(DRV, RAW.Le, 'sealed', SP).values!;
const P: PlotParams = {fmin: 10, fmax: 2000, prXmax: 0.008, portVelocityLimit_m_per_s: 17};
const REDLINE = '#ff6b6b';

function limitLine(chart: ChartId, name: string) {
  const bundle = seriesFor(engine, chart, DRV, 'sealed', P, SW, undefined);
  return bundle.series.find((s) => s.name === name);
}

describe('chart limit lines', () => {
  it.each([
    ['Excursion', 'Xmax'],
    ['PRExcursion', 'PR Xmax'],
    ['RearPort', '17 m/s'],
  ] as const)('the %s chart draws its "%s" line red', (chart, name) => {
    assert.equal(limitLine(chart, name)?.color, REDLINE);
  });
});
