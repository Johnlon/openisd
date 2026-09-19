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
import {describe, expect, it} from 'vitest';
import {
    boxTypeIsSimulatable,
    definePassiveRadiator,
    focusedProject,
    newProject,
    openProjects
} from '../../src/logic/appState.js';

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

describe('definePassiveRadiator', () => {
  it('puts a blank radiator in the focused project, so the editor has one to fill in', () => {
    newProject();
    const project = focusedProject();
    if (!project) throw new Error('newProject must focus the project it created');

    definePassiveRadiator();

    // A blank radiator states nothing, but the slot is no longer empty — writing to it is
    // exactly what the editor does next, and an empty slot refuses a write.
    project.box.passiveRadiator.radiator.spec.Fs_hz.set(11);
    expect(project.box.passiveRadiator.radiator.spec.Fs_hz.get().value).toBe(11);
  });

  it('replaces whatever radiator was there, so Define is not an edit of the old one', () => {
    newProject();
    const project = focusedProject();
    if (!project) throw new Error('newProject must focus the project it created');
    definePassiveRadiator();
    project.box.passiveRadiator.radiator.model.set('Old PR');

    definePassiveRadiator();

    expect(project.box.passiveRadiator.radiator.model.get().value).toBe('');
  });
});

describe('boxTypeIsSimulatable', () => {
  it('accepts a box type the circuit models', () => {
    expect(boxTypeIsSimulatable('sealed')).toBe(true);
  });

  it('refuses one it does not, which is what puts the Box tab in its pending state', () => {
    expect(boxTypeIsSimulatable('bandpass6')).toBe(false);
  });
});
