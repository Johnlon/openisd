import {describe, it} from 'vitest';
import {solveConsistencyGroup} from './testSolver.js';
import assert from 'node:assert/strict';

describe('relation 24 semi-inductance', () => {
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
});
