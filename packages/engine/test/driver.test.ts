/**
 * Unit tests for packages/engine/src/driver.ts
 *
 * Covers: deriveEngineDriver {value,errors} contract and Q-derivation branches.
 * WDR interop (parseWdr, toWdr, parstate) is tested in @openisd/winisd — see
 * packages/winisd/test/wdr.test.ts.
 *
 * Q-factor formulas: https://en.wikipedia.org/wiki/Thiele/Small_parameters#Small_signal_parameters
 *   Qts = (Qes · Qms) / (Qes + Qms)
 *   Qes = (Qts · Qms) / (Qms − Qts)   [inverse]
 *   Qms = (Qts · Qes) / (Qes − Qts)   [inverse]
 */

import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { deriveEngineDriver, solveConsistencyGroup } from '../src/driver.js';


// ── Q-derivation test values ─────────────────────────────────────────────────
const QES = 0.400;    // electrical Q — resistance damping from voice coil
const QMS = 7.000;    // mechanical Q — damping from spider / surround
// Qts derived from QES and QMS via Thiele/Small combination formula
const QTS_DERIVED = (QES * QMS) / (QES + QMS);   // ≈ 0.37838

// Floating-point tolerance for algebraically-derived Q values.
// These computations are closed-form with no measurement rounding,
// so double-precision error should be well below 1e-10.
const Q_TOL = 1e-10;

// Base driver params (mechanical + electrical, no Q value — Q supplied per test)
const BASE = {
  Fs: 37,        // resonant frequency, Hz
  Vas: 0.030,    // acoustic compliance volume, m³
  Sd: 0.0133,    // effective piston area, m²
  Re: 5.6,       // DC resistance, Ω
  Le: 0.70e-3,   // voice-coil inductance, H
  Xmax: 0.005,   // peak linear excursion, m
  Pe: 60,        // rated power, W
  Znom: 8,          // nominal impedance, Ω
};

// ── deriveEngineDriver — {value, errors} contract ───────────────────────────────────

describe('deriveEngineDriver — {value, errors} contract', () => {
  it('returns an object with value and errors properties — never a bare driver or a throw', () => {
    const result = deriveEngineDriver({ ...BASE, Qes: QES, Qms: QMS });
    assert.ok('value' in result, 'must have value property');
    assert.ok('errors' in result, 'must have errors property');
    assert.ok(Array.isArray(result.errors), 'errors must be an array');
  });

  it('errors is empty for a complete valid driver — no spurious warnings on good input', () => {
    const { errors } = deriveEngineDriver({ ...BASE, Qes: QES, Qms: QMS });
    assert.deepEqual(errors, [], 'no errors expected for complete valid driver');
  });

  it('value is non-null for a complete valid driver — all T/S fields present means usable result', () => {
    const { value } = deriveEngineDriver({ ...BASE, Qes: QES, Qms: QMS });
    assert.ok(value != null, 'value must not be null for complete input');
  });

  it('returns value:null and field-level error for Fs when Fs is missing', () => {
    const { value, errors } = deriveEngineDriver({ ...BASE, Qes: QES, Qms: QMS, Fs: undefined });
    assert.equal(value, null, 'value must be null when Fs is missing');
    const e = errors.find(e => e.field === 'Fs');
    assert.ok(e, 'must have an error entry for field Fs');
    assert.equal(e.level, 'error', 'Fs error must be level:error');
    assert.ok(typeof e.message === 'string' && e.message.length > 0, 'must have a non-empty human-readable message');
  });

  it('returns value:null and field-level error for Re when Re is missing', () => {
    const { value, errors } = deriveEngineDriver({ ...BASE, Qes: QES, Qms: QMS, Re: undefined });
    assert.equal(value, null);
    const e = errors.find(e => e.field === 'Re');
    assert.ok(e && e.level === 'error', 'must have level:error entry for Re');
  });

  it('returns value:null and field-level error for Sd when Sd is missing', () => {
    const { value, errors } = deriveEngineDriver({ ...BASE, Qes: QES, Qms: QMS, Sd: undefined });
    assert.equal(value, null);
    const e = errors.find(e => e.field === 'Sd');
    assert.ok(e && e.level === 'error', 'must have level:error entry for Sd');
  });

  it('returns value:null and field-level error for Vas when Vas is missing', () => {
    const { value, errors } = deriveEngineDriver({ ...BASE, Qes: QES, Qms: QMS, Vas: undefined });
    assert.equal(value, null);
    const e = errors.find(e => e.field === 'Vas');
    assert.ok(e && e.level === 'error', 'must have level:error entry for Vas');
  });

  it('returns value:null and error when fewer than two Q parameters are present', () => {
    // Qts alone cannot resolve Qes or Qms — underdetermined system
    const { value, errors } = deriveEngineDriver({ ...BASE, Qts: QTS_DERIVED });
    assert.equal(value, null, 'value must be null when Q system is underdetermined');
    assert.ok(errors.some(e => e.level === 'error'), 'must have at least one error');
  });

  it('returns value:null when Fs is zero — zero frequency is not physically valid', () => {
    const { value, errors } = deriveEngineDriver({ ...BASE, Qes: QES, Qms: QMS, Fs: 0 });
    assert.equal(value, null);
    assert.ok(errors.some(e => e.field === 'Fs'), 'must have Fs error entry');
  });

  it('returns non-null value and a warn for Pe when Pe is absent — Pe is optional, driver is still usable', () => {
    const { value, errors } = deriveEngineDriver({ ...BASE, Qes: QES, Qms: QMS, Pe: undefined });
    assert.ok(value != null, 'value must not be null — Pe absence does not block derivation');
    const w = errors.find(e => e.field === 'Pe' && e.level === 'warn');
    assert.ok(w, 'must have a level:warn entry for Pe when absent');
    assert.ok(typeof w.message === 'string' && w.message.length > 0, 'warn message must be non-empty');
  });

  it('returns non-null value and a warn for Pe when Pe is zero — zero Pe same treatment as absent', () => {
    const { value, errors } = deriveEngineDriver({ ...BASE, Qes: QES, Qms: QMS, Pe: 0 });
    assert.ok(value != null, 'value must not be null for Pe=0');
    const w = errors.find(e => e.field === 'Pe' && e.level === 'warn');
    assert.ok(w, 'must have a level:warn entry for Pe=0');
  });

  // ── edge cases ──────────────────────────────────────────────────────────────

  it('a Pe warn alone (all required fields present) does not block the value — warn ≠ error', () => {
    // The critical distinction: warn-level entries must NOT null the value.
    const { value, errors } = deriveEngineDriver({ ...BASE, Qes: QES, Qms: QMS, Pe: 0 });
    assert.ok(value != null, 'warn-only result must keep a usable value');
    assert.ok(!errors.some(e => e.level === 'error'), 'Pe=0 alone produces no error-level entry');
  });

  it('negative Fs is rejected the same as zero/absent — Fs must be strictly positive', () => {
    const { value, errors } = deriveEngineDriver({ ...BASE, Qes: QES, Qms: QMS, Fs: -37 });
    assert.equal(value, null);
    assert.ok(errors.some(e => e.field === 'Fs' && e.level === 'error'), 'negative Fs must be an error');
  });

  it('negative Re is rejected — resistance must be strictly positive', () => {
    const { value, errors } = deriveEngineDriver({ ...BASE, Qes: QES, Qms: QMS, Re: -5.6 });
    assert.equal(value, null);
    assert.ok(errors.some(e => e.field === 'Re' && e.level === 'error'));
  });

  it('NaN Fs is rejected — NaN must not slip through the > 0 guard', () => {
    const { value, errors } = deriveEngineDriver({ ...BASE, Qes: QES, Qms: QMS, Fs: NaN });
    assert.equal(value, null);
    assert.ok(errors.some(e => e.field === 'Fs' && e.level === 'error'));
  });

  it('multiple missing required fields accumulate one error entry per field — not just the first', () => {
    // Fs, Re, Sd, Vas all absent → four distinct error entries, all fields named.
    const { value, errors } = deriveEngineDriver({ Qes: QES, Qms: QMS });
    assert.equal(value, null);
    const errFields = new Set(errors.filter(e => e.level === 'error').map(e => e.field));
    for (const f of ['Fs', 'Re', 'Sd', 'Vas']) {
      assert.ok(errFields.has(f), `expected an error entry for ${f}; got fields ${[...errFields].join(', ')}`);
    }
  });

  it('a completely empty driver produces errors but never throws and never returns undefined', () => {
    const result = deriveEngineDriver({});
    assert.ok(result && Array.isArray(result.errors), 'must return {value, errors} even for {}');
    assert.equal(result.value, null);
    assert.ok(result.errors.length > 0, 'empty driver must report at least one error');
  });

  it('every error entry has field, level, and a non-empty human-readable message', () => {
    // Contract guarantee the UI relies on to render per-field messages.
    const { errors } = deriveEngineDriver({});
    for (const e of errors) {
      assert.ok(typeof e.field === 'string' && e.field.length > 0, 'field must be a non-empty string');
      assert.ok(e.level === 'error' || e.level === 'warn', `level must be error|warn, got ${e.level}`);
      assert.ok(typeof e.message === 'string' && e.message.length > 0, 'message must be non-empty text');
    }
  });
});

// ── deriveEngineDriver — Q-factor derivation ───────────────────────────────────────

describe('deriveEngineDriver — Q-factor derivation branches', () => {
  it('derives Qts from Qes and Qms when Qts is absent — '
   + 'standard scenario where Qes and Qms are measured separately', () => {
    const { value: d } = deriveEngineDriver({ ...BASE, Qes: QES, Qms: QMS });
    assert.ok(d);
    assert(
      Math.abs(d.Qts - QTS_DERIVED) < Q_TOL,
      `expected Qts = Qes·Qms/(Qes+Qms) = ${QTS_DERIVED}, got ${d.Qts}`,
    );
  });

  it('derives Qes from Qts and Qms when Qes is absent — '
   + 'inverse combination formula Qes = Qts·Qms / (Qms − Qts)', () => {
    const expectedQes = (QTS_DERIVED * QMS) / (QMS - QTS_DERIVED);
    const { value: d } = deriveEngineDriver({ ...BASE, Qts: QTS_DERIVED, Qms: QMS });
    assert.ok(d);
    assert(
      Math.abs(d.Qes - expectedQes) < Q_TOL,
      `expected Qes = ${expectedQes}, got ${d.Qes}`,
    );
  });

  it('derives Qms from Qts and Qes when Qms is absent — '
   + 'inverse combination formula Qms = Qts·Qes / (Qes − Qts)', () => {
    const expectedQms = (QTS_DERIVED * QES) / (QES - QTS_DERIVED);
    const { value: d } = deriveEngineDriver({ ...BASE, Qts: QTS_DERIVED, Qes: QES });
    assert.ok(d);
    assert(
      Math.abs(d.Qms - expectedQms) < Q_TOL,
      `expected Qms = ${expectedQms}, got ${d.Qms}`,
    );
  });

  // §11 — deriving Qes from Qts,Qms divides by (Qms − Qts); Qms ≤ Qts makes that
  // zero/negative → Qes = ∞/negative, which used to poison Bl and the whole circuit
  // silently. Qts is the parallel combination of Qes and Qms, so Qms > Qts is a
  // physical invariant; violating it must be a blocking error, not a NaN curve.
  it('rejects Qms == Qts (Qes absent) with a blocking error instead of deriving Qes = Infinity', () => {
    const { value, errors } = deriveEngineDriver({ ...BASE, Qts: 0.5, Qms: 0.5 });
    assert.equal(value, null, 'a degenerate Qms == Qts driver must not derive');
    assert.ok(
      errors.some(e => e.level === 'error' && /Qms/.test(e.field + e.message)),
      'must report a blocking error naming Qms',
    );
  });

  it('rejects Qms < Qts (Qes absent) — Qes = Qts·Qms/(Qms−Qts) would go negative', () => {
    const { value, errors } = deriveEngineDriver({ ...BASE, Qts: 0.6, Qms: 0.4 });
    assert.equal(value, null, 'Qms < Qts is physically impossible; must not derive');
    assert.ok(errors.some(e => e.level === 'error'), 'must report a blocking error');
  });

  it('rejects Qes == Qts (Qms absent) — the symmetric divide-by-zero deriving Qms', () => {
    const { value, errors } = deriveEngineDriver({ ...BASE, Qts: 0.5, Qes: 0.5 });
    assert.equal(value, null, 'a degenerate Qes == Qts driver must not derive');
    assert.ok(
      errors.some(e => e.level === 'error' && /Qes/.test(e.field + e.message)),
      'must report a blocking error naming Qes',
    );
  });
});

describe('solveConsistencyGroup — full fixpoint solver mode', () => {
  it('solves Hc bi-directionally when Hg and Xmax are provided (underhung default)', () => {
    const res = solveConsistencyGroup({ Hg: 0.008, Xmax: 0.003 }, { full: true }) as Record<string, number>;
    assert.equal(res.Hc, 0.002, 'Hc must solve to Hg - 2*Xmax = 0.002 m');
  });

  it('solves Hg bi-directionally when Hc and Xmax are provided', () => {
    const res = solveConsistencyGroup({ Hc: 0.015, Xmax: 0.005 }, { full: true }) as Record<string, number>;
    assert.ok(Math.abs(res.Hg - 0.005) < 1e-6, `Hg must solve to Hc - 2*Xmax = 0.005 m, got ${res.Hg}`);
  });


  it('prioritizes Row 6 (Dd -> Sd) over Row 20 (Vd/Xmax -> Sd)', () => {
    const res = solveConsistencyGroup({ Dd: 0.200, Vd: 0.0001, Xmax: 0.005 }, { full: true }) as Record<string, number>;
    const expectedSd = Math.PI * 0.100 ** 2; // ~0.0314159
    assert.ok(Math.abs(res.Sd - expectedSd) < 1e-6, `expected Row 6 Sd ~${expectedSd}, got ${res.Sd}`);
  });

  it('executes a 4-hop multi-cascade derivation from minimal 6-input set', () => {
    const res = solveConsistencyGroup({
      Fs: 35.0,
      Qes: 0.40,
      Qms: 4.50,
      Vas: 0.045,
      Re: 6.0,
      Dd: 0.210,
    }, { full: true }) as Record<string, number>;

    assert.ok(res.Sd > 0, 'Sd must be calculated (Hop 1)');
    assert.ok(res.Cms > 0, 'Cms must be calculated (Hop 2)');
    assert.ok(res.Mms > 0, 'Mms must be calculated (Hop 3)');
    assert.ok(res.BL > 0, 'BL must be calculated (Hop 4)');
    assert.ok(res.Rms > 0, 'Rms must be calculated (Hop 4)');
    assert.ok(res.Qts > 0, 'Qts must be calculated');
    assert.ok(res.no > 0, 'no must be calculated');
  });
});

