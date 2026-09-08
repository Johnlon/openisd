/**
 * `projectChanged` — the signal App.vue's persistence hook watches (QO92).
 *
 * The contract has two halves and BOTH matter. It must FIRE on a change to the focused
 * project, and it must hand over NOTHING: the hook learns that something changed and gets no
 * route to the project, which is what stopped `ManagedProject` having to expose a whole
 * `OpenISDProject` to the app.
 *
 * Firing is tested through a real Vue `watch`, not by reading the value, because a `computed`
 * notifies its watchers only when its VALUE changes — a signal can be recomputing on every
 * edit and still never wake a watcher.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { watch, nextTick } from 'vue';
import {
  projectChanged, requireFocusedProject, focusProject, removeProject, newProject, openProjects,
} from '../../src/logic/appState.js';

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

describe('projectChanged fires on a change to the focused project', () => {
  it('an edit to the focused project wakes a watcher', async () => {
    newProject();   // the app starts with NO project (QO121), so this test opens its own
    const fired = await firingsDuring(() => {
      requireFocusedProject().box.sealed.losses.Ql.set(11);
    });
    assert.ok(fired > 0, 'an edit to the focused project must wake the persistence hook');
  });

  it('two consecutive edits each wake the watcher — it is a counter, not a state reading', async () => {
    // The trap this guards: a signal derived from current state (e.g. "is a project open")
    // recomputes on both edits, compares equal to itself, and notifies on NEITHER.
    newProject();
    const fired = await firingsDuring(() => {
      requireFocusedProject().box.sealed.losses.Ql.set(21);
      requireFocusedProject().box.sealed.losses.Qa.set(31);
    });
    assert.ok(fired > 0, 'a second edit that leaves derived state unchanged must still signal');
  });

  it('opening a second project wakes a watcher', async () => {
    const fired = await firingsDuring(() => { newProject(); });
    assert.ok(fired > 0, 'a newly opened project changes what the hook would persist');
    removeProject(openProjects().length - 1);
  });

  it('switching focus wakes a watcher', async () => {
    newProject();   // one to switch AWAY from
    newProject();   // focuses the new one, at the last index
    const fired = await firingsDuring(() => { focusProject(0); });
    assert.ok(fired > 0, 'focus moving to a different project changes what the hook would persist');
    removeProject(openProjects().length - 1);
  });
});

describe('projectChanged hands over nothing', () => {
  it('the signal is a plain number, carrying no route to any project', () => {
    const v: number = projectChanged.value;
    assert.equal(typeof v, 'number',
      'the hook must learn THAT something changed and get no access to the domain object — ' +
      'handing out an OpenISDProject is the leak this signal exists to remove (QO92)');
  });
});
