/**
 * `buildPlotData`'s legend naming and emphasis when comparing two or more projects on one
 * chart — QO: the legend read "Current: Max power" for the focused project instead of its
 * real name, with no visual distinction from an overlay's own trace.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createEngine} from '@openisd/design/engine';

const engine = createEngine();
import type {SweepDriver, SweepParams} from '@openisd/design/engine';
import {ProjectBuilder} from '@openisd/design';
import {buildPlotData} from '../../src/logic/series.js';
import type {Design, PlotParams} from '../../src/types.js';

const RAW: Record<string, number> = {
  Fs: 37, Qts: 0.378, Qes: 0.40, Qms: 7.0, Vas: 0.0300,
  Sd: 0.0133, Re: 5.6, Le: 0.70e-3, Xmax: 0.0050, Pe: 60, Znom: 8,
};
/** The RAW driver, solved through an OpenISD project as the app solves it, in the plain form
 *  `SimulationEngine.sweep()`/`maxCurves()` take. */
function solvedDriver(): SweepDriver {
  const specs = ProjectBuilder.empty(engine).driver.specs;
  specs.Fs_hz.set(RAW.Fs); specs.Qts.set(RAW.Qts); specs.Qes.set(RAW.Qes); specs.Qms.set(RAW.Qms);
  specs.Vas_m3.set(RAW.Vas); specs.Sd_m2.set(RAW.Sd); specs.Re_ohm.set(RAW.Re); specs.Le_H.set(RAW.Le);
  specs.Xmax_m.set(RAW.Xmax); specs.Pe_W.set(RAW.Pe); specs.Znom_ohm.set(RAW.Znom);
  return specs.sweepDriver();
}
const DRV = solvedDriver();
const LE_H = 0.70e-3;
const SP: SweepParams = { Vb: 0.030, eg: 2.83, fmin: 10, fmax: 2000, N: 200, filters: [] };
const PP: PlotParams = { fmin: SP.fmin ?? 10, fmax: SP.fmax ?? 2000 };
const SW = engine.simulation.sweep(DRV, LE_H, 'sealed', SP).values!;
const MX = engine.simulation.maxCurves(DRV, LE_H, 'sealed', SP).values!;

function design(name: string, color: string, sortIndex?: number): Design {
  return { driver: DRV, box: 'sealed', P: PP, curves: SW, maxCurves: MX, name, color, sortIndex };
}

describe('buildPlotData — comparing two or more designs', () => {
  it('names the focused design\'s legend entry after the project, not the literal "Current"', () => {
    const out = buildPlotData(engine, 'Zmag', 10, 2000, design('W5 sealed', '#4fb0ff'), [design('p1', '#ffb454')]).value!;
    assert.equal(out.series[0].name, 'W5 sealed: |Z|');
    assert.equal(out.series[1].name, 'p1: |Z|');
  });

  it('marks the focused design\'s own series as current; overlays are not', () => {
    const out = buildPlotData(engine, 'Zmag', 10, 2000, design('W5 sealed', '#4fb0ff'), [design('p1', '#ffb454')]).value!;
    assert.equal(out.series[0].current, true);
    assert.ok(!out.series[1].current);
  });

  it('leaves the single-design case unmarked (no legend is drawn for it anyway)', () => {
    const out = buildPlotData(engine, 'Zmag', 10, 2000, design('W5 sealed', '#4fb0ff'), []).value!;
    assert.equal(out.series[0].name, '|Z|');
  });

  it('orders series by sortIndex, not by current-first — matches the sidebar project list', () => {
    // Focused project sits below the overlay in the sidebar (sortIndex 1 vs 0): its own
    // trace must draw/legend second, matching that list, not first just because it's focused.
    const out = buildPlotData(
      engine, 'Zmag', 10, 2000,
      design('W5 sealed', '#4fb0ff', 1),
      [design('p1', '#ffb454', 0)],
    ).value!;
    assert.equal(out.series[0].name, 'p1: |Z|');
    assert.equal(out.series[1].name, 'W5 sealed: |Z|');
    assert.equal(out.series[1].current, true);
  });
});

describe('buildPlotData — levels below −190 dB are real points, not silence', () => {
  // LP Butterworth n=10 at 50 Hz takes the transfer function well below −190 dB inside the sweep
  // (BUG_20261001_transfer-function-jumps-80db-where-spl-drops-below-190db).
  const steep: SweepParams = { ...SP, filters: [{ type: 'lowpass', family: 'butterworth', order: 10, fc: 50, Q: Math.SQRT1_2, enabled: true }] };
  const sw = engine.simulation.sweep(DRV, LE_H, 'sealed', steep).values!;
  const steepDesign: Design = { ...design('steep', '#4fb0ff'), curves: sw };

  it('the transfer-function chart\'s y range reaches its lowest real point', () => {
    const out = buildPlotData(engine, 'TFMag', 10, 2000, steepDesign, []).value!;
    const lowest = Math.min(...sw.tfMag);
    assert.ok(lowest < -190, `sweep should reach below −190 dB, lowest ${lowest}`);
    assert.ok(out.ymin <= lowest, `ymin ${out.ymin} cuts off the lowest real point ${lowest}`);
  });

  it('the SPL chart\'s y range reaches its lowest real point', () => {
    const out = buildPlotData(engine, 'SPL', 10, 2000, steepDesign, []).value!;
    assert.ok(out.ymin <= Math.min(...sw.spl), `ymin ${out.ymin}`);
  });
});

// BUG_20261001_port-velocity-chart-draws-a-pr-box-overlay: a design whose box type does not have
// the chart (`BoxEngine.chartsFor`) draws no line on it — a PR box has no port.
describe('buildPlotData — a design draws only on charts its box type has', () => {
  const of = (box: Design['box'], name: string): Design => ({ ...design(name, '#ffb454'), box });

  it('a passive-radiator overlay draws nothing on the port velocity chart', () => {
    const out = buildPlotData(engine, 'RearPort', 10, 2000, of('vented', 'vent'), [of('box-passive-radiator', 'pr')]).value!;
    // One design left, so its trace carries no project prefix.
    assert.deepEqual(out.series.filter(s => !s.dash).map(s => s.name), ['Port vel']);
  });

  it('a vented overlay still draws on the port velocity chart', () => {
    const out = buildPlotData(engine, 'RearPort', 10, 2000, of('vented', 'a'), [of('vented', 'b')]).value!;
    assert.ok(out.series.some(s => s.name.startsWith('b: ')));
  });

  it('every design draws on a chart every box type has', () => {
    const out = buildPlotData(engine, 'SPL', 10, 2000, of('vented', 'a'), [of('box-passive-radiator', 'b')]).value!;
    assert.ok(out.series.some(s => s.name.startsWith('b: ')));
  });
});
