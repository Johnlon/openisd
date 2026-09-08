/**
 * Filter edits must drive a re-sweep.
 *
 * The sweep is re-run by `watch(live, scheduleSweep)` in appState.ts, where `live` is the
 * store's Vue bridge onto the focused project's own change-notification channel
 * (`docs/design/REACTIVITY.md`). `scheduleSweep` throttles (leading-edge, `SWEEP_MS`), so this
 * asserts the deterministic half of that chain instead: writing `filters` through the project's
 * own `RawField` fires `projectChanged`, the same signal `live`'s subscription bumps on every
 * mutation and the one the persistence hook watches.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { watch, nextTick } from 'vue';
import { projectChanged, requireFocusedProject, newProject } from '../../src/logic/appState.js';
import type { Filter } from '@openisd/design/engine';

const hp = (fc: number): Filter => ({ id: 'f-hp', type: 'highpass', enabled: true, fc, Q: 0.7071 });

/** Count how many times a real watcher on the signal wakes while `body` runs. */
async function firingsDuring(body: () => void): Promise<number> {
  let fired = 0;
  const stop = watch(projectChanged, () => { fired++; });
  try {
    body();
    await nextTick();
    return fired;
  } finally {
    stop();
  }
}

describe('filter edits re-trigger project change notification (drives the re-sweep)', () => {
  it('editing a filter field wakes projectChanged', async () => {
    newProject();   // the app starts with NO project (QO121), so this test opens its own
    requireFocusedProject().filters.set([hp(80)]);
    const fired = await firingsDuring(() => {
      const edited = requireFocusedProject().filters.get().map(f => ({ ...f, fc: 120 }));
      requireFocusedProject().filters.set(edited);
    });
    assert.ok(fired > 0, 'editing a filter field must wake projectChanged (drives the re-sweep)');
  });

  it('adding a filter wakes projectChanged', async () => {
    newProject();
    requireFocusedProject().filters.set([]);
    const fired = await firingsDuring(() => {
      requireFocusedProject().filters.set([...requireFocusedProject().filters.get(), hp(60)]);
    });
    assert.ok(fired > 0, 'adding a filter must wake projectChanged');
  });
});
