/**
 * ONE user action is ONE domain transaction — exactly one notification, one solve.
 *
 * `OpenISDProject.enter()`/`clear()` perform the value write, the provenance mark and the
 * group re-solve as one operation; the managed layer runs it inside a single `mutate()`, so
 * `requireFocusedProject().subscribe()` fires EXACTLY ONCE per user action. `appState.ts`'s coarse
 * auto-solve watch is parked by the suspension for that one notification, so it can never add
 * a second solve (`docs/design/REACTIVITY.md`; `bugs/BUG_20260821_vent_group_auto_solve_
 * clobbers_a_half_written_entered_set.md`).
 *
 * Pinned by counting `requireFocusedProject().subscribe()` notifications for one call: more than one
 * means the transaction split (value/provenance/solve as separate mutations — the shape whose
 * unsuspended tail once produced a second store-triggered solve), and zero means the write
 * never notified at all.
 */
import { describe, it, beforeEach } from 'vitest';
import assert from 'node:assert/strict';
import { newProject, requireFocusedProject } from '../../src/logic/appState.js';
import { enterVentField as enterVentFieldOn, clearVentField as clearVentFieldOn } from '../../src/logic/useVentGroup.js';
import { enterPrField as enterPrFieldOn, clearPrField as clearPrFieldOn } from '../../src/logic/usePrGroup.js';

function countNotifications(fn: () => void): number {
  let count = 0;
  const unsub = requireFocusedProject().subscribe(() => { count++; });
  try { fn(); } finally { unsub(); }
  return count;
}

describe('vent/PR group writes coalesce to exactly the writes made, never an extra store-triggered re-solve', () => {
  beforeEach(() => {
    // The app starts with NO project (QO121), so each run opens its own and tunes it to vented.
    newProject();
    requireFocusedProject().box.boxType.set('vented');
    requireFocusedProject().box.vented.volume_m3.set(0.02);
    requireFocusedProject().box.vented.vent.diameter_m.set(0.05);
    requireFocusedProject().box.vented.vent.endCorrection_m.set(0.6);
    // setEnteredSet is no longer needed; .set() sets origin to entered
  });

  it('enterVentField(Fb) — value write + provenance write + one solve write, no more', () => {
    const count = countNotifications(() => enterVentFieldOn(requireFocusedProject(), 'Fb', 40));
    // setBoxTuning_Fb_hz + setEntered('Fb') + solveVentGroup's own ventL write = 3.
    // Before the fix (trailing solve outside suspension) this counted 4: the store's
    // auto-solve watch, unsuspended by the time the solve's own write landed, ran a second,
    // fully redundant `solveVentGroup`.
    assert.equal(count, 1,
      `expected exactly 1 notification (one domain transaction) — got ${count}; extra writes ` +
      `mean the store's auto-solve watch re-ran the solver a second time for one user action`);
  });

  it('clearVentField(Fb) — provenance write + one solve write, no more', () => {
    // Over-determine first (both Fb and ventL entered), so clearing Fb leaves ventL as the
    // sole entered member and Fb genuinely becomes the CALCULATED one — otherwise nothing is
    // derivable after the clear and the solve step is a real no-op (a different, equally
    // valid scenario, but not one that exercises a solve write).
    enterVentFieldOn(requireFocusedProject(), 'ventL', 0.15);
    const count = countNotifications(() => clearVentFieldOn(requireFocusedProject(), 'Fb'));
    assert.equal(count, 1,
      `expected exactly 1 notification (one domain transaction) — got ${count}`);
  });
});

describe('PR group writes coalesce the same way', () => {
  beforeEach(() => {
    requireFocusedProject().box.vented.volume_m3.set(0.02);
    requireFocusedProject().box.passiveRadiator.radiator.spec.Sd_m2.set(0.008);
    requireFocusedProject().box.passiveRadiator.radiator.spec.Cms_m_per_N.set(0.0006);
    requireFocusedProject().box.passiveRadiator.radiator.spec.Mms_kg.set(0.02);
    // Nothing entered yet — entering prFp below is the ONLY entered member, so prMadd is the
    // one CALCULATED one and the solve step genuinely writes.
    // setEnteredSet is no longer needed; .set() sets origin to entered
  });

  it('enterPrField(prFp) — value write + provenance write + one solve write, no more', () => {
    const count = countNotifications(() => enterPrFieldOn(requireFocusedProject(), 'prFp', 40));
    assert.equal(count, 1,
      `expected exactly 1 notification (one domain transaction) — got ${count}`);
  });

  it('clearPrField(prFp) — provenance write + one solve write, no more', () => {
    // Enter prMadd too first, so clearing prFp leaves prMadd as the sole entered member and
    // prFp becomes the CALCULATED one — otherwise nothing is derivable after the clear.
    enterPrFieldOn(requireFocusedProject(), 'prFp', 40);
    enterPrFieldOn(requireFocusedProject(), 'prMadd', 0.01);
    const count = countNotifications(() => clearPrFieldOn(requireFocusedProject(), 'prFp'));
    assert.equal(count, 1,
      `expected exactly 1 notification (one domain transaction) — got ${count}`);
  });
});

/**
 * Lower bound the coalescing tests above cannot see: they only count notifications and would
 * pass identically whether the store's PR-group auto-solve watch fires or is permanently dead
 * (`BUG_20260822_pr_group_auto_solve_watch_never_fires_after_the_live_repoint.md`). This proves
 * the watch itself actually re-solves — writing `prFp` directly through `requireFocusedProject()`, never
 * through `enterPrField` (which calls `solvePrGroup` itself inside its own suspension and so
 * would pass even with a dead store watch), outside any `suspendVentSolve` — so the only thing
 * that can write `prMadd` here is the store's own watch reacting to the live notification.
 */
describe('PR-group auto-solve watch fires on every requireFocusedProject() notification', () => {
  it('a raw prFp write outside enterPrField/suspension re-solves prMadd', () => {
    requireFocusedProject().box.vented.volume_m3.set(0.02);
    requireFocusedProject().box.passiveRadiator.radiator.spec.Sd_m2.set(0.008);
    requireFocusedProject().box.passiveRadiator.radiator.spec.Cms_m_per_N.set(0.0006);
    requireFocusedProject().box.passiveRadiator.radiator.spec.Mms_kg.set(0.02);
    // setEnteredSet is no longer needed; .set() sets origin to entered // prFp entered, prMadd is the CALCULATED member
    requireFocusedProject().box.passiveRadiator.addedMass_kg.set(0); // known starting value for the calculated member — a raw write, must NOT mark prMadd entered
    const before = requireFocusedProject().box.passiveRadiator.addedMass_kg.get().value;

    requireFocusedProject().box.passiveRadiator.tuning_hz.set(55); // raw write — no suspension, no direct solvePrGroup call

    const after = requireFocusedProject().box.passiveRadiator.addedMass_kg.get().value;
    assert.notEqual(after, before,
      'prMadd was not re-solved after a live prFp write — the store\'s PR-group auto-solve ' +
      'watch did not fire');
  });
});
