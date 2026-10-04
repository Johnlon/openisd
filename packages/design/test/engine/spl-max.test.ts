import type {TestSolverQuantities} from './testSolver.js';
import {solveConsistencyGroup} from './testSolver.js';
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';

/** Beyma 10BR60/V2, the real fixture whose stored Bl disagrees with its own Fs/Mms/Re/Qes. */
const BEYMA: TestSolverQuantities = {
  Fs_hz: 29.0, Mms_kg: 0.044, Cms_m_per_N: 0.000693, Rms_kg_per_s: 2.4,
  BL_Tm: 10.9, Re_ohm: 6.5, Qes: 0.44, Qms: 3.3, Sd_m2: 0.038,
};

// TYPED, not `Record<string, number>` with a cast on each end. The cast this replaces made every
// name in this file invisible to the compiler: stale keys went in, matched nothing, and every
// derived figure came back `undefined` while the suite still built.
const solve = (d: TestSolverQuantities): Readonly<TestSolverQuantities> =>
  solveConsistencyGroup(d);

/** A figure the solver was expected to derive. Every `any` member is optional —
 *  absent means "not derived" — so reading one for an assertion has to say which it is. A missing
 *  derivation then fails as `Rme_kg_per_s was not derived`, where bare arithmetic on `undefined`
 *  yielded a NaN comparison and a message that named no cause. */
function derived(v: number | undefined, name: string): number {
  assert.ok(v !== undefined, `${name} was not derived`);
  return v;
}

describe('Mpow, gamma, SPLmax and USPL', () => {
  describe('Mpow, gamma', () => {
    // Mpow = Bl/√Re, NOT √Rme — recovered from the `inconsistent-fs` parity golden
    // (packages/winisd/test/fixtures/winisd-parity/goldens/inconsistent-fs.wpr), whose stored
    // `Fs` is written at exactly twice its true value, separating the two routes (they agree on
    // every self-consistent record, including BEYMA below — which is why this needs its own
    // discriminator). WinISD wrote `Rme=17.578125`, `Mpow=2.96463530640786` on that record;
    // `Bl/√Re` matches to the last digit, `√Rme` (4.1926274578121) does not. See
    // bugs/archive/BUG_20260813_mpow-uses-sqrt-rme-where-winisd-uses-bl-over-sqrt-re.md.
    it('Mpow is Bl/√Re, NOT √Rme — the two happen to agree on BEYMA, so this only pins the value', () => {
      const r = solve({ ...BEYMA });
      assert.ok(Math.abs(derived(r.Mpow_N_per_sqrtW, 'Mpow_N_per_sqrtW') - derived(BEYMA.BL_Tm, 'BL_Tm') / Math.sqrt(derived(BEYMA.Re_ohm, 'Re_ohm'))) < 1e-12, `Mpow = ${r.Mpow_N_per_sqrtW}`);
      assert.ok(Math.abs(derived(r.Mpow_N_per_sqrtW, 'Mpow_N_per_sqrtW') - 4.275331746012412) < 1e-9);
    });

    it('Mpow = Bl/√Re disagrees with √Rme on a record whose stored Fs contradicts Mms·Cms', () => {
      // The `inconsistent-fs` discriminator, transcribed: Fs stored at 2×true, Bl=7.5, Re=6.4,
      // Qes=0.41220376440829154, Mms=0.0155 — WinISD's own Rme/Mpow pair for this record.
      const r = solve({ Fs_hz: 74.4, Mms_kg: 0.0155, Qes: 0.41220376440829154, BL_Tm: 7.5, Re_ohm: 6.4 });
      assert.ok(Math.abs(derived(r.Rme_kg_per_s, 'Rme_kg_per_s') - 17.578125) < 1e-9, `Rme = ${r.Rme_kg_per_s}`);
      assert.ok(Math.abs(derived(r.Mpow_N_per_sqrtW, 'Mpow_N_per_sqrtW') - 2.96463530640786) < 1e-9, `Mpow = ${r.Mpow_N_per_sqrtW}`);
      assert.ok(Math.abs(derived(r.Mpow_N_per_sqrtW, 'Mpow_N_per_sqrtW') - Math.sqrt(derived(r.Rme_kg_per_s, 'Rme_kg_per_s'))) > 1, '√Rme must NOT be the answer here');
    });

    it('falls back to √Rme when Bl is absent', () => {
      const r = solve({ Fs_hz: BEYMA.Fs_hz, Mms_kg: BEYMA.Mms_kg, Qes: BEYMA.Qes });
      assert.ok(Math.abs(derived(r.Mpow_N_per_sqrtW, 'Mpow_N_per_sqrtW') - Math.sqrt(derived(r.Rme_kg_per_s, 'Rme_kg_per_s'))) < 1e-12, `Mpow = ${r.Mpow_N_per_sqrtW}, √Rme = ${Math.sqrt(derived(r.Rme_kg_per_s, 'Rme_kg_per_s'))}`);
    });

    it('gamma = Bl/Mms', () => {
      const r = solve({ ...BEYMA });
      assert.ok(Math.abs(derived(r.gamma_m_per_s2_A, 'gamma_m_per_s2_A') - 10.9 / 0.044) < 1e-9, `gamma = ${r.gamma_m_per_s2_A}`);
    });

    it('neither overwrites an entered value', () => {
      const r = solve({ ...BEYMA, Mpow_N_per_sqrtW: 7, gamma_m_per_s2_A: 11 });
      assert.equal(r.Mpow_N_per_sqrtW, 7);
      assert.equal(r.gamma_m_per_s2_A, 11);
    });
  });

  describe('SPLmax and USPL — both offsets from the ONE reference base', () => {
    // Vas and Pe complete the efficiency chain; the reference SPL itself comes from
    // efficiency.ts (via `no` → `SPLref`), which is what these two are offsets from when the
    // record carries no STATED `SPL` (BEYMA does not, so `SPLref` is the base here too).
    const FULL = { ...BEYMA, Vas_m3: 0.055, Pe_W: 300 };

    // Both formulas corrected 2026-08-14 — the code used to read `SPLref + 10·log₁₀(8/Re)` /
    // `SPLref + 10·log₁₀(Pe)` (no derating). Recovered from the `winisd-parity` goldens:
    // predicting each golden's own `USPL`/`SPLmax` from its stated `SPL` and `Re`/`Pe` with
    // `2.83²` (not the bare `8`) and a flat `−3` dB agrees with WinISD's stored values to
    // 4.3e-14 / 0 and 4.3e-15 relative respectively, on every golden available. See
    // bugs/archive/BUG_20260813_uspl-and-splmax-use-formulas-winisd-does-not-2p83-volts-and-a-3db-derating.md.
    it('SPLmax = SPLref + 10·log₁₀(Pe) − 3 dB', () => {
      const r = solve({ ...FULL });
      assert.ok(derived(r.SPLref_dB, 'SPLref_dB') > 0, 'the reference sensitivity must have been derived first');
      assert.ok(Math.abs((derived(r.SPLmax_dB, 'SPLmax_dB') - derived(r.SPLref_dB, 'SPLref_dB')) - (10 * Math.log10(300) - 3)) < 1e-12, `SPLmax = ${r.SPLmax_dB}`);
    });

    it('USPL = SPLref + 10·log₁₀(2.83²/Re) — 2.83² = 8.0089, NOT the bare 8', () => {
      const r = solve({ ...FULL });
      assert.ok(Math.abs((derived(r.USPL_dB, 'USPL_dB') - derived(r.SPLref_dB, 'SPLref_dB')) - 10 * Math.log10(2.83 * 2.83 / derived(BEYMA.Re_ohm, 'Re_ohm'))) < 1e-12, `USPL = ${r.USPL_dB}`);
      // The two constants are close enough to look interchangeable but are not: on this
      // record the bare-8 formula would be off by 0.0048 dB, well outside float noise.
      assert.ok(Math.abs((derived(r.USPL_dB, 'USPL_dB') - derived(r.SPLref_dB, 'SPLref_dB')) - 10 * Math.log10(8 / derived(BEYMA.Re_ohm, 'Re_ohm'))) > 1e-4,
        'USPL must not have come from the bare-8 formula');
    });

    it('USPL/SPLmax prefer a STATED SPL over the η₀-derived SPLref, when the record carries one', () => {
      // A stated SPL (the record's own `SPL` key, entered — as a WDR's `SPL=` line arrives) is
      // WinISD's own base, and disagrees with the η₀-derived SPLref on a real record exactly
      // the way `sealed-small`'s golden does (SPL=90 stated vs SPLref=87.65068346041753 derived).
      const withStated = solve({ ...FULL, SPL_dB: 90 });
      assert.ok(Math.abs(derived(withStated.SPLref_dB, 'SPLref_dB') - 90) > 0.1, 'SPLref must stay the η₀-derived value, not 90');
      assert.ok(Math.abs((derived(withStated.USPL_dB, 'USPL_dB') - 90) - 10 * Math.log10(2.83 * 2.83 / derived(BEYMA.Re_ohm, 'Re_ohm'))) < 1e-12,
        `USPL = ${withStated.USPL_dB}, must be based on the stated SPL (90), not SPLref`);
      assert.ok(Math.abs((derived(withStated.SPLmax_dB, 'SPLmax_dB') - 90) - (10 * Math.log10(300) - 3)) < 1e-12,
        `SPLmax = ${withStated.SPLmax_dB}, must be based on the stated SPL (90), not SPLref`);
    });

    it('SPLmax needs Pe — a driver without a power rating gets no SPLmax rather than a guess', () => {
      const { Pe_W, ...noPower } = FULL;
      assert.equal(Pe_W, 300);
      assert.equal(solve(noPower).SPLmax_dB, undefined);
    });
  });
});
