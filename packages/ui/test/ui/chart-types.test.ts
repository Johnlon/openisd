/**
 * The chart-type set is CLOSED, and every member must actually draw.
 *
 * `TAB_META` and `CURVE_BUILDERS` are both `Record<ChartTabId, …>`, so a member with no
 * implementation is already a COMPILE error. What the compiler cannot check, and what is
 * checked here, is that each builder RUNS and returns a drawable bundle — a member can be
 * present in both maps and still hand back an empty series.
 *
 * Also covers the three "(EQ/Filter)" charts added for WinISD parity, whose contract is
 * fixed by WinISD Pro's help, "Filter/equalizer behavioral simulator":
 *   "Filter system is logically located at electrical side. 0 dB gain at filter chain
 *    means that voltage at driver terminal is equal that is specified at 'signal'-tab."
 *
 * Specification: docs/spec/SPEC_UI.md §1.1 "Decoupled Chart Series Building"
 *
 * Run: npm run test:unit
 */

import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { Engine } from '@openisd/design/engine';
import type { SweepParams } from '@openisd/design/engine';
import { TABS, TAB_META, parseChartTabId, seriesFor } from '../../src/logic/series.js';
import type { ChartTabId, PlotParams } from '../../src/types.js';

const RAW: Record<string, number> = {
  Fs: 37, Qts: 0.378, Qes: 0.40, Qms: 7.0, Vas: 0.0300,
  Sd: 0.0133, Re: 5.6, Le: 0.70e-3, Xmax: 0.0050, Pe: 60, Znom: 8,
};
// The solver derives what the stated values imply, terminal Re/BL included — there is no
// separate derive-and-validate step, and `sweep` is what reports a driver it cannot use.
const DRV = new Engine().solveConsistencyGroup({
  Fs_hz: RAW.Fs, Qts: RAW.Qts, Qes: RAW.Qes, Qms: RAW.Qms, Vas_m3: RAW.Vas,
  Sd_m2: RAW.Sd, Re_ohm: RAW.Re, Xmax_m: RAW.Xmax, Pe_W: RAW.Pe, Znom_ohm: RAW.Znom,
});
const LE_H = 0.70e-3;

const SP: SweepParams = {
  Vb: 0.030, eg: 2.83, Sp: Math.PI * (0.05 / 2) ** 2, Leff: 0.30 + 0.732 * 0.05,
  fmin: 10, fmax: 2000, N: 200,
  filters: [{ type: 'peaking', fc: 60, Q: 3, gain: 6, enabled: true }],
};
const PP = SP as unknown as PlotParams;
const SW = new Engine().sweep(DRV, LE_H, 'vented', SP).value;
assert.ok(SW, 'reference sweep produced nothing');
const MX = new Engine().maxCurves(DRV, LE_H, 'vented', SP).value;
assert.ok(MX, 'reference max curves produced nothing');
const build = (id: ChartTabId) => seriesFor(id, DRV, 'vented', PP, SW, MX);

const ALL_IDS = Object.keys(TAB_META) as ChartTabId[];

describe('chart-type set — every declared member draws', () => {
  it('TABS exposes exactly the declared members, in declaration order', () => {
    assert.deepEqual(TABS.map(t => t.id), ALL_IDS);
    for (const t of TABS) assert.equal(t.id, TAB_META[t.id].id, 'meta key and id disagree');
  });

  it('every member returns a non-empty first series with matching xs/ys lengths', () => {
    for (const id of ALL_IDS) {
      const b = build(id);
      assert.ok(b.series.length > 0, `${id}: no series at all`);
      const s = b.series.find(x => !x.phantom);
      assert.ok(s, `${id}: every series was a phantom legend entry`);
      assert.ok(s.xs.length > 0, `${id}: primary series has no points`);
      assert.equal(s.xs.length, s.ys.length, `${id}: xs/ys length mismatch`);
      assert.ok(b.unit.length > 0, `${id}: no unit`);
    }
  });

  it('every member produces a finite, non-degenerate y range', () => {
    for (const id of ALL_IDS) {
      const b = build(id);
      assert.ok(Number.isFinite(b.ymin), `${id}: ymin is ${b.ymin}`);
      assert.ok(Number.isFinite(b.ymax), `${id}: ymax is ${b.ymax}`);
      assert.ok(b.ymax > b.ymin, `${id}: empty y range ${b.ymin}..${b.ymax}`);
    }
  });

  it('every member plots real numbers, not NaN', () => {
    for (const id of ALL_IDS) {
      const s = build(id).series.find(x => !x.phantom)!;
      assert.ok(s.ys.every(v => !Number.isNaN(v)), `${id}: NaN in the plotted values`);
    }
  });
});

describe('chart-type set — the one string→member boundary', () => {
  it('accepts every declared id unchanged', () => {
    for (const id of ALL_IDS) assert.equal(parseChartTabId(id), id);
  });

  it('treats an undeclared id as missing, not as a second spelling', () => {
    // A stale id from localStorage, a hand-edited share link, and a typo are all just
    // invalid data — none of them selects a chart nothing can draw.
    for (const bad of ['Excursion(PR)', 'spl', 'banana', '', null, undefined])
      assert.equal(parseChartTabId(bad), 'SPL', `parseChartTabId(${JSON.stringify(bad)})`);
  });

  it('does not admit inherited Object properties as chart ids', () => {
    for (const bad of ['toString', 'constructor', 'hasOwnProperty'])
      assert.equal(parseChartTabId(bad), 'SPL', `parseChartTabId(${JSON.stringify(bad)})`);
  });
});

describe('EQ/filter charts — units, datum and axis', () => {
  it('FltMag is in dB and always draws its 0 dB unity datum', () => {
    const b = build('FltMag');
    assert.equal(b.unit, 'dB');
    const ref = b.series.find(s => s.name === '0 dB');
    assert.ok(ref, 'the 0 dB unity line is missing — it is what the help pins the chart to');
    assert.ok(ref.ys.every(v => v === 0), 'the 0 dB line is not at 0 dB');
    assert.ok(ref.dash, 'the reference line must be dashed, not mistakable for data');
  });

  it('FltMag draws the 0 dB datum in bare/classic mode too', () => {
    // Unlike SPL's F3/F6/F10 annotations, unity is the chart's DEFINING datum, so `bare`
    // must not strip it.
    const bare = seriesFor('FltMag', DRV, 'vented', PP, SW, MX, true);
    assert.ok(bare.series.some(s => s.name === '0 dB'), 'bare mode dropped the unity datum');
  });

  it('FltMag brackets the +6 dB peak the filter chain actually has', () => {
    const b = build('FltMag');
    const s = b.series[0];
    assert.ok(Math.max(...s.ys) > 5.5, 'the +6 dB peaking filter is not visible in the curve');
    assert.ok(b.ymax >= Math.max(...s.ys), 'the peak is above the top of the axis');
    assert.ok(b.ymin <= Math.min(...s.ys), 'the trough is below the bottom of the axis');
  });

  it('FltPhase is in DEGREES, converted from the engine radians', () => {
    const b = build('FltPhase');
    assert.equal(b.unit, '°');
    const ys = b.series[0].ys;
    for (let i = 0; i < ys.length; i++)
      assert.ok(Math.abs(ys[i] - SW.fltPhase[i] * 180 / Math.PI) < 1e-9,
        `degree conversion wrong at ${SW.fs[i].toFixed(2)} Hz`);
  });

  it('FltGD is in ms and its axis admits the negative delay a cut filter produces', () => {
    const b = build('FltGD');
    assert.equal(b.unit, 'ms');
    assert.ok(b.ymin <= 0, 'the group-delay floor is pinned above 0, hiding negative delay');
    assert.deepEqual(b.series[0].ys, SW.fltGd);
  });

  it('an empty filter chain still yields a drawable, non-degenerate axis on all three', () => {
    // The default project has no filters, so this is what the user sees first: a flat line
    // at unity, which must not collapse the axis to zero height.
    const noFlt = { ...SP, filters: [] };
    const noFltP = noFlt as unknown as PlotParams;
    const engine = new Engine();
    const sw = engine.sweep(DRV, LE_H, 'vented', noFlt).value;
    assert.ok(sw, 'sweep produced nothing');
    const mx = engine.maxCurves(DRV, LE_H, 'vented', noFlt).value;
    assert.ok(mx, 'maxCurves produced nothing');
    for (const id of ['FltMag', 'FltPhase', 'FltGD'] as const) {
      const b = seriesFor(id, DRV, 'vented', noFltP, sw, mx);
      assert.ok(b.ymax > b.ymin, `${id}: empty chain collapsed the axis to ${b.ymin}..${b.ymax}`);
      assert.ok(b.series[0].ys.every(v => v === 0), `${id}: an empty chain is not flat at unity`);
      assert.ok(b.ymin < 0 && b.ymax > 0, `${id}: the flat unity line sits on the axis edge`);
    }
  });
});

describe('a design with no max curves draws nothing, rather than crashing', () => {
  // A compare overlay whose sweep has not produced max curves reaches these two charts with
  // none. `Design.maxCurves` is declared nullable, so this is an ordinary state, not an edge.
  // It used to arrive as `{} as MaxCurvesResult` — an object with no `fs` and no `maxspl` — and
  // both builders read straight through it: `realDb(mx.maxspl)` is `undefined.filter(...)`, and
  // `Math.max(...mx.maxpwr)` spreads `undefined`. Both throw.
  it('MaxSPL contributes no series when the max curves are absent', () => {
    const bundle = seriesFor('MaxSPL', DRV, 'vented', PP, SW, undefined);
    assert.deepEqual(bundle.series, []);
  });

  it('MaxPwr contributes no series when the max curves are absent', () => {
    const bundle = seriesFor('MaxPwr', DRV, 'vented', PP, SW, undefined);
    assert.deepEqual(bundle.series, []);
  });

  it('every OTHER chart is unaffected — they never read the max curves', () => {
    for (const id of ALL_IDS.filter(i => i !== 'MaxSPL' && i !== 'MaxPwr')) {
      const bundle = seriesFor(id, DRV, 'vented', PP, SW, undefined);
      assert.ok(bundle.series.length > 0, `${id} drew nothing without max curves`);
    }
  });
});
