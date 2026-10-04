import type {TestSolverQuantities} from './testSolver.js';
import {sweepDriver, solveConsistencyGroup} from './testSolver.js';
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import type {SweepParams} from '../../engine/index.js';
import {createEngine} from '../../engine/index.js';

/** The engine's one door: every calculation below is a method on this object. */
const engine = createEngine();

/** The reference 6.5" mid-woofer used across the engine suite — complete and valid. */
const RAW_COMPLETE = {
  Fs: 37, Qts: 0.38, Qes: 0.40, Qms: 7.0,
  Vas: 0.030, Sd: 0.0133, Re: 5.6, Le: 0.7e-3, Xmax: 0.005, Pe: 60, Znom: 8,
};

const P_SEALED: SweepParams = { Vb: 0.030, eg: 2.83, Ql: 10, fmin: 10, fmax: 1000, N: 50 };

const validDriver = () => sweepDriver(solveConsistencyGroup({
  Fs_hz: RAW_COMPLETE.Fs, Qts: RAW_COMPLETE.Qts, Qes: RAW_COMPLETE.Qes, Qms: RAW_COMPLETE.Qms,
  Vas_m3: RAW_COMPLETE.Vas, Sd_m2: RAW_COMPLETE.Sd, Re_ohm: RAW_COMPLETE.Re,
  Xmax_m: RAW_COMPLETE.Xmax, Pe_W: RAW_COMPLETE.Pe, Znom_ohm: RAW_COMPLETE.Znom,
}));

describe('driver preconditions', () => {
  // ── Criterion 1 ──────────────────────────────────────────────────────────────
  describe('a driver with Vas and Qts but no Qms gets a message naming what is missing, not a blank graph', () => {
    // One Q is not enough to resolve the T/S group, so `Cms`/`Mms`/`Rms`/`BL` never derive and the
    // circuit has nothing to run on. The REFUSAL now lives in `sweep`, not in a separate derive
    // step: it checks the six the circuit reads unguarded, and reports what a user could state.
    const VAS_AND_QTS_ONLY: TestSolverQuantities = { Fs_hz: 37, Qts: 0.38, Vas_m3: 0.030, Sd_m2: 0.0133, Re_ohm: 5.6 };
    const refused = () => engine.simulation.sweep(
      sweepDriver(solveConsistencyGroup(VAS_AND_QTS_ONLY)), undefined, 'sealed', P_SEALED);

    it('is refused before any arithmetic, so nothing non-finite is ever produced', () => {
      assert.equal(refused().values, null, 'one Q cannot solve the group; the sweep must refuse');
    });

    it('the refusal names exactly the circuit fields still missing, one issue per field — '
     + 'never a combined message or a cross-field substitution suggestion (QO144)', () => {
      const { issues } = refused();
      assert.ok(issues.length > 0, 'a refused sweep must carry at least one issue');
      for (const issue of issues) {
        assert.equal(issue.kind, 'missing-dependencies');
        if (issue.kind !== 'missing-dependencies') continue;
        // Exactly one route — the field itself — never a list of alternative fields.
        assert.equal(issue.routes.length, 1);
        assert.deepEqual(issue.routes[0].missing, [issue.target]);
      }
      const targets = issues.map(i => i.kind === 'missing-dependencies' ? i.target : null);
      // Vas+Fs derive Cms and Mms; nothing derives BL_terminal_Tm (no BL_Tm stated) or
      // Rms_kg_per_s (needs Qms, which VAS_AND_QTS_ONLY does not state).
      assert.ok(targets.includes('BL_terminal_Tm'), 'BL_terminal_Tm is genuinely absent and must be named');
      assert.ok(targets.includes('Rms_kg_per_s'), 'Rms_kg_per_s is genuinely absent and must be named');
    });

    it('a complete driver is NOT refused — the guard is about what is missing, not about being strict', () => {
      assert.ok(engine.simulation.sweep(validDriver(), 0.7e-3, 'sealed', P_SEALED).values,
        'the reference driver states enough to simulate');
    });
  });
});
