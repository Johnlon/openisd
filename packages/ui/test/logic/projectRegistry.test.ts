/**
 * projectRegistry — the multi-project registry in `appState.ts`
 * (`openProjects()`/`focusedProject()`/`focusProject()`/`removeProject()`/`addProject()`) —
 * human ruling 2026-08-18, REVIEW.md.
 *
 * The app has NO project until one is opened (John, 2026-09-08: "there is either selected
 * project or not selected project", "there is only focusedProject() which is nullable - thats
 * it"): no `seedProject`, no `openBlankProject()`, no `state` mirror.
 *
 * The registry is an ORDERED LIST, never a map keyed by name (Plan 1 Step 10):
 * `OpenISDProjectMeta`'s `name` is a LABEL, two open projects may share one, so it is never an
 * identity.
 *
 * `appState.ts` caches its state on a module-scope `ctx`, shared across every test in this file,
 * so the startup-shape tests MUST run first (they add and remove nothing) and every other test
 * asserts relative behaviour (deltas from whatever the registry already holds), never an
 * absolute starting count.
 */
import {describe, expect, it} from 'vitest';
import assert from 'node:assert/strict';
import * as appState from '../../src/logic/appState.js';
import {
    applyLoadedProject,
    requireFocusedProject,
    addProject,
    engine,
    focusedProject,
    focusProject,
    newProject,
    openProjects,
    removeProject,
} from '../../src/logic/appState.js';
import {OpenISDDriver, ProjectBuilder} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';
import type {OpenISDProject} from '@openisd/design';
import {presentationState} from '../../src/logic/presentationState.js';

/** Two independent projects, both named identically, so any name-keyed storage would collapse
 *  them into one. */
function namedProject(name: string): OpenISDProject {
  newProject();
  const p = openProjects()[openProjects().length - 1];
  p.name.set(name);
  return p;
}

describe('projectRegistry', () => {
  describe('starts with no project', () => {
    it('focusedProject() is null before anything is opened', () => {
      expect(appState.focusedProject()).toBeNull();
    });

    it('openProjects() is empty before anything is opened', () => {
      expect(appState.openProjects()).toEqual([]);
    });

    it('exports no seedProject / openBlankProject / state', () => {
      expect('seedProject' in appState).toBe(false);
      expect('openBlankProject' in appState).toBe(false);
      expect('state' in appState).toBe(false);
    });

    it('requireFocusedProject() throws when nothing is focused', () => {
      expect(() => appState.requireFocusedProject()).toThrow(appState.NoFocusedProjectError);
    });
  });

  describe('opening, focusing and removing projects', () => {
    it('opens a project on request, and the newly opened one is focused', () => {
      // The app starts with NO project (QO121, John 2026-09-08: "there is either selected project
      // or not selected project") — the startup tests above pin that shape. Here the
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
      const adopted = new ProjectBuilder(OpenISDDriver.empty(engine), engine)
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

    it('focusProject(index) closes What-if? on the project being left', () => {
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
      assert.equal(presentationState.editDriver, false, 'What-if? closes on focus switch');
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

  describe('is an ordered array, not a name-keyed map', () => {
    it('openProjects() returns a real Array, addressable by index', () => {
      assert.ok(Array.isArray(openProjects()), 'openProjects() must return an Array');
    });

    it('two open projects may share a name, and both survive', () => {
      const before = openProjects().length;
      const a = namedProject('Untitled');
      const b = namedProject('Untitled');
      const names = openProjects().slice(before).map(p => p.name.value);
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
      const indexOfA = openProjects().indexOf(a);
      focusProject(indexOfA);
      assert.equal(focusedProject(), a, 'focusing by index must land on the SPECIFIC instance, ' +
        'not "a project named Same Name" — a name cannot disambiguate the two');

      removeProject(openProjects().indexOf(b));
      removeProject(openProjects().indexOf(a));
      void before;
    });
  });

  describe('applyLoadedProject — the loaded project replaces the focused one wholesale', () => {
    it('a loaded project\'s active box type and fields both take effect on the focused tab', () => {
      newProject();
      const engine = createEngine();
      // This test is about which project is FOCUSED, not about any driver's contents, so the
      // driver states nothing — the domain's own blank rather than a record assembled here.
      const loaded = new ProjectBuilder(OpenISDDriver.empty(engine), engine)
        .sealed().volume_m3(0.0275).build();

      applyLoadedProject(loaded);

      assert.equal(requireFocusedProject(), loaded, 'the focused tab now IS the loaded project');
      assert.equal(requireFocusedProject().box.boxType.value, 'sealed');
      assert.equal(requireFocusedProject().box.sealed.volume_m3.value, 0.0275);
      });
  });
});
