/**
 * The store is the single enforced engine→UI seam (ESLint forbids components importing
 * `sweep`/`maxCurves` directly), so it is where the engine's hardening layers have to be
 * unioned into one issue list. These pin the WIRING — that `allIssues` actually carries
 * each layer — not the classification rules themselves, which are covered engine-side by
 * `packages/engine/test/hardening.test.ts`.
 *
 * Without this, a layer can be implemented, tested, and still reach no one: the store is
 * the only place the three sources are joined.
 *
 * A new project opens UNSIZED — `prototypeBox()` states no volume, tuning or vent geometry,
 * because nothing has chosen them (TODO(box-wizard) there). So a test that needs a design
 * which raises no precondition issue SIZES THE BOX ITSELF, inline, and says what it set.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {allIssues, curvesData, newProject, paramIssues, requireFocusedProject} from '../../src/logic/appState.js';

/** `sweepErrors`'s re-sweep is throttled (`scheduleSweep`, `SWEEP_MS` — docs/design/
 *  REACTIVITY.md): a burst of synchronous `.set()`/`.clear()` calls lands well inside one
 *  throttle window, so a test that needs `allIssues` to reflect them must wait past it —
 *  exactly as a real user's edits, spread over multiple frames, naturally would. Reading
 *  `allIssues.value` synchronously right after a change proves nothing either way: a
 *  test that never awaits this can pass whether or not the channel ever actually recomputed. */
async function awaitSweepThrottle(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 50));
}

describe('the store unions every hardening layer into one issue list', () => {
  it('a fully specified design is clean — no layer reports a false positive', async () => {
    newProject();
    requireFocusedProject().box.boxType.set('vented');
    requireFocusedProject().driver.spec.woofer.Fs_hz.set(37);
    requireFocusedProject().driver.spec.woofer.Qts.set(0.378);
    requireFocusedProject().driver.spec.woofer.Qes.set(0.40);
    requireFocusedProject().driver.spec.woofer.Qms.set(7.0);
    requireFocusedProject().driver.spec.woofer.Vas_m3.set(0.0300);
    requireFocusedProject().driver.spec.woofer.Sd_m2.set(0.0133);
    requireFocusedProject().driver.spec.woofer.Re_ohm.set(5.6);
    requireFocusedProject().driver.spec.woofer.Le_H.set(0.70e-3);
    requireFocusedProject().driver.spec.woofer.Xmax_m.set(0.0050);
    requireFocusedProject().driver.spec.woofer.Pe_W.set(60);
    requireFocusedProject().driver.spec.woofer.Znom_ohm.set(8);
    requireFocusedProject().box.vented.volume_m3.set(0.030);
    requireFocusedProject().box.vented.tuning_hz.set(37);
    requireFocusedProject().box.vented.vent.diameter_m.set(0.102);
    await awaitSweepThrottle();

    // Proves this reflects a genuinely fresh, successful sweep — not a vacuously-empty
    // channel that was never recomputed at all (an empty array passes either way).
    assert.ok(curvesData.value, 'a valid design must have actually produced curves');
    assert.deepEqual(allIssues.value.filter(e => e.level === 'error'), [],
      'a complete driver must derive without a blocking error');
    assert.deepEqual(paramIssues.value, [], 'a sized box must raise no parameter issue');
  });

  it('a zero box volume surfaces a Vb error through allIssues, naming the field', () => {
    newProject();
    // A new project opens SEALED, and these tests configure a vented box — the vent fields
    // below are dormant until the box type names them.
    requireFocusedProject().box.boxType.set('vented');
    requireFocusedProject().box.vented.vent.diameter_m.set(0.102);
    requireFocusedProject().box.vented.volume_m3.set(0);

    const vb = allIssues.value.find(e => e.field === 'Vb' && e.level === 'error');
    assert.ok(vb, `allIssues must carry the Vb error; got: ${allIssues.value.map(e => e.field).join(', ')}`);
    assert.match(vb.message, /greater than zero/, 'the message must state the requirement');
    assert.equal(
      allIssues.value.some(e => e.field === 'sweep' && e.level === 'error'),
      false,
      'the downstream no-values consequence must not hide the Vb cause',
    );
  });

  it('the box-parameter layer is reachable independently as paramIssues', () => {
    newProject();
    // A new project opens SEALED, and these tests configure a vented box — the vent fields
    // below are dormant until the box type names them.
    requireFocusedProject().box.boxType.set('vented');
    requireFocusedProject().box.vented.vent.diameter_m.set(0.102);
    requireFocusedProject().box.vented.volume_m3.set(0);

    assert.deepEqual(paramIssues.value.map(e => e.field), ['Vb'],
      'paramIssues is the precondition layer on its own, for a panel that wants only it');
  });

  it('an unsized new project reports BOTH preconditions — Vb and the vent area', () => {
    newProject();
    // A new project opens SEALED, and these tests configure a vented box — the vent fields
    // below are dormant until the box type names them.
    requireFocusedProject().box.boxType.set('vented');
    requireFocusedProject().box.vented.volume_m3.set(0);
    requireFocusedProject().box.vented.vent.diameter_m.set(0);

    assert.deepEqual(paramIssues.value.map(e => e.field).sort(), ['Sp', 'Vb'],
      'nothing has sized the box, and the channel says so rather than assuming a size');
  });

  it('clearing the bad value clears the issue — the channel is live, not latched', () => {
    newProject();
    // A new project opens SEALED, and these tests configure a vented box — the vent fields
    // below are dormant until the box type names them.
    requireFocusedProject().box.boxType.set('vented');
    requireFocusedProject().box.vented.vent.diameter_m.set(0.102);
    requireFocusedProject().box.vented.volume_m3.set(0);
    assert.ok(paramIssues.value.length > 0, 'precondition of this test');

    requireFocusedProject().box.vented.volume_m3.set(0.030);
    assert.deepEqual(paramIssues.value, [], 'fixing the input must retract the issue');
  });

  it('carries one sweep circuit failure per missing driver value, not one combined message', async () => {
    // QO144 (2026-09-15): the sweep no longer combines every missing circuit field into one
    // message with a cross-field substitution suggestion — each missing field is its own issue,
    // naming exactly that field, so the user knows precisely what to state.
    //
    // Proven as a LIVE TRANSITION (valid → broken), not by clearing fields on a brand-new blank
    // project: a blank project already has every circuit field missing before any `.clear()`
    // call runs, so asserting on the post-clear state alone cannot tell a genuinely reactive
    // channel apart from one that never recomputed at all — both would show the same
    // "everything missing" result. Starting from a project already proven clean makes the
    // failure this test asserts on only reachable if the sweep actually re-ran.
    newProject();
    requireFocusedProject().box.boxType.set('sealed');
    const driver = requireFocusedProject().driver.spec.woofer;
    driver.Fs_hz.set(37);
    driver.Re_ohm.set(5.6);
    driver.Qts.set(0.378);
    driver.Qes.set(0.40);
    driver.Qms.set(7.0);
    driver.Vas_m3.set(0.0300);
    driver.Sd_m2.set(0.0133);
    requireFocusedProject().box.sealed.volume_m3.set(0.030);
    await awaitSweepThrottle();
    assert.deepEqual(allIssues.value.filter(e => e.level === 'error'), [],
      'precondition: the circuit must be genuinely valid before this test breaks it');

    driver.Fs_hz.clear();
    driver.Re_ohm.clear();
    driver.Qts.clear();
    driver.Qes.clear();
    driver.Qms.clear();
    driver.Vas_m3.clear();
    driver.Sd_m2.clear();
    await awaitSweepThrottle();

    for (const field of ['Sd_m2', 'Re_terminal_ohm', 'BL_terminal_Tm', 'Cms_m_per_N', 'Mms_kg', 'Rms_kg_per_s']) {
      const failure = allIssues.value.find(issue => issue.field === field);
      assert.ok(failure, `the sweep failure for ${field} must reach allIssues; got: ${allIssues.value.map(e => e.field).join(', ')}`);
      assert.match(failure.message, new RegExp(field));
    }
  });

  it('a driver with neither Pe nor Xmax reports maxSPL/maxPower as unbounded advisories, '
   + 'never as blocking errors (QO143)', async () => {
    newProject();
    requireFocusedProject().box.boxType.set('vented');
    requireFocusedProject().driver.spec.woofer.Fs_hz.set(37);
    requireFocusedProject().driver.spec.woofer.Qts.set(0.378);
    requireFocusedProject().driver.spec.woofer.Qes.set(0.40);
    requireFocusedProject().driver.spec.woofer.Qms.set(7.0);
    requireFocusedProject().driver.spec.woofer.Vas_m3.set(0.0300);
    requireFocusedProject().driver.spec.woofer.Sd_m2.set(0.0133);
    requireFocusedProject().driver.spec.woofer.Re_ohm.set(5.6);
    requireFocusedProject().driver.spec.woofer.Le_H.set(0.70e-3);
    requireFocusedProject().driver.spec.woofer.Znom_ohm.set(8);
    // Pe_W and Xmax_m deliberately left unstated.
    requireFocusedProject().box.vented.volume_m3.set(0.030);
    requireFocusedProject().box.vented.tuning_hz.set(37);
    requireFocusedProject().box.vented.vent.diameter_m.set(0.102);

    await awaitSweepThrottle();

    assert.deepEqual(allIssues.value.filter(e => e.level === 'error'), [],
      'unbounded is a valid answer, not a blocking error');
    const maxsplWarn = allIssues.value.find(e => e.field === 'maxspl' && e.level === 'warn');
    const maxpwrWarn = allIssues.value.find(e => e.field === 'maxpwr' && e.level === 'warn');
    assert.ok(maxsplWarn, 'maxspl must carry an unbounded advisory');
    assert.ok(maxpwrWarn, 'maxpwr must carry an unbounded advisory');
    assert.match(maxsplWarn.message, /Pe_W/);
    assert.match(maxsplWarn.message, /Xmax_m/);
  });

it('an unsized vent port surfaces a tuning_hz/length_m error through allIssues, '
   + 'not the generic no-values postcondition (T1)', async () => {
    newProject();
    requireFocusedProject().box.boxType.set('vented');
    const driver = requireFocusedProject().driver.spec.woofer;
    driver.Fs_hz.set(37);
    driver.Qts.set(0.378);
    driver.Qes.set(0.40);
    driver.Qms.set(7.0);
    driver.Vas_m3.set(0.0300);
    driver.Sd_m2.set(0.0133);
    driver.Re_ohm.set(5.6);
    driver.Le_H.set(0.70e-3);
    driver.Xmax_m.set(0.0050);
    driver.Pe_W.set(60);
    driver.Znom_ohm.set(8);
    // Sized box, but NEITHER tuning nor port length ever stated — the no-target sweep
    // state T1 adds a specific error for, instead of the generic no-values consequence.
    requireFocusedProject().box.vented.volume_m3.set(0.030);
    requireFocusedProject().box.vented.vent.diameter_m.set(0.102);
    await awaitSweepThrottle();

    const vent = allIssues.value.find(e => e.field === 'tuning_hz' || e.field === 'length_m');
    assert.ok(vent, `the unsized vent must surface through allIssues; got: ${allIssues.value.map(e => e.field).join(', ')}`);
    assert.equal(vent.level, 'error');
    assert.match(vent.message, /cannot be calculated yet/);
    assert.equal(allIssues.value.some(e => e.field === 'sweep' && e.level === 'error'), false,
      'the generic downstream no-values consequence must not be the one reporting the cause');

    // The live recovery half of the transition: stating a tuning must clear the guard
    // and put curves back.
    requireFocusedProject().box.vented.tuning_hz.set(37);
    await awaitSweepThrottle();
    assert.deepEqual(allIssues.value.filter(e => e.level === 'error'), [],
      'stating a tuning must clear the vent sweep guard');
    assert.ok(curvesData.value, 'stating a tuning must yield a sweep again');
  });

  it('a vent sweep error reads the identical sentence the cell itself carries as DQ (S2-11)', async () => {
    newProject();
    requireFocusedProject().box.boxType.set('vented');
    requireFocusedProject().box.vented.volume_m3.set(0.030);
    requireFocusedProject().box.vented.vent.diameter_m.set(0.102);
    // A stated but non-physical tuning — a genuine per-field vent issue (not the "nothing
    // chosen yet" sweep-only guard `#ventSweepIssues` adds on top of an empty cascade result),
    // so the SAME issue instance reaches both the sweep channel and the cell's own DQ.
    requireFocusedProject().box.vented.tuning_hz.set(0);
    await awaitSweepThrottle();

    const tuningCell = requireFocusedProject().box.vented.tuning_hz.get();
    assert.ok(tuningCell.dq().length > 0, 'precondition: the cell must actually carry a DQ');
    const swept = allIssues.value.find(e => e.field === 'tuning_hz' && e.level === 'error');
    assert.ok(swept, `allIssues must carry the tuning_hz error; got: ${allIssues.value.map(e => e.field).join(', ')}`);
    assert.deepEqual(tuningCell.dq(), [swept.message],
      'the vent cell DQ and the sweep channel message must be the identical sentence');
  });

  it('an unsimulated topology (bandpass6) reports "Not yet implemented", not a silent blank chart (S3/T4)', async () => {
    newProject();
    requireFocusedProject().box.boxType.set('bandpass6');
    await awaitSweepThrottle();

    const notImpl = allIssues.value.find(e => /not yet implemented/i.test(e.message));
    assert.ok(notImpl, `allIssues must carry a "not yet implemented" error; got: ${allIssues.value.map(e => e.message).join(', ')}`);
    assert.equal(notImpl.level, 'error');
    assert.equal(notImpl.field, 'boxType');
    assert.match(notImpl.message, /bandpass6/);
  });

  it('an unsimulated topology (abc) reports "Not yet implemented", not a silent blank chart (S3/T4)', async () => {
    newProject();
    requireFocusedProject().box.boxType.set('abc');
    await awaitSweepThrottle();

    const notImpl = allIssues.value.find(e => /not yet implemented/i.test(e.message));
    assert.ok(notImpl, `allIssues must carry a "not yet implemented" error; got: ${allIssues.value.map(e => e.message).join(', ')}`);
    assert.equal(notImpl.level, 'error');
    assert.equal(notImpl.field, 'boxType');
    assert.match(notImpl.message, /abc/);
  });
});
