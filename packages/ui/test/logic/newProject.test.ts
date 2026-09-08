/**
 * `newProject()` — the store's entry point for "a new project, nothing chosen yet".
 *
 * QO125 (John, 2026-09-08): the wizard EDITS a defaulted project rather than collecting a spec
 * and building at the end, so a project must be able to exist before a driver is picked. The
 * defaults come from the domain (`OpenISDProject.empty`); this only adds it to the registry and
 * focuses it, which is the store's own job.
 *
 * `appState.ts` caches its registry on a module-scope singleton shared across every test file in
 * a run, so these assert DELTAS from whatever the registry already holds, never absolute counts.
 */
import { describe, it, expect } from 'vitest';
import { newProject, openProjects, focusedProject } from '../../src/logic/appState.js';

describe('newProject', () => {
  it('adds one project and focuses it', () => {
    const before = openProjects().length;

    newProject();

    expect(openProjects().length).toBe(before + 1);
    expect(focusedProject()).toBe(openProjects()[before]);
  });

  it('starts with no driver chosen, which is what the wizard then fills in', () => {
    newProject();

    expect(focusedProject()!.driver.brand.get().value).toBe('');
    expect(focusedProject()!.driver.spec.woofer.Fs_hz.get().state).toBe('not-available');
  });

  it('holds a radiator already, so a switch to a passive-radiator box is legal', () => {
    newProject();

    focusedProject()!.box.passiveRadiator.radiator.spec.Fs_hz.set(12);
    expect(focusedProject()!.box.passiveRadiator.radiator.spec.Fs_hz.get().value).toBe(12);
  });

  it('gives each new project its own records', () => {
    newProject();
    const one = focusedProject()!;
    newProject();
    const two = focusedProject()!;

    one.driver.model.set('RS225');

    expect(two.driver.model.get().value).toBe('');
  });
});
