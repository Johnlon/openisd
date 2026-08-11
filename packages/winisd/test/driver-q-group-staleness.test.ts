/**
 * @openisd/winisd — Driver ADT: entering Qes+Qms after Qts was already Entered must not
 * leave Qts stuck at its stale value.
 *
 * QO13 (openisd inbox, .../questions.yml): "Qts never recalculates from Qms/Qes because a
 * library driver arrives with EVERY field marked Entered." A library-loaded driver enters
 * Qts as part of its own load (state 'E'). `deriveDriver`'s Qts fill only fires
 * `if (r.Qts == null)` (packages/engine/src/driver.ts), so once Qts is Entered it is a hard
 * override — editing Qes/Qms afterwards (e.g. via the Tune what-if panel) computes new inputs
 * but Qts, still present in #inputs, never re-derives. The Box tab's sealed Fsc/Qtc then use
 * the STALE Qts, silently wrong.
 *
 * Fix belongs on the Driver ADT itself (STATE_MODEL.md's "the layer object self-maintains
 * consistency, not the UI caller") but is SESSION-scoped via beginSession()/endSession(): a
 * bare driver (no session) may legitimately carry all of Qts/Qes/Qms as directly-published
 * manufacturer facts (see driver-class.test.ts's override/revert coverage, which must keep
 * passing unchanged). Only within an active session — a what-if overlay or editor draft
 * freshly seeded from the committed driver, exactly when Tune/the editor opens — does
 * completing the group by typing a FRESH value auto-clear the one member INHERITED from
 * before the session began (never a value the user just typed this session).
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { Driver } from '@openisd/winisd';

function withoutQs(): Driver {
  const d = new Driver();
  d.enter('Fs', 40);
  d.enter('Vas', 0.00765);
  d.enter('Sd', 0.0133);
  d.enter('Re', 6.6);
  d.enter('Xmax', 0.005);
  d.enter('Pe', 60);
  return d;
}

describe('Driver ADT — Q_GROUP staleness within an edit session (QO13)', () => {
  it('Qts inherited (library load), then Qes+Qms entered fresh (Tune session) → Qts reverts to Computed and re-derives', () => {
    const d = withoutQs();
    d.enter('Qts', 0.378);               // library-loaded default, marked Entered
    assert.equal(d.cell('Qts').state, 'E', 'sanity: Qts starts Entered, as a loaded driver would');

    d.beginSession();                    // Tune/editor opens — Qts is now the session's INHERITED fact
    d.enter('Qes', 0.450);               // Tune: fresh user edit this session
    d.enter('Qms', 2.940);               // Tune: fresh user edit — completes the 3rd member

    const qts = d.cell('Qts');
    assert.equal(qts.state, 'C',
      `Qts must revert to Computed once Qes and Qms are both freshly entered — got state '${qts.state}'`);
    const expected = 1 / (1 / 2.940 + 1 / 0.450); // Qts = Qes·Qms/(Qes+Qms)
    assert.ok(typeof qts.value === 'number' && Math.abs(qts.value - expected) < 1e-6,
      `Qts must re-derive from the new Qes/Qms (expected ${expected}), got ${qts.value}`);
  });

  it('entering only Qes (Qms never entered, Qts still inherited) leaves the group alone — 2 of 3 stay authoritative', () => {
    const d = withoutQs();
    d.enter('Qts', 0.378);
    d.beginSession();
    d.enter('Qes', 0.45);                // Qms is never entered — only 2 of 3 members present
    assert.equal(d.cell('Qts').state, 'E');
    assert.equal(d.cell('Qes').state, 'E');
    assert.equal(d.cell('Qms').state, 'C', 'Qms was never entered, so it is Computed by default');
  });

  it('once the inherited value has been resolved, completing the group again does not clear a field the user just typed', () => {
    const d = withoutQs();
    d.enter('Qts', 0.378);
    d.beginSession();
    d.enter('Qes', 0.450);
    d.enter('Qms', 2.940);               // clears Qts (the session's one inherited member)
    assert.equal(d.cell('Qts').state, 'C');

    d.enter('Qts', 0.40);                // user now types Qts too — a fresh session entry, not inherited
    assert.equal(d.cell('Qts').state, 'E');
    assert.equal(d.cell('Qes').state, 'E',
      'Qes was entered by the user this session, same as Qts — neither is "stale", so nothing auto-clears');
    assert.equal(d.cell('Qms').state, 'E');
  });

  it('outside a session, a driver may legitimately carry all three Q members as published facts (no auto-clear)', () => {
    // No beginSession() — matches a bare load/round-trip and driver-class.test.ts's own
    // "override a derivable field" coverage. Never auto-clear here.
    const d = withoutQs();
    d.enter('Qts', 0.378);
    d.enter('Qes', 0.450);
    d.enter('Qms', 2.940);
    assert.equal(d.cell('Qts').state, 'E');
    assert.equal(d.cell('Qes').state, 'E');
    assert.equal(d.cell('Qms').state, 'E');
  });
});
