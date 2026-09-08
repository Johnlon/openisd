/**
 * The app has NO project until one is opened — `focusedProject()` returns `null` at startup,
 * and there is no `seedProject`, no `openBlankProject()`, no `state` mirror.
 *
 * John, 2026-09-08: "there is either selected project or not selected project",
 * "there is only focusedProject() which is nullable - thats it".
 *
 * `appState.ts` caches its registry on a module-scope singleton shared across every test file
 * in a run, so a test that has already added projects would see them here. This file imports
 * `appState.ts` and asserts the STARTUP shape, so it must be the only place in its run that
 * touches the registry — it adds nothing and removes nothing.
 */
import { describe, it, expect } from 'vitest';
import * as appState from '../../src/logic/appState.js';

describe('the app starts with no project', () => {
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
