import type {TestSolverQuantities} from './testSolver.js';
import {solveConsistencyGroup} from './testSolver.js';
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';

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

describe('Xmax route precedence', () => {
  describe('Xmax route precedence is on the RESULT, not the route ', () => {
    it('an equal overhang is not an excursion limit — it falls through to Vd/Sd', () => {
      // Hc === Hg makes abs(Hc-Hg)/2 zero. WinISD does not accept that as Xmax; it uses the
      // other route. Expected value is independent of the code: 140e-6 / 0.0095.
      const r = solve({ Hc_m: 0.012, Hg_m: 0.012, Vd_m3: 140e-6, Sd_m2: 0.0095 });
      assert.ok(Math.abs(derived(r.Xmax_m, 'Xmax_m') - 140e-6 / 0.0095) < 1e-15, `Xmax was ${r.Xmax_m}`);
    });

    it('an unequal overhang wins over Vd/Sd', () => {
      const r = solve({ Hc_m: 0.0176, Hg_m: 0.006, Vd_m3: 140e-6, Sd_m2: 0.0095 });
      assert.ok(Math.abs(derived(r.Xmax_m, 'Xmax_m') - 0.0058) < 1e-15, `Xmax was ${r.Xmax_m}`);
    });
  });
});
