/**
 * usePrGroup — the passive-radiator group's writes.
 *
 * ONE user action is ONE domain transaction — exactly one notification, one solve.
 * `OpenISDProject.enter()`/`clear()` perform the value write, the provenance mark and the group
 * re-solve as one operation; the managed layer runs it inside a single `mutate()`, so
 * `requireFocusedProject().subscribe()` fires EXACTLY ONCE per user action (`docs/design/REACTIVITY.md`).
 * Pinned by counting notifications for one call: more than one means the transaction split,
 * zero means the write never notified at all.
 */
import {beforeEach, describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {newProject, requireFocusedProject} from '../../src/logic/appState.js';
import {clearPrField as clearPrFieldOn, enterPrField as enterPrFieldOn} from '../../src/logic/usePrGroup.js';

function countNotifications(fn: () => void): number {
  let count = 0;
  const unsub = requireFocusedProject().subscribe(() => { count++; });
  try { fn(); } finally { unsub(); }
  return count;
}

describe('usePrGroup — one user action is one notification', () => {
  beforeEach(() => {
    newProject();
    requireFocusedProject().box.vented.volume_m3.set(0.02);
    requireFocusedProject().box.passiveRadiator.radiator.spec.Sd_m2.set(0.008);
    requireFocusedProject().box.passiveRadiator.radiator.spec.Cms_m_per_N.set(0.0006);
    requireFocusedProject().box.passiveRadiator.radiator.spec.Mms_kg.set(0.02);
    // Nothing entered yet — entering prFp below is the ONLY entered member, so prMadd is the
    // one CALCULATED one and the solve step genuinely writes.
    // setEnteredSet is no longer needed; .set() sets origin to entered
  });

  it('enterPrField(prFp) — value write + provenance write + one solve write, no more', () => {
    const count = countNotifications(() => enterPrFieldOn(requireFocusedProject(), 'tuning_goal_hz', 40));
    assert.equal(count, 1,
      `expected exactly 1 notification (one domain transaction) — got ${count}`);
  });

  it('clearPrField(prFp) — provenance write + one solve write, no more', () => {
    // Enter prMadd too first, so clearing prFp leaves prMadd as the sole entered member and
    // prFp becomes the CALCULATED one — otherwise nothing is derivable after the clear.
    enterPrFieldOn(requireFocusedProject(), 'tuning_goal_hz', 40);
    enterPrFieldOn(requireFocusedProject(), 'addedMass_kg', 0.01);
    const count = countNotifications(() => clearPrFieldOn(requireFocusedProject(), 'tuning_goal_hz'));
    assert.equal(count, 1,
      `expected exactly 1 notification (one domain transaction) — got ${count}`);
  });
});

/**
 * Lower bound the coalescing tests above cannot see: they only count notifications and would
 * pass identically whether the store's PR-group auto-solve watch fires or is permanently dead
 * (`BUG_20260822_pr_group_auto_solve_watch_never_fires_after_the_live_repoint.md`). This proves
 * the watch itself actually re-solves — writing `prFp` directly through `requireFocusedProject()`, never
 * through `enterPrField` (which calls `notifyPrChanged` itself inside its own suspension and so
 * would pass even with a dead store watch), outside any `suspendVentSolve` — so the only thing
 * that can write `prMadd` here is the store's own watch reacting to the live notification.
 */
// BLOCKED: QO126, like the eight cases in useVentGroup.test.ts. The store's watch DOES fire
// (BUG_20260822_pr_group_auto_solve_watch_never_fires_after_the_live_repoint.md is RESOLVED);
// what it calls, `OpenISDProject.notifyPrChanged()`, is an empty stub until the tuning <-> added-mass
// relation is wired. The assertion is kept as written rather than weakened — one loosened to
// match a stub would go green and stop describing the behaviour the app is supposed to have.
describe('usePrGroup — auto-solve watch fires on every requireFocusedProject() notification (BLOCKED: QO126)', () => {
  it('a raw prFp write outside enterPrField/suspension re-solves prMadd', () => {
    newProject();
    requireFocusedProject().box.vented.volume_m3.set(0.02);
    requireFocusedProject().box.passiveRadiator.radiator.spec.Sd_m2.set(0.008);
    requireFocusedProject().box.passiveRadiator.radiator.spec.Cms_m_per_N.set(0.0006);
    requireFocusedProject().box.passiveRadiator.radiator.spec.Mms_kg.set(0.02);
    // setEnteredSet is no longer needed; .set() sets origin to entered // prFp entered, prMadd is the CALCULATED member
    requireFocusedProject().box.passiveRadiator.addedMass_kg.set(0); // known starting value for the calculated member — a raw write, must NOT mark prMadd entered
    const before = requireFocusedProject().box.passiveRadiator.addedMass_kg.value;

    requireFocusedProject().box.passiveRadiator.tuning_goal_hz.set(55); // raw write — no suspension, no direct notifyPrChanged call

    const after = requireFocusedProject().box.passiveRadiator.addedMass_kg.value;
    assert.notEqual(after, before,
      'prMadd was not re-solved after a live prFp write. The store\'s watch fires; ' +
      'OpenISDProject.notifyPrChanged() is an empty stub until QO126 wires the tuning <-> ' +
      'added-mass relation.');
  });
});
