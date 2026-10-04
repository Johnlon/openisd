import {sweepDriver, solveConsistencyGroup} from './testSolver.js';
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import type {SweepParams} from '../../engine/index.js';
import {createEngine} from '../../engine/index.js';
import {OpenISDDriver} from '../../domain/driver/openISDDriver.js';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';

/** Voice-coil inductance for the fixtures below. Not a solver quantity — nothing
 *  derives it — so it reaches `sweep` on its own, and only the impedance plot reads it. */
const LE_H = 0.7e-3;

/** The engine's one door: every calculation below is a method on this object. */
const engine = createEngine();

const DRV = solveConsistencyGroup({
  Fs_hz:   37,      // Hz
  Qts:  0.38,
  Qes:  0.40,
  Qms:  7.0,
  Vas_m3:  0.030,   // m³
  Sd_m2:   0.0133,  // m²
  Re_ohm:   5.6,     // Ω  // H
  Xmax_m: 0.005,   // m
  Pe_W:   60,      // W
  Znom_ohm:    8,       // Ω
});

// Sealed box — lossless, 30 L
const BOX = 'sealed';

const VB_M3 = 0.030;

const QL_LOSSLESS = 1e6;

/** The reference 6.5" mid-woofer used across the engine suite — complete and valid. */
const RAW_COMPLETE = {
  Fs: 37, Qts: 0.38, Qes: 0.40, Qms: 7.0,
  Vas: 0.030, Sd: 0.0133, Re: 5.6, Le: 0.7e-3, Xmax: 0.005, Pe: 60, Znom: 8,
};

const P_SEALED: SweepParams = { Vb: 0.030, eg: 2.83, Ql: 10, fmin: 10, fmax: 1000, N: 50 };

const validDriver = () => sweepDriver(solveConsistencyGroup({
  Fs_hz: RAW_COMPLETE.Fs, Qts: RAW_COMPLETE.Qts, Qes: RAW_COMPLETE.Qes, Qms: RAW_COMPLETE.Qms,
  Vas_m3: RAW_COMPLETE.Vas, Sd_m2: RAW_COMPLETE.Sd, Re_ohm: RAW_COMPLETE.Re,
  Xmax_m: RAW_COMPLETE.Xmax, Pe_W: RAW_COMPLETE.Pe, Znom_ohm: RAW_COMPLETE.Znom,
}));

describe('classifyFinite', () => {
  // ── classifyFinite — the sweep-finiteness postcondition (hardening) ──────────
  // A precondition on inputs can't foresee a frequency-dependent singularity, so
  // the sweep output is classified at the boundary: isolated non-finite points →
  // warn (the curve still draws with a gap); an entirely non-finite primary curve
  // → error (nothing usable). Sentinels like -200 dB are finite and never flagged.
  describe('classifyFinite — non-finite sweep results are surfaced, never silently blank', () => {
    const P: SweepParams = { Vb: VB_M3, Ql: QL_LOSSLESS, eg: 2.83, fmin: 10, fmax: 1000, N: 50 };

    it('returns null for an all-finite sweep', () => {
      const sw = engine.simulation.sweep(sweepDriver(DRV), LE_H, BOX, P).values!;
      assert.equal(engine.simulation.classifyFinite(sw), null, 'a healthy sweep has no finiteness issue');
    });

    it('an all-finite sweep with -200 dB silence sentinels is still null (sentinels are finite)', () => {
      const sw = engine.simulation.sweep(sweepDriver(DRV), LE_H, BOX, { ...P, eg: 0 }).values!; // eg=0 → spl all -200 (finite sentinel)
      assert.equal(engine.simulation.classifyFinite(sw), null, '-200 dB sentinels must not be flagged as non-finite');
    });

    it('flags an entirely non-finite primary curve as a blocking error', () => {
      const sw = engine.simulation.sweep(sweepDriver(DRV), LE_H, BOX, P).values!;
      for (let i = 0; i < sw.spl.length; i++) sw.spl[i] = NaN;
      const r = engine.simulation.classifyFinite(sw);
      assert.ok(r && r.level === 'error', 'no finite spl point at all → blocking error');
      assert.match(r!.message, /no finite values in/i,
        'the blocking message must identify the failed sweep outputs');
    });

    it('names the plotted outputs that failed instead of guessing at an input cause', () => {
      const sw = engine.simulation.sweep(sweepDriver(DRV), LE_H, BOX, P).values!;
      for (let i = 0; i < sw.fs.length; i++) {
        sw.exc[i] = NaN;
        sw.zmag[i] = NaN;
      }
      const r = engine.simulation.classifyFinite(sw);
      assert.ok(r);
      assert.match(r.message, /excursion/i);
      assert.match(r.message, /impedance magnitude/i);
      assert.doesNotMatch(r.message, /6 L box alone/i);
    });

    it('reports a broken transfer-magnitude series for the TFM chart', () => {
      const sw = engine.simulation.sweep(sweepDriver(DRV), LE_H, BOX, P).values!;
      for (let i = 0; i < sw.tfMag.length; i++) sw.tfMag[i] = NaN;
      const issue = engine.simulation.classifyFiniteIssues(sw).find(error => error.field === 'sweep:transfer magnitude');
      assert.ok(issue, 'TFM output failure must be reported to the chart');
      assert.match(issue.message, /transfer magnitude/i);
    });

    it('per-output: exactly one non-finite value reads as singular ("1 non-finite ... value", not "values")', () => {
      const sw = engine.simulation.sweep(sweepDriver(DRV), LE_H, BOX, P).values!;
      sw.tfMag[0] = NaN; // exactly one bad point, not all of them
      const issue = engine.simulation.classifyFiniteIssues(sw).find(error => error.field === 'sweep:transfer magnitude');
      assert.ok(issue && issue.level === 'warn', 'a partial failure is a warn, not a block');
      assert.match(issue.message, /1 non-finite transfer magnitude value;/, 'exactly one bad value must read singular, no trailing "s"');
    });

    it('per-output: more than one non-finite value (but not all) reads as plural ("values")', () => {
      const sw = engine.simulation.sweep(sweepDriver(DRV), LE_H, BOX, P).values!;
      sw.tfMag[0] = NaN;
      sw.tfMag[1] = NaN;
      sw.tfMag[2] = NaN;
      const issue = engine.simulation.classifyFiniteIssues(sw).find(error => error.field === 'sweep:transfer magnitude');
      assert.ok(issue && issue.level === 'warn', 'a partial failure is a warn, not a block');
      assert.match(issue.message, /3 non-finite transfer magnitude values;/, 'more than one bad value must read plural');
    });

    it('reports a tempK missing-dependencies issue for a temperature beyond the supported range', () => {
      const result = engine.simulation.sweep(sweepDriver(DRV), LE_H, BOX, { ...P, tempK: 5000 });
      assert.equal(result.values, null);
      assert.equal(result.issues.length, 1);
      const [issue] = result.issues;
      assert.equal(issue.kind, 'missing-dependencies');
      if (issue.kind !== 'missing-dependencies') return;
      assert.equal(issue.target, 'tempK');
      assert.match(issue.routes[0].formula, /173\.15.*373\.15/);
    });

    it('rejects a temperature beyond the supported range even if the formula stays finite', () => {
      const result = engine.simulation.sweep(sweepDriver(DRV), LE_H, BOX, { ...P, tempK: 500 });
      assert.equal(result.values, null);
      assert.equal(result.issues.length, 1);
      const [issue] = result.issues;
      assert.equal(issue.kind, 'missing-dependencies');
      if (issue.kind !== 'missing-dependencies') return;
      assert.equal(issue.target, 'tempK');
    });

    it('rejects absolute zero with an exclusive lower-bound formula', () => {
      const result = engine.simulation.sweep(sweepDriver(DRV), LE_H, BOX, { ...P, tempK: 1 });
      assert.equal(result.values, null);
      const [issue] = result.issues;
      assert.equal(issue.kind, 'missing-dependencies');
      if (issue.kind !== 'missing-dependencies') return;
      assert.match(issue.routes[0].formula, /173\.15/);
    });

    it('names multiple isolated singularities in ascending frequency order, past and below 100 Hz, with a "+more" count past 3', () => {
      // A single bad index never invokes the frequency sort (nothing to sort) and never reaches
      // the >3 "+more" count — needs several, spanning both sides of the fs.toFixed(0)/toFixed(1)
      // 100 Hz split, and out of order so the sort actually does work.
      const sw = engine.simulation.sweep(sweepDriver(DRV), LE_H, BOX, P).values!;
      for (const i of [40, 5, 30, 13, 45]) sw.spl[i] = NaN; // unsorted on purpose
      const r = engine.simulation.classifyFinite(sw);
      assert.ok(r && r.level === 'warn', 'a partial, isolated breakdown is a warn, not a block');
      const freqs = [5, 13, 30, 40, 45].map(i => sw.fs[i]);
      assert.ok(freqs[0] < 100 && freqs[1] < 100 && freqs[2] >= 100, 'fixture must straddle the 100 Hz formatting split');
      assert.match(r!.message, /\+2 more/, 'only the first 3 (in ascending order) are named, the rest counted');
    });
  });

  // ── Criterion 3 ──────────────────────────────────────────────────────────────
  describe('an isolated mid-sweep singularity keeps the curve and explains the gap', () => {
    const singularSweep = () => {
      const sw = engine.simulation.sweep(validDriver(), undefined, 'sealed', P_SEALED).values!;
      sw.spl[10] = NaN;   // one grid point landing on a pole
      return sw;
    };

    it('is classified as a warn, never as a blocking error', () => {
      const issue = engine.simulation.classifyFinite(singularSweep());
      assert.ok(issue, 'a non-finite point must never pass unreported');
      assert.equal(issue.level, 'warn', 'one bad point out of 51 is a gap, not an unusable simulation');
    });

    it('names the frequency where the curve is undefined', () => {
      const sw = singularSweep();
      const issue = engine.simulation.classifyFinite(sw);
      assert.ok(issue, 'expected an issue');
      const f = sw.fs[10];
      assert.ok(issue.message.includes(f >= 100 ? f.toFixed(0) : f.toFixed(1)),
        `the message must name ~${f} Hz so the gap is not a mystery; got: ${issue.message}`);
    });

    it('leaves every other point intact so the renderer still draws the curve with a gap', () => {
      const sw = singularSweep();
      engine.simulation.classifyFinite(sw);
      const finite = sw.spl.filter(Number.isFinite).length;
      assert.equal(finite, sw.spl.length - 1, 'classification must not blank or interpolate the data');
      assert.ok(finite > 0, 'there is drawable data, so the chart must not be suppressed');
    });

    it('does not interpolate across the gap — the undefined point stays undefined', () => {
      const sw = singularSweep();
      engine.simulation.classifyFinite(sw);
      assert.ok(!Number.isFinite(sw.spl[10]),
        'filling the hole would fabricate a value where the model has none');
    });
  });

  // ── Criterion 4 ──────────────────────────────────────────────────────────────
  describe('no engine output reaches a chart non-finite without a surfaced issue', () => {
    /** Every `SweepResult` member the chart layer plots, by the name it is read under. */
    const PLOTTED_SWEEP_SERIES = [
      'spl', 'phase', 'exc', 'excPR', 'pv', 'zmag', 'zph', 'gd', 'fltMag', 'fltPhase', 'fltGd',
    ] as const;

    it('poisoning any single plotted sweep series is detected', () => {
      for (const key of PLOTTED_SWEEP_SERIES) {
        const sw = engine.simulation.sweep(validDriver(), undefined, 'sealed', P_SEALED).values!;
        sw[key][5] = NaN;
        assert.ok(engine.simulation.classifyFinite(sw), `a NaN in sweep.${key} reaches a chart and must be reported`);
      }
    });

    it('an Infinity is caught as well as a NaN — both break an axis the same way', () => {
      const sw = engine.simulation.sweep(validDriver(), undefined, 'sealed', P_SEALED).values!;
      sw.zmag[7] = Infinity;
      assert.ok(engine.simulation.classifyFinite(sw), 'Number.isFinite must be the test, not Number.isNaN');
    });

    it('a breakdown at every frequency is an error even where spl holds the finite −200 sentinel', () => {
      // Vb = 0 in the circuit: exc/zmag go NaN while spl stays at the finite sentinel, so
      // testing the headline series alone would call total garbage a mere warn.
      const sw = engine.simulation.sweep(validDriver(), undefined, 'sealed', { ...P_SEALED, Vb: 0 }).values!;
      const issue = engine.simulation.classifyFinite(sw);
      assert.ok(issue, 'a fully broken sweep must be reported');
      assert.equal(issue.level, 'error', 'nothing usable came out, so no chart should be drawn');
    });

    it('the Max-SPL / Max-power pair going to +Infinity (no Pe, no Xmax) is NOT flagged by '
     + 'classifyMaxFinite — QO143 (2026-09-15): unbounded is a correct answer, not a breakdown; '
     + 'the engine\'s own driverPrerequisites advisory covers this case instead (sweep.test.ts)', () => {
      // A driver with neither Pe nor Xmax has no limit to apply, so maxCurves is +Infinity
      // everywhere — while the sweep it derives from is entirely finite. This used to be
      // classified as an unusable-chart error; QO143 reversed that: +Infinity here means
      // "nothing limits it yet", a real answer, so classifyMaxFinite must stay quiet and let
      // `maxCurves()`'s own `driverPrerequisites` name what would bound it instead.
      const noLimits = solveConsistencyGroup({ Fs_hz: 37, Qts: 0.38, Qes: 0.40, Qms: 7.0, Vas_m3: 0.030, Sd_m2: 0.0133, Re_ohm: 5.6 });
      assert.ok(noLimits, 'a driver without Pe/Xmax is valid — those are advisories, not errors');
      const sw = engine.simulation.sweep(sweepDriver(noLimits), LE_H, 'sealed', P_SEALED).values!;
      const mx = engine.simulation.maxCurves(sweepDriver(noLimits), LE_H, 'sealed', P_SEALED).values!;

      assert.equal(engine.simulation.classifyFinite(sw), null, 'the sweep itself is fine — this is why a second check is needed');
      assert.ok(mx.maxspl.every(v => v === Infinity), 'precondition of this test: maxspl is genuinely unbounded, not NaN');

      assert.equal(engine.simulation.classifyMaxFinite(mx), null,
        'a genuinely unbounded (not broken) curve must not be classified as a postcondition failure');
    });

    it('classifyMaxFinite still reports a genuine NaN breakdown as an error — only +Infinity is exempt', () => {
      const mx = engine.simulation.maxCurves(validDriver(), undefined, 'sealed', P_SEALED).values!;
      for (let i = 0; i < mx.maxspl.length; i++) { mx.maxspl[i] = NaN; mx.maxpwr[i] = NaN; }
      const issue = engine.simulation.classifyMaxFinite(mx);
      assert.ok(issue, 'NaN everywhere is still a genuine breakdown, unlike a deliberate +Infinity');
      assert.equal(issue.level, 'error');
    });

    it('max curves of a driver with both limits are clean', () => {
      assert.equal(engine.simulation.classifyMaxFinite(engine.simulation.maxCurves(validDriver(), undefined, 'sealed', P_SEALED).values!), null,
        'Pe and Xmax both present bounds the curve; reporting an issue here would be a false positive');
    });

    it('an isolated non-finite max-curve point is a warn naming the frequency, same rule as the sweep', () => {
      const mx = engine.simulation.maxCurves(validDriver(), undefined, 'sealed', P_SEALED).values!;
      mx.maxpwr[12] = NaN;
      const issue = engine.simulation.classifyMaxFinite(mx);
      assert.ok(issue && issue.level === 'warn', 'one bad point is a gap, not an unusable chart');
      assert.match(issue.message, /Hz/, 'the message must name the affected frequency');
    });

    it('classification never throws, whatever it is handed — failure travels as a value', () => {
      const sw = engine.simulation.sweep(validDriver(), undefined, 'sealed', P_SEALED).values!;
      for (let i = 0; i < sw.spl.length; i++) sw.spl[i] = NaN;
      assert.doesNotThrow(() => engine.simulation.classifyFinite(sw), 'the engine communicates by Result, never by exception');
      assert.doesNotThrow(() => engine.simulation.classifyMaxFinite(engine.simulation.maxCurves(validDriver(), undefined, 'sealed', P_SEALED).values!));
      assert.doesNotThrow(() => engine.simulation.solveBoxParams('box-passive-radiator', {}));
    });
  });

  // ── Criterion 5 (S4/T6) ──────────────────────────────────────────────────────
  describe('T1\'s domain guard fires before classifyFinite ever sees the sweep', () => {
    // (a) DOMAIN-level. `values: null`, `issue.target === 'length_m'` and the routes shape are
    // already pinned at packages/design/test/domain.test.ts:1568 ("a vented project with no
    // tuning_goal_hz and no length_m reports a blocking VentIssue, not NaN curves") — not duplicated
    // here. What that test does NOT check, and this adds: the MESSAGE a user actually sees is the
    // guard's own sentence (`engine.issueToText`), never classifyFinite's generic postcondition
    // text — which cannot even have run, since `values` is null before any array exists to
    // classify (`curveIssues` in packages/ui/src/logic/appState.ts short-circuits on `!sw`).
    const scraped = <T,>(value: T) => ({ value });
    const spec = (read_value: number) => ({ state: 'E' as const, value: read_value, origin: 'scraped', readings: { scraped: { read_value } } });
    function driverJson() {
      const meta = {
        brand: scraped('Dayton'), model: scraped('RS225'), manufacturer: scraped('Dayton'),
        provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
        uuid: { value: '00000000-0000-4000-8000-000000000000' },
        sku: { value: 'TEST-SKU', grounds: [{ origin: 'manufacturer_datasheet', reading: 'TEST-SKU' }] },
        driver_type: scraped('woofer'),
        data_sources: { value: { manufacturer_datasheet: 'https://example.invalid/ds.pdf' } },
        quality: {
          confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
          parse_errors: [], cross_source_only: [],
        },
      };
      return {
        ...meta,
        specs: {
          woofer: {
            Fs_hz: spec(30), Qts: spec(0.4), Sd_m2: spec(0.02), Cms_m_per_N: spec(0.0005),
            Mms_kg: spec(0.05), Rms_kg_per_s: spec(2), Xmax_m: spec(0.008),
          },
        },
      };
    }

    it('the message the user sees is the guard\'s own sentence, not classifyFinite\'s generic text', () => {
      const drv = OpenISDDriver.fromConformingRecord(driverJson(), engine);
      if (Array.isArray(drv)) throw new Error(`fixture driver is invalid: ${drv.join(', ')}`);
      const p = new ProjectBuilder(drv, engine).vented().volume_m3(0.03).tuning_goal_hz(40).build();
      p.box.vented.vent.shape.set('round');
      p.box.vented.vent.diameter_m.set(0.05);
      // The builder requires an initial tuning_goal_hz to construct at all — cleared right back off so
      // NEITHER tuning_goal_hz nor vent.length_m is stated, same as domain.test.ts:1568's fixture.
      p.box.vented.tuning_goal_hz.clear();

      const result = p.sweep({ fmin: 10, fmax: 100, N: 10 });
      assert.equal(result.values, null, 'precondition: nothing to classify — the guard must have blocked it');
      const issue = result.issues[0];
      assert.ok(issue, 'expected the vent guard\'s own issue');
      // `missing-dependencies` is the guard's own diagnosis of an unstated target — not
      // `classifyFinite`'s generic postcondition, which never ran here.
      assert.equal(issue.kind, 'missing-dependencies', 'expected the guard\'s own unreachable-target diagnosis');
      if (issue.kind !== 'missing-dependencies') throw new Error('unreachable');
      const named: readonly string[] = issue.fields;
      assert.ok(named.includes('length_m'), `the issue must name length_m; got: ${named.join(', ')}`);
    });

    // (b) ENGINE-level net. The domain guard above only exists in `OpenISDProject.sweep()` — the
    // bare engine has no such guard, so calling `engine.simulation.sweep()` directly with `Leff` undefined
    // (P_SEALED carries none) must still reach `classifyFinite` and be classified there, proving
    // the engine keeps its OWN net regardless of whether a domain guard runs in front of it.
    it('the engine\'s own net still classifies a vented sweep given directly with Leff undefined', () => {
      const sw = engine.simulation.sweep(validDriver(), undefined, 'vented', P_SEALED).values!;
      assert.equal(P_SEALED.Leff, undefined, 'precondition: this call bypasses the domain guard entirely');
      const issue = engine.simulation.classifyFinite(sw);
      assert.ok(issue, 'an undefined Leff must poison the vent-dependent arrays, and the engine\'s own postcondition must catch it');
    });
  });

});
