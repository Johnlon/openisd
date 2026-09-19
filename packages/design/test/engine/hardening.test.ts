import type {TestSolverQuantities} from './testSolver.js';
import {driverParams, solveConsistencyGroup} from './testSolver.js';
/**
 * Engine hardening — acceptance tests for CODE_REVIEW/ENGINE_HARDENING.md.
 *
 * The contract under test: the engine communicates failure through the `Result`/issue
 * channel (`{ level, field, message }`), never by throwing and never by handing a chart a
 * non-finite number in silence. Two layers:
 *
 *   precondition  — `deriveEngineDriver` (driver params) and `solveBoxParams` (box params) reject
 *                   input that would be undefined at EVERY frequency, naming the field.
 *   postcondition — `classifyFinite` / `classifyMaxFinite` classify what actually came out,
 *                   because a frequency-dependent singularity cannot be foreseen from the
 *                   inputs alone.
 *
 * Scenario names below are the acceptance criteria, one `describe` per criterion.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import type {SimulatableBoxType, SweepParams} from '../../engine/index.js';
import {Engine} from '../../engine/index.js';
import {OpenISDDriver, OpenISDProject} from '../../domain/openisdDomain.js';

/** Voice-coil inductance for the fixtures below. Not a solver quantity — nothing
 *  derives it — so it reaches `sweep` on its own, and only the impedance plot reads it. */
const LE_H = 0.7e-3;

/** The engine's one door: every calculation below is a method on this object. */
const engine = new Engine();

/** The reference 6.5" mid-woofer used across the engine suite — complete and valid. */
const RAW_COMPLETE = {
  Fs: 37, Qts: 0.38, Qes: 0.40, Qms: 7.0,
  Vas: 0.030, Sd: 0.0133, Re: 5.6, Le: 0.7e-3, Xmax: 0.005, Pe: 60, Znom: 8,
};

const P_SEALED: SweepParams = { Vb: 0.030, eg: 2.83, Ql: 10, fmin: 10, fmax: 1000, N: 50 };
/** Sp/Leff are what the store's `syncedP` computes from a 50 mm × 100 mm vent. */
const P_VENTED: SweepParams = { ...P_SEALED, Sp: Math.PI * 0.025 ** 2, Leff: 0.1366 };
const P_PR: SweepParams = { ...P_SEALED, prSd: 0.0133, prNum: 1, prMmd: 0.030, prMadd: 0, prCms: 0.0008, prRms: 1.0 };
const P_BP4: SweepParams = { ...P_VENTED, Vf: 0.020 };



const validDriver = () => driverParams(solveConsistencyGroup({
  Fs_hz: RAW_COMPLETE.Fs, Qts: RAW_COMPLETE.Qts, Qes: RAW_COMPLETE.Qes, Qms: RAW_COMPLETE.Qms,
  Vas_m3: RAW_COMPLETE.Vas, Sd_m2: RAW_COMPLETE.Sd, Re_ohm: RAW_COMPLETE.Re,
  Xmax_m: RAW_COMPLETE.Xmax, Pe_W: RAW_COMPLETE.Pe, Znom_ohm: RAW_COMPLETE.Znom,
}));

const targets = (issues: readonly { target: string }[]): string[] => issues.map(i => i.target);

// ── Criterion 1 ──────────────────────────────────────────────────────────────
describe('a driver with Vas and Qts but no Qms gets a message naming what is missing, not a blank graph', () => {
  // One Q is not enough to resolve the T/S group, so `Cms`/`Mms`/`Rms`/`BL` never derive and the
  // circuit has nothing to run on. The REFUSAL now lives in `sweep`, not in a separate derive
  // step: it checks the six the circuit reads unguarded, and reports what a user could state.
  const VAS_AND_QTS_ONLY: TestSolverQuantities = { Fs_hz: 37, Qts: 0.38, Vas_m3: 0.030, Sd_m2: 0.0133, Re_ohm: 5.6 };
  const refused = () => engine.sweep(
    driverParams(solveConsistencyGroup(VAS_AND_QTS_ONLY)), undefined, 'sealed', P_SEALED);

  it('is refused before any arithmetic, so nothing non-finite is ever produced', () => {
    assert.equal(refused().values, null, 'one Q cannot solve the group; the sweep must refuse');
  });

  it('the refusal names exactly the circuit fields still missing, one issue per field — '
   + 'never a combined message or a cross-field substitution suggestion (QO144)', () => {
    const { issues } = refused();
    assert.ok(issues.length > 0, 'a refused sweep must carry at least one issue');
    for (const issue of issues) {
      assert.equal(issue.kind, 'missing-dependencies');
      if (issue.kind !== 'missing-dependencies') continue;
      // Exactly one route — the field itself — never a list of alternative fields.
      assert.equal(issue.routes.length, 1);
      assert.deepEqual(issue.routes[0].missing, [issue.target]);
    }
    const targets = issues.map(i => i.kind === 'missing-dependencies' ? i.target : null);
    // Vas+Fs derive Cms and Mms; nothing derives BL_terminal_Tm (no BL_Tm stated) or
    // Rms_kg_per_s (needs Qms, which VAS_AND_QTS_ONLY does not state).
    assert.ok(targets.includes('BL_terminal_Tm'), 'BL_terminal_Tm is genuinely absent and must be named');
    assert.ok(targets.includes('Rms_kg_per_s'), 'Rms_kg_per_s is genuinely absent and must be named');
  });

  it('a complete driver is NOT refused — the guard is about what is missing, not about being strict', () => {
    assert.ok(engine.sweep(validDriver(), 0.7e-3, 'sealed', P_SEALED).values,
      'the reference driver states enough to simulate');
  });
});

// ── Criterion 2 ──────────────────────────────────────────────────────────────
describe('a zero box volume is a named error, not Infinity-poisoned curves', () => {
  it('Vb = 0 is rejected by the box-parameter precondition, naming Vb, with null values', () => {
    const result = engine.solveBoxParams('sealed', { ...P_SEALED, Vb: 0 });
    assert.equal(result.values, null, 'a zero-volume box cannot be simulated');
    assert.equal(result.issues.length, 1, 'exactly the one broken field should be reported');
    assert.equal(result.issues[0].kind, 'missing-dependencies');
    assert.equal(result.issues[0].target, 'Vb', 'the issue must name the field the user has to change');
    if (result.issues[0].kind === 'missing-dependencies') {
      assert.match(result.issues[0].routes[0].formula, /Box volume \(Vb\)/, 'the route must use the UI label for the field');
    }
  });

  it('the route formula explains the consequence, so the user is not told merely that a number is wrong', () => {
    const [issue] = engine.solveBoxParams('sealed', { ...P_SEALED, Vb: 0 }).issues;
    assert.equal(issue.kind, 'missing-dependencies');
    if (issue.kind === 'missing-dependencies') {
      assert.match(issue.routes[0].formula, /compliance/i, 'the message must say what breaks in the model');
    }
  });

  it('Vb absent and Vb negative are rejected the same as zero', () => {
    for (const Vb of [undefined as unknown as number, -0.01, NaN, Infinity])
      assert.ok(targets(engine.solveBoxParams('sealed', { ...P_SEALED, Vb }).issues).includes('Vb'),
        `Vb = ${Vb} must be rejected — only a finite positive volume is simulatable`);
  });

  it('a healthy design of every SIMULATABLE box type raises no parameter issue and returns its own params as values', () => {
    // Total over `SimulatableBoxType`, so giving the circuit a new topology fails to compile
    // here until this table names it.
    const healthy: Record<SimulatableBoxType, SweepParams> = {
      sealed: P_SEALED, vented: P_VENTED, 'box-passive-radiator': P_PR, bandpass4: P_BP4,
    };
    for (const box of Object.keys(healthy) as SimulatableBoxType[]) {
      const result = engine.solveBoxParams(box, healthy[box]);
      assert.deepEqual(result.issues, [],
        `${box}: a valid design must produce no parameter issue (a false positive would block a good design)`);
      assert.equal(result.values, healthy[box], `${box}: a valid design's values must be its own params`);
    }
  });

  it('a box type the circuit has no model for reports no issue and null values — naming it is the store\'s job (S3)', () => {
    // `BoxType` names six enclosures and the circuit models four. The other two are simply
    // unsimulatable here — never falling through to another topology's maths, which would
    // produce a plausible-looking curve for a box that was never simulated — but the engine's
    // precondition layer does not itself narrate WHICH box was declined; that presentation is
    // the store's concern, not this one.
    for (const box of ['bandpass6', 'abc'] as const) {
      const result = engine.solveBoxParams(box, P_SEALED);
      assert.equal(result.values, null, `${box}: has no circuit model, so there is nothing to sweep`);
      assert.deepEqual(result.issues, [], `${box}: expected no field-level issue for an unmodelled topology`);
    }
  });

  it('every simulatable box type is genuinely simulatable — the refusal set is exactly the two', () => {
    // Non-vacuity for the test above: if `simulatableBoxType` ever started refusing a box the
    // engine really does model, that test would still pass while the app lost a feature.
    for (const box of ['sealed', 'vented', 'bandpass4', 'box-passive-radiator'] as const)
      assert.notEqual(engine.simulatableBoxType(box), null, `${box} must remain simulatable`);
    for (const box of ['bandpass6', 'abc'] as const)
      assert.equal(engine.simulatableBoxType(box), null, `${box} has no circuit model yet`);
  });

  it('a vented box with no vent area is rejected, naming Sp', () => {
    assert.deepEqual(targets(engine.solveBoxParams('vented', { ...P_VENTED, Sp: 0 }).issues), ['Sp'],
      'the port mass Map = ρ·Leff/Sp is infinite at Sp = 0');
  });

  it('a 4th-order bandpass with no front chamber is rejected, naming Vf', () => {
    assert.deepEqual(targets(engine.solveBoxParams('bandpass4', { ...P_BP4, Vf: 0 }).issues), ['Vf'],
      'a bandpass needs both chambers; the front compliance is Vf/(ρc²)');
  });

  it('a passive-radiator box with no PR parameters reports every missing one, not just the first', () => {
    assert.deepEqual(targets(engine.solveBoxParams('box-passive-radiator', P_SEALED).issues), ['prSd', 'prCms', 'prMmd'],
      'the user should see the whole list, not fix one field and be told about the next');
  });

  it('the sealed box does not demand vent or PR parameters it never uses', () => {
    const result = engine.solveBoxParams('sealed', P_SEALED);
    assert.deepEqual(result.issues, [], 'requiring an unused field would block a perfectly valid sealed design');
    assert.equal(result.values, P_SEALED);
  });

  it('every parameter issue is missing-dependencies, naming a field with a non-empty human-readable route', () => {
    for (const issue of engine.solveBoxParams('box-passive-radiator', { ...P_SEALED, Vb: 0 }).issues) {
      assert.equal(issue.kind, 'missing-dependencies', 'no enclosure parameter contradicts another');
      assert.ok(issue.target.length > 0, 'target must identify an input');
      if (issue.kind === 'missing-dependencies') {
        assert.ok(issue.routes[0].formula.trim().length > 10, 'route formula must be readable prose, not a code');
      }
    }
  });
});

// ── Criterion 3 ──────────────────────────────────────────────────────────────
describe('an isolated mid-sweep singularity keeps the curve and explains the gap', () => {
  const singularSweep = () => {
    const sw = engine.sweep(validDriver(), undefined, 'sealed', P_SEALED).values!;
    sw.spl[10] = NaN;   // one grid point landing on a pole
    return sw;
  };

  it('is classified as a warn, never as a blocking error', () => {
    const issue = engine.classifyFinite(singularSweep());
    assert.ok(issue, 'a non-finite point must never pass unreported');
    assert.equal(issue.level, 'warn', 'one bad point out of 51 is a gap, not an unusable simulation');
  });

  it('names the frequency where the curve is undefined', () => {
    const sw = singularSweep();
    const issue = engine.classifyFinite(sw);
    assert.ok(issue, 'expected an issue');
    const f = sw.fs[10];
    assert.ok(issue.message.includes(f >= 100 ? f.toFixed(0) : f.toFixed(1)),
      `the message must name ~${f} Hz so the gap is not a mystery; got: ${issue.message}`);
  });

  it('leaves every other point intact so the renderer still draws the curve with a gap', () => {
    const sw = singularSweep();
    engine.classifyFinite(sw);
    const finite = sw.spl.filter(Number.isFinite).length;
    assert.equal(finite, sw.spl.length - 1, 'classification must not blank or interpolate the data');
    assert.ok(finite > 0, 'there is drawable data, so the chart must not be suppressed');
  });

  it('does not interpolate across the gap — the undefined point stays undefined', () => {
    const sw = singularSweep();
    engine.classifyFinite(sw);
    assert.ok(!Number.isFinite(sw.spl[10]),
      'filling the hole would fabricate a value where the model has none');
  });

  it('a −200 dB silence sentinel is finite data and is never reported as a singularity', () => {
    const sw = engine.sweep(validDriver(), undefined, 'sealed', { ...P_SEALED, eg: 0 }).values!;
    assert.equal(engine.classifyFinite(sw), null, 'silence is a real answer, not a numerical failure');
  });
});

// ── Criterion 4 ──────────────────────────────────────────────────────────────
describe('no engine output reaches a chart non-finite without a surfaced issue', () => {
  /** Every `SweepResult` member the chart layer plots, by the name it is read under. */
  const PLOTTED_SWEEP_SERIES = [
    'spl', 'phase', 'exc', 'excPR', 'pv', 'zmag', 'zph', 'gd', 'fltMag', 'fltPhase', 'fltGd',
  ] as const;

  it('a clean sweep of a valid design reports nothing — the guard does not cry wolf', () => {
    assert.equal(engine.classifyFinite(engine.sweep(validDriver(), undefined, 'sealed', P_SEALED).values!), null);
  });

  it('poisoning any single plotted sweep series is detected', () => {
    for (const key of PLOTTED_SWEEP_SERIES) {
      const sw = engine.sweep(validDriver(), undefined, 'sealed', P_SEALED).values!;
      sw[key][5] = NaN;
      assert.ok(engine.classifyFinite(sw), `a NaN in sweep.${key} reaches a chart and must be reported`);
    }
  });

  it('an Infinity is caught as well as a NaN — both break an axis the same way', () => {
    const sw = engine.sweep(validDriver(), undefined, 'sealed', P_SEALED).values!;
    sw.zmag[7] = Infinity;
    assert.ok(engine.classifyFinite(sw), 'Number.isFinite must be the test, not Number.isNaN');
  });

  it('a breakdown at every frequency is an error even where spl holds the finite −200 sentinel', () => {
    // Vb = 0 in the circuit: exc/zmag go NaN while spl stays at the finite sentinel, so
    // testing the headline series alone would call total garbage a mere warn.
    const sw = engine.sweep(validDriver(), undefined, 'sealed', { ...P_SEALED, Vb: 0 }).values!;
    const issue = engine.classifyFinite(sw);
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
    const sw = engine.sweep(driverParams(noLimits), LE_H, 'sealed', P_SEALED).values!;
    const mx = engine.maxCurves(driverParams(noLimits), LE_H, 'sealed', P_SEALED).values!;

    assert.equal(engine.classifyFinite(sw), null, 'the sweep itself is fine — this is why a second check is needed');
    assert.ok(mx.maxspl.every(v => v === Infinity), 'precondition of this test: maxspl is genuinely unbounded, not NaN');

    assert.equal(engine.classifyMaxFinite(mx), null,
      'a genuinely unbounded (not broken) curve must not be classified as a postcondition failure');
  });

  it('classifyMaxFinite still reports a genuine NaN breakdown as an error — only +Infinity is exempt', () => {
    const mx = engine.maxCurves(validDriver(), undefined, 'sealed', P_SEALED).values!;
    for (let i = 0; i < mx.maxspl.length; i++) { mx.maxspl[i] = NaN; mx.maxpwr[i] = NaN; }
    const issue = engine.classifyMaxFinite(mx);
    assert.ok(issue, 'NaN everywhere is still a genuine breakdown, unlike a deliberate +Infinity');
    assert.equal(issue.level, 'error');
  });

  it('max curves of a driver with both limits are clean', () => {
    assert.equal(engine.classifyMaxFinite(engine.maxCurves(validDriver(), undefined, 'sealed', P_SEALED).values!), null,
      'Pe and Xmax both present bounds the curve; reporting an issue here would be a false positive');
  });

  it('an isolated non-finite max-curve point is a warn naming the frequency, same rule as the sweep', () => {
    const mx = engine.maxCurves(validDriver(), undefined, 'sealed', P_SEALED).values!;
    mx.maxpwr[12] = NaN;
    const issue = engine.classifyMaxFinite(mx);
    assert.ok(issue && issue.level === 'warn', 'one bad point is a gap, not an unusable chart');
    assert.match(issue.message, /Hz/, 'the message must name the affected frequency');
  });

  it('classification never throws, whatever it is handed — failure travels as a value', () => {
    const sw = engine.sweep(validDriver(), undefined, 'sealed', P_SEALED).values!;
    for (let i = 0; i < sw.spl.length; i++) sw.spl[i] = NaN;
    assert.doesNotThrow(() => engine.classifyFinite(sw), 'the engine communicates by Result, never by exception');
    assert.doesNotThrow(() => engine.classifyMaxFinite(engine.maxCurves(validDriver(), undefined, 'sealed', P_SEALED).values!));
    assert.doesNotThrow(() => engine.solveBoxParams('box-passive-radiator', {} as SweepParams));
  });
});

// ── Criterion 5 (S4/T6) ──────────────────────────────────────────────────────
describe('T1\'s domain guard fires before classifyFinite ever sees the sweep', () => {
  // (a) DOMAIN-level. `values: null`, `issue.target === 'length_m'` and the routes shape are
  // already pinned at packages/design/test/domain.test.ts:1568 ("a vented project with no
  // tuning_hz and no length_m reports a blocking VentIssue, not NaN curves") — not duplicated
  // here. What that test does NOT check, and this adds: the MESSAGE a user actually sees is the
  // guard's own sentence (`engine.issueToText`), never classifyFinite's generic postcondition
  // text — which cannot even have run, since `values` is null before any array exists to
  // classify (`curveIssues` in packages/ui/src/logic/appState.ts short-circuits on `!sw`).
  const scraped = <T,>(value: T) => ({ value });
  const spec = (read_value: number) => ({ origin: 'scraped', readings: { scraped: { read_value } } });
  function driverJson() {
    const meta = {
      brand: scraped('Dayton'), model: scraped('RS225'), manufacturer: scraped('Dayton'),
      provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
      uuid: { value: '00000000-0000-4000-8000-000000000000' },
      sku: { value: 'TEST-SKU', grounds: [{ origin: 'manufacturer_datasheet', reading: 'TEST-SKU' }] },
      driver_type: scraped('woofer'),
      data_sources: { value: { manufacturer_datasheet: 'https://example.invalid/ds.pdf' } },
      authoritative: { value: 'manufacturer_datasheet' },
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
    const p = OpenISDProject.builder(drv, engine).vented().volume_m3(0.03).tuning_hz(40).build();
    p.box.vented.vent.shape.set('round');
    p.box.vented.vent.diameter_m.set(0.05);
    // The builder requires an initial tuning_hz to construct at all — cleared right back off so
    // NEITHER tuning_hz nor vent.length_m is stated, same as domain.test.ts:1568's fixture.
    p.box.vented.tuning_hz.clear();

    const result = p.sweep({ fmin: 10, fmax: 100, N: 10 });
    assert.equal(result.values, null, 'precondition: nothing to classify — the guard must have blocked it');
    const issue = result.issues[0];
    assert.ok(issue, 'expected the vent guard\'s own issue');
    assert.ok(engine.issueFields(issue).includes('length_m'),
      `issueFields must name length_m; got: ${engine.issueFields(issue).join(', ')}`);

    const message = engine.issueToText(issue);
    assert.match(message, /cannot be calculated yet/, 'the guard\'s own sentence names the unstated target');
    assert.doesNotMatch(message, /no finite values|no usable/i,
      'this must not be classifyFinite\'s generic postcondition text — that check never ran');
  });

  // (b) ENGINE-level net. The domain guard above only exists in `OpenISDProject.sweep()` — the
  // bare engine has no such guard, so calling `engine.sweep()` directly with `Leff` undefined
  // (P_SEALED carries none) must still reach `classifyFinite` and be classified there, proving
  // the engine keeps its OWN net regardless of whether a domain guard runs in front of it.
  it('the engine\'s own net still classifies a vented sweep given directly with Leff undefined', () => {
    const sw = engine.sweep(validDriver(), undefined, 'vented', P_SEALED).values!;
    assert.equal(P_SEALED.Leff, undefined, 'precondition: this call bypasses the domain guard entirely');
    const issue = engine.classifyFinite(sw);
    assert.ok(issue, 'an undefined Leff must poison the vent-dependent arrays, and the engine\'s own postcondition must catch it');
  });
});
