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
import {buildPlotData, type Design, type PlotParams} from '@openisd/design/chart';

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

describe('buildPlotData — the axes it draws on', () => {
  it('carries a frequency axis over the sweep range and a level axis over the merged value range', () => {
    const one = buildPlotData(engine, 'Zmag', 10, 2000, design('a', '#4fb0ff'), []).value!;
    assert.deepEqual([one.freqAxis.fmin, one.freqAxis.fmax], [10, 2000]);
    assert.deepEqual([one.levelAxis.min, one.levelAxis.max, one.levelAxis.logy], [one.ymin, one.ymax, one.logy]);
    const two = buildPlotData(engine, 'Zmag', 10, 2000, design('a', '#4fb0ff'), [design('b', '#ffb454')]).value!;
    assert.deepEqual([two.levelAxis.min, two.levelAxis.max], [two.ymin, two.ymax]);
  });

  it('a zero sweep range falls back to 10 … 1000 Hz', () => {
    const out = buildPlotData(engine, 'Zmag', 0, 0, design('a', '#4fb0ff'), []).value!;
    assert.deepEqual([out.freqAxis.fmin, out.freqAxis.fmax], [10, 1000]);
  });
});

describe('buildPlotData — comparing two or more designs', () => {
  it('names the focused design\'s legend entry after the project, not the literal "Current"', () => {
    const out = buildPlotData(engine, 'Zmag', 10, 2000, design('W5 sealed', '#4fb0ff'), [design('p1', '#ffb454')]).value!;
    assert.equal(out.series[0].name, 'W5 sealed');
    assert.equal(out.series[1].name, 'p1');
  });

  it('marks the focused design\'s own series as current; overlays are not', () => {
    const out = buildPlotData(engine, 'Zmag', 10, 2000, design('W5 sealed', '#4fb0ff'), [design('p1', '#ffb454')]).value!;
    assert.equal(out.series[0].current, true);
    assert.ok(!out.series[1].current);
  });

  it('names a lone design\'s entry after the project too', () => {
    const out = buildPlotData(engine, 'Zmag', 10, 2000, design('W5 sealed', '#4fb0ff'), []).value!;
    assert.equal(out.series[0].name, 'W5 sealed');
  });

  it('orders series by sortIndex, not by current-first — matches the sidebar project list', () => {
    // Focused project sits below the overlay in the sidebar (sortIndex 1 vs 0): its own
    // trace must draw/legend second, matching that list, not first just because it's focused.
    const out = buildPlotData(
      engine, 'Zmag', 10, 2000,
      design('W5 sealed', '#4fb0ff', 1),
      [design('p1', '#ffb454', 0)],
    ).value!;
    assert.equal(out.series[0].name, 'p1');
    assert.equal(out.series[1].name, 'W5 sealed');
    assert.equal(out.series[1].current, true);
  });

  it('lists the 0 dB and −3 dB lines below every project entry', () => {
    const out = buildPlotData(engine, 'TFMag', 10, 2000, design('W5 sealed', '#4fb0ff', 0), [design('p1', '#ffb454', 1)]).value!;
    assert.deepEqual(out.series.map(s => s.name), ['W5 sealed', 'p1', '0 dB', '−3 dB']);
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
    assert.deepEqual(out.series.filter(s => !s.dash).map(s => s.name), ['vent']);
  });

  it('a vented overlay still draws on the port velocity chart', () => {
    const out = buildPlotData(engine, 'RearPort', 10, 2000, of('vented', 'a'), [of('vented', 'b')]).value!;
    assert.ok(out.series.some(s => s.name === 'b'));
  });

  it('every design draws on a chart every box type has', () => {
    const out = buildPlotData(engine, 'SPL', 10, 2000, of('vented', 'a'), [of('box-passive-radiator', 'b')]).value!;
    assert.ok(out.series.some(s => s.name === 'b'));
  });
});

describe('buildPlotData — F3 and F10 on the transfer function chart', () => {
  it('TFMag carries F3 and F10: where the current trace first reaches −3 dB and −10 dB', () => {
    const out = buildPlotData(engine, 'TFMag', 10, 2000, design('a', '#4fb0ff'), []).value!;
    assert.deepEqual(out.rolloffs.map(r => r.label), ['F3', 'F10']);
    const [f3, f10] = out.rolloffs.map(r => r.f);
    assert.ok(f3 !== null && f10 !== null, 'a sealed W5 box reaches both levels');
    assert.ok(f10 < f3, `F10 ${f10} sits below F3 ${f3}`);
    assert.ok(Math.abs(f3 - engine.simulation.rolloffFreq(SW, 3)!) < 0.1 * f3, 'near the SPL chart\'s F3');
  });

  it('a trace that never reaches a level has f null for it', () => {
    const flat: Design = { ...design('flat', '#4fb0ff'), curves: { ...SW, tfMag: SW.tfMag.map(() => 0) } };
    const out = buildPlotData(engine, 'TFMag', 10, 2000, flat, []).value!;
    assert.equal(out.rolloffs[0].f, 10);
  });

  it('the other charts carry none', () => {
    assert.deepEqual(buildPlotData(engine, 'SPL', 10, 2000, design('a', '#4fb0ff'), []).value!.rolloffs, []);
  });
});

describe('buildPlotData — the active trace is drawn 1.5 times as wide', () => {
  it('a lone design\'s trace is 1.7 px x 1.5', () => {
    const out = buildPlotData(engine, 'Zmag', 10, 2000, design('a', '#4fb0ff'), []).value!;
    assert.ok(Math.abs(out.series[0].lineWidth! - 1.7 * 1.5) < 1e-9, `${out.series[0].lineWidth}`);
  });

  it('beside overlays the focused trace is the same 1.7 px x 1.5 and the overlays keep the default', () => {
    const out = buildPlotData(engine, 'Zmag', 10, 2000, design('a', '#4fb0ff'), [design('p1', '#ffb454')]).value!;
    assert.ok(Math.abs(out.series[0].lineWidth! - 1.7 * 1.5) < 1e-9, `${out.series[0].lineWidth}`);
    assert.equal(out.series[1].lineWidth, undefined);
  });

  it('reference lines keep their own width', () => {
    const out = buildPlotData(engine, 'TFMag', 10, 2000, design('a', '#4fb0ff'), []).value!;
    assert.equal(out.series[1].lineWidth, undefined);
  });
});

describe('buildPlotData — the phase cut-over segments', () => {
  it('a degree chart marks the segments that jump across ±180°; a dB chart marks none', () => {
    const wrapped: Design = { ...design('w', '#4fb0ff'), curves: { ...SW, phase: SW.phase.map((_, i) => (i % 2 ? 170 : -170)) } };
    const phase = buildPlotData(engine, 'Phase', 10, 2000, wrapped, []).value!;
    assert.deepEqual(phase.series[0].wraps, phase.series[0].ys.map((_, i) => i).filter(i => i > 0));
    const spl = buildPlotData(engine, 'SPL', 10, 2000, design('a', '#4fb0ff'), []).value!;
    assert.equal(spl.series[0].wraps, undefined);
  });
});
