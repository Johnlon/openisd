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

describe('Rme', () => {
  describe('Rme — the two routes, and which one wins', () => {
    it('takes 2π·Fs·Mms/Qes (18.22124), NOT Bl²/Re (18.27846), when both are available', () => {
      const r = solve({ ...BEYMA });
      assert.ok(Math.abs(derived(r.Rme_kg_per_s, 'Rme_kg_per_s') - 18.2212373908208) < 1e-9, `Rme = ${r.Rme_kg_per_s}`);
      assert.ok(Math.abs(derived(r.Rme_kg_per_s, 'Rme_kg_per_s') - 18.27846153846154) > 0.05, 'Rme must not have come from Bl²/Re');
    });

    it('falls back to Bl²/Re when the motional route is short of an input', () => {
      const r = solve({ BL_Tm: BEYMA.BL_Tm, Re_ohm: BEYMA.Re_ohm });
      assert.ok(Math.abs(derived(r.Rme_kg_per_s, 'Rme_kg_per_s') - 18.27846153846154) < 1e-9, `Rme = ${r.Rme_kg_per_s}`);
    });

    it('is absent when neither route can be evaluated', () => {
      assert.equal(solve({ Fs_hz: 29, Mms_kg: 0.044 }).Rme_kg_per_s, undefined);
    });

    it('never overwrites an entered Rme — WinISD fixed-E semantics', () => {
      assert.equal(solve({ ...BEYMA, Rme_kg_per_s: 99 }).Rme_kg_per_s, 99);
    });
  });
});
