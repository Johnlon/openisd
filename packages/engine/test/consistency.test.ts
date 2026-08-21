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
import { checkConsistency, moistAirDensity, moistAirSoundVelocity, T_REF_K, RH_REF_PCT, P_REF_PA, qGroupIsIncomplete } from '@openisd/engine';

// DEMO carries no c/roo, so production resolves it live at the reference environment
// (driver.ts's driverRho/driverC) -- matched here the same way, never a stored constant.
const refRho = (): number => moistAirDensity(T_REF_K, RH_REF_PCT, P_REF_PA);
const refC = (): number => moistAirSoundVelocity(T_REF_K, RH_REF_PCT, P_REF_PA);

/** The app's demo driver: self-consistent, and over-determined by construction. */
const DEMO = { Fs: 37, Qts: 0.378, Qes: 0.40, Qms: 7.0, Vas: 0.0300, Sd: 0.0133, Re: 5.6, Le: 0.70e-3, Xmax: 0.0050, Pe: 60 };

const fieldsOf = (issues: { fields: readonly string[] }[]): string[][] =>
  issues.map(i => [...i.fields].sort());

describe('checkConsistency — a group that reconciles is silent', () => {
  it('reports nothing for the demo driver', () => {
    assert.deepEqual(checkConsistency(DEMO), []);
  });

  it('reports nothing when a group is OVER-DETERMINED but still reconciles', () => {
    // Every derivable member entered as well as its inputs. Qts/Qes/Qms, Vas/Cms/Sd and
    // Fs/Mms/Cms are each fully entered and each self-consistent, so nothing disagrees and
    // no mark is due — over-determination on its own is not a defect.
    const Cms = DEMO.Vas / (refRho() * refC() * refC() * DEMO.Sd * DEMO.Sd);
    const Mms = 1 / ((2 * Math.PI * DEMO.Fs) ** 2 * Cms);
    const over = { ...DEMO, Cms, Mms,
                   Rms: 2 * Math.PI * DEMO.Fs * Mms / DEMO.Qms,
                   Bl: Math.sqrt(2 * Math.PI * DEMO.Fs * Mms * DEMO.Re / DEMO.Qes) };
    assert.deepEqual(checkConsistency(over), []);
  });

  it('reports nothing when the disagreement is inside the recorded precision', () => {
    // Qts recorded to 3 dp asserts ±0.0005; Qes and Qms to 2 dp and 1 dp assert far more.
    // 0.378 vs the exact 0.3783783… is well within that, so the trio is consistent.
    assert.deepEqual(checkConsistency({ Qts: 0.378, Qes: 0.40, Qms: 7.0 }), []);
  });
});

describe('checkConsistency — a group that does not reconcile marks EVERY member', () => {
  it('marks all three Q fields when Qts contradicts Qes and Qms', () => {
    // Qes·Qms/(Qes+Qms) = 0.37838; 0.500 is 32% away, which no rounding of 3, 2 and 1
    // recorded decimals can explain.
    const issues = checkConsistency({ Qts: 0.500, Qes: 0.40, Qms: 7.0 });
    assert.equal(issues.length, 1);
    assert.deepEqual(fieldsOf(issues), [['Qes', 'Qms', 'Qts']]);
    assert.equal(issues[0].target, 'Qts');
    assert.ok(issues[0].relative > 0.2, `relative ${issues[0].relative}`);
  });

  it('names the group and the size of the disagreement, not just "inconsistent"', () => {
    const [issue] = checkConsistency({ Qts: 0.500, Qes: 0.40, Qms: 7.0 });
    assert.equal(issue.formula, 'Qts = Qes·Qms/(Qes+Qms)');
    assert.ok(Math.abs(issue.expected - 0.4 * 7 / 7.4) < 1e-12);
    assert.equal(issue.actual, 0.5);
  });

  it('marks Vas, Cms and Sd together when the compliance volume contradicts them', () => {
    const Cms = 0.0013;
    const Sd = 0.0133;
    const Vas = refRho() * refC() * refC() * Sd * Sd * Cms * 1.2;   // 20% out — far beyond 4 dp on Vas
    const issues = checkConsistency({ Fs: 37, Re: 5.6, Qes: 0.4, Qms: 7, Vas, Sd, Cms });
    assert.ok(fieldsOf(issues).some(f => f.join() === ['Cms', 'Sd', 'Vas'].sort().join()),
      `expected the Vas group among ${JSON.stringify(fieldsOf(issues))}`);
  });
});

describe('checkConsistency — QO12: entering Mms alongside Fs and Cms', () => {
  // The case the human ruled on, measured live 2026-08-05: the demo driver with Mms typed as
  // 30 g. Fs stays entered, Cms stays computed from Vas and Sd, and Bl/Rms are recomputed from
  // the impossible Mms. The over-determination is only a defect BECAUSE it contradicts, and
  // the contradiction is what the detector reports.
  const poisoned = { ...DEMO, Mms: 0.030 };

  it('marks Fs, Mms and Cms', () => {
    const issues = checkConsistency(poisoned);
    assert.deepEqual(fieldsOf(issues), [['Cms', 'Fs', 'Mms']]);
  });

  it('states how far out the group is', () => {
    const [issue] = checkConsistency(poisoned);
    assert.equal(issue.formula, 'Fs = 1/(2π·√(Mms·Cms))');
    // Fs implied by 30 g and the driver's own Cms is ~26.6 Hz against the entered 37.
    assert.ok(issue.expected > 26 && issue.expected < 27, `expected ${issue.expected}`);
    assert.ok(issue.relative > 0.25, `relative ${issue.relative}`);
  });

  it('says nothing before Mms is typed — the same driver, still over-determined', () => {
    assert.deepEqual(checkConsistency(DEMO), []);
  });
});

describe('checkConsistency — the recorded precision decides, not the size of the gap', () => {
  // The SAME 0.43% disagreement in the Q trio, recorded two ways. A tolerance chosen as a
  // number would have to call both of these the same; the members' own digits do not.
  it('is silent when the members are recorded to 2 decimals', () => {
    // Qes·Qms/(Qes+Qms) = 0.37838, and 0.38 at 2 dp asserts only ±0.005 — five times the gap.
    assert.deepEqual(checkConsistency({ Qts: 0.38, Qes: 0.40, Qms: 7.0 }), []);
  });

  it('marks the group when the same gap is recorded to 6 decimals', () => {
    // 0.401234 and 7.01234 imply Qts = 0.379519; 0.381151 is the same 0.43% out, but at 6 dp
    // every member asserts ±5e-7, so the record genuinely claims two different numbers.
    const issues = checkConsistency({ Qts: 0.381151, Qes: 0.401234, Qms: 7.01234 });
    assert.deepEqual(fieldsOf(issues), [['Qes', 'Qms', 'Qts']]);
  });
});

describe('qGroupIsIncomplete — the group needs two of three to solve the third', () => {
  it('is incomplete with zero usable members', () => {
    assert.equal(qGroupIsIncomplete(() => false), true);
  });

  it('is incomplete with exactly one usable member', () => {
    const usable = new Set(['Qts']);
    assert.equal(qGroupIsIncomplete(f => usable.has(f)), true);
  });

  it('is complete with exactly two usable members', () => {
    const usable = new Set(['Qes', 'Qms']);
    assert.equal(qGroupIsIncomplete(f => usable.has(f)), false);
  });

  it('is complete with all three usable', () => {
    assert.equal(qGroupIsIncomplete(() => true), false);
  });
});
