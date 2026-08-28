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
import type { SimulatableBoxType, SweepParams } from '../../engine/index.js';

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

const validDriver = () => {
  const { value, errors } = engine.deriveEngineDriver(RAW_COMPLETE);
  if (!value) throw new Error('fixture driver must be valid: ' + errors.map(e => e.message).join('; '));
  return value;
};

const errorFields = (issues: { level: string; field: string }[]): string[] =>
  issues.filter(e => e.level === 'error').map(e => e.field);

// ── Criterion 1 ──────────────────────────────────────────────────────────────
describe('a driver with Vas and Qts but no Qms gets a message naming what is missing, not a blank graph', () => {
  const VAS_AND_QTS_ONLY = { Fs: 37, Qts: 0.38, Vas: 0.030, Sd: 0.0133, Re: 5.6 };

  it('is rejected before any arithmetic — value is null, so nothing non-finite is ever produced', () => {
    const { value } = engine.deriveEngineDriver(VAS_AND_QTS_ONLY);
    assert.equal(value, null, 'one Q is not enough to solve the T/S group; the driver must not derive');
  });

  it('the blocking error names the Q parameters and says how many are needed', () => {
    const { errors } = engine.deriveEngineDriver(VAS_AND_QTS_ONLY);
    const blocking = errors.filter(e => e.level === 'error');
    assert.ok(blocking.length > 0, 'a rejected driver must carry at least one error-level issue');
    const q = blocking.find(e => e.field === 'Qts');
    assert.ok(q, `expected an error on the Qts field; got fields ${errorFields(errors).join(', ')}`);
    assert.match(q.message, /two Q parameters/i, 'the message must state the actual requirement');
  });

  it('adding the second Q makes the same driver derive — the guard rejects the gap, not the driver', () => {
    const { value } = engine.deriveEngineDriver({ ...VAS_AND_QTS_ONLY, Qms: 7.0 });
    assert.ok(value, 'Qts + Qms is two of three: the driver must now derive');
    assert.ok(Number.isFinite(value.Qes) && value.Qes > 0, 'Qes must be derived as a finite positive number');
  });

  it('Qms equal to Qts is rejected instead of deriving Qes = Infinity', () => {
    // Qes = Qts·Qms/(Qms−Qts): equal values divide by zero. Infinity here would go on to
    // make Bl = √(2π·Fs·Mms·Re/Qes) = 0 and a flat −200 dB sweep with no error at all.
    const { value, errors } = engine.deriveEngineDriver({ ...VAS_AND_QTS_ONLY, Qms: 0.38 });
    assert.equal(value, null, 'Qms == Qts must block');
    assert.ok(errorFields(errors).includes('Qms'), 'the error must name Qms');
  });

  it('Qms below Qts is rejected — the derived Qes would be negative, not merely large', () => {
    const { value, errors } = engine.deriveEngineDriver({ ...VAS_AND_QTS_ONLY, Qms: 0.2 });
    assert.equal(value, null, 'Qms < Qts must block');
    assert.ok(errorFields(errors).includes('Qms'), 'the error must name Qms');
  });

  it('an inconsistent Q pair is rejected even when the third Q is also supplied', () => {
    // With all three present nothing divides, so the old guard let this through — but the
    // trio is still inconsistent: Qts is the PARALLEL combination, so Qts < min(Qes, Qms).
    const { value, errors } = engine.deriveEngineDriver({ ...RAW_COMPLETE, Qts: 0.5, Qes: 0.4, Qms: 0.5 });
    assert.equal(value, null, 'Qms == Qts must block whether or not Qes is present');
    assert.ok(errorFields(errors).includes('Qms'), 'the error must name Qms');
  });

  it('a Q of Infinity is not accepted as a present Q parameter', () => {
    // `Infinity > 0` is true, so a bare positivity test counts it as supplied. It then
    // derives Bl = 0 and a silent flat curve — the exact failure the guard exists to stop.
    const { value, errors } = engine.deriveEngineDriver({ ...VAS_AND_QTS_ONLY, Qes: Infinity });
    assert.equal(value, null, 'Qes = Infinity must not satisfy the two-of-three requirement');
    assert.ok(errorFields(errors).includes('Qts'), 'the completeness error must still be raised');
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
    const sw = engine.sweep(validDriver(), 'sealed', P_SEALED);
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
    const sw = engine.sweep(validDriver(), 'sealed', { ...P_SEALED, eg: 0 });
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
    assert.equal(engine.classifyFinite(engine.sweep(validDriver(), 'sealed', P_SEALED)), null);
  });

  it('poisoning any single plotted sweep series is detected', () => {
    for (const key of PLOTTED_SWEEP_SERIES) {
      const sw = engine.sweep(validDriver(), 'sealed', P_SEALED);
      sw[key][5] = NaN;
      assert.ok(engine.classifyFinite(sw), `a NaN in sweep.${key} reaches a chart and must be reported`);
    }
  });

  it('an Infinity is caught as well as a NaN — both break an axis the same way', () => {
    const sw = engine.sweep(validDriver(), 'sealed', P_SEALED);
    sw.zmag[7] = Infinity;
    assert.ok(engine.classifyFinite(sw), 'Number.isFinite must be the test, not Number.isNaN');
  });

  it('a breakdown at every frequency is an error even where spl holds the finite −200 sentinel', () => {
    // Vb = 0 in the circuit: exc/zmag go NaN while spl stays at the finite sentinel, so
    // testing the headline series alone would call total garbage a mere warn.
    const sw = engine.sweep(validDriver(), 'sealed', { ...P_SEALED, Vb: 0 });
    const issue = engine.classifyFinite(sw);
    assert.ok(issue, 'a fully broken sweep must be reported');
    assert.equal(issue.level, 'error', 'nothing usable came out, so no chart should be drawn');
  });

  it('the Max-SPL / Max-power pair is classified too, not only the sweep', () => {
    // A driver with neither Pe nor Xmax has no limit to apply, so maxCurves is Infinity
    // everywhere — while the sweep it derives from is entirely finite. classifyFinite
    // cannot see this; it is a separate output with its own postcondition.
    const { value: noLimits } = engine.deriveEngineDriver({ Fs: 37, Qts: 0.38, Qes: 0.40, Qms: 7.0, Vas: 0.030, Sd: 0.0133, Re: 5.6 });
    assert.ok(noLimits, 'a driver without Pe/Xmax is valid — those are warns, not errors');
    const sw = engine.sweep(noLimits, 'sealed', P_SEALED);
    const mx = engine.maxCurves(noLimits, 'sealed', P_SEALED);

    assert.equal(engine.classifyFinite(sw), null, 'the sweep itself is fine — this is why a second check is needed');
    assert.ok(mx.maxspl.every(v => !Number.isFinite(v)), 'precondition of this test: maxspl is unbounded');

    const issue = engine.classifyMaxFinite(mx);
    assert.ok(issue, 'unbounded max curves must not reach a chart silently');
    assert.equal(issue.level, 'error', 'no finite point at any frequency means nothing to draw');
    assert.match(issue.message, /Pe|Xmax/, 'the message must name the parameters that would bound the curve');
  });

  it('max curves of a driver with both limits are clean', () => {
    assert.equal(engine.classifyMaxFinite(engine.maxCurves(validDriver(), 'sealed', P_SEALED)), null,
      'Pe and Xmax both present bounds the curve; reporting an issue here would be a false positive');
  });

  it('an isolated non-finite max-curve point is a warn naming the frequency, same rule as the sweep', () => {
    const mx = engine.maxCurves(validDriver(), 'sealed', P_SEALED);
    mx.maxpwr[12] = NaN;
    const issue = engine.classifyMaxFinite(mx);
    assert.ok(issue && issue.level === 'warn', 'one bad point is a gap, not an unusable chart');
    assert.match(issue.message, /Hz/, 'the message must name the affected frequency');
  });

  it('classification never throws, whatever it is handed — failure travels as a value', () => {
    const sw = engine.sweep(validDriver(), 'sealed', P_SEALED);
    for (let i = 0; i < sw.spl.length; i++) sw.spl[i] = NaN;
    assert.doesNotThrow(() => engine.classifyFinite(sw), 'the engine communicates by Result, never by exception');
    assert.doesNotThrow(() => engine.classifyMaxFinite(engine.maxCurves(validDriver(), 'sealed', P_SEALED)));
    assert.doesNotThrow(() => engine.validateParams('box-passive-radiator', {} as SweepParams));
  });
});
