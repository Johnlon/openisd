/**
 * Specification: http://localhost:8000/winisd/openisd/openspec/specs/project-management/spec.md?html
 */
/**
 * The store is the single enforced engine→UI seam (ESLint forbids components importing
 * `sweep`/`maxCurves` directly), so it is where the engine's hardening layers have to be
 * unioned into one issue list. These pin the WIRING — that `allIssues` actually carries
 * each layer — not the classification rules themselves, which are covered engine-side by
 * `packages/engine/test/hardening.test.ts`.
 *
 * Without this, a layer can be implemented, tested, and still reach no one: the store is
 * the only place the three sources are joined.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { state, allIssues, paramIssues, driverErrors } from '../src/store.js';

/** Restore the box volume the default design opens with, so tests don't leak state. */
const VB_DEFAULT = state.P.Vb;

describe('the store unions every hardening layer into one issue list', () => {
  it('the default design is clean — no layer reports a false positive', () => {
    state.P.Vb = VB_DEFAULT;
    assert.deepEqual(driverErrors.value.filter(e => e.level === 'error'), [],
      'the default driver must derive without a blocking error');
    assert.deepEqual(paramIssues.value, [], 'the default box must raise no parameter issue');
  });

  it('a zero box volume surfaces a Vb error through allIssues, naming the field', () => {
    state.P.Vb = 0;
    try {
      const vb = allIssues.value.find(e => e.field === 'Vb' && e.level === 'error');
      assert.ok(vb, `allIssues must carry the Vb error; got: ${allIssues.value.map(e => e.field).join(', ')}`);
      assert.match(vb.message, /greater than zero/, 'the message must state the requirement');
    } finally {
      state.P.Vb = VB_DEFAULT;
    }
  });

  it('the box-parameter layer is reachable independently as paramIssues', () => {
    state.P.Vb = 0;
    try {
      assert.deepEqual(paramIssues.value.map(e => e.field), ['Vb'],
        'paramIssues is the precondition layer on its own, for a panel that wants only it');
    } finally {
      state.P.Vb = VB_DEFAULT;
    }
  });

  it('clearing the bad value clears the issue — the channel is live, not latched', () => {
    state.P.Vb = 0;
    assert.ok(paramIssues.value.length > 0, 'precondition of this test');
    state.P.Vb = VB_DEFAULT;
    assert.deepEqual(paramIssues.value, [], 'fixing the input must retract the issue');
  });
});
