/**
 * The multi-project registry (`openProjects()`/`focusedProject()`/`focusProject()`/
 * `removeProject()`/`addProject()`) — human ruling 2026-08-18, REVIEW.md.
 *
 * `appState.ts` caches its state on a module-scope `ctx` (keyed off `window`, or an in-process
 * object outside a browser), shared across every test file that imports it in this run — so
 * these tests assert relative behaviour (deltas from whatever the registry already holds),
 * never an absolute starting count.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import {
  openProjects, focusedProject, focusProject, removeProject, addProject,
} from '../../src/logic/appState.js';
import { ManagedProject } from '../../src/logic/managedProject.js';
import { presentationState } from '../../src/logic/presentationState.js';

describe('project registry', () => {
  it('starts with at least one project open, and it is focused', () => {
    assert.ok(openProjects().length >= 1);
    assert.equal(focusedProject(), openProjects()[0]);
  });

  it('addProject() appends and focuses the new project', () => {
    const before = openProjects().length;
    const p = ManagedProject.createEmpty();

    addProject(p);

    assert.equal(openProjects().length, before + 1);
    assert.equal(openProjects()[before], p);
    assert.equal(focusedProject(), p, 'the newly added project becomes focused');
  });

  it('focusProject(index) moves focus; an out-of-range index is ignored', () => {
    const p1 = ManagedProject.createEmpty();
    const p2 = ManagedProject.createEmpty();
    addProject(p1);
    addProject(p2);
    const i1 = openProjects().indexOf(p1);

    focusProject(i1);
    assert.equal(focusedProject(), p1);

    const before = focusedProject();
    focusProject(-1);
    assert.equal(focusedProject(), before, 'negative index ignored');
    focusProject(999);
    assert.equal(focusedProject(), before, 'too-large index ignored');
  });

  it('removeProject(index) clamps focus to the new last project when it was past the end', () => {
    const p1 = ManagedProject.createEmpty();
    const p2 = ManagedProject.createEmpty();
    addProject(p1);
    addProject(p2);
    const iLast = openProjects().length - 1;
    assert.equal(focusedProject(), p2, 'addProject focused it');

    removeProject(iLast);

    assert.equal(focusedProject(), openProjects()[openProjects().length - 1],
      'focus clamped to the new last project, not left pointing past the end');
  });

  it('removeProject() on an out-of-range index is a no-op', () => {
    const before = openProjects().length;
    removeProject(-1);
    removeProject(before + 5);
    assert.equal(openProjects().length, before);
  });

  it('focusProject(index) closes Tune on the project being left', () => {
    const a = ManagedProject.createEmpty();
    const b = ManagedProject.createEmpty();
    addProject(a);
    addProject(b);
    const iA = openProjects().indexOf(a);
    const iB = openProjects().indexOf(b);

    focusProject(iA);
    presentationState.editDriver = true;

    focusProject(iB);

    assert.equal(focusedProject(), b);
    assert.equal(presentationState.editDriver, false, 'Tune closes on focus switch');
  });

  it('focusProject(index) closes the Driver Editor modal on focus switch', () => {
    const a = ManagedProject.createEmpty();
    const b = ManagedProject.createEmpty();
    addProject(a);
    addProject(b);
    const iA = openProjects().indexOf(a);
    const iB = openProjects().indexOf(b);

    focusProject(iA);
    presentationState.editDriverInfo = true;

    focusProject(iB);

    assert.equal(presentationState.editDriverInfo, false, 'Driver Editor modal closes on focus switch');
  });
});
