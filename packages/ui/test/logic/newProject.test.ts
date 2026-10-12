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
import {describe, expect, it, beforeEach} from 'vitest';
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

describe('newProject', () => {
  it('starts with Rg not at the driver side (WinISD default)', () => {
    appState.newProject();

    expect(appState.focusedProject()!.rgAtDriverSide.value).toBe(false);
  });

  it('adds one project and focuses it', () => {
    const before = appState.openProjects().length;

    appState.newProject();

    expect(appState.openProjects().length).toBe(before + 1);
    expect(appState.focusedProject()).toBe(appState.openProjects()[before]);
  });

  it('starts with no driver chosen, which is what the wizard then fills in', () => {
    appState.newProject();

    expect(appState.focusedProject()!.driver.brand.value).toBe('');
    expect(appState.focusedProject()!.driver.specs.Fs_hz.value).toBe(null);
  });

  it('holds a radiator already, so a switch to a passive-radiator box is legal', () => {
    appState.newProject();

    appState.focusedProject()!.box.passiveRadiator.radiator.spec.Fs_hz.set(12);
    expect(appState.focusedProject()!.box.passiveRadiator.radiator.spec.Fs_hz.value).toBe(12);
  });

  it('gives each new project its own records', () => {
    appState.newProject();
    const one = appState.focusedProject()!;
    appState.newProject();
    const two = appState.focusedProject()!;

    one.driver.model.set('RS225');

    expect(two.driver.model.value).toBe('');
  });

  it('stamps creator and the embedded driver\'s providedBy from the app\'s own Username setting', () => {
    const previous = presentationState.ui.username;
    presentationState.ui.username = 'johnl';
    try {
      appState.newProject();
      expect(appState.focusedProject()!.creator.value).toBe('johnl');
      expect(appState.focusedProject()!.driver.providedBy.value).toBe('johnl');
    } finally {
      presentationState.ui.username = previous;
    }
  });

  it('leaves creator and providedBy blank when no Username is set', () => {
    const previous = presentationState.ui.username;
    presentationState.ui.username = undefined;
    try {
      appState.newProject();
      expect(appState.focusedProject()!.creator.value).toBe('');
      expect(appState.focusedProject()!.driver.providedBy.value).toBeNull();
    } finally {
      presentationState.ui.username = previous;
    }
  });
});

describe('definePassiveRadiator', () => {
  it('puts a blank radiator in the focused project, so the editor has one to fill in', () => {
    appState.newProject();
    const project = appState.focusedProject();
    if (!project) throw new Error('newProject must focus the project it created');

    appState.definePassiveRadiator();

    // A blank radiator states nothing, but the slot is no longer empty — writing to it is
    // exactly what the editor does next, and an empty slot refuses a write.
    project.box.passiveRadiator.radiator.spec.Fs_hz.set(11);
    expect(project.box.passiveRadiator.radiator.spec.Fs_hz.value).toBe(11);
  });

  it('replaces whatever radiator was there, so Define is not an edit of the old one', () => {
    appState.newProject();
    const project = appState.focusedProject();
    if (!project) throw new Error('newProject must focus the project it created');
    appState.definePassiveRadiator();
    project.box.passiveRadiator.radiator.model.set('Old PR');

    appState.definePassiveRadiator();

    expect(project.box.passiveRadiator.radiator.model.value).toBe('');
  });

  it('stamps the new radiator\'s providedBy from the app\'s own Username setting', () => {
    const previous = presentationState.ui.username;
    presentationState.ui.username = 'johnl';
    try {
      appState.newProject();
      appState.definePassiveRadiator();
      expect(appState.focusedProject()!.box.passiveRadiator.radiator.providedBy.value).toBe('johnl');
    } finally {
      presentationState.ui.username = previous;
    }
  });
});

describe('boxTypeIsSimulatable', () => {
  it('accepts every box type — bandpass6 and ABC gained circuits in df81902c, so none is pending', () => {
    for (const box of ['sealed', 'vented', 'bandpass4', 'bandpass6', 'abc', 'box-passive-radiator'] as const) {
      expect(appState.boxTypeIsSimulatable(box), box).toBe(true);
    }
  });
});

describe('IMPLEMENTED_BOX_TYPES', () => {
  it('lists every box type — no picker row is dimmed', () => {
    for (const box of ['sealed', 'vented', 'bandpass4', 'bandpass6', 'abc', 'box-passive-radiator'] as const)
      expect(appState.IMPLEMENTED_BOX_TYPES.includes(box), box).toBe(true);
  });
});
