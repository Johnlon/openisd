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
import {describe, expect, it, beforeEach} from 'vitest';
import assert from 'node:assert/strict';
import {NoFocusedProjectError} from '../../src/logic/appState.js';
import {OpenISDDriver, ProjectBuilder} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';
import type {OpenISDProject} from '@openisd/design';
import {createAppStateFixture} from '../fixtures/appStateFixture.js';
import type {AppState} from '../../src/logic/appState.js';
import type {PresentationState} from '../../src/logic/presentationState.js';

let appState: AppState;
let presentationState: PresentationState;

beforeEach(() => {
  const fixture = createAppStateFixture();
  appState = fixture.appState;
  presentationState = fixture.presentation;
});

/** Two independent projects, both named identically, so any name-keyed storage would collapse
 *  them into one. */
function namedProject(name: string): OpenISDProject {
  appState.newProject();
  const p = appState.openProjects()[appState.openProjects().length - 1];
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
      expect(() => appState.requireFocusedProject()).toThrow(NoFocusedProjectError);
    });
  });

  describe('opening, focusing and removing projects', () => {
    it('opens a project on request, and the newly opened one is focused', () => {
      // The app starts with NO project (QO121, John 2026-09-08: "there is either selected project
      // or not selected project") — the startup tests above pin that shape. Here the
      // registry is shared with every other test file in the run, so this asserts the DELTA.
      const before = appState.openProjects().length;

      appState.newProject();

      assert.equal(appState.openProjects().length, before + 1);
      assert.equal(appState.focusedProject(), appState.openProjects()[before]);
    });

    it('addProject() appends the project it was handed, and focuses it', () => {
      // `appState.addProject` is the door for a project built ELSEWHERE — a `.owpr` opened from disk, a
      // share link, a `.wpr` import. Distinct from `appState.newProject()`, which builds a blank one, so it
      // is handed a project here rather than asserted through its caller.
      const adopted = new ProjectBuilder(OpenISDDriver.empty(appState.engine), appState.engine)
        .sealed().volume_m3(0.03).build();
      const before = appState.openProjects().length;

      appState.addProject(adopted);

      assert.equal(appState.openProjects().length, before + 1);
      assert.equal(appState.openProjects()[before], adopted, 'the registry holds the project it was handed');
      assert.equal(appState.focusedProject(), adopted, 'the newly added project becomes focused');
    });

    it('focusProject(index) moves focus; an out-of-range index is ignored', () => {
      appState.newProject();
      appState.newProject();
      const p1 = appState.openProjects()[appState.openProjects().length - 2];
      const i1 = appState.openProjects().indexOf(p1);

      appState.focusProject(i1);
      assert.equal(appState.focusedProject(), p1);

      const before = appState.focusedProject();
      appState.focusProject(-1);
      assert.equal(appState.focusedProject(), before, 'negative index ignored');
      appState.focusProject(999);
      assert.equal(appState.focusedProject(), before, 'too-large index ignored');
    });

    it('removeProject(index) clamps focus to the new last project when it was past the end', () => {
      appState.newProject();
      appState.newProject();
      const p2 = appState.openProjects()[appState.openProjects().length - 1];
      const iLast = appState.openProjects().length - 1;
      assert.equal(appState.focusedProject(), p2, 'addProject focused it');

      appState.removeProject(iLast);

      assert.equal(appState.focusedProject(), appState.openProjects()[appState.openProjects().length - 1],
        'focus clamped to the new last project, not left pointing past the end');
    });

    it('removeProject() on an out-of-range index is a no-op', () => {
      const before = appState.openProjects().length;
      appState.removeProject(-1);
      appState.removeProject(before + 5);
      assert.equal(appState.openProjects().length, before);
    });

    it('focusProject(index) closes What-if? on the project being left', () => {
      appState.newProject();
      appState.newProject();
      const a = appState.openProjects()[appState.openProjects().length - 2];
      const b = appState.openProjects()[appState.openProjects().length - 1];
      const iA = appState.openProjects().indexOf(a);
      const iB = appState.openProjects().indexOf(b);

      appState.focusProject(iA);
      presentationState.editDriver = true;

      appState.focusProject(iB);

      assert.equal(appState.focusedProject(), b);
      assert.equal(presentationState.editDriver, false, 'What-if? closes on focus switch');
    });

    it('focusProject(index) closes the Driver Editor modal on focus switch', () => {
      appState.newProject();
      appState.newProject();
      const a = appState.openProjects()[appState.openProjects().length - 2];
      const b = appState.openProjects()[appState.openProjects().length - 1];
      const iA = appState.openProjects().indexOf(a);
      const iB = appState.openProjects().indexOf(b);

      appState.focusProject(iA);
      presentationState.editDriverInfo = true;

      appState.focusProject(iB);

      assert.equal(presentationState.editDriverInfo, false, 'Driver Editor modal closes on focus switch');
    });
  });

  describe('is an ordered array, not a name-keyed map', () => {
    it('openProjects() returns a real Array, addressable by index', () => {
      assert.ok(Array.isArray(appState.openProjects()), 'openProjects() must return an Array');
    });

    it('two open projects may share a name, and both survive', () => {
      const before = appState.openProjects().length;
      const a = namedProject('Untitled');
      const b = namedProject('Untitled');
      const names = appState.openProjects().slice(before).map(p => p.name.value);
      assert.deepEqual(names, ['Untitled', 'Untitled'],
        'a name-keyed store would have silently dropped one of these two');
      assert.equal(appState.openProjects().length, before + 2, 'both entries must be present, not merged');

      // Clean up — this suite shares the module-level registry with every other test file.
      appState.removeProject(appState.openProjects().indexOf(b));
      appState.removeProject(appState.openProjects().indexOf(a));
    });

    it('focus is by POSITION, so it survives a duplicate name unambiguously', () => {
      const before = appState.openProjects().length;
      const a = namedProject('Same Name');
      const b = namedProject('Same Name');
      const indexOfA = appState.openProjects().indexOf(a);
      appState.focusProject(indexOfA);
      assert.equal(appState.focusedProject(), a, 'focusing by index must land on the SPECIFIC instance, ' +
        'not "a project named Same Name" — a name cannot disambiguate the two');

      appState.removeProject(appState.openProjects().indexOf(b));
      appState.removeProject(appState.openProjects().indexOf(a));
      void before;
    });
  });

  describe('applyLoadedProject — the loaded project replaces the focused one wholesale', () => {
    it('a loaded project\'s active box type and fields both take effect on the focused tab', () => {
      appState.newProject();
      const engine = createEngine();
      // This test is about which project is FOCUSED, not about any driver's contents, so the
      // driver states nothing — the domain's own blank rather than a record assembled here.
      const loaded = new ProjectBuilder(OpenISDDriver.empty(engine), engine)
        .sealed().volume_m3(0.0275).build();

      appState.applyLoadedProject(loaded);

      assert.equal(appState.requireFocusedProject(), loaded, 'the focused tab now IS the loaded project');
      assert.equal(appState.requireFocusedProject().box.boxType.value, 'sealed');
      assert.equal(appState.requireFocusedProject().box.sealed.volume_m3.value, 0.0275);
      });
  });
});
