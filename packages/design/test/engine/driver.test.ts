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

import {describe, it} from 'vitest';
import type {TestSolverQuantities} from './testSolver.js';
import {solveConsistencyGroup} from './testSolver.js';
import assert from 'node:assert/strict';
import {Engine} from "../../engine/index.js";

/** The engine's one door: every calculation below is a method on this object. */
const engine = new Engine();

// A driver record stating no `c`/`roo` of its own takes the live physical model at the
// reference environment — the same air `airFor({})` reports.
const driverC   = (): number => engine.solveEnvironment({}).values.c;
const driverRho = (): number => engine.solveEnvironment({}).values.rho;

describe('solveConsistencyGroup — full fixpoint solver mode', () => {
  // The DVol/Depth/MagDepth/Magnet geometry lock (WINISD_SCHEMA.md §3.10.1): any one member
  // solves from the other three plus Dd and Vcd. Geometry from dvolRelation.test.ts's worked
  // example — Dd 90mm, Vcd 25mm, Depth 55mm, MagDepth 20mm, Magnet 60mm.
  const GEOM = { Dd_m: 0.090, Vcd_m: 0.025, Depth_m: 0.055, MagDepth_m: 0.020, Magnet_m: 0.060 } as const;
  const DVOL = (Math.PI / 4) * ((0.090 ** 2 + 0.090 * 0.025 + 0.025 ** 2) * (0.055 - 0.020) / 3
    + 0.060 ** 2 * 0.020);

  it('solves DVol from Dd/Vcd/Depth/MagDepth/Magnet', () => {
    const res = solveConsistencyGroup({ ...GEOM }) as Record<string, number>;
    assert.ok(Math.abs(res.DVol_m3 - DVOL) < 1e-9, `DVol must solve to ${DVOL}, got ${res.DVol_m3}`);
  });

  it('solves Depth back from the other four when DVol is entered', () => {
    const { Depth_m: _omitted, ...rest } = GEOM;
    const res = solveConsistencyGroup({ ...rest, DVol_m3: DVOL }) as Record<string, number>;
    assert.ok(Math.abs(res.Depth_m - 0.055) < 1e-9, `Depth must solve to 0.055, got ${res.Depth_m}`);
  });

  it('solves MagDepth back from the other four when DVol is entered', () => {
    const { MagDepth_m: _omitted, ...rest } = GEOM;
    const res = solveConsistencyGroup({ ...rest, DVol_m3: DVOL }) as Record<string, number>;
    assert.ok(Math.abs(res.MagDepth_m - 0.020) < 1e-9, `MagDepth must solve to 0.020, got ${res.MagDepth_m}`);
  });

  it('solves Magnet back from the other four when DVol is entered', () => {
    const { Magnet_m: _omitted, ...rest } = GEOM;
    const res = solveConsistencyGroup({ ...rest, DVol_m3: DVOL }) as Record<string, number>;
    assert.ok(Math.abs(res.Magnet_m - 0.060) < 1e-9, `Magnet must solve to 0.060, got ${res.Magnet_m}`);
  });

  it('an entered DVol is never overwritten by the derivation', () => {
    const res = solveConsistencyGroup({ ...GEOM, DVol_m3: 0.123 }) as Record<string, number>;
    assert.equal(res.DVol_m3, 0.123, 'entered values are pinned; the solver fills only absent members');
  });

  it('a degenerate geometry (Depth == MagDepth) yields no DVol rather than a junk value', () => {
    const res = solveConsistencyGroup({ ...GEOM, Depth_m: 0.020 }) as Record<string, number>;
    assert.equal(res.DVol_m3, undefined, 'a non-positive cone height must not produce a DVol');
  });

  it('solves Hc bi-directionally when Hg and Xmax are provided (underhung default)', () => {
    const res = solveConsistencyGroup({ Hg_m: 0.008, Xmax_m: 0.003 }) as Record<string, number>;
    assert.equal(res.Hc_m, 0.002, 'Hc must solve to Hg - 2*Xmax = 0.002 m');
  });

  it('solves Hg bi-directionally when Hc and Xmax are provided', () => {
    const res = solveConsistencyGroup({ Hc_m: 0.015, Xmax_m: 0.005 }) as Record<string, number>;
    assert.ok(Math.abs(res.Hg_m - 0.005) < 1e-6, `Hg must solve to Hc - 2*Xmax = 0.005 m, got ${res.Hg_m}`);
  });

  it('prioritizes Row 6 (Dd -> Sd) over Row 20 (Vd/Xmax -> Sd)', () => {
    const res = solveConsistencyGroup({ Dd_m: 0.200, Vd_m3: 0.0001, Xmax_m: 0.005 }) as Record<string, number>;
    const expectedSd = Math.PI * 0.100 ** 2; // ~0.0314159
    assert.ok(Math.abs(res.Sd_m2 - expectedSd) < 1e-6, `expected Row 6 Sd ~${expectedSd}, got ${res.Sd_m2}`);
  });

  it('executes a 4-hop multi-cascade derivation from minimal 6-input set', () => {
    const res = solveConsistencyGroup({ Fs_hz: 35.0, Qes: 0.40, Qms: 4.50, Vas_m3: 0.045, Re_ohm: 6.0, Dd_m: 0.210 }) as Record<string, number>;

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
    const res = solveConsistencyGroup({ EBP_hz: 207.77, Qes: 0.1925 }) as Record<string, number>;
    assert.ok(res.Fs_hz != null, 'Fs must be derived from EBP+Qes');
    assert.ok(Math.abs(res.Fs_hz - 40) < 0.01, `expected Fs ~40 from rel 12, got ${res.Fs_hz}`);
  });

  it('derives Fs from Rme + Qes + Mms (rel 4)', () => {
    const res = solveConsistencyGroup({ Rme_kg_per_s: 2.54371, Qes: 0.1925, Mms_kg: 0.00195 }) as Record<string, number>;
    assert.ok(res.Fs_hz != null, 'Fs must be derived from Rme+Qes+Mms');
    assert.ok(Math.abs(res.Fs_hz - 40) < 0.05, `expected Fs ~40 from rel 4, got ${res.Fs_hz}`);
  });

  it('leaves Fs blank from Rms + Qms + Mms alone — WinISD has no such route', () => {
    const res = solveConsistencyGroup({ Rms_kg_per_s: 0.2332, Qms: 2.1, Mms_kg: 0.00195 }) as Record<string, number>;
    assert.equal(res.Fs_hz, undefined, 'engine must not invent an Fs WinISD would leave blank');
  });

  it('prefers rel 14 (no/Qes/Vas) over rel 2 (Qes/BL/Re/Mms) when both are available and disagree', () => {
    const Qes = 0.4;
    const Vas = 0.045;
    const fs14 = 40;                       // the value rel 14 must produce
    const no = engine.referenceEfficiency(fs14, Vas, Qes, engine.solveEnvironment({}).values);

    // rel 2 inputs engineered to disagree with rel 14's answer (50 Hz instead of 40 Hz).
    const fs2 = 50;
    const Mms = 0.02;
    const Re = 6;
    const BL = Math.sqrt(2 * Math.PI * fs2 * Mms * Re / Qes);

    const res = solveConsistencyGroup({ Qes, Vas_m3: Vas, no, Mms_kg: Mms, Re_ohm: Re, BL_Tm: BL }) as Record<string, number>;
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
    const no = engine.referenceEfficiency(fs14, Vas, Qes, engine.solveEnvironment({}).values);

    const res = solveConsistencyGroup({ Mms_kg: Mms, Cms_m_per_N: Cms, Qes, Vas_m3: Vas, no }) as Record<string, number>;
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

    const res = solveConsistencyGroup({ Qes, Mms_kg: Mms, Re_ohm: Re, BL_Tm: BL, Rme_kg_per_s: Rme }) as Record<string, number>;
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

    const res = solveConsistencyGroup({ Qes, Mms_kg: Mms, Rme_kg_per_s: Rme, EBP_hz: EBP }) as Record<string, number>;
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

    const res = solveConsistencyGroup({ Mms_kg: Mms, Re_ohm: Re, Qes, Sd_m2: Sd, BL_Tm: BL, Vas_m3: Vas }) as Record<string, number>;
    assert.ok(Math.abs(res.Fs_hz - fs2) < 1e-6, `rel 2 must lock Fs at ${fs2} before rel 11's Cms is ready, got ${res.Fs_hz}`);
    assert.notEqual(Math.round(res.Fs_hz), fs11, 'rel 11 must NOT win merely because it has the higher static priority');
  });
});


// ── Vas route parity with WinISD — FINDING-027/028 ─────────────────────────
// Live probe, winisd_research/toys/probe_vas_route_precedence.py (2026-09-13): when Vas is
// cleared, WinISD refills it through the EFFICIENCY group first (rel 14, no/Qes/Fs at
// 0x45fdd8) and only falls back to the compliance group (rel 10, Cms/Sd at 0x45fe70) when
// `no` is underivable. And `no` itself is derivable from BL/Sd/Mms/Re (rel 15, 0x45fc3b)
// BEFORE the Vas sites run, so a `no`-less record with full mechanical data still resolves
// its Vas from efficiency.
//
// The three probe scenes, reproduced with the genuine W5-1138SMF field values. Expected
// values are the WinISD-saved literals at the engine's own reference air (c=343.6826980479399,
// rho=1.20096212152557 — exactly what the genuine /tmp/w5-oid-vas_calculated-Fb_refreshed.wpr
// stores): maybe `no` entered (FINDING-027), `no` absent so rel 15 fills it then rel 14 wins
// (FINDING-028 no_absent_full), `no` underivable so rel 10 is the last resort (compliance_only).
describe('solveConsistencyGroup — Vas route parity with WinISD (FINDING-027/028)', () => {
  // Tang Band W5-1138SMF, datasheet-verbatim values (2026-09-13 pdftotext).
  const W5 = {
    Fs_hz: 45, Qes: 0.57, Qms: 3.56, Cms_m_per_N: 0.00036872, Sd_m2: 0.0094,
    Mms_kg: 0.02881, BL_Tm: 7.17, Re_ohm: 3.4, Znom: 4, Le_H: 0.00034, Xmax_m: 0.00925,
  } as const;
  // WinISD's own stored efficiency value for this record (the W5 save), as a FRACTION.
  const NO_WINISD = 0.000895200585183395;

  // Oracle literals at the engine's default air (airFor({}) = c 343.6826980479.../rho 1.2009621215):
  //   rel 14 (entered no): V = no·Qes/(K(c)·Fs³)        = 0.005757990477296902 m³ (WinISD saved 5.7579904772969 L)
  //   rel 15 (BL/Sd/Mms/Re): no = ρ/(2πc)·BL²·Sd²/(Re·Mms²) = 0.0008952005851833956
  //   rel 14 (from rel-15 no):                          = 0.005757990477296906
  //   rel 10 (Cms/Sd):        V = ρ·c²·Sd²·Cms           = 0.004621649972016005
  const VAS_EFF_ENTERED = 0.005757990477296902;
  const VAS_EFF_RE15    = 0.005757990477296906;
  const NO_RE15         = 0.0008952005851833956;
  const VAS_COMPLIANCE  = 0.004621649972016005;

  it('a cleared Vas refills via rel 14 (no/Qes/Fs), beating rel 10 (Cms/Sd) when `no` is entered — FINDING-027', () => {
    const res = solveConsistencyGroup({ ...W5, no: NO_WINISD }) as Record<string, number>;
    assert.ok(Math.abs(res.Vas_m3 - VAS_EFF_ENTERED) <= VAS_EFF_ENTERED * 1e-12,
      `Vas must solve to rel 14 ${VAS_EFF_ENTERED}, got ${res.Vas_m3}`);
    assert.notEqual(Math.round(res.Vas_m3 * 1e3), Math.round(VAS_COMPLIANCE * 1e3),
      'the compliance route 4.62 L must NOT win while rel 14 can fire');
  });

  it('a `no`-less driver with BL/Sd/Mms/Re present derives `no` via rel 15, THEN Vas via rel 14 — FINDING-028 no_absent_full', () => {
    const res = solveConsistencyGroup({ ...W5 }) as Record<string, number>;
    assert.ok(res.no != null, 'no must be derivable from BL/Sd/Mms/Re even when absent (rel 15)');
    assert.ok(Math.abs(res.no - NO_RE15) <= NO_RE15 * 1e-12,
      `no must come from rel 15 (BL/Sd/Mms/Re) = ${NO_RE15}, got ${res.no}`);
    assert.ok(Math.abs(res.Vas_m3 - VAS_EFF_RE15) <= VAS_EFF_RE15 * 1e-12,
      `Vas must then be rel 14 from that no = ${VAS_EFF_RE15}, got ${res.Vas_m3}`);
  });

  it('falls back to rel 10 (Cms/Sd) only when `no` is underivable — FINDING-028 compliance_only', () => {
    // Exactly the probe's compliance_only scene: Cms/Sd/Fs/Qes/Qms but no BL, Mms, Re, no, SPL.
    const complianceOnly: TestSolverQuantities = {
      Fs_hz: W5.Fs_hz, Qes: W5.Qes, Qms: W5.Qms,
      Cms_m_per_N: W5.Cms_m_per_N, Sd_m2: W5.Sd_m2,
    };
    const res = solveConsistencyGroup(complianceOnly) as Record<string, number>;
    assert.ok(Math.abs(res.Vas_m3 - VAS_COMPLIANCE) <= VAS_COMPLIANCE * 1e-12,
      `Vas must fall back to rel 10 ${VAS_COMPLIANCE}, got ${res.Vas_m3}`);
    // WinISD then derives `no` from Fs/Qes/Vas off the compliance Vas — the probe's saved no
    // 0.000718523656549444. Spot-check the same happens here.
    assert.ok(res.no != null, 'no still derives from Fs/Qes/Vas once the compliance Vas exists');
    const noFromCompliance = engine.referenceEfficiency(
      W5.Fs_hz, VAS_COMPLIANCE, W5.Qes, engine.solveEnvironment({}).values);
    assert.ok(Math.abs(res.no - noFromCompliance) <= noFromCompliance * 1e-12,
      `no must be η₀ of the compliance Vas, got ${res.no}`);
  });

  it('an ENTERED Vas is never overwritten, even when the efficiency group disagrees', () => {
    const entered = 0.00485; // the datasheet's own stated Vas
    const res = solveConsistencyGroup({ ...W5, no: NO_WINISD, Vas_m3: entered }) as Record<string, number>;
    assert.equal(res.Vas_m3, entered, 'a stated Vas is pinned; the solver fills only absent members');
  });
});


describe('relation 24 — semi-inductance, KLe = Le·√(2π·fLe)', () => {
  // WinISD relates these three: John verified it by hand against real WinISD, 2026-08-31, and
  // docs/design/WINISD_SCHEMA.md §rel-24 records the formula as read directly from WinISD's
  // calculation engine. Bug: bugs/BUG_20260831_the_solver_omits_relation_24_so_KLe_is_never_
  // computed_from_Le_and_fLe.md
  it('computes KLe from a stated Le and fLe', () => {
    
    const Le_H = 0.0012; const fLe_hz = 1000; const res = solveConsistencyGroup({ Le_H, fLe_hz });

    assert.ok(res.KLe_H_sqrtHz !== undefined, 'KLe is derived, not left absent');
    assert.ok(Math.abs(res.KLe_H_sqrtHz! - Le_H * Math.sqrt(2 * Math.PI * fLe_hz)) < 1e-12,
      `KLe = Le·√(2π·fLe); got ${res.KLe_H_sqrtHz}`);
  });

  it('is ONE-DIRECTIONAL: a stated KLe never produces Le or fLe', () => {
    // WINISD_SCHEMA.md §rel-24: "One direction only. Nothing anywhere calculates Le or fLe,
    // which is why both are always either typed in or absent." Deriving them would invent
    // provenance WinISD never claims, and this is the assertion that stops a later
    // "symmetrical" rewrite.
    const res = solveConsistencyGroup({ KLe_H_sqrtHz: 0.0951, fLe_hz: 1000 });

    assert.equal(res.Le_H, undefined, 'Le is never computed');

    const other = solveConsistencyGroup({ KLe_H_sqrtHz: 0.0951, Le_H: 0.0012 });
    assert.equal(other.fLe_hz, undefined, 'fLe is never computed');
  });

  it('leaves KLe absent when either input is missing, rather than guessing a default', () => {
    const noFLe = solveConsistencyGroup({ Le_H: 0.0012 });
    assert.equal(noFLe.KLe_H_sqrtHz, undefined, 'no fLe, no KLe');

    const noLe = solveConsistencyGroup({ fLe_hz: 1000 });
    assert.equal(noLe.KLe_H_sqrtHz, undefined, 'no Le, no KLe');
  });

  it('does not overwrite a KLe the record already states', () => {
    const stated = 0.05;
    const res = solveConsistencyGroup(
      { Le_H: 0.0012, fLe_hz: 1000, KLe_H_sqrtHz: stated });

    assert.equal(res.KLe_H_sqrtHz, stated, 'a stated value wins over a derived one');
  });
});
