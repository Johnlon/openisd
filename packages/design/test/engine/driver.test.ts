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
import { Engine } from '../../engine';

/** The engine's one door: every calculation below is a method on this object. */
const engine = new Engine();

// A driver record stating no `c`/`roo` of its own takes the live physical model at the
// reference environment — the same air `airFor({})` reports.
const driverC   = (): number => engine.airFor({}).c;
const driverRho = (): number => engine.airFor({}).rho;

describe('solveConsistencyGroup — full fixpoint solver mode', () => {
  // The DVol/Depth/MagDepth/Magnet geometry lock (WINISD_SCHEMA.md §3.10.1): any one member
  // solves from the other three plus Dd and Vcd. Geometry from dvolRelation.test.ts's worked
  // example — Dd 90mm, Vcd 25mm, Depth 55mm, MagDepth 20mm, Magnet 60mm.
  const GEOM = { Dd_m: 0.090, Vcd_m: 0.025, Depth_m: 0.055, MagDepth_m: 0.020, Magnet_m: 0.060 } as const;
  const DVOL = (Math.PI / 4) * ((0.090 ** 2 + 0.090 * 0.025 + 0.025 ** 2) * (0.055 - 0.020) / 3
    + 0.060 ** 2 * 0.020);

  it('solves DVol from Dd/Vcd/Depth/MagDepth/Magnet', () => {
    const res = engine.solveConsistencyGroup({ ...GEOM }) as Record<string, number>;
    assert.ok(Math.abs(res.DVol_m3 - DVOL) < 1e-9, `DVol must solve to ${DVOL}, got ${res.DVol_m3}`);
  });

  it('solves Depth back from the other four when DVol is entered', () => {
    const { Depth_m: _omitted, ...rest } = GEOM;
    const res = engine.solveConsistencyGroup({ ...rest, DVol_m3: DVOL }) as Record<string, number>;
    assert.ok(Math.abs(res.Depth_m - 0.055) < 1e-9, `Depth must solve to 0.055, got ${res.Depth_m}`);
  });

  it('solves MagDepth back from the other four when DVol is entered', () => {
    const { MagDepth_m: _omitted, ...rest } = GEOM;
    const res = engine.solveConsistencyGroup({ ...rest, DVol_m3: DVOL }) as Record<string, number>;
    assert.ok(Math.abs(res.MagDepth_m - 0.020) < 1e-9, `MagDepth must solve to 0.020, got ${res.MagDepth_m}`);
  });

  it('solves Magnet back from the other four when DVol is entered', () => {
    const { Magnet_m: _omitted, ...rest } = GEOM;
    const res = engine.solveConsistencyGroup({ ...rest, DVol_m3: DVOL }) as Record<string, number>;
    assert.ok(Math.abs(res.Magnet_m - 0.060) < 1e-9, `Magnet must solve to 0.060, got ${res.Magnet_m}`);
  });

  it('an entered DVol is never overwritten by the derivation', () => {
    const res = engine.solveConsistencyGroup({ ...GEOM, DVol_m3: 0.123 }) as Record<string, number>;
    assert.equal(res.DVol_m3, 0.123, 'entered values are pinned; the solver fills only absent members');
  });

  it('a degenerate geometry (Depth == MagDepth) yields no DVol rather than a junk value', () => {
    const res = engine.solveConsistencyGroup({ ...GEOM, Depth_m: 0.020 }) as Record<string, number>;
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
    const res = engine.solveConsistencyGroup({ Fs_hz: 35.0, Qes: 0.40, Qms: 4.50, Vas_m3: 0.045, Re_ohm: 6.0, Dd_m: 0.210 }) as Record<string, number>;

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

    const res = engine.solveConsistencyGroup({ Qes, Vas_m3: Vas, no, Mms_kg: Mms, Re_ohm: Re, BL_Tm: BL }) as Record<string, number>;
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

    const res = engine.solveConsistencyGroup({ Mms_kg: Mms, Cms_m_per_N: Cms, Qes, Vas_m3: Vas, no }) as Record<string, number>;
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

    const res = engine.solveConsistencyGroup({ Qes, Mms_kg: Mms, Re_ohm: Re, BL_Tm: BL, Rme_kg_per_s: Rme }) as Record<string, number>;
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

    const res = engine.solveConsistencyGroup({ Qes, Mms_kg: Mms, Rme_kg_per_s: Rme, EBP_hz: EBP }) as Record<string, number>;
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

    const res = engine.solveConsistencyGroup({ Mms_kg: Mms, Re_ohm: Re, Qes, Sd_m2: Sd, BL_Tm: BL, Vas_m3: Vas }) as Record<string, number>;
    assert.ok(Math.abs(res.Fs_hz - fs2) < 1e-6, `rel 2 must lock Fs at ${fs2} before rel 11's Cms is ready, got ${res.Fs_hz}`);
    assert.notEqual(Math.round(res.Fs_hz), fs11, 'rel 11 must NOT win merely because it has the higher static priority');
  });
});


describe('relation 24 — semi-inductance, KLe = Le·√(2π·fLe)', () => {
  // WinISD relates these three: John verified it by hand against real WinISD, 2026-08-31, and
  // docs/design/WINISD_SCHEMA.md §rel-24 records the formula as read directly from WinISD's
  // calculation engine. Bug: bugs/BUG_20260831_the_solver_omits_relation_24_so_KLe_is_never_
  // computed_from_Le_and_fLe.md
  it('computes KLe from a stated Le and fLe', () => {
    const Le_H = 0.0012;
    const fLe_hz = 1000;

    const res = new Engine().solveConsistencyGroup({ Le_H, fLe_hz });

    assert.ok(res.KLe_H_sqrtHz !== undefined, 'KLe is derived, not left absent');
    assert.ok(Math.abs(res.KLe_H_sqrtHz! - Le_H * Math.sqrt(2 * Math.PI * fLe_hz)) < 1e-12,
      `KLe = Le·√(2π·fLe); got ${res.KLe_H_sqrtHz}`);
  });

  it('is ONE-DIRECTIONAL: a stated KLe never produces Le or fLe', () => {
    // WINISD_SCHEMA.md §rel-24: "One direction only. Nothing anywhere calculates Le or fLe,
    // which is why both are always either typed in or absent." Deriving them would invent
    // provenance WinISD never claims, and this is the assertion that stops a later
    // "symmetrical" rewrite.
    const res = new Engine().solveConsistencyGroup({ KLe_H_sqrtHz: 0.0951, fLe_hz: 1000 });

    assert.equal(res.Le_H, undefined, 'Le is never computed');

    const other = new Engine().solveConsistencyGroup({ KLe_H_sqrtHz: 0.0951, Le_H: 0.0012 });
    assert.equal(other.fLe_hz, undefined, 'fLe is never computed');
  });

  it('leaves KLe absent when either input is missing, rather than guessing a default', () => {
    const noFLe = new Engine().solveConsistencyGroup({ Le_H: 0.0012 });
    assert.equal(noFLe.KLe_H_sqrtHz, undefined, 'no fLe, no KLe');

    const noLe = new Engine().solveConsistencyGroup({ fLe_hz: 1000 });
    assert.equal(noLe.KLe_H_sqrtHz, undefined, 'no Le, no KLe');
  });

  it('flags a stated KLe that contradicts a stated Le and fLe', () => {
    // John, 2026-08-31: "yes if things dont add up we want the screen to [carry] a mark", and it
    // is the general rule for every derivation, not a special case for this one. A relation the
    // solver can compute is a relation that can be CONTRADICTED, and a contradiction nothing
    // reports is a driver quietly simulating on numbers that disagree with each other.
    const Le_H = 0.0012;
    const fLe_hz = 1000;
    const trueKLe = Le_H * Math.sqrt(2 * Math.PI * fLe_hz);

    const issues = new Engine().checkConsistency(
      { Le_H, fLe_hz, KLe_H_sqrtHz: trueKLe * 2 });

    assert.ok(issues.some(i => i.fields.includes('KLe_H_sqrtHz')),
      `a KLe twice its own Le/fLe must be flagged; got ${JSON.stringify(issues)}`);
  });

  it('does not flag a KLe that agrees with its Le and fLe', () => {
    const Le_H = 0.0012;
    const fLe_hz = 1000;

    const issues = new Engine().checkConsistency(
      { Le_H, fLe_hz, KLe_H_sqrtHz: Le_H * Math.sqrt(2 * Math.PI * fLe_hz) });

    assert.deepEqual(issues.filter(i => i.fields.includes('KLe_H_sqrtHz')), [],
      'a consistent trio is silent');
  });

  it('does not overwrite a KLe the record already states', () => {
    const stated = 0.05;
    const res = new Engine().solveConsistencyGroup(
      { Le_H: 0.0012, fLe_hz: 1000, KLe_H_sqrtHz: stated });

    assert.equal(res.KLe_H_sqrtHz, stated, 'a stated value wins over a derived one');
  });
});
