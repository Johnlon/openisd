/**
 * Unit tests for packages/engine/src/consistency.ts — the consistency-group detector.
 *
 * The two behaviours the human ruled on (workspace ledger QP18, openisd ledger QO12) are the
 * same remedy through one mechanism: when a WINISD_SCHEMA §4 group loses consistency, EVERY
 * member of that group is marked, and nothing is blocked.
 *
 * The tolerance is not a chosen number — it is each field's own precision, half of the last
 * significant decimal of the value as stored, propagated into the computed fields. So the
 * boundary cases below are written by CHOOSING the recorded precision, not by tuning a limit.
 */

import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { Engine } from '../../engine/index.js';
import type { SolverQuantities } from '../../engine/index.js';

/** The engine's one door: every calculation below is a method on this object. */
const engine = new Engine();

// DEMO carries no c/roo, so production resolves it live at the reference environment
// -- matched here the same way, never a stored constant.
const refRho = (): number => engine.airFor({}).rho;
const refC = (): number => engine.airFor({}).c;

/** The app's demo driver: self-consistent, and over-determined by construction. */
const DEMO = { Fs_hz: 37, Qts: 0.378, Qes: 0.40, Qms: 7.0, Vas_m3: 0.0300, Sd_m2: 0.0133, Re_ohm: 5.6, Le_H: 0.70e-3, Xmax_m: 0.0050, Pe_W: 60 } satisfies SolverQuantities;

const fieldsOf = (issues: { fields: readonly string[] }[]): string[][] =>
  issues.map(i => [...i.fields].sort());

describe('checkConsistency — a group that reconciles is silent', () => {
  it('reports nothing for the demo driver', () => {
    assert.deepEqual(engine.checkConsistency(DEMO), []);
  });

  it('reports nothing when a group is OVER-DETERMINED but still reconciles', () => {
    // Every derivable member entered as well as its inputs. Qts/Qes/Qms, Vas/Cms/Sd and
    // Fs/Mms/Cms are each fully entered and each self-consistent, so nothing disagrees and
    // no mark is due — over-determination on its own is not a defect.
    const Cms = DEMO.Vas_m3 / (refRho() * refC() * refC() * DEMO.Sd_m2 * DEMO.Sd_m2);
    const Mms = 1 / ((2 * Math.PI * DEMO.Fs_hz) ** 2 * Cms);
    const over: SolverQuantities = {
      ...DEMO, Cms_m_per_N: Cms, Mms_kg: Mms,
      Rms_kg_per_s: 2 * Math.PI * DEMO.Fs_hz * Mms / DEMO.Qms,
      BL_Tm: Math.sqrt(2 * Math.PI * DEMO.Fs_hz * Mms * DEMO.Re_ohm / DEMO.Qes),
    };
    assert.deepEqual(engine.checkConsistency(over), []);
  });

  it('reports nothing when the disagreement is inside the recorded precision', () => {
    // Qts recorded to 3 dp asserts ±0.0005; Qes and Qms to 2 dp and 1 dp assert far more.
    // 0.378 vs the exact 0.3783783… is well within that, so the trio is consistent.
    assert.deepEqual(engine.checkConsistency({ Qts: 0.378, Qes: 0.40, Qms: 7.0 }), []);
  });
});

describe('checkConsistency — a group that does not reconcile marks EVERY member', () => {
  it('marks all three Q fields when Qts contradicts Qes and Qms', () => {
    // Qes·Qms/(Qes+Qms) = 0.37838; 0.500 is 32% away, which no rounding of 3, 2 and 1
    // recorded decimals can explain.
    const issues = engine.checkConsistency({ Qts: 0.500, Qes: 0.40, Qms: 7.0 });
    assert.equal(issues.length, 1);
    assert.deepEqual(fieldsOf(issues), [['Qes', 'Qms', 'Qts']]);
    assert.equal(issues[0].target, 'Qts');
    assert.ok(issues[0].relative > 0.2, `relative ${issues[0].relative}`);
  });

  it('names the group and the size of the disagreement, not just "inconsistent"', () => {
    const [issue] = engine.checkConsistency({ Qts: 0.500, Qes: 0.40, Qms: 7.0 });
    assert.equal(issue.formula, 'Qts = Qes·Qms/(Qes+Qms)');
    assert.ok(Math.abs(issue.expected - 0.4 * 7 / 7.4) < 1e-12);
    assert.equal(issue.actual, 0.5);
  });

  it('marks Vas, Cms and Sd together when the compliance volume contradicts them', () => {
    const Cms = 0.0013;
    const Sd = 0.0133;
    const Vas = refRho() * refC() * refC() * Sd * Sd * Cms * 1.2;   // 20% out — far beyond 4 dp on Vas
    const issues = engine.checkConsistency({
      Fs_hz: 37, Re_ohm: 5.6, Qes: 0.4, Qms: 7, Vas_m3: Vas, Sd_m2: Sd, Cms_m_per_N: Cms });
    assert.ok(fieldsOf(issues).some(f => f.join() === ['Cms_m_per_N', 'Sd_m2', 'Vas_m3'].sort().join()),
      `expected the Vas group among ${JSON.stringify(fieldsOf(issues))}`);
  });
});

describe('checkConsistency — QO12: entering Mms alongside Fs and Cms', () => {
  // The case the human ruled on, measured live 2026-08-05: the demo driver with Mms typed as
  // 30 g. Fs stays entered, Cms stays computed from Vas and Sd, and Bl/Rms are recomputed from
  // the impossible Mms. The over-determination is only a defect BECAUSE it contradicts, and
  // the contradiction is what the detector reports.
  const poisoned: SolverQuantities = { ...DEMO, Mms_kg: 0.030 };

  it('marks Fs, Mms and Cms', () => {
    const issues = engine.checkConsistency(poisoned);
    assert.deepEqual(fieldsOf(issues), [['Cms_m_per_N', 'Fs_hz', 'Mms_kg']]);
  });

  it('states how far out the group is', () => {
    const [issue] = engine.checkConsistency(poisoned);
    assert.equal(issue.formula, 'Fs = 1/(2π·√(Mms·Cms))');
    // Fs implied by 30 g and the driver's own Cms is ~26.6 Hz against the entered 37.
    assert.ok(issue.expected > 26 && issue.expected < 27, `expected ${issue.expected}`);
    assert.ok(issue.relative > 0.25, `relative ${issue.relative}`);
  });

  it('says nothing before Mms is typed — the same driver, still over-determined', () => {
    assert.deepEqual(engine.checkConsistency(DEMO), []);
  });
});

describe('checkConsistency — the recorded precision decides, not the size of the gap', () => {
  // The SAME 0.43% disagreement in the Q trio, recorded two ways. A tolerance chosen as a
  // number would have to call both of these the same; the members' own digits do not.
  it('is silent when the members are recorded to 2 decimals', () => {
    // Qes·Qms/(Qes+Qms) = 0.37838, and 0.38 at 2 dp asserts only ±0.005 — five times the gap.
    assert.deepEqual(engine.checkConsistency({ Qts: 0.38, Qes: 0.40, Qms: 7.0 }), []);
  });

  it('marks the group when the same gap is recorded to 6 decimals', () => {
    // 0.401234 and 7.01234 imply Qts = 0.379519; 0.381151 is the same 0.43% out, but at 6 dp
    // every member asserts ±5e-7, so the record genuinely claims two different numbers.
    const issues = engine.checkConsistency({ Qts: 0.381151, Qes: 0.401234, Qms: 7.01234 });
    assert.deepEqual(fieldsOf(issues), [['Qes', 'Qms', 'Qts']]);
  });
});

describe('checkConsistency — §4 rel-25: the DVol/Depth/MagDepth/Magnet geometry lock', () => {
  // Worked geometry from WINISD_SCHEMA.md §3.10.1 / dvolRelation.test.ts: Dd 90mm, Vcd 25mm,
  // Depth 55mm, MagDepth 20mm, Magnet 60mm. DVOL is the exact §3.10.1 formula over those five.
  const GEOM = { Dd_m: 0.090, Vcd_m: 0.025, Depth_m: 0.055, MagDepth_m: 0.020, Magnet_m: 0.060 };
  const DVOL = (Math.PI / 4) * ((GEOM.Dd_m ** 2 + GEOM.Dd_m * GEOM.Vcd_m + GEOM.Vcd_m ** 2) * (GEOM.Depth_m - GEOM.MagDepth_m) / 3
    + GEOM.Magnet_m ** 2 * GEOM.MagDepth_m);

  it('is silent when the carried DVol agrees with the §3.10.1 derivation', () => {
    assert.deepEqual(engine.checkConsistency({ ...GEOM, DVol_m3: DVOL }), []);
  });

  it('flags DVol, naming the group, when the carried value disagrees', () => {
    const issues = engine.checkConsistency({ ...GEOM, DVol_m3: DVOL * 1.5 });
    assert.equal(issues.length, 1);
    assert.deepEqual(fieldsOf(issues), [['DVol_m3', 'Dd_m', 'Depth_m', 'MagDepth_m', 'Magnet_m', 'Vcd_m']]);
    assert.equal(issues[0].target, 'DVol_m3');
    assert.equal(issues[0].formula, 'DVol = (π/4)·[ (Dd²+Dd·Vcd+Vcd²)·(Depth−MagDepth)/3 + Magnet²·MagDepth ]');
    assert.ok(Math.abs(issues[0].expected - DVOL) < 1e-9, `expected ${issues[0].expected}`);
    assert.equal(issues[0].actual, DVOL * 1.5);
    assert.ok(issues[0].relative > 0.3, `relative ${issues[0].relative}`);
  });

  it('is silent when DVol is absent — no derivation to disagree with', () => {
    assert.deepEqual(engine.checkConsistency({ ...GEOM }), []);
  });

  it('is silent when the geometry inputs are insufficient to derive DVol', () => {
    const { Magnet_m: _omitted, ...rest } = GEOM;
    assert.deepEqual(engine.checkConsistency({ ...rest, DVol_m3: DVOL }), []);
  });

  it('is silent on a degenerate geometry (Depth ≤ MagDepth) rather than a junk expected value', () => {
    assert.deepEqual(engine.checkConsistency({ ...GEOM, MagDepth_m: 0.060, DVol_m3: DVOL }), []);
  });
});

describe('qGroupIsIncomplete — the group needs two of three to solve the third', () => {
  it('is incomplete with zero usable members', () => {
    assert.equal(engine.qGroupIsIncomplete(() => false), true);
  });

  it('is incomplete with exactly one usable member', () => {
    const usable = new Set(['Qts']);
    assert.equal(engine.qGroupIsIncomplete(f => usable.has(f)), true);
  });

  it('is complete with exactly two usable members', () => {
    const usable = new Set(['Qes', 'Qms']);
    assert.equal(engine.qGroupIsIncomplete(f => usable.has(f)), false);
  });

  it('is complete with all three usable', () => {
    assert.equal(engine.qGroupIsIncomplete(() => true), false);
  });
});

describe('checkConsistency — the η₀ reference-efficiency relation (D18)', () => {
  // no = efficiencyConstant(c)·Fs³·Vas/Qes — the WinISD-verified route (a Wine probe of real
  // WinISD matched this form to 0.000000% on its own saved `no`; winisd_research
  // scripts/probe_rme_beyma.py). Values below are self-consistent by construction.
  const consistent = { Fs_hz: 28, Vas_m3: 0.028, Qes: 0.4,
    no: (4 * Math.PI * Math.PI / (343.6826980479399 ** 3)) * 28 ** 3 * 0.028 / 0.4,
  } satisfies SolverQuantities;

  it('a consistent no/Fs/Vas/Qes group is silent', () => {
    assert.deepEqual(engine.checkConsistency(consistent), []);
  });

  it('an inconsistent no marks the group', () => {
    const off = { ...consistent, no: consistent.no * 1.5 } satisfies SolverQuantities;
    const marks = engine.checkConsistency(off);
    assert.equal(marks.length > 0, true, 'a 50%-off no must not pass silently');
    assert.equal(marks.some(m => m.target === 'no' && m.fields.includes('no')), true, 'the no group is the one marked');
  });
});

describe('checkConsistency — the EBP relation (§4 row 12, BUG_20260821)', () => {
  // EBP = Fs/Qes — the derivation route solver.ts rel 12 already uses (Fs = EBP·Qes).
  it('a consistent EBP/Fs/Qes group is silent', () => {
    assert.deepEqual(engine.checkConsistency({ Fs_hz: 28, Qes: 0.4, EBP_hz: 70 }), []);
  });

  it('an inconsistent EBP marks the group', () => {
    const marks = engine.checkConsistency({ Fs_hz: 28, Qes: 0.4, EBP_hz: 120 });
    assert.equal(marks.length > 0, true, 'EBP=120 against Fs/Qes implying 70 must not pass silently');
    assert.equal(marks.some(m => m.target === 'EBP_hz' && m.fields.includes('EBP_hz')), true);
  });
});
