/**
 * The open-projects registry is an ORDERED LIST, never a map keyed by name — Plan 1 Step 10.
 *
 * `OpenISDProjectMeta`'s own doc already states why: "`name` is a LABEL: two open projects may
 * share one, so it is never an identity." A map keyed by name cannot hold two projects that
 * share a label at all — the second `add` would silently overwrite the first. This is the gate
 * that keeps that true of the registry `appState.ts` actually exposes (`openProjects()` /
 * `addProject()` / `removeProject()` / `focusProject()`), not just of the type comment.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import {
  openProjects, addProject, removeProject, focusProject, focusedProject,
} from '../../src/logic/appState.js';
import { ManagedProject } from '../../src/logic/managedProject.js';

/** Two independent projects, both named identically, so any name-keyed storage would collapse
 *  them into one. */
function namedProject(name: string): ManagedProject {
  const p = ManagedProject.createEmpty();
  p.mutate(project => project.setProjectMeta({ ...project.projectMeta(), name }));
  return p;
}

describe('the project registry is an ordered array, not a name-keyed map', () => {
  it('openProjects() returns a real Array, addressable by index', () => {
    assert.ok(Array.isArray(openProjects()), 'openProjects() must return an Array');
  });

  it('two open projects may share a name, and both survive', () => {
    const before = openProjects().length;
    const a = namedProject('Untitled');
    const b = namedProject('Untitled');
    addProject(a);
    addProject(b);
    const names = openProjects().slice(before).map(p => p.snapshot().projectMeta().name);
    assert.deepEqual(names, ['Untitled', 'Untitled'],
      'a name-keyed store would have silently dropped one of these two');
    assert.equal(openProjects().length, before + 2, 'both entries must be present, not merged');

    // Clean up — this suite shares the module-level registry with every other test file.
    removeProject(openProjects().indexOf(b));
    removeProject(openProjects().indexOf(a));
  });

  it('focus is by POSITION, so it survives a duplicate name unambiguously', () => {
    const before = openProjects().length;
    const a = namedProject('Same Name');
    const b = namedProject('Same Name');
    addProject(a);
    addProject(b);
    const indexOfA = openProjects().indexOf(a);
    focusProject(indexOfA);
    assert.equal(focusedProject(), a, 'focusing by index must land on the SPECIFIC instance, ' +
      'not "a project named Same Name" — a name cannot disambiguate the two');

    removeProject(openProjects().indexOf(b));
    removeProject(openProjects().indexOf(a));
    void before;
  });
});
