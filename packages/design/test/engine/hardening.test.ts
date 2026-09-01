/**
 * Engine hardening — acceptance tests for CODE_REVIEW/ENGINE_HARDENING.md.
 *
 * The contract under test: the engine communicates failure through the `Result`/issue
 * channel (`{ level, field, message }`), never by throwing and never by handing a chart a
 * non-finite number in silence. Two layers:
 *
 *   precondition  — `deriveEngineDriver` (driver params) and `validateParams` (box params) reject
 *                   input that would be undefined at EVERY frequency, naming the field.
 *   postcondition — `classifyFinite` / `classifyMaxFinite` classify what actually came out,
 *                   because a frequency-dependent singularity cannot be foreseen from the
 *                   inputs alone.
 *
 * Scenario names below are the acceptance criteria, one `describe` per criterion.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { Engine } from '../../engine/index.js';
import type { SolverQuantities } from '../../engine/index.js';
import type { SimulatableBoxType, SweepParams } from '../../engine/index.js';

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



const validDriver = () => engine.solveConsistencyGroup({
  Fs_hz: RAW_COMPLETE.Fs, Qts: RAW_COMPLETE.Qts, Qes: RAW_COMPLETE.Qes, Qms: RAW_COMPLETE.Qms,
  Vas_m3: RAW_COMPLETE.Vas, Sd_m2: RAW_COMPLETE.Sd, Re_ohm: RAW_COMPLETE.Re,
  Xmax_m: RAW_COMPLETE.Xmax, Pe_W: RAW_COMPLETE.Pe, Znom_ohm: RAW_COMPLETE.Znom,
});

const errorFields = (issues: { level: string; field: string }[]): string[] =>
  issues.filter(e => e.level === 'error').map(e => e.field);

// ── Criterion 1 ──────────────────────────────────────────────────────────────
describe('a driver with Vas and Qts but no Qms gets a message naming what is missing, not a blank graph', () => {
  // One Q is not enough to resolve the T/S group, so `Cms`/`Mms`/`Rms`/`BL` never derive and the
  // circuit has nothing to run on. The REFUSAL now lives in `sweep`, not in a separate derive
  // step: it checks the six the circuit reads unguarded, and reports what a user could state.
  const VAS_AND_QTS_ONLY: SolverQuantities = { Fs_hz: 37, Qts: 0.38, Vas_m3: 0.030, Sd_m2: 0.0133, Re_ohm: 5.6 };
  const refused = () => engine.sweep(
    engine.solveConsistencyGroup(VAS_AND_QTS_ONLY), undefined, 'sealed', P_SEALED);

  it('is refused before any arithmetic, so nothing non-finite is ever produced', () => {
    assert.equal(refused().value, null, 'one Q cannot solve the group; the sweep must refuse');
  });

  it('the refusal is actionable — it names fields the user could state, not the ones it derived', () => {
    const [issue] = refused().errors;
    assert.ok(issue, 'a refused sweep must carry at least one issue');
    assert.equal(issue.level, 'error');
    // The old message named `Cms`/`Mms`/`Rms`/`BL` — quantities no datasheet prints, so a reader
    // was told to enter numbers they do not have. It now offers what WOULD unblock it.
    assert.match(issue.message, /State any ONE of|more than one parameter is missing/);
    assert.doesNotMatch(issue.message, /^Cms_m_per_N is needed/);
  });

  it('a complete driver is NOT refused — the guard is about what is missing, not about being strict', () => {
    assert.ok(engine.sweep(validDriver(), 0.7e-3, 'sealed', P_SEALED).value,
      'the reference driver states enough to simulate');
  });
});

// ── Criterion 2 ──────────────────────────────────────────────────────────────
describe('a zero box volume is a named error, not Infinity-poisoned curves', () => {
  it('Vb = 0 is rejected by the box-parameter precondition, naming Vb', () => {
    const issues = engine.validateParams('sealed', { ...P_SEALED, Vb: 0 });
    assert.equal(issues.length, 1, 'exactly the one broken field should be reported');
    assert.equal(issues[0].level, 'error', 'a zero-volume box is unsimulatable, so this blocks');
    assert.equal(issues[0].field, 'Vb', 'the issue must name the field the user has to change');
    assert.match(issues[0].message, /Box volume \(Vb\)/, 'the message must use the UI label for the field');
  });

  it('the message explains the consequence, so the user is not told merely that a number is wrong', () => {
    const [issue] = engine.validateParams('sealed', { ...P_SEALED, Vb: 0 });
    assert.match(issue.message, /compliance/i, 'the message must say what breaks in the model');
  });

  it('Vb absent and Vb negative are rejected the same as zero', () => {
    for (const Vb of [undefined as unknown as number, -0.01, NaN, Infinity])
      assert.ok(errorFields(engine.validateParams('sealed', { ...P_SEALED, Vb })).includes('Vb'),
        `Vb = ${Vb} must be rejected — only a finite positive volume is simulatable`);
  });

  it('a healthy design of every SIMULATABLE box type raises no parameter issue at all', () => {
    // Total over `SimulatableBoxType`, so giving the circuit a new topology fails to compile
    // here until this table names it.
    const healthy: Record<SimulatableBoxType, SweepParams> = {
      sealed: P_SEALED, vented: P_VENTED, 'box-passive-radiator': P_PR, bandpass4: P_BP4,
    };
    for (const box of Object.keys(healthy) as SimulatableBoxType[])
      assert.deepEqual(engine.validateParams(box, healthy[box]), [],
        `${box}: a valid design must produce no parameter issue (a false positive would block a good design)`);
  });

  it('a box type the circuit has no model for is refused BY NAME, not silently mis-simulated', () => {
    // `BoxType` names six enclosures and the circuit models four. The other two must come back
    // as a stated refusal naming the enclosure — never fall through to another topology's
    // maths, which would produce a plausible-looking curve for a box that was never simulated.
    for (const box of ['bandpass6', 'abc'] as const) {
      const issues = engine.validateParams(box, P_SEALED);
      assert.equal(issues.length, 1, `${box}: expected exactly one refusal`);
      assert.equal(issues[0].level, 'error', `${box}: a topology with no model is a blocking error`);
      assert.ok(issues[0].message.includes(box),
        `${box}: the refusal must name the enclosure it declined — got "${issues[0].message}"`);
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
    assert.deepEqual(errorFields(engine.validateParams('vented', { ...P_VENTED, Sp: 0 })), ['Sp'],
      'the port mass Map = ρ·Leff/Sp is infinite at Sp = 0');
  });

  it('a 4th-order bandpass with no front chamber is rejected, naming Vf', () => {
    assert.deepEqual(errorFields(engine.validateParams('bandpass4', { ...P_BP4, Vf: 0 })), ['Vf'],
      'a bandpass needs both chambers; the front compliance is Vf/(ρc²)');
  });

  it('a passive-radiator box with no PR parameters reports every missing one, not just the first', () => {
    assert.deepEqual(errorFields(engine.validateParams('box-passive-radiator', P_SEALED)), ['prSd', 'prCms', 'prMmd'],
      'the user should see the whole list, not fix one field and be told about the next');
  });

  it('the sealed box does not demand vent or PR parameters it never uses', () => {
    assert.deepEqual(engine.validateParams('sealed', P_SEALED), [],
      'requiring an unused field would block a perfectly valid sealed design');
  });

  it('every parameter issue carries a level, a field and a non-empty human-readable message', () => {
    for (const issue of engine.validateParams('box-passive-radiator', { ...P_SEALED, Vb: 0 })) {
      assert.ok(issue.level === 'error' || issue.level === 'warn', 'level must be a declared IssueLevel');
      assert.ok(issue.field.length > 0, 'field must identify an input');
      assert.ok(issue.message.trim().length > 10, 'message must be readable prose, not a code');
    }
  });
});

// ── Criterion 3 ──────────────────────────────────────────────────────────────
describe('an isolated mid-sweep singularity keeps the curve and explains the gap', () => {
  const singularSweep = () => {
    const sw = engine.sweep(validDriver(), undefined, 'sealed', P_SEALED).value!;
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
    const sw = engine.sweep(validDriver(), undefined, 'sealed', { ...P_SEALED, eg: 0 }).value!;
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
    assert.equal(engine.classifyFinite(engine.sweep(validDriver(), undefined, 'sealed', P_SEALED).value!), null);
  });

  it('poisoning any single plotted sweep series is detected', () => {
    for (const key of PLOTTED_SWEEP_SERIES) {
      const sw = engine.sweep(validDriver(), undefined, 'sealed', P_SEALED).value!;
      sw[key][5] = NaN;
      assert.ok(engine.classifyFinite(sw), `a NaN in sweep.${key} reaches a chart and must be reported`);
    }
  });

  it('an Infinity is caught as well as a NaN — both break an axis the same way', () => {
    const sw = engine.sweep(validDriver(), undefined, 'sealed', P_SEALED).value!;
    sw.zmag[7] = Infinity;
    assert.ok(engine.classifyFinite(sw), 'Number.isFinite must be the test, not Number.isNaN');
  });

  it('a breakdown at every frequency is an error even where spl holds the finite −200 sentinel', () => {
    // Vb = 0 in the circuit: exc/zmag go NaN while spl stays at the finite sentinel, so
    // testing the headline series alone would call total garbage a mere warn.
    const sw = engine.sweep(validDriver(), undefined, 'sealed', { ...P_SEALED, Vb: 0 }).value!;
    const issue = engine.classifyFinite(sw);
    assert.ok(issue, 'a fully broken sweep must be reported');
    assert.equal(issue.level, 'error', 'nothing usable came out, so no chart should be drawn');
  });

  it('the Max-SPL / Max-power pair is classified too, not only the sweep', () => {
    // A driver with neither Pe nor Xmax has no limit to apply, so maxCurves is Infinity
    // everywhere — while the sweep it derives from is entirely finite. classifyFinite
    // cannot see this; it is a separate output with its own postcondition.
    const noLimits = engine.solveConsistencyGroup({ Fs_hz: 37, Qts: 0.38, Qes: 0.40, Qms: 7.0, Vas_m3: 0.030, Sd_m2: 0.0133, Re_ohm: 5.6 });
    assert.ok(noLimits, 'a driver without Pe/Xmax is valid — those are warns, not errors');
    const sw = engine.sweep(noLimits, LE_H, 'sealed', P_SEALED).value!;
    const mx = engine.maxCurves(noLimits, LE_H, 'sealed', P_SEALED).value!;

    assert.equal(engine.classifyFinite(sw), null, 'the sweep itself is fine — this is why a second check is needed');
    assert.ok(mx.maxspl.every(v => !Number.isFinite(v)), 'precondition of this test: maxspl is unbounded');

    const issue = engine.classifyMaxFinite(mx);
    assert.ok(issue, 'unbounded max curves must not reach a chart silently');
    assert.equal(issue.level, 'error', 'no finite point at any frequency means nothing to draw');
    assert.match(issue.message, /Pe|Xmax/, 'the message must name the parameters that would bound the curve');
  });

  it('max curves of a driver with both limits are clean', () => {
    assert.equal(engine.classifyMaxFinite(engine.maxCurves(validDriver(), undefined, 'sealed', P_SEALED).value!), null,
      'Pe and Xmax both present bounds the curve; reporting an issue here would be a false positive');
  });

  it('an isolated non-finite max-curve point is a warn naming the frequency, same rule as the sweep', () => {
    const mx = engine.maxCurves(validDriver(), undefined, 'sealed', P_SEALED).value!;
    mx.maxpwr[12] = NaN;
    const issue = engine.classifyMaxFinite(mx);
    assert.ok(issue && issue.level === 'warn', 'one bad point is a gap, not an unusable chart');
    assert.match(issue.message, /Hz/, 'the message must name the affected frequency');
  });

  it('classification never throws, whatever it is handed — failure travels as a value', () => {
    const sw = engine.sweep(validDriver(), undefined, 'sealed', P_SEALED).value!;
    for (let i = 0; i < sw.spl.length; i++) sw.spl[i] = NaN;
    assert.doesNotThrow(() => engine.classifyFinite(sw), 'the engine communicates by Result, never by exception');
    assert.doesNotThrow(() => engine.classifyMaxFinite(engine.maxCurves(validDriver(), undefined, 'sealed', P_SEALED).value!));
    assert.doesNotThrow(() => engine.validateParams('box-passive-radiator', {} as SweepParams));
  });
});
