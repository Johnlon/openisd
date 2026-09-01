/**
 * Unit tests for packages/engine/src/driver.ts
 *
 * Covers: deriveEngineDriver {value,errors} contract and Q-derivation branches.
 * WDR interop (parseWdr, toWdr, parstate) is tested in @openisd/design/winisd — see
 * packages/design/test/winisd/wdr.test.ts.
 *
 * Q-factor formulas: https://en.wikipedia.org/wiki/Thiele/Small_parameters#Small_signal_parameters
 *   Qts = (Qes · Qms) / (Qes + Qms)
 *   Qes = (Qts · Qms) / (Qms − Qts)   [inverse]
 *   Qms = (Qts · Qes) / (Qes − Qts)   [inverse]
 */

import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { Engine } from '../../engine/index.js';

/** The engine's one door: every calculation below is a method on this object. */
const engine = new Engine();

// A driver record stating no `c`/`roo` of its own takes the live physical model at the
// reference environment — the same air `airFor({})` reports.
const driverC   = (): number => engine.airFor({}).c;
const driverRho = (): number => engine.airFor({}).rho;


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
    const result = engine.solveConsistencyGroup({ ...BASE, Qes: QES, Qms: QMS });
    assert.ok('value' in result, 'must have value property');
    assert.ok('errors' in result, 'must have errors property');
    assert.ok(Array.isArray(result.errors), 'errors must be an array');
  });

  it('errors is empty for a complete valid driver — no spurious warnings on good input', () => {
    const { errors } = engine.solveConsistencyGroup({ ...BASE, Qes: QES, Qms: QMS });
    assert.deepEqual(errors, [], 'no errors expected for complete valid driver');
  });

  it('value is non-null for a complete valid driver — all T/S fields present means usable result', () => {
    const { value } = engine.solveConsistencyGroup({ ...BASE, Qes: QES, Qms: QMS });
    assert.ok(value != null, 'value must not be null for complete input');
  });

  it('returns value:null and field-level error for Fs when Fs is missing', () => {
    const { value, errors } = engine.solveConsistencyGroup({ ...BASE, Qes: QES, Qms: QMS, Fs_hz: undefined });
    assert.equal(value, null, 'value must be null when Fs is missing');
    const e = errors.find(e => e.field === 'Fs');
    assert.ok(e, 'must have an error entry for field Fs');
    assert.equal(e.level, 'error', 'Fs error must be level:error');
    assert.ok(typeof e.message === 'string' && e.message.length > 0, 'must have a non-empty human-readable message');
  });

  it('returns value:null and field-level error for Re when Re is missing', () => {
    const { value, errors } = engine.solveConsistencyGroup({ ...BASE, Qes: QES, Qms: QMS, Re_ohm: undefined });
    assert.equal(value, null);
    const e = errors.find(e => e.field === 'Re');
    assert.ok(e && e.level === 'error', 'must have level:error entry for Re');
  });

  it('returns value:null and field-level error for Sd when Sd is missing', () => {
    const { value, errors } = engine.solveConsistencyGroup({ ...BASE, Qes: QES, Qms: QMS, Sd_m2: undefined });
    assert.equal(value, null);
    const e = errors.find(e => e.field === 'Sd');
    assert.ok(e && e.level === 'error', 'must have level:error entry for Sd');
  });

  it('returns value:null and field-level error for Vas when Vas is missing', () => {
    const { value, errors } = engine.solveConsistencyGroup({ ...BASE, Qes: QES, Qms: QMS, Vas_m3: undefined });
    assert.equal(value, null);
    const e = errors.find(e => e.field === 'Vas');
    assert.ok(e && e.level === 'error', 'must have level:error entry for Vas');
  });

  it('returns value:null and error when fewer than two Q parameters are present', () => {
    // Qts alone cannot resolve Qes or Qms — underdetermined system
    const { value, errors } = engine.solveConsistencyGroup({ ...BASE, Qts: QTS_DERIVED });
    assert.equal(value, null, 'value must be null when Q system is underdetermined');
    assert.ok(errors.some(e => e.level === 'error'), 'must have at least one error');
  });

  it('returns value:null when Fs is zero — zero frequency is not physically valid', () => {
    const { value, errors } = engine.solveConsistencyGroup({ ...BASE, Qes: QES, Qms: QMS, Fs_hz: 0 });
    assert.equal(value, null);
    assert.ok(errors.some(e => e.field === 'Fs'), 'must have Fs error entry');
  });

  it('returns non-null value and a warn for Pe when Pe is absent — Pe is optional, driver is still usable', () => {
    const { value, errors } = engine.solveConsistencyGroup({ ...BASE, Qes: QES, Qms: QMS, Pe_W: undefined });
    assert.ok(value != null, 'value must not be null — Pe absence does not block derivation');
    const w = errors.find(e => e.field === 'Pe' && e.level === 'warn');
    assert.ok(w, 'must have a level:warn entry for Pe when absent');
    assert.ok(typeof w.message === 'string' && w.message.length > 0, 'warn message must be non-empty');
  });

  it('returns non-null value and a warn for Pe when Pe is zero — zero Pe same treatment as absent', () => {
    const { value, errors } = engine.solveConsistencyGroup({ ...BASE, Qes: QES, Qms: QMS, Pe_W: 0 });
    assert.ok(value != null, 'value must not be null for Pe=0');
    const w = errors.find(e => e.field === 'Pe' && e.level === 'warn');
    assert.ok(w, 'must have a level:warn entry for Pe=0');
  });

  // ── edge cases ──────────────────────────────────────────────────────────────

  it('a Pe warn alone (all required fields present) does not block the value — warn ≠ error', () => {
    // The critical distinction: warn-level entries must NOT null the value.
    const { value, errors } = engine.solveConsistencyGroup({ ...BASE, Qes: QES, Qms: QMS, Pe_W: 0 });
    assert.ok(value != null, 'warn-only result must keep a usable value');
    assert.ok(!errors.some(e => e.level === 'error'), 'Pe=0 alone produces no error-level entry');
  });

  it('negative Fs is rejected the same as zero/absent — Fs must be strictly positive', () => {
    const { value, errors } = engine.solveConsistencyGroup({ ...BASE, Qes: QES, Qms: QMS, Fs_hz: -37 });
    assert.equal(value, null);
    assert.ok(errors.some(e => e.field === 'Fs' && e.level === 'error'), 'negative Fs must be an error');
  });

  it('negative Re is rejected — resistance must be strictly positive', () => {
    const { value, errors } = engine.solveConsistencyGroup({ ...BASE, Qes: QES, Qms: QMS, Re_ohm: -5.6 });
    assert.equal(value, null);
    assert.ok(errors.some(e => e.field === 'Re' && e.level === 'error'));
  });

  it('NaN Fs is rejected — NaN must not slip through the > 0 guard', () => {
    const { value, errors } = engine.solveConsistencyGroup({ ...BASE, Qes: QES, Qms: QMS, Fs_hz: NaN });
    assert.equal(value, null);
    assert.ok(errors.some(e => e.field === 'Fs' && e.level === 'error'));
  });

  it('multiple missing required fields accumulate one error entry per field — not just the first', () => {
    // Fs, Re, Sd, Vas all absent → four distinct error entries, all fields named.
    const { value, errors } = engine.solveConsistencyGroup({ Qes: QES, Qms: QMS });
    assert.equal(value, null);
    const errFields = new Set(errors.filter(e => e.level === 'error').map(e => e.field));
    for (const f of ['Fs', 'Re', 'Sd', 'Vas']) {
      assert.ok(errFields.has(f), `expected an error entry for ${f}; got fields ${[...errFields].join(', ')}`);
    }
  });

  it('a completely empty driver produces errors but never throws and never returns undefined', () => {
    const result = engine.solveConsistencyGroup({});
    assert.ok(result && Array.isArray(result.errors), 'must return {value, errors} even for {}');
    assert.equal(result.value, null);
    assert.ok(result.errors.length > 0, 'empty driver must report at least one error');
  });

  it('every error entry has field, level, and a non-empty human-readable message', () => {
    // Contract guarantee the UI relies on to render per-field messages.
    const { errors } = engine.solveConsistencyGroup({});
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
    const { value: d } = engine.solveConsistencyGroup({ ...BASE, Qes: QES, Qms: QMS });
    assert.ok(d);
    assert(
      Math.abs(d.Qts - QTS_DERIVED) < Q_TOL,
      `expected Qts = Qes·Qms/(Qes+Qms) = ${QTS_DERIVED}, got ${d.Qts}`,
    );
  });

  it('derives Qes from Qts and Qms when Qes is absent — '
   + 'inverse combination formula Qes = Qts·Qms / (Qms − Qts)', () => {
    const expectedQes = (QTS_DERIVED * QMS) / (QMS - QTS_DERIVED);
    const { value: d } = engine.solveConsistencyGroup({ ...BASE, Qts: QTS_DERIVED, Qms: QMS });
    assert.ok(d);
    assert(
      Math.abs(d.Qes - expectedQes) < Q_TOL,
      `expected Qes = ${expectedQes}, got ${d.Qes}`,
    );
  });

  it('derives Qms from Qts and Qes when Qms is absent — '
   + 'inverse combination formula Qms = Qts·Qes / (Qes − Qts)', () => {
    const expectedQms = (QTS_DERIVED * QES) / (QES - QTS_DERIVED);
    const { value: d } = engine.solveConsistencyGroup({ ...BASE, Qts: QTS_DERIVED, Qes: QES });
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
    const { value, errors } = engine.solveConsistencyGroup({ ...BASE, Qts: 0.5, Qms: 0.5 });
    assert.equal(value, null, 'a degenerate Qms == Qts driver must not derive');
    assert.ok(
      errors.some(e => e.level === 'error' && /Qms/.test(e.field + e.message)),
      'must report a blocking error naming Qms',
    );
  });

  it('rejects Qms < Qts (Qes absent) — Qes = Qts·Qms/(Qms−Qts) would go negative', () => {
    const { value, errors } = engine.solveConsistencyGroup({ ...BASE, Qts: 0.6, Qms: 0.4 });
    assert.equal(value, null, 'Qms < Qts is physically impossible; must not derive');
    assert.ok(errors.some(e => e.level === 'error'), 'must report a blocking error');
  });

  it('rejects Qes == Qts (Qms absent) — the symmetric divide-by-zero deriving Qms', () => {
    const { value, errors } = engine.solveConsistencyGroup({ ...BASE, Qts: 0.5, Qes: 0.5 });
    assert.equal(value, null, 'a degenerate Qes == Qts driver must not derive');
    assert.ok(
      errors.some(e => e.level === 'error' && /Qes/.test(e.field + e.message)),
      'must report a blocking error naming Qes',
    );
  });
});

describe('solveConsistencyGroup — full fixpoint solver mode', () => {
  // The DVol/Depth/MagDepth/Magnet geometry lock (WINISD_SCHEMA.md §3.10.1): any one member
  // solves from the other three plus Dd and Vcd. Geometry from dvolRelation.test.ts's worked
  // example — Dd 90mm, Vcd 25mm, Depth 55mm, MagDepth 20mm, Magnet 60mm.
  const GEOM = { Dd: 0.090, Vcd: 0.025, Depth: 0.055, MagDepth: 0.020, Magnet: 0.060 } as const;
  const DVOL = (Math.PI / 4) * ((0.090 ** 2 + 0.090 * 0.025 + 0.025 ** 2) * (0.055 - 0.020) / 3
    + 0.060 ** 2 * 0.020);

  it('solves DVol from Dd/Vcd/Depth/MagDepth/Magnet', () => {
    const res = engine.solveConsistencyGroup({ ...GEOM }) as Record<string, number>;
    assert.ok(Math.abs(res.DVol_m3 - DVOL) < 1e-9, `DVol must solve to ${DVOL}, got ${res.DVol_m3}`);
  });

  it('solves Depth back from the other four when DVol is entered', () => {
    const { Depth: _omitted, ...rest } = GEOM;
    const res = engine.solveConsistencyGroup({ ...rest, DVol: DVOL }) as Record<string, number>;
    assert.ok(Math.abs(res.Depth_m - 0.055) < 1e-9, `Depth must solve to 0.055, got ${res.Depth_m}`);
  });

  it('solves MagDepth back from the other four when DVol is entered', () => {
    const { MagDepth: _omitted, ...rest } = GEOM;
    const res = engine.solveConsistencyGroup({ ...rest, DVol: DVOL }) as Record<string, number>;
    assert.ok(Math.abs(res.MagDepth_m - 0.020) < 1e-9, `MagDepth must solve to 0.020, got ${res.MagDepth_m}`);
  });

  it('solves Magnet back from the other four when DVol is entered', () => {
    const { Magnet: _omitted, ...rest } = GEOM;
    const res = engine.solveConsistencyGroup({ ...rest, DVol: DVOL }) as Record<string, number>;
    assert.ok(Math.abs(res.Magnet_m - 0.060) < 1e-9, `Magnet must solve to 0.060, got ${res.Magnet_m}`);
  });

  it('an entered DVol is never overwritten by the derivation', () => {
    const res = engine.solveConsistencyGroup({ ...GEOM, DVol: 0.123 }) as Record<string, number>;
    assert.equal(res.DVol_m3, 0.123, 'entered values are pinned; the solver fills only absent members');
  });

  it('a degenerate geometry (Depth == MagDepth) yields no DVol rather than a junk value', () => {
    const res = engine.solveConsistencyGroup({ ...GEOM, Depth: 0.020 }) as Record<string, number>;
    assert.equal(res.DVol_m3, undefined, 'a non-positive cone height must not produce a DVol');
  });

  it('solves Hc bi-directionally when Hg and Xmax are provided (underhung default)', () => {
    const res = engine.solveConsistencyGroup({ Hg_m: 0.008, Xmax_m: 0.003 }) as Record<string, number>;
    assert.equal(res.Hc_m, 0.002, 'Hc must solve to Hg - 2*Xmax = 0.002 m');
  });

  it('solves Hg bi-directionally when Hc and Xmax are provided', () => {
    const res = engine.solveConsistencyGroup({ Hc_m: 0.015, Xmax_m: 0.005 }) as Record<string, number>;
    assert.ok(Math.abs(res.Hg_m - 0.005) < 1e-6, `Hg must solve to Hc - 2*Xmax = 0.005 m, got ${res.Hg_m}`);
  });


  it('prioritizes Row 6 (Dd -> Sd) over Row 20 (Vd/Xmax -> Sd)', () => {
    const res = engine.solveConsistencyGroup({ Dd_m: 0.200, Vd_m3: 0.0001, Xmax_m: 0.005 }) as Record<string, number>;
    const expectedSd = Math.PI * 0.100 ** 2; // ~0.0314159
    assert.ok(Math.abs(res.Sd_m2 - expectedSd) < 1e-6, `expected Row 6 Sd ~${expectedSd}, got ${res.Sd_m2}`);
  });

  it('executes a 4-hop multi-cascade derivation from minimal 6-input set', () => {
    const res = engine.solveConsistencyGroup({
      Fs_hz: 35.0,
      Qes: 0.40,
      Qms: 4.50,
      Vas_m3: 0.045,
      Re_ohm: 6.0,
      Dd_m: 0.210,
    }) as Record<string, number>;

    assert.ok(res.Sd_m2 > 0, 'Sd must be calculated (Hop 1)');
    assert.ok(res.Cms_m_per_N > 0, 'Cms must be calculated (Hop 2)');
    assert.ok(res.Mms_kg > 0, 'Mms must be calculated (Hop 3)');
    assert.ok(res.BL_Tm > 0, 'BL must be calculated (Hop 4)');
    assert.ok(res.Rms_kg_per_s > 0, 'Rms must be calculated (Hop 4)');
    assert.ok(res.Qts > 0, 'Qts must be calculated');
    assert.ok(res.no > 0, 'no must be calculated');
  });
});

// ── Fs route parity with WinISD — BUG_20260817 ──────────────────────────────
// WinISD derives Fs via exactly five routes, tried in this priority order (first whose
// inputs are all present wins — bugs/BUG_20260817_engine_is_missing_two_of_winisds_fs_routes_and_has_one_winisd_does_not.md):
//   1. rel 11  Fs = 1 / (2π·√(Mms·Cms))
//   2. rel 14  Fs = ∛(no·c³·Qes / (4π²·Vas))
//   3. rel 2   Fs = Qes·BL² / (2π·Mms·Re)
//   4. rel 4   Fs = Rme·Qes / (2π·Mms)
//   5. rel 12  Fs = EBP·Qes
// WinISD has no route deriving Fs from Rms/Qms/Mms — that direction must stay unfilled.
describe('solveConsistencyGroup — Fs route parity with WinISD (BUG_20260817)', () => {
  it('derives Fs from EBP + Qes (rel 12)', () => {
    const res = engine.solveConsistencyGroup({ EBP_hz: 207.77, Qes: 0.1925 }) as Record<string, number>;
    assert.ok(res.Fs_hz != null, 'Fs must be derived from EBP+Qes');
    assert.ok(Math.abs(res.Fs_hz - 40) < 0.01, `expected Fs ~40 from rel 12, got ${res.Fs_hz}`);
  });

  it('derives Fs from Rme + Qes + Mms (rel 4)', () => {
    const res = engine.solveConsistencyGroup({ Rme_kg_per_s: 2.54371, Qes: 0.1925, Mms_kg: 0.00195 }) as Record<string, number>;
    assert.ok(res.Fs_hz != null, 'Fs must be derived from Rme+Qes+Mms');
    assert.ok(Math.abs(res.Fs_hz - 40) < 0.05, `expected Fs ~40 from rel 4, got ${res.Fs_hz}`);
  });

  it('leaves Fs blank from Rms + Qms + Mms alone — WinISD has no such route', () => {
    const res = engine.solveConsistencyGroup({ Rms_kg_per_s: 0.2332, Qms: 2.1, Mms_kg: 0.00195 }) as Record<string, number>;
    assert.equal(res.Fs_hz, undefined, 'engine must not invent an Fs WinISD would leave blank');
  });

  it('prefers rel 14 (no/Qes/Vas) over rel 2 (Qes/BL/Re/Mms) when both are available and disagree', () => {
    const Qes = 0.4;
    const Vas = 0.045;
    const fs14 = 40;                       // the value rel 14 must produce
    const no = engine.referenceEfficiency(fs14, Vas, Qes, engine.airFor({}));

    // rel 2 inputs engineered to disagree with rel 14's answer (50 Hz instead of 40 Hz).
    const fs2 = 50;
    const Mms = 0.02;
    const Re = 6;
    const BL = Math.sqrt(2 * Math.PI * fs2 * Mms * Re / Qes);

    const res = engine.solveConsistencyGroup({ Qes, Vas, no, Mms, Re, BL }) as Record<string, number>;
    assert.ok(Math.abs(res.Fs_hz - fs14) < 1e-6, `rel 14 must win over rel 2, expected ${fs14}, got ${res.Fs_hz}`);
  });

  it('prefers rel 11 (Mms/Cms) over rel 14 (no/Qes/Vas) when both are available and disagree', () => {
    const Mms = 0.02;
    const Cms = 0.0008;
    const fs11 = 1 / (2 * Math.PI * Math.sqrt(Mms * Cms));   // rel 11's answer

    // rel 14 inputs engineered to disagree with rel 11's answer.
    const Qes = 0.4;
    const Vas = 0.045;
    const fs14 = fs11 * 1.5;
    const no = engine.referenceEfficiency(fs14, Vas, Qes, engine.airFor({}));

    const res = engine.solveConsistencyGroup({ Mms, Cms, Qes, Vas, no }) as Record<string, number>;
    assert.ok(Math.abs(res.Fs_hz - fs11) < 1e-6, `rel 11 must win over rel 14, expected ${fs11}, got ${res.Fs_hz}`);
  });

  it('prefers rel 2 (Qes/BL/Mms/Re) over rel 4 (Rme/Qes/Mms) when both are available and disagree', () => {
    const Qes = 0.4;
    const Mms = 0.02;
    const Re = 6;
    const fs2 = 50;                        // the value rel 2 must produce
    const BL = Math.sqrt(2 * Math.PI * fs2 * Mms * Re / Qes);

    // rel 4 inputs engineered to disagree with rel 2's answer (40 Hz instead of 50 Hz).
    const fs4 = 40;
    const Rme = (2 * Math.PI * fs4 * Mms) / Qes;

    const res = engine.solveConsistencyGroup({ Qes, Mms, Re, BL, Rme }) as Record<string, number>;
    assert.ok(Math.abs(res.Fs_hz - fs2) < 1e-6, `rel 2 must win over rel 4, expected ${fs2}, got ${res.Fs_hz}`);
  });

  it('prefers rel 4 (Rme/Qes/Mms) over rel 12 (EBP/Qes) when both are available and disagree', () => {
    const Qes = 0.4;
    const Mms = 0.02;
    const fs4 = 40;                        // the value rel 4 must produce
    const Rme = (2 * Math.PI * fs4 * Mms) / Qes;

    // rel 12 inputs engineered to disagree with rel 4's answer (50 Hz instead of 40 Hz).
    const fs12 = 50;
    const EBP = fs12 / Qes;

    const res = engine.solveConsistencyGroup({ Qes, Mms, Rme, EBP }) as Record<string, number>;
    assert.ok(Math.abs(res.Fs_hz - fs4) < 1e-6, `rel 4 must win over rel 12, expected ${fs4}, got ${res.Fs_hz}`);
  });

  it('a route ready in pass 1 locks Fs even against a higher-priority route whose input (Cms) is not derived until a later block — WinISD\'s own guard chain has the same lockout (RE_GHIDRA_FINDINGS.md "Fs priority settled STATICALLY": the rel 11 Fs guard is at 0x45f0d6; Cms\'s compute site 0x45f6f7 — winisd_research/scripts/relation_routes.py:40 — sits AFTER it, and every block re-tests Fs for still-unset before writing it)', () => {
    const Mms = 0.02;
    const Re = 6;
    const Qes = 0.4;
    const Sd = 0.05;

    // rel 2 inputs, ready immediately: Fs = Qes·BL²/(2π·Mms·Re) = 50.
    const fs2 = 50;
    const BL = Math.sqrt(2 * Math.PI * fs2 * Mms * Re / Qes);

    // rel 11 inputs: Cms is NOT entered directly — it is only derivable from Vas/Sd in a
    // later block, so it is not ready when the Fs block runs in pass 1. Vas is chosen so
    // that block 4 WOULD derive the Cms that makes rel 11 answer 40, if it got the chance.
    const fs11 = 40;
    const Cms = 1 / ((2 * Math.PI * fs11) ** 2 * Mms);
    const rho = driverRho();
    const c = driverC();
    const Vas = Cms * rho * c * c * Sd * Sd;

    const res = engine.solveConsistencyGroup({ Mms, Re, Qes, Sd, BL, Vas }) as Record<string, number>;
    assert.ok(Math.abs(res.Fs_hz - fs2) < 1e-6, `rel 2 must lock Fs at ${fs2} before rel 11's Cms is ready, got ${res.Fs_hz}`);
    assert.notEqual(Math.round(res.Fs_hz), fs11, 'rel 11 must NOT win merely because it has the higher static priority');
  });
});




