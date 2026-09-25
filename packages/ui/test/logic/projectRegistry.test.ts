/**
 * The multi-project registry (`openProjects()`/`focusedProject()`/`focusProject()`/
 * `removeProject()`/`addProject()`) — human ruling 2026-08-18, REVIEW.md.
 *
 * `appState.ts` caches its state on a module-scope `ctx` (keyed off `window`, or an in-process
 * object outside a browser), shared across every test file that imports it in this run — so
 * these tests assert relative behaviour (deltas from whatever the registry already holds),
 * never an absolute starting count.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {
    addProject,
    engine,
    focusedProject,
    focusProject,
    newProject,
    openProjects,
    removeProject,
} from '../../src/logic/appState.js';
import {OpenISDDriver, OpenISDProject} from '@openisd/design';
import {presentationState} from '../../src/logic/presentationState.js';

describe('project registry', () => {
  it('opens a project on request, and the newly opened one is focused', () => {
    // The app starts with NO project (QO121, John 2026-09-08: "there is either selected project
    // or not selected project") — `no-seed-project.test.ts` pins that startup shape. Here the
    // registry is shared with every other test file in the run, so this asserts the DELTA.
    const before = openProjects().length;

    newProject();

    assert.equal(openProjects().length, before + 1);
    assert.equal(focusedProject(), openProjects()[before]);
  });

  it('addProject() appends the project it was handed, and focuses it', () => {
    // `addProject` is the door for a project built ELSEWHERE — a `.owpr` opened from disk, a
    // share link, a `.wpr` import. Distinct from `newProject()`, which builds a blank one, so it
    // is handed a project here rather than asserted through its caller.
    const adopted = OpenISDProject.builder(OpenISDDriver.empty(engine), engine)
      .sealed().volume_m3(0.03).build();
    const before = openProjects().length;

    addProject(adopted);

    assert.equal(openProjects().length, before + 1);
    assert.equal(openProjects()[before], adopted, 'the registry holds the project it was handed');
    assert.equal(focusedProject(), adopted, 'the newly added project becomes focused');
  });

  it('focusProject(index) moves focus; an out-of-range index is ignored', () => {
    newProject();
    newProject();
    const p1 = openProjects()[openProjects().length - 2];
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
    newProject();
    newProject();
    const p2 = openProjects()[openProjects().length - 1];
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
    newProject();
    newProject();
    const a = openProjects()[openProjects().length - 2];
    const b = openProjects()[openProjects().length - 1];
    const iA = openProjects().indexOf(a);
    const iB = openProjects().indexOf(b);

    focusProject(iA);
    presentationState.editDriver = true;

    focusProject(iB);

    assert.equal(focusedProject(), b);
    assert.equal(presentationState.editDriver, false, 'Tune closes on focus switch');
  });

  it('focusProject(index) closes the Driver Editor modal on focus switch', () => {
    newProject();
    newProject();
    const a = openProjects()[openProjects().length - 2];
    const b = openProjects()[openProjects().length - 1];
    const iA = openProjects().indexOf(a);
    const iB = openProjects().indexOf(b);

    focusProject(iA);
    presentationState.editDriverInfo = true;

    focusProject(iB);

    assert.equal(presentationState.editDriverInfo, false, 'Driver Editor modal closes on focus switch');
  });
});
