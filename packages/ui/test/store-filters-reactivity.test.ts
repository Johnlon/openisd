/**
 * Filter edits must drive a re-sweep (CLASSIC-SKIN-review.md #1).
 *
 * The sweep is re-run by `watch([driver, syncedP, box], …)` in store.ts. `syncedP` is a
 * computed derived from `state.P`; if it doesn't take a reactive dependency on the
 * *contents* of `state.P.filters`, editing a filter's fc/Q — or adding/removing one —
 * won't recompute `syncedP`, so the watcher never fires and the graph never redraws.
 *
 * These assert that mutating the filters array recomputes `syncedP`. Sync flush makes it
 * deterministic without a component/tick.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { watch } from 'vue';
import { state, syncedP } from '../src/store.js';
import type { Filter } from '@openisd/engine';

const hp = (fc: number): Filter => ({ id: 'f-hp', type: 'highpass', enabled: true, fc, Q: 0.7071 });

describe('filter edits re-trigger the sweep params (syncedP reactivity)', () => {
  it('editing a filter field recomputes syncedP', () => {
    state.P.filters = [hp(80)];
    let fires = 0;
    const stop = watch(syncedP, () => { fires++; }, { flush: 'sync' });
    void syncedP.value;                 // ensure it's tracked
    fires = 0;
    state.P.filters[0].fc = 120;        // edit — must re-trigger the sweep params
    stop();
    assert.ok(fires > 0, 'editing a filter field must recompute syncedP (drives the re-sweep)');
  });

  it('adding a filter recomputes syncedP', () => {
    state.P.filters = [];
    let fires = 0;
    const stop = watch(syncedP, () => { fires++; }, { flush: 'sync' });
    void syncedP.value;
    fires = 0;
    state.P.filters.push(hp(60));       // add — must re-trigger
    stop();
    assert.ok(fires > 0, 'adding a filter must recompute syncedP');
  });
});
