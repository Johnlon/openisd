import {describe, it} from 'vitest';
import type {TestSolverQuantities} from './testSolver.js';
import {solveConsistencyGroup} from './testSolver.js';
import assert from 'node:assert/strict';
import {createEngine} from '../../engine/index.js';

/** The engine's one door: every calculation below is a method on this object. */
const engine = createEngine();

/** Every `TestSolverQuantities` member is optional, since a solve fills only what it can. A
 *  test that reaches for one arithmetically has already asserted (or is about to assert) that
 *  the solve produced it — this makes that assumption a loud failure instead of a silent
 *  `undefined - x = NaN`. */
function num(v: number | undefined): number {
  assert.ok(v !== undefined, 'expected a solved numeric value, got undefined');
  return v;
}

// A driver record stating no `c`/`roo` of its own takes WinISD's air model at the
// reference environment — the same air `airFor({})` reports.
const driverC   = (): number => engine.environment.solve({}).values.c;

const driverRho = (): number => engine.environment.solve({}).values.rho;

describe('driver Fs and Vas route parity with WinISD', () => {
  // ── Fs route parity with WinISD — BUG_20260817 ──────────────────────────────
  // WinISD derives Fs via exactly five routes, tried in this priority order (first whose
  // inputs are all present wins — bugs/archive/BUG_20260817_engine_is_missing_two_of_winisds_fs_routes_and_has_one_winisd_does_not.md):
  //   1. rel 11  Fs = 1 / (2π·√(Mms·Cms))
  //   2. rel 14  Fs = ∛(no·c³·Qes / (4π²·Vas))
  //   3. rel 2   Fs = Qes·BL² / (2π·Mms·Re)
  //   4. rel 4   Fs = Rme·Qes / (2π·Mms)
  //   5. rel 12  Fs = EBP·Qes
  // WinISD has no route deriving Fs from Rms/Qms/Mms — that direction must stay unfilled.
  describe('solveConsistencyGroup — Fs route parity with WinISD', () => {
    it('derives Fs from EBP + Qes (rel 12)', () => {
      const res = solveConsistencyGroup({ EBP_hz: 207.77, Qes: 0.1925 });
      assert.ok(res.Fs_hz != null, 'Fs must be derived from EBP+Qes');
      assert.ok(Math.abs(num(res.Fs_hz) - 40) < 0.01, `expected Fs ~40 from rel 12, got ${res.Fs_hz}`);
    });

    it('derives Fs from Rme + Qes + Mms (rel 4)', () => {
      const res = solveConsistencyGroup({ Rme_kg_per_s: 2.54371, Qes: 0.1925, Mms_kg: 0.00195 });
      assert.ok(res.Fs_hz != null, 'Fs must be derived from Rme+Qes+Mms');
      assert.ok(Math.abs(num(res.Fs_hz) - 40) < 0.05, `expected Fs ~40 from rel 4, got ${res.Fs_hz}`);
    });

    it('leaves Fs blank from Rms + Qms + Mms alone — WinISD has no such route', () => {
      const res = solveConsistencyGroup({ Rms_kg_per_s: 0.2332, Qms: 2.1, Mms_kg: 0.00195 });
      assert.equal(res.Fs_hz, undefined, 'engine must not invent an Fs WinISD would leave blank');
    });

    it('prefers rel 14 (no/Qes/Vas) over rel 2 (Qes/BL/Re/Mms) when both are available and disagree', () => {
      const Qes = 0.4;
      const Vas = 0.045;
      const fs14 = 40;                       // the value rel 14 must produce
      const no = engine.driver.referenceEfficiency(fs14, Vas, Qes, engine.environment.solve({}).values);

      // rel 2 inputs engineered to disagree with rel 14's answer (50 Hz instead of 40 Hz).
      const fs2 = 50;
      const Mms = 0.02;
      const Re = 6;
      const BL = Math.sqrt(2 * Math.PI * fs2 * Mms * Re / Qes);

      const res = solveConsistencyGroup({ Qes, Vas_m3: Vas, no, Mms_kg: Mms, Re_ohm: Re, BL_Tm: BL });
      assert.ok(Math.abs(num(res.Fs_hz) - fs14) < 1e-6, `rel 14 must win over rel 2, expected ${fs14}, got ${res.Fs_hz}`);
    });

    it('prefers rel 11 (Mms/Cms) over rel 14 (no/Qes/Vas) when both are available and disagree', () => {
      const Mms = 0.02;
      const Cms = 0.0008;
      const fs11 = 1 / (2 * Math.PI * Math.sqrt(Mms * Cms));   // rel 11's answer

      // rel 14 inputs engineered to disagree with rel 11's answer.
      const Qes = 0.4;
      const Vas = 0.045;
      const fs14 = fs11 * 1.5;
      const no = engine.driver.referenceEfficiency(fs14, Vas, Qes, engine.environment.solve({}).values);

      const res = solveConsistencyGroup({ Mms_kg: Mms, Cms_m_per_N: Cms, Qes, Vas_m3: Vas, no });
      assert.ok(Math.abs(num(res.Fs_hz) - fs11) < 1e-6, `rel 11 must win over rel 14, expected ${fs11}, got ${res.Fs_hz}`);
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

      const res = solveConsistencyGroup({ Qes, Mms_kg: Mms, Re_ohm: Re, BL_Tm: BL, Rme_kg_per_s: Rme });
      assert.ok(Math.abs(num(res.Fs_hz) - fs2) < 1e-6, `rel 2 must win over rel 4, expected ${fs2}, got ${res.Fs_hz}`);
    });

    it('prefers rel 4 (Rme/Qes/Mms) over rel 12 (EBP/Qes) when both are available and disagree', () => {
      const Qes = 0.4;
      const Mms = 0.02;
      const fs4 = 40;                        // the value rel 4 must produce
      const Rme = (2 * Math.PI * fs4 * Mms) / Qes;

      // rel 12 inputs engineered to disagree with rel 4's answer (50 Hz instead of 40 Hz).
      const fs12 = 50;
      const EBP = fs12 / Qes;

      const res = solveConsistencyGroup({ Qes, Mms_kg: Mms, Rme_kg_per_s: Rme, EBP_hz: EBP });
      assert.ok(Math.abs(num(res.Fs_hz) - fs4) < 1e-6, `rel 4 must win over rel 12, expected ${fs4}, got ${res.Fs_hz}`);
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

      const res = solveConsistencyGroup({ Mms_kg: Mms, Re_ohm: Re, Qes, Sd_m2: Sd, BL_Tm: BL, Vas_m3: Vas });
      assert.ok(Math.abs(num(res.Fs_hz) - fs2) < 1e-6, `rel 2 must lock Fs at ${fs2} before rel 11's Cms is ready, got ${res.Fs_hz}`);
      assert.notEqual(Math.round(num(res.Fs_hz)), fs11, 'rel 11 must NOT win merely because it has the higher static priority');
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
      // The W5 .wdr states its own air (winisd_drivers db), and WinISD's saved Vas was computed in it.
      c_m_per_s: 343.6826980479399, roo_kg_per_m3: 1.2009621215255684,
    } as const;
    // WinISD's own stored efficiency value for this record (the W5 save), as a FRACTION.
    const NO_WINISD = 0.000895200585183395;

    // Oracle literals at the record's own air (c 343.6826980479.../rho 1.2009621215):
    //   rel 14 (entered no): V = no·Qes/(K(c)·Fs³)        = 0.005757990477296902 m³ (WinISD saved 5.7579904772969 L)
    //   rel 15 (BL/Sd/Mms/Re): no = ρ/(2πc)·BL²·Sd²/(Re·Mms²) = 0.0008952005851833956
    //   rel 14 (from rel-15 no):                          = 0.005757990477296906
    //   rel 10 (Cms/Sd):        V = ρ·c²·Sd²·Cms           = 0.004621649972016005
    const VAS_EFF_ENTERED = 0.005757990477296902;
    const VAS_EFF_RE15    = 0.005757990477296906;
    const NO_RE15         = 0.0008952005851833956;
    const VAS_COMPLIANCE  = 0.004621649972016005;

    it('a cleared Vas refills via rel 14 (no/Qes/Fs), beating rel 10 (Cms/Sd) when `no` is entered — FINDING-027', () => {
      const res = solveConsistencyGroup({ ...W5, no: NO_WINISD });
      assert.ok(Math.abs(num(res.Vas_m3) - VAS_EFF_ENTERED) <= VAS_EFF_ENTERED * 1e-12,
        `Vas must solve to rel 14 ${VAS_EFF_ENTERED}, got ${res.Vas_m3}`);
      assert.notEqual(Math.round(num(res.Vas_m3) * 1e3), Math.round(VAS_COMPLIANCE * 1e3),
        'the compliance route 4.62 L must NOT win while rel 14 can fire');
    });

    it('a `no`-less driver with BL/Sd/Mms/Re present derives `no` via rel 15, THEN Vas via rel 14 — FINDING-028 no_absent_full', () => {
      const res = solveConsistencyGroup({ ...W5 });
      assert.ok(res.no != null, 'no must be derivable from BL/Sd/Mms/Re even when absent (rel 15)');
      assert.ok(Math.abs(num(res.no) - NO_RE15) <= NO_RE15 * 1e-12,
        `no must come from rel 15 (BL/Sd/Mms/Re) = ${NO_RE15}, got ${res.no}`);
      assert.ok(Math.abs(num(res.Vas_m3) - VAS_EFF_RE15) <= VAS_EFF_RE15 * 1e-12,
        `Vas must then be rel 14 from that no = ${VAS_EFF_RE15}, got ${res.Vas_m3}`);
    });

    it('falls back to rel 10 (Cms/Sd) only when `no` is underivable — FINDING-028 compliance_only', () => {
      // Exactly the probe's compliance_only scene: Cms/Sd/Fs/Qes/Qms but no BL, Mms, Re, no, SPL.
      const complianceOnly: TestSolverQuantities = {
        Fs_hz: W5.Fs_hz, Qes: W5.Qes, Qms: W5.Qms,
        Cms_m_per_N: W5.Cms_m_per_N, Sd_m2: W5.Sd_m2,
      };
      const res = solveConsistencyGroup(complianceOnly);
      assert.ok(Math.abs(num(res.Vas_m3) - VAS_COMPLIANCE) <= VAS_COMPLIANCE * 1e-12,
        `Vas must fall back to rel 10 ${VAS_COMPLIANCE}, got ${res.Vas_m3}`);
      // WinISD then derives `no` from Fs/Qes/Vas off the compliance Vas — the probe's saved no
      // 0.000718523656549444. Spot-check the same happens here.
      assert.ok(res.no != null, 'no still derives from Fs/Qes/Vas once the compliance Vas exists');
      const noFromCompliance = engine.driver.referenceEfficiency(
        W5.Fs_hz, VAS_COMPLIANCE, W5.Qes, engine.environment.solve({}).values);
      assert.ok(Math.abs(num(res.no) - noFromCompliance) <= noFromCompliance * 1e-12,
        `no must be η₀ of the compliance Vas, got ${res.no}`);
    });

    it('an ENTERED Vas is never overwritten, even when the efficiency group disagrees', () => {
      const entered = 0.00485; // the datasheet's own stated Vas
      const res = solveConsistencyGroup({ ...W5, no: NO_WINISD, Vas_m3: entered });
      assert.equal(res.Vas_m3, entered, 'a stated Vas is pinned; the solver fills only absent members');
    });
  });
});
