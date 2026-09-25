import {driverParams, solveConsistencyGroup} from './testSolver.js';
/**
 * Unit tests for src/core/sweep.js — targeting the branch coverage gaps
 * not covered by engine.test.mjs:
 *   - Line 53: fmin/fmax/N parameter defaults (10, 1000, 400)
 *   - Line 70: spl fallback to -200 when pm = 0 (eg = 0 → no acoustic output)
 *   - Line 85: group-delay dw = 0 fallback (N = 0 → single frequency point)
 *   - Line 98: drv.Pe_W default to 50 W in maxCurves when Pe absent
 *
 * Note on line 103 (excAt283 = 0 → vXmax = 1e9):
 *   excAt283 = |UD|·√2 / (ω·Sd) at 2.83 V. Since UD = pg / (ZaE+ZaD+Zbox) and pg ≠ 0
 *   when eg = 2.83 V, excAt283 = 0 is unreachable in practice — the guard is defensive.
 *   This branch is intentionally left uncovered with this explanation.
 *
 * Run: node --test test/sweep.test.mjs
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import type {SweepParams} from '../../engine/index.js';
import {Engine} from '../../engine/index.js';

/** Voice-coil inductance for the fixtures below. Not a solver quantity — nothing
 *  derives it — so it reaches `sweep` on its own, and only the impedance plot reads it. */
const LE_H = 0.7e-3;

/** The engine's one door: every calculation below is a method on this object. */
const engine = new Engine();

// Reference driver: same synthetic 6.5" mid-woofer as engine.test.mjs


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

// Default parameter values from sweep.js line 53
const DEFAULT_FMIN_HZ = 10;
const DEFAULT_FMAX_HZ = 1000;
const DEFAULT_N = 400;       // number of frequency steps → N+1 = 401 points

// 2.83 V — IEC 60268-5 sensitivity reference
const EG_STANDARD = 2.83;

// ── Line 53: fmin / fmax / N defaults ────────────────────────────────────────

describe('sweep — parameter defaults when fmin / fmax / N are absent', () => {
  it('uses fmin=10 Hz, fmax=1000 Hz, N=400 when those parameters are not supplied — '
   + 'verifies P.fmin||10, P.fmax||1000, P.N||400 fallbacks', () => {
    // Call sweep without fmin, fmax, or N.  The returned fs array must span 10–1000 Hz
    // with 401 points (steps 0…400 inclusive).
    const { fs } = engine.sweep(driverParams(DRV), LE_H, BOX, { Vb: VB_M3, Ql: QL_LOSSLESS, eg: EG_STANDARD }).values!;

    // N+1 = 401 points
    assert.equal(fs.length, DEFAULT_N + 1,
      `expected ${DEFAULT_N + 1} frequency points (N=${DEFAULT_N} steps + 1), got ${fs.length}`);

    // First frequency must equal fmin exactly (no log-space rounding at i=0)
    assert.equal(fs[0], DEFAULT_FMIN_HZ,
      `first frequency must be fmin=${DEFAULT_FMIN_HZ} Hz, got ${fs[0]}`);

    // Last frequency must equal fmax exactly (at i=N: f0*(f1/f0)^1 = f1)
    assert.equal(fs[fs.length - 1], DEFAULT_FMAX_HZ,
      `last frequency must be fmax=${DEFAULT_FMAX_HZ} Hz, got ${fs[fs.length - 1]}`);
  });
});

// ── Line 70: pm = 0 → spl fallback to -200 ───────────────────────────────────

describe('sweep — zero-excitation (eg=0) produces -200 dB SPL for all frequencies', () => {
  it('when eg=0 there is no acoustic output; spl fallback (-200 dB) applies at every point', () => {
    // With eg=0: pg = cx(0·Bl, 0) = cx(0,0) → UD = 0 → U0 = 0 → pm = |Hc| = 0.
    // The guard `pm > 0 ? 20·log10(pm/P0) : -200` takes the -200 branch.
    const SPL_SILENCE_DB = -200;  // sentinel value for zero-excitation, defined in sweep.js
    const { spl } = engine.sweep(driverParams(DRV), LE_H, BOX, { Vb: VB_M3, Ql: QL_LOSSLESS, eg: 0 }).values!;
    assert(spl.length > 0, 'spl array must be non-empty');
    for (let i = 0; i < spl.length; i++) {
      assert.equal(spl[i], SPL_SILENCE_DB,
        `spl[${i}] must be ${SPL_SILENCE_DB} dB with eg=0, got ${spl[i]}`);
    }
  });
});

// ── Line 85: dw = 0 → group delay fallback to 0 ──────────────────────────────

describe('sweep — fmin=fmax produces constant-frequency sweep where dw=0', () => {
  it('when fmin equals fmax all frequencies are identical so dw=0 and group delay defaults to 0 ms '
   + 'for every sample — exercises the dw!==0 false branch', () => {
    // P.N || 400: 0 is falsy so N=0 would use default 400.  Instead, trigger dw=0 by
    // making fmin = fmax so that f = fmin·(fmax/fmin)^(i/N) = fmin for all i.
    // Then fs[b] - fs[a] = 0 → dw = 0 → gd.push(0) for every sample.
    const FREQ_HZ = 100;      // arbitrary passband frequency
    const N_STEPS = 5;        // need >1 so the loop has multiple iterations
    const GD_ZERO_MS = 0;     // fallback group delay when dw=0

    const { fs, gd } = engine.sweep(driverParams(DRV), LE_H, BOX, {
      Vb: VB_M3, Ql: QL_LOSSLESS, eg: EG_STANDARD,
      fmin: FREQ_HZ, fmax: FREQ_HZ, N: N_STEPS,
    }).values!;

    // All frequencies must be identical (fmin = fmax collapse to one point)
    assert(fs.every(f => f === FREQ_HZ),
      `all frequencies must equal ${FREQ_HZ} Hz when fmin=fmax`);

    // All group delay values must be the dw=0 fallback
    for (let i = 0; i < gd.length; i++) {
      assert.equal(gd[i], GD_ZERO_MS,
        `gd[${i}] must be ${GD_ZERO_MS} ms when dw=0, got ${gd[i]}`);
    }
  });
});

// ── Line 98: drv.Pe_W default in maxCurves ──────────────────────────────────────

describe('maxCurves — one limit absent falls back to the other (never poisons the curve)', () => {
  it('driver without Pe → curve is Xmax-limited and finite (no thermal limit, no fabricated default)', () => {
    // Pe absent → vPe = Infinity; the excursion (Xmax) limit alone bounds the curve.
    const drvNoPe = solveConsistencyGroup({
      Fs_hz: 37, Qts: 0.38, Qes: 0.40, Qms: 7.0,
      Vas_m3: 0.030, Sd_m2: 0.0133, Re_ohm: 5.6, Xmax_m: 0.005,
    });

    const { fs, maxspl } = engine.maxCurves(driverParams(drvNoPe), LE_H, BOX, {
      Vb: VB_M3, Ql: QL_LOSSLESS, eg: EG_STANDARD, fmin: 10, fmax: 1000, N: 50,
    }).values!;

    assert(fs.length > 0, 'maxCurves must return non-empty fs array');
    assert(maxspl.every(v => isFinite(v)),
      'every maxspl value must be finite when Pe is absent (Xmax-limited)');

    // Physically plausible passband range.
    const passband = maxspl.find((_, i) => fs[i] > 200);  // well above Fs=37
    assert(passband !== undefined && passband > 60 && passband < 160,
      `passband maxspl must be in [60, 160] dB, got ${passband} dB`);
  });

  it('driver with Xmax=0 but Pe present → curve is Pe-limited and finite, not -Infinity', () => {
    // Regression: Xmax=0 used to make vXmax=0 → vUse=0 → maxspl=-Infinity, maxpwr=0
    // (blank Max-SPL/Max-power charts). Xmax=0 must be treated as "no excursion limit"
    // so the Pe (thermal) limit alone bounds the curve.
    const drvXmax0 = solveConsistencyGroup({
      Fs_hz: 37, Qts: 0.38, Qes: 0.40, Qms: 7.0,
      Vas_m3: 0.030, Sd_m2: 0.0133, Re_ohm: 5.6, Pe_W: 60, Xmax_m: 0,
    });

    const { maxspl, maxpwr } = engine.maxCurves(driverParams(drvXmax0), LE_H, BOX, {
      Vb: VB_M3, Ql: QL_LOSSLESS, eg: EG_STANDARD, fmin: 10, fmax: 1000, N: 50,
    }).values!;

    assert(maxspl.every(Number.isFinite),
      'Xmax=0 must not poison Max-SPL with -Infinity — Pe limit must apply');
    assert(maxpwr.every(v => Number.isFinite(v) && v > 0),
      'Max-power must be finite and positive (Pe-limited), not 0');
  });

  it('neither Pe nor Xmax stated → maxspl/maxpwr are genuinely unbounded, reported as a '
   + "driverPrerequisites advisory naming both fields — never as a blocking issue (QO143: "
   + "Infinity here is a correct answer, not a gap)", () => {
    const drvNeither = solveConsistencyGroup({
      Fs_hz: 37, Qts: 0.38, Qes: 0.40, Qms: 7.0,
      Vas_m3: 0.030, Sd_m2: 0.0133, Re_ohm: 5.6,
    });

    const result = engine.maxCurves(driverParams(drvNeither), LE_H, BOX, {
      Vb: VB_M3, Ql: QL_LOSSLESS, eg: EG_STANDARD, fmin: 10, fmax: 1000, N: 50,
    });

    assert.equal(result.issues.length, 0, 'unbounded is a valid answer, not a blocking issue');
    assert(result.values!.maxspl.every(v => v === Infinity), 'maxspl is genuinely unbounded');
    assert(result.values!.maxpwr.every(v => v === Infinity), 'maxpwr is genuinely unbounded');
    assert.deepEqual(result.driverPrerequisites, [
      { output: 'maxspl', missing: ['Pe_W', 'Xmax_m'] },
      { output: 'maxpwr', missing: ['Pe_W', 'Xmax_m'] },
    ]);
  });

  it('Xmax stated but Pe absent → bounded by Xmax alone, no driverPrerequisites advisory', () => {
    const drvXmaxOnly = solveConsistencyGroup({
      Fs_hz: 37, Qts: 0.38, Qes: 0.40, Qms: 7.0,
      Vas_m3: 0.030, Sd_m2: 0.0133, Re_ohm: 5.6, Xmax_m: 0.005,
    });

    const result = engine.maxCurves(driverParams(drvXmaxOnly), LE_H, BOX, {
      Vb: VB_M3, Ql: QL_LOSSLESS, eg: EG_STANDARD, fmin: 10, fmax: 1000, N: 50,
    });

    assert.deepEqual(result.driverPrerequisites, []);
  });
});

// ── classifyFinite — the sweep-finiteness postcondition (hardening) ──────────
// A precondition on inputs can't foresee a frequency-dependent singularity, so
// the sweep output is classified at the boundary: isolated non-finite points →
// warn (the curve still draws with a gap); an entirely non-finite primary curve
// → error (nothing usable). Sentinels like -200 dB are finite and never flagged.
describe('classifyFinite — non-finite sweep results are surfaced, never silently blank', () => {
  const P: SweepParams = { Vb: VB_M3, Ql: QL_LOSSLESS, eg: 2.83, fmin: 10, fmax: 1000, N: 50 };

  it('returns null for an all-finite sweep', () => {
    const sw = engine.sweep(driverParams(DRV), LE_H, BOX, P).values!;
    assert.equal(engine.classifyFinite(sw), null, 'a healthy sweep has no finiteness issue');
  });

  it('an all-finite sweep with -200 dB silence sentinels is still null (sentinels are finite)', () => {
    const sw = engine.sweep(driverParams(DRV), LE_H, BOX, { ...P, eg: 0 }).values!; // eg=0 → spl all -200 (finite sentinel)
    assert.equal(engine.classifyFinite(sw), null, '-200 dB sentinels must not be flagged as non-finite');
  });

  it('flags an isolated non-finite point as a warn that names the frequency', () => {
    const sw = engine.sweep(driverParams(DRV), LE_H, BOX, P).values!;
    sw.spl[10] = NaN; // inject a lone singularity
    const r = engine.classifyFinite(sw);
    assert.ok(r && r.level === 'warn', 'an isolated NaN is a warn, not a block');
    assert.match(r.message, /Hz/, 'the message names the affected frequency');
  });

  it('flags an entirely non-finite primary curve as a blocking error', () => {
    const sw = engine.sweep(driverParams(DRV), LE_H, BOX, P).values!;
    for (let i = 0; i < sw.spl.length; i++) sw.spl[i] = NaN;
    const r = engine.classifyFinite(sw);
    assert.ok(r && r.level === 'error', 'no finite spl point at all → blocking error');
    assert.match(r!.message, /no finite values in/i,
      'the blocking message must identify the failed sweep outputs');
  });

  it('names the plotted outputs that failed instead of guessing at an input cause', () => {
    const sw = engine.sweep(driverParams(DRV), LE_H, BOX, P).values!;
    for (let i = 0; i < sw.fs.length; i++) {
      sw.exc[i] = NaN;
      sw.zmag[i] = NaN;
    }
    const r = engine.classifyFinite(sw);
    assert.ok(r);
    assert.match(r.message, /excursion/i);
    assert.match(r.message, /impedance magnitude/i);
    assert.doesNotMatch(r.message, /6 L box alone/i);
  });

  it('reports a broken transfer-magnitude series for the TFM chart', () => {
    const sw = engine.sweep(driverParams(DRV), LE_H, BOX, P).values!;
    for (let i = 0; i < sw.tfMag.length; i++) sw.tfMag[i] = NaN;
    const issue = engine.classifyFiniteIssues(sw).find(error => error.field === 'sweep:transfer magnitude');
    assert.ok(issue, 'TFM output failure must be reported to the chart');
    assert.match(issue.message, /transfer magnitude/i);
  });

  it('per-output: exactly one non-finite value reads as singular ("1 non-finite ... value", not "values")', () => {
    const sw = engine.sweep(driverParams(DRV), LE_H, BOX, P).values!;
    sw.tfMag[0] = NaN; // exactly one bad point, not all of them
    const issue = engine.classifyFiniteIssues(sw).find(error => error.field === 'sweep:transfer magnitude');
    assert.ok(issue && issue.level === 'warn', 'a partial failure is a warn, not a block');
    assert.match(issue.message, /1 non-finite transfer magnitude value;/, 'exactly one bad value must read singular, no trailing "s"');
  });

  it('per-output: more than one non-finite value (but not all) reads as plural ("values")', () => {
    const sw = engine.sweep(driverParams(DRV), LE_H, BOX, P).values!;
    sw.tfMag[0] = NaN;
    sw.tfMag[1] = NaN;
    sw.tfMag[2] = NaN;
    const issue = engine.classifyFiniteIssues(sw).find(error => error.field === 'sweep:transfer magnitude');
    assert.ok(issue && issue.level === 'warn', 'a partial failure is a warn, not a block');
    assert.match(issue.message, /3 non-finite transfer magnitude values;/, 'more than one bad value must read plural');
  });

  it('reports a tempK missing-dependencies issue for a temperature beyond the supported range', () => {
    const result = engine.sweep(driverParams(DRV), LE_H, BOX, { ...P, tempK: 5000 });
    assert.equal(result.values, null);
    assert.equal(result.issues.length, 1);
    const [issue] = result.issues;
    assert.equal(issue.kind, 'missing-dependencies');
    if (issue.kind !== 'missing-dependencies') return;
    assert.equal(issue.target, 'tempK');
    assert.match(issue.routes[0].formula, /173\.15.*373\.15/);
  });

  it('rejects a temperature beyond the supported range even if the formula stays finite', () => {
    const result = engine.sweep(driverParams(DRV), LE_H, BOX, { ...P, tempK: 500 });
    assert.equal(result.values, null);
    assert.equal(result.issues.length, 1);
    const [issue] = result.issues;
    assert.equal(issue.kind, 'missing-dependencies');
    if (issue.kind !== 'missing-dependencies') return;
    assert.equal(issue.target, 'tempK');
  });

  it('rejects absolute zero with an exclusive lower-bound formula', () => {
    const result = engine.sweep(driverParams(DRV), LE_H, BOX, { ...P, tempK: 1 });
    assert.equal(result.values, null);
    const [issue] = result.issues;
    assert.equal(issue.kind, 'missing-dependencies');
    if (issue.kind !== 'missing-dependencies') return;
    assert.match(issue.routes[0].formula, /173\.15/);
  });

  it('flags pervasive breakdown even when spl is the finite −200 sentinel (the Vb=0 shape)', () => {
    // Vb=0 makes cInv(0) poison exc/zmag with NaN, but spl stays −200 (finite) via
    // the pm>0 guard. Classifying on spl alone would call this a "warn"; it is total
    // garbage → error. Every frequency is affected, so it must be a blocking error.
    const sw = engine.sweep(driverParams(DRV), LE_H, BOX, P).values!;
    for (let i = 0; i < sw.exc.length; i++) sw.exc[i] = NaN;
    const r = engine.classifyFinite(sw);
    assert.ok(r && r.level === 'error', 'every-frequency breakdown → error, not warn, despite finite spl');
  });

  it('names multiple isolated singularities in ascending frequency order, past and below 100 Hz, with a "+more" count past 3', () => {
    // A single bad index never invokes the frequency sort (nothing to sort) and never reaches
    // the >3 "+more" count — needs several, spanning both sides of the fs.toFixed(0)/toFixed(1)
    // 100 Hz split, and out of order so the sort actually does work.
    const sw = engine.sweep(driverParams(DRV), LE_H, BOX, P).values!;
    for (const i of [40, 5, 30, 13, 45]) sw.spl[i] = NaN; // unsorted on purpose
    const r = engine.classifyFinite(sw);
    assert.ok(r && r.level === 'warn', 'a partial, isolated breakdown is a warn, not a block');
    const freqs = [5, 13, 30, 40, 45].map(i => sw.fs[i]);
    assert.ok(freqs[0] < 100 && freqs[1] < 100 && freqs[2] >= 100, 'fixture must straddle the 100 Hz formatting split');
    assert.match(r!.message, /\+2 more/, 'only the first 3 (in ascending order) are named, the rest counted');
  });
});

describe('sweep circuit diagnostics', () => {
  it('reports one missing-dependencies issue per missing circuit quantity, each naming exactly '
   + 'that field — never a combined message or a cross-field substitution suggestion', () => {
    const result = engine.sweep(driverParams({ Fs_hz: 111111 }), LE_H, BOX, {
      Vb: VB_M3, Ql: QL_LOSSLESS, eg: EG_STANDARD,
    });

    assert.equal(result.values, null);
    const targets = result.issues.map(i => i.kind === 'missing-dependencies' ? i.target : null).sort();
    assert.deepEqual(targets, [
      'BL_terminal_Tm', 'Cms_m_per_N', 'Mms_kg', 'Re_terminal_ohm', 'Rms_kg_per_s', 'Sd_m2',
    ].sort());
    for (const issue of result.issues) {
      assert.equal(issue.kind, 'missing-dependencies');
      if (issue.kind !== 'missing-dependencies') continue;
      assert.equal(issue.routes.length, 1, `${issue.target} must name exactly one route — itself`);
      assert.deepEqual(issue.routes[0].missing, [issue.target]);
    }
  });

  it('maxCurves() passes through the same null values and issues as sweep() when the circuit is missing fields', () => {
    const swept = engine.sweep(driverParams({ Fs_hz: 111111 }), LE_H, BOX, {
      Vb: VB_M3, Ql: QL_LOSSLESS, eg: EG_STANDARD,
    });
    const mx = engine.maxCurves(driverParams({ Fs_hz: 111111 }), LE_H, BOX, {
      Vb: VB_M3, Ql: QL_LOSSLESS, eg: EG_STANDARD,
    });
    assert.equal(mx.values, null);
    assert.deepEqual(mx.issues, swept.issues);
    assert.deepEqual(mx.driverPrerequisites, []);
  });
});

/**
 * Architecture & Encapsulation Contract:
 * The cutoff frequency derivation (rolloffFreq) must reside 100% inside the engine, completely
 * decoupled from UI presentation code. UI components and series builders consume pre-calculated
 * engine data directly.
 *
 * Specification: docs/spec/SPEC_ENGINE.md §3.2
 */
describe('rolloffFreq — Encapsulated Engine Physics Calculations', () => {
  const P: SweepParams = { Vb: VB_M3, Ql: QL_LOSSLESS, eg: 2.83, fmin: 10, fmax: 1000, N: 100 };

  /**
   * Spec Link: docs/spec/SPEC_ENGINE.md §3.2 "Cutoff Frequency Readouts (F3, F6, F10)"
   */
  it('rolloffFreq derives F3 (-3 dB), F6 (-6 dB), and F10 (-10 dB) cutoff frequencies inside engine', () => {
    const sw = engine.sweep(driverParams(DRV), LE_H, BOX, P).values!;
    const f3 = engine.rolloffFreq(sw, 3);
    const f6 = engine.rolloffFreq(sw, 6);
    const f10 = engine.rolloffFreq(sw, 10);

    assert.ok(f3 !== null && f3 > 0, 'F3 (-3 dB) cutoff frequency is derived');
    assert.ok(f6 !== null && f6 > 0, 'F6 (-6 dB) cutoff frequency is derived');
    assert.ok(f10 !== null && f10 > 0, 'F10 (-10 dB) cutoff frequency is derived');
    assert.ok(f10 < f6 && f6 < f3, 'F10 < F6 < F3 frequency ordering holds for highpass roll-off');
  });

  it('returns null when no frequency ever reaches within dropDb of the passband reference (an all-silent sweep)', () => {
    // eg=0 → spl is -200 dB everywhere, so passbandRef falls back to its own 0 dB sentinel and
    // even a 3 dB drop is never satisfied by -200 >= 0 - 3.
    const sw = engine.sweep(driverParams(DRV), LE_H, BOX, { ...P, eg: 0 }).values!;
    assert.equal(engine.rolloffFreq(sw, 3), null, 'an all-silent sweep has no rolloff frequency to report');
  });
});

/**
 * hfPassbandRef (sweep.ts) — the high-frequency asymptote fallback tfMag() uses when the
 * caller cannot supply a first-principles reference (splRefLimit requires Fs_hz/Vas_m3/Qes
 * ALL stated). Reached only when a driver satisfies the circuit's 6 required fields directly
 * (bypassing solveConsistencyGroup, via driverParams) without also carrying the T/S triple.
 */
describe('hfPassbandRef — high-frequency passband fallback when no first-principles reference exists', () => {
  it('an audible high-frequency asymptote becomes 0 dB tfMag at that same point (ref = itself)', () => {
    const circuitOnly = driverParams({
      Sd_m2: 0.0133, Re_terminal_ohm: 5.6, BL_terminal_Tm: 7.0,
      Cms_m_per_N: 0.0008, Mms_kg: 0.012, Rms_kg_per_s: 1.5,
      Xmax_m: 0.005, Pe_W: 60,
    });
    const sw = engine.sweep(circuitOnly, LE_H, BOX, { Vb: VB_M3, Ql: QL_LOSSLESS, eg: EG_STANDARD, fmin: 10, fmax: 1000, N: 50 }).values!;
    assert.ok(Number.isFinite(sw.spl[sw.spl.length - 1]) && sw.spl[sw.spl.length - 1] > -190,
      'fixture must produce an audible top-of-sweep point for hfPassbandRef to use as the reference');
    assert.equal(sw.tfMag[sw.tfMag.length - 1], 0, 'the reference point itself must read as 0 dB tfMag');
  });
});

/**
 * classifyFlatClamp (sweep.ts) — the frequency in its message is formatted with .toFixed(0)
 * at/above 100 Hz and .toFixed(1) below, the same split classifyArrays uses for its own
 * singularity list. advanced-options.test.ts already covers a clamp binding below 100 Hz;
 * this covers the >=100 Hz arm.
 */
describe('classifyFlatClamp — clamp-bound frequency formatting at/above 100 Hz', () => {
  it('formats a clamp bound at or above 100 Hz with .toFixed(0) (no decimal place)', () => {
    // fmin itself is 100 Hz and a highpass filter at 300 Hz still rolls off heavily there,
    // so the very first (lowest, and only >=100 Hz) point needs far more than the 6 dB clamp.
    const P: SweepParams = {
      Vb: VB_M3, Ql: QL_LOSSLESS, eg: EG_STANDARD, fmin: 100, fmax: 2000, N: 50,
      forceFlatResponse: true, flatMaxBoostDb: 6,
      filters: [{ type: 'highpass', enabled: true, fc: 300, Q: Math.SQRT1_2 }],
    };
    const sw = engine.sweep(driverParams(DRV), LE_H, BOX, P).values!;
    assert.ok(sw.flatClamped !== null && sw.flatClamped >= 100, 'fixture must clamp at/above 100 Hz');
    const issue = engine.classifyFlatClamp(sw);
    assert.ok(issue, 'a bound clamp must surface an issue');
    assert.match(issue!.message, new RegExp(`below ${sw.flatClamped!.toFixed(0)} Hz`), 'a >=100 Hz clamp frequency must format with no decimal place');
  });
});

/**
 * Force-flat response (sweep.ts L296-312) skips silent points ("no gain resurrects silence")
 * — the continue at L300. Reached only when force-flat is on AND some point is the -200 dB
 * sentinel (or already non-finite), which advanced-options.test.ts's fixtures never produce.
 */
describe('force-flat response — silent (-200 dB) points are never resurrected by the EQ', () => {
  it('an all-silent sweep (eg=0) stays all-silent under forceFlatResponse — no clamp, no gain applied', () => {
    const sw = engine.sweep(driverParams(DRV), LE_H, BOX, {
      Vb: VB_M3, Ql: QL_LOSSLESS, eg: 0, fmin: 10, fmax: 1000, N: 50, forceFlatResponse: true,
    }).values!;
    assert.ok(sw.spl.every(v => v === -200), 'silence must not be boosted just because force-flat is on');
    assert.equal(sw.flatClamped, null, 'a curve with nothing to flatten never binds the clamp');
  });
});

/**
 * fltMag (sweep.ts L265) — the filter chain's own dB magnitude, with the same -200 dB silence
 * sentinel as spl for the pathological |H|=0 case: a peaking EQ with gain -> -Infinity becomes
 * a true notch (its zero sits exactly on the real axis at its own centre frequency), and when
 * that centre frequency lands exactly on a sweep grid point, |H| is exactly 0, not merely small.
 */
describe('fltMag — an exact spectral null lands the -200 dB silence sentinel, not a huge negative number', () => {
  it('a peaking-EQ notch (gain=-Infinity) centred exactly on a grid point reads -200 dB there', () => {
    // fmin=10, fmax=1000, N=2 → grid points 10, 100, 1000 (log-spaced); fc=100 lands on i=1.
    const P: SweepParams = {
      Vb: VB_M3, Ql: QL_LOSSLESS, eg: EG_STANDARD, fmin: 10, fmax: 1000, N: 2,
      filters: [{ type: 'peaking', enabled: true, fc: 100, Q: 1, gain: -Infinity }],
    };
    const sw = engine.sweep(driverParams(DRV), LE_H, BOX, P).values!;
    assert.equal(sw.fs[1], 100, 'grid point must land exactly on the notch centre frequency');
    assert.equal(sw.fltMag[1], -200, 'an exact |H|=0 null reads the same -200 dB silence sentinel as spl');
  });
});

/**
 * withAddedMass (solver.ts) returns the driver unchanged when `driverAddedMass > 0` but the
 * driver is missing one of the five fields the mass-shift needs (Mms/Cms/Rms/Re/Bl) — it must
 * not derive or invent the missing field just because a shift was requested.
 */
describe('sweep — driverAddedMass > 0 on a driver missing a mass-shift input leaves the driver unchanged', () => {
  it('a driver missing Cms_m_per_N still reports Cms_m_per_N missing, not a mass-shifted circuit', () => {
    const partial = driverParams({ Fs_hz: 37, Re_ohm: 5.6, BL_Tm: 6, Mms_kg: 0.012, Rms_kg_per_s: 1.2 });
    const result = engine.sweep(partial, LE_H, BOX, { Vb: VB_M3, Ql: QL_LOSSLESS, eg: EG_STANDARD, driverAddedMass: 0.01 });
    assert.equal(result.values, null, 'the circuit cannot be built without Cms_m_per_N');
    assert.ok(
      result.issues.some(i => i.kind === 'missing-dependencies' && i.target === 'Cms_m_per_N'),
      'withAddedMass must leave the driver unchanged (never derive Cms) when a mass-shift input is absent',
    );
  });
});
