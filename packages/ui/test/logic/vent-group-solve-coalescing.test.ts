/**
 * ONE user action must produce ONE solve, not two.
 *
 * `store.ts` bridges `ManagedOpenISDProject.subscribe()` to a coarse auto-solve watch: ANY
 * project mutation notifies `live`, and the watch re-runs `solveVentGroup`/`solvePrGroup`
 * unless a suspension is active (`docs/design/REACTIVITY.md`; `bugs/BUG_20260821_vent_group_
 * auto_solve_clobbers_a_half_written_entered_set.md`'s "live design risk" section).
 *
 * `enterVentField`/`clearVentField` (`useVentGroup.ts`) each make more than one write — the
 * field's value, its provenance flag, and the solve's own write. Reviewer finding 9: with only
 * the WRITE+PROVENANCE pair suspended and the trailing `solveVentGroup()` call left OUTSIDE the
 * suspension, that call's own write re-triggers the store's auto-solve watch a SECOND time
 * (unsuspended by then), so one `enterVentField()` call produced two solves. The fix wraps the
 * ENTIRE transaction, including the trailing solve, in one `suspendVentSolve()` — nothing
 * mutates outside the suspension, so the store's watch never fires for this call at all, and
 * the ONE call to `solveVentGroup` inside the suspension is the only solve that runs.
 *
 * This is pinned by counting `managedProject.subscribe()` notifications for one call — not by
 * spying on `solveVentGroup` itself (same-module internal calls do not go through a spy-able
 * export binding), but each write (value, provenance, solve) notifies exactly once, so the
 * notification count is an exact, direct measure of how many writes — and therefore how many
 * solve attempts — one call causes.
 */
import { describe, it, beforeEach } from 'vitest';
import assert from 'node:assert/strict';
import { state, managedProject } from '../../src/logic/store.js';
import { enterVentField as enterVentFieldOn, clearVentField as clearVentFieldOn } from '../../src/logic/useVentGroup.js';
import { enterPrField as enterPrFieldOn, clearPrField as clearPrFieldOn } from '../../src/logic/usePrGroup.js';

function countNotifications(fn: () => void): number {
  let count = 0;
  const unsub = managedProject.subscribe(() => { count++; });
  try { fn(); } finally { unsub(); }
  return count;
}

describe('vent/PR group writes coalesce to exactly the writes made, never an extra store-triggered re-solve', () => {
  beforeEach(() => {
    state.box = 'vented';
    managedProject.setBoxVolume_m3(0.02);
    managedProject.setActiveVentField('diameter_m', 0.05);
    managedProject.setActiveVentField('endCorrection', 0.6);
    managedProject.setEnteredSet({ Vb: true, ventD: true, Fb: true });
  });

  it('enterVentField(Fb) — value write + provenance write + one solve write, no more', () => {
    const count = countNotifications(() => enterVentFieldOn(managedProject, 'Fb', 40, state.box));
    // setBoxTuning_Fb_hz + setEntered('Fb') + solveVentGroup's own ventL write = 3.
    // Before the fix (trailing solve outside suspension) this counted 4: the store's
    // auto-solve watch, unsuspended by the time the solve's own write landed, ran a second,
    // fully redundant `solveVentGroup`.
    assert.equal(count, 3,
      `expected exactly 3 writes (value, provenance, one solve) — got ${count}; extra writes ` +
      `mean the store's auto-solve watch re-ran the solver a second time for one user action`);
  });

  it('clearVentField(Fb) — provenance write + one solve write, no more', () => {
    // Over-determine first (both Fb and ventL entered), so clearing Fb leaves ventL as the
    // sole entered member and Fb genuinely becomes the CALCULATED one — otherwise nothing is
    // derivable after the clear and the solve step is a real no-op (a different, equally
    // valid scenario, but not one that exercises a solve write).
    enterVentFieldOn(managedProject, 'ventL', 0.15, state.box);
    const count = countNotifications(() => clearVentFieldOn(managedProject, 'Fb', state.box));
    assert.equal(count, 2,
      `expected exactly 2 writes (provenance, one solve) — got ${count}`);
  });
});

describe('PR group writes coalesce the same way', () => {
  beforeEach(() => {
    managedProject.setBoxVolume_m3(0.02);
    managedProject.setPrField('Sd_m2', 0.008);
    managedProject.setPrField('Cms_m_per_N', 0.0006);
    managedProject.setPrField('Mmd_kg', 0.02);
    // Nothing entered yet — entering prFp below is the ONLY entered member, so prMadd is the
    // one CALCULATED one and the solve step genuinely writes.
    managedProject.setEnteredSet({});
  });

  it('enterPrField(prFp) — value write + provenance write + one solve write, no more', () => {
    const count = countNotifications(() => enterPrFieldOn(managedProject, 'prFp', 40));
    assert.equal(count, 3,
      `expected exactly 3 writes (value, provenance, one solve) — got ${count}`);
  });

  it('clearPrField(prFp) — provenance write + one solve write, no more', () => {
    // Enter prMadd too first, so clearing prFp leaves prMadd as the sole entered member and
    // prFp becomes the CALCULATED one — otherwise nothing is derivable after the clear.
    enterPrFieldOn(managedProject, 'prFp', 40);
    enterPrFieldOn(managedProject, 'prMadd', 0.01);
    const count = countNotifications(() => clearPrFieldOn(managedProject, 'prFp'));
    assert.equal(count, 2,
      `expected exactly 2 writes (provenance, one solve) — got ${count}`);
  });
});

/**
 * Lower bound the coalescing tests above cannot see: they only count notifications and would
 * pass identically whether the store's PR-group auto-solve watch fires or is permanently dead
 * (`BUG_20260822_pr_group_auto_solve_watch_never_fires_after_the_live_repoint.md`). This proves
 * the watch itself actually re-solves — writing `prFp` directly through `managedProject`, never
 * through `enterPrField` (which calls `solvePrGroup` itself inside its own suspension and so
 * would pass even with a dead store watch), outside any `suspendVentSolve` — so the only thing
 * that can write `prMadd` here is the store's own watch reacting to the live notification.
 */
describe('PR-group auto-solve watch fires on every managedProject notification', () => {
  it('a raw prFp write outside enterPrField/suspension re-solves prMadd', () => {
    managedProject.setBoxVolume_m3(0.02);
    managedProject.setPrField('Sd_m2', 0.008);
    managedProject.setPrField('Cms_m_per_N', 0.0006);
    managedProject.setPrField('Mmd_kg', 0.02);
    managedProject.setEnteredSet({ prFp: true }); // prFp entered, prMadd is the CALCULATED member
    managedProject.setPrAddedMass_kg(0); // known starting value for the calculated member
    const before = managedProject.prAddedMass_kg();

    managedProject.setPrFp_hz(55); // raw write — no suspension, no direct solvePrGroup call

    const after = managedProject.prAddedMass_kg();
    assert.notEqual(after, before,
      'prMadd was not re-solved after a live prFp write — the store\'s PR-group auto-solve ' +
      'watch did not fire');
  });
});
