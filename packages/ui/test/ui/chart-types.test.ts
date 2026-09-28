/**
 * The chart-type set is CLOSED, and every member must actually draw.
 *
 * `TAB_META` and `CURVE_BUILDERS` are both `Record<ChartId, …>`, so a member with no
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

import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import type {ChartId, DqIssue, DriverSolverParams, SolverField, SweepParams} from '@openisd/design/engine';
import {createEngine} from '@openisd/design/engine';

const engine = createEngine();
import {parseChartId, seriesFor, TAB_META, TABS} from '../../src/logic/series.js';
import type {PlotParams} from '../../src/types.js';

const RAW: Record<string, number> = {
  Fs: 37, Qts: 0.378, Qes: 0.40, Qms: 7.0, Vas: 0.0300,
  Sd: 0.0133, Re: 5.6, Le: 0.70e-3, Xmax: 0.0050, Pe: 60, Znom: 8,
};

/** A writable `SolverField` test double (mirrors `packages/design/test/engine/testSolver.ts`'s
 *  own `fakeSolverField`, not importable here — that lives under `packages/design/test/`, not
 *  the published package). `entered` for a stated value, so `Engine.solveDriver()` leaves it
 *  alone; absent starts `not-available` and the solve fills it via `setCalculated`. */
function fakeField<T>(value: T | null): SolverField<T> {
  let current: T | null = value;
  let state: 'entered' | 'calculated' | 'not-available' = value === null ? 'not-available' : 'entered';
  return {
    get value() { return current; },
    get entered() { return state === 'entered'; },
    get calculated() { return state === 'calculated'; },
    get precision() { return null; },
    get dq() { return [] as DqIssue[]; },
    setCalculated(v: T) { current = v; state = 'calculated'; },
    setDq() {},
    setNotAvailable() { current = null; state = 'not-available'; },
  };
}

// The solver derives what the stated values imply, terminal Re/BL included — there is no
// separate derive-and-validate step, and `sweep` is what reports a driver it cannot use.
// S2-10: `SimulationEngine.sweep()`/`maxCurves()` now take handles (`DriverSolverParams`), so the stated
// RAW values are seeded as entered fields, `solveDriver()` fills in everything it can derive
// (writing back via `setCalculated`), and the same handle set is then handed to `sweep()` — no
// intermediate bag anywhere.
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
  c_m_per_s: fakeField(engine.environment.solve({}).values.c),
  roo_kg_per_m3: fakeField(engine.environment.solve({}).values.rho),
  Re_terminal_ohm: fakeField<number>(null), BL_terminal_Tm: fakeField<number>(null), numVC: fakeField<number>(null),
  wiring: fakeField('parallel'),
};
engine.driver.solve(driverParams, engine.environment.solve({}).values);
const DRV = driverParams;
const LE_H = 0.70e-3;

// Fb: the tuning this Vb/Sp/Leff already amounts to (Helmholtz, inverted) — winisd-lossy's own
// Map comes from Fb directly (circuit.ts, BUG_20260927_vented-box-losses-not-winisd-form.md).
const SP_VB = 0.030, SP_SP = Math.PI * (0.05 / 2) ** 2, SP_LEFF = 0.30 + 0.732 * 0.05;
const {c: SP_C} = engine.environment.solve({}).values;
const SP: SweepParams = {
  Vb: SP_VB, eg: 2.83, Sp: SP_SP, Leff: SP_LEFF, Fb: SP_C * Math.sqrt(SP_SP / (SP_LEFF * SP_VB)) / (2 * Math.PI),
  fmin: 10, fmax: 2000, N: 200,
  filters: [{ type: 'peaking', fc: 60, Q: 3, gain: 6, enabled: true }],
};
const PP = SP as unknown as PlotParams;
const SW = engine.simulation.sweep(DRV, LE_H, 'vented', SP).values;
assert.ok(SW, 'reference sweep produced nothing');
const MX = engine.simulation.maxCurves(DRV, LE_H, 'vented', SP).values;
assert.ok(MX, 'reference max curves produced nothing');

// The three "(PR)" chart ids are `null` for a vented design (SW above) — that is the correct,
// designed answer (bugs/BUG_20260927_winisd-charts-missing.md: no fake zero, unlike `excPR`),
// not a gap this suite should paper over. They get their OWN reference design, a real
// passive-radiator box, so "every declared member draws" is checked against data that
// actually exists for them.
const PR_ENGINE = createEngine();
const PR_VB = 0.010;
const PR_BOX = { prSd: 0.0095, prNum: 1, prMmd: 0.010, prMadd: 0, prCms: 0.0018, prRms: 1.0 };
const PR_FR = PR_ENGINE.pr.tuning({ Vb: PR_VB, prMmd: PR_BOX.prMmd, prMadd: PR_BOX.prMadd, prSd: PR_BOX.prSd, prCms: PR_BOX.prCms, prNum: PR_BOX.prNum },
  PR_ENGINE.environment.solve({}).values);
const SP_PR: SweepParams = {
  Vb: PR_VB, eg: 2.83, ...PR_BOX, Fr: PR_FR, Ql: 7, Qa: 30,
  fmin: 10, fmax: 2000, N: 200,
  filters: [{ type: 'peaking', fc: 60, Q: 3, gain: 6, enabled: true }],
};
const PP_PR = SP_PR as unknown as PlotParams;
const SW_PR = PR_ENGINE.simulation.sweep(DRV, LE_H, 'box-passive-radiator', SP_PR).values;
assert.ok(SW_PR, 'reference PR sweep produced nothing');
const MX_PR = PR_ENGINE.simulation.maxCurves(DRV, LE_H, 'box-passive-radiator', SP_PR).values;
assert.ok(MX_PR, 'reference PR max curves produced nothing');

// `FrontPortGain` is `null` for a vented design (SW above), same reasoning as the PR trio —
// its own reference design is a real bandpass4 box.
const BP4_ENGINE = createEngine();
const SP_BP4: SweepParams = {
  Vb: 0.010, Vf: 0.005, Ff: 60, Qlr: 7, Qar: 30, Qiclfr: 20, Qlf: 9, Qaf: 40, Qpf: 15,
  eg: 2.83, fmin: 10, fmax: 2000, N: 200,
  filters: [{ type: 'peaking', fc: 60, Q: 3, gain: 6, enabled: true }],
};
const PP_BP4 = SP_BP4 as unknown as PlotParams;
const SW_BP4 = BP4_ENGINE.simulation.sweep(DRV, LE_H, 'bandpass4', SP_BP4).values;
assert.ok(SW_BP4, 'reference bandpass4 sweep produced nothing');
const MX_BP4 = BP4_ENGINE.simulation.maxCurves(DRV, LE_H, 'bandpass4', SP_BP4).values;
assert.ok(MX_BP4, 'reference bandpass4 max curves produced nothing');

const PR_IDS = new Set<ChartId>(['PRTFMag', 'PRTFPhase', 'PRExcursion']);
const BP4_IDS = new Set<ChartId>(['FrontPortGain']);
const build = (id: ChartId) => PR_IDS.has(id)
  ? seriesFor(engine, id, DRV, 'box-passive-radiator', PP_PR, SW_PR, MX_PR)
  : BP4_IDS.has(id)
  ? seriesFor(engine, id, DRV, 'bandpass4', PP_BP4, SW_BP4, MX_BP4)
  : seriesFor(engine, id, DRV, 'vented', PP, SW, MX);

const ALL_IDS = Object.keys(TAB_META) as ChartId[];

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

  it('every plotted point sits within the builder\'s own declared y range', () => {
    for (const id of ALL_IDS) {
      const b = build(id);
      for (const s of b.series) {
        if (s.phantom) continue;
        for (const y of s.ys) {
          if (!Number.isFinite(y)) continue;
          assert.ok(y >= b.ymin - 1e-9 && y <= b.ymax + 1e-9,
            `${id}: y=${y} outside declared range ${b.ymin}..${b.ymax} — the line would render off-chart`);
        }
      }
    }
  });
});

describe('chart-type set — the one string→member boundary', () => {
  it('accepts every declared id unchanged', () => {
    for (const id of ALL_IDS) assert.equal(parseChartId(engine, id), id);
  });

  it('treats an undeclared id as missing, not as a second spelling', () => {
    // A stale id from localStorage, a hand-edited share link, and a typo are all just
    // invalid data — none of them selects a chart nothing can draw.
    for (const bad of ['Excursion(PR)', 'spl', 'banana', '', null, undefined])
      assert.equal(parseChartId(engine, bad), 'SPL', `parseChartId(${JSON.stringify(bad)})`);
  });

  it('does not admit inherited Object properties as chart ids', () => {
    for (const bad of ['toString', 'constructor', 'hasOwnProperty'])
      assert.equal(parseChartId(engine, bad), 'SPL', `parseChartId(${JSON.stringify(bad)})`);
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
    const bare = seriesFor(engine, 'FltMag', DRV, 'vented', PP, SW, MX, true);
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
    const engine = createEngine();
    const sw = engine.simulation.sweep(DRV, LE_H, 'vented', noFlt).values;
    assert.ok(sw, 'sweep produced nothing');
    const mx = engine.simulation.maxCurves(DRV, LE_H, 'vented', noFlt).values;
    assert.ok(mx, 'maxCurves produced nothing');
    for (const id of ['FltMag', 'FltPhase', 'FltGD'] as const) {
      const b = seriesFor(engine, id, DRV, 'vented', noFltP, sw, mx);
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
    const bundle = seriesFor(engine, 'MaxSPL', DRV, 'vented', PP, SW, undefined);
    assert.deepEqual(bundle.series, []);
  });

  it('MaxPwr contributes no series when the max curves are absent', () => {
    const bundle = seriesFor(engine, 'MaxPwr', DRV, 'vented', PP, SW, undefined);
    assert.deepEqual(bundle.series, []);
  });

  it('every OTHER chart is unaffected — they never read the max curves', () => {
    for (const id of ALL_IDS.filter(i => i !== 'MaxSPL' && i !== 'MaxPwr')) {
      const bundle = seriesFor(engine, id, DRV, 'vented', PP, SW, undefined);
      assert.ok(bundle.series.length > 0, `${id} drew nothing without max curves`);
    }
  });
});
