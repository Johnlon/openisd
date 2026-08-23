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
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { allIssues, paramIssues, managedProject } from '../../src/logic/appState.js';

describe('the store unions every hardening layer into one issue list', () => {
  it('a fully specified design is clean — no layer reports a false positive', () => {
    managedProject.loadEmpty();
    for (const [k, v] of Object.entries({ Fs: 37, Qts: 0.378, Qes: 0.40, Qms: 7.0, Vas: 0.0300,
                                          Sd: 0.0133, Re: 5.6, Le: 0.70e-3, Xmax: 0.0050,
                                          Pe: 60, Znom: 8 })) {
      managedProject.enter(k as Parameters<typeof managedProject.enter>[0], v);
    }
    managedProject.setBoxVolume_m3(0.030);
    managedProject.setActiveVentField('diameter_m', 0.102);

    assert.deepEqual(managedProject.errors().filter(e => e.level === 'error'), [],
      'a complete driver must derive without a blocking error');
    assert.deepEqual(paramIssues.value, [], 'a sized box must raise no parameter issue');
  });

  it('a zero box volume surfaces a Vb error through allIssues, naming the field', () => {
    managedProject.loadEmpty();
    managedProject.setActiveVentField('diameter_m', 0.102);
    managedProject.setBoxVolume_m3(0);

    const vb = allIssues.value.find(e => e.field === 'Vb' && e.level === 'error');
    assert.ok(vb, `allIssues must carry the Vb error; got: ${allIssues.value.map(e => e.field).join(', ')}`);
    assert.match(vb.message, /greater than zero/, 'the message must state the requirement');
  });

  it('the box-parameter layer is reachable independently as paramIssues', () => {
    managedProject.loadEmpty();
    managedProject.setActiveVentField('diameter_m', 0.102);
    managedProject.setBoxVolume_m3(0);

    assert.deepEqual(paramIssues.value.map(e => e.field), ['Vb'],
      'paramIssues is the precondition layer on its own, for a panel that wants only it');
  });

  it('an unsized new project reports BOTH preconditions — Vb and the vent area', () => {
    managedProject.loadEmpty();
    managedProject.setBoxVolume_m3(0);
    managedProject.setActiveVentField('diameter_m', 0);

    assert.deepEqual(paramIssues.value.map(e => e.field).sort(), ['Sp', 'Vb'],
      'nothing has sized the box, and the channel says so rather than assuming a size');
  });

  it('clearing the bad value clears the issue — the channel is live, not latched', () => {
    managedProject.loadEmpty();
    managedProject.setActiveVentField('diameter_m', 0.102);
    managedProject.setBoxVolume_m3(0);
    assert.ok(paramIssues.value.length > 0, 'precondition of this test');

    managedProject.setBoxVolume_m3(0.030);
    assert.deepEqual(paramIssues.value, [], 'fixing the input must retract the issue');
  });
});
