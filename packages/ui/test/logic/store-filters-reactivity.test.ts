/**
 * Filter edits must drive a re-sweep.
 *
 * The sweep is re-run by `watch([driver, syncedP, box], …)` in store.ts. `syncedP` reads
 * `requireFocusedProject().toUiParams()` (which includes `filters()`, a fresh copy on every call) and
 * depends on `live` — the store's Vue bridge onto the domain's own change-notification channel
 * (`docs/design/REACTIVITY.md`) — so any edit that goes through `requireFocusedProject().setFilters()`
 * must recompute it; a caller that mutated an array in place, bypassing `setFilters()`, would
 * change nothing `syncedP` can see.
 *
 * These assert that writing the filters array through `setFilters()` recomputes `syncedP`.
 * Sync flush makes it deterministic without a component/tick.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { watch } from 'vue';
import { syncedP, requireFocusedProject } from '../../src/logic/appState.js';
import type { Filter } from '@openisd/design/engine';

const hp = (fc: number): Filter => ({ id: 'f-hp', type: 'highpass', enabled: true, fc, Q: 0.7071 });

describe('filter edits re-trigger the sweep params (syncedP reactivity)', () => {
  it('editing a filter field recomputes syncedP', () => {
    requireFocusedProject().setFilters([hp(80)]);
    let fires = 0;
    const stop = watch(syncedP, () => { fires++; }, { flush: 'sync' });
    void syncedP.value;                 // ensure it's tracked
    fires = 0;
    const edited = requireFocusedProject().filters();
    edited[0].fc = 120;
    requireFocusedProject().setFilters(edited);  // edit — must re-trigger the sweep params
    stop();
    assert.ok(fires > 0, 'editing a filter field must recompute syncedP (drives the re-sweep)');
  });

  it('adding a filter recomputes syncedP', () => {
    requireFocusedProject().setFilters([]);
    let fires = 0;
    const stop = watch(syncedP, () => { fires++; }, { flush: 'sync' });
    void syncedP.value;
    fires = 0;
    requireFocusedProject().setFilters([...requireFocusedProject().filters(), hp(60)]);   // add — must re-trigger
    stop();
    assert.ok(fires > 0, 'adding a filter must recompute syncedP');
  });
});
