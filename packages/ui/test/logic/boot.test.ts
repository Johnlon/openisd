/**
 * Startup is a sequence, not a set of flags that happen to fire in a helpful order.
 *
 * Both faults reported on 2026-09-25 were ordering faults: a panel restored from the stored
 * view mounted before anything had established whether a project existed, and persistence was
 * armed on a boot that had failed to restore. `bootApplication` states the order once —
 * share link, session, legacy project, view, panels — and nothing in it runs before the phase
 * it depends on has returned.
 */
import {beforeEach, describe, expect, it} from 'vitest';
import {Engine} from '@openisd/design/engine';
import {OpenISDProject} from '@openisd/design';
import type {OpenProjectSession, ProjectRepo, ViewSnapshot} from '@openisd/persistence';
import {bootApplication, type BootDeps} from '../../src/logic/boot.js';
import {focusedProject, openProjects, removeProject} from '../../src/logic/appState.js';
import {presentationState} from '../../src/logic/presentationState.js';

const engine = new Engine();

function project(name: string): OpenISDProject {
  const p = OpenISDProject.empty(engine);
  p.name.set(name);
  p.save();
  return p;
}

interface Recorded {
  readonly log: string[];
  readonly deps: BootDeps;
}

/** Deps whose every door records that it was asked, so the order is observable. */
function recording(overrides: {
  hash?: () => Awaited<ReturnType<ProjectRepo['loadFromHash']>>;
  session?: () => OpenProjectSession | string[] | null;
  view?: () => ViewSnapshot | null;
} = {}): Recorded {
  const log: string[] = [];
  const deps: BootDeps = {
    projectRepo: {
      loadFromHash: async () => { log.push('hash'); return overrides.hash ? overrides.hash() : null; },
      loadOpenProjects: () => { log.push('session'); return overrides.session ? overrides.session() : null; },
      loadFromStorage: () => { log.push('legacy'); return null; },
      quarantineOpenSession: () => { log.push('quarantine'); },
    },
    viewStateRepo: {load: () => { log.push('view'); return overrides.view ? overrides.view() : null; }},
    logging: {flash: (m: string) => { log.push('flash: ' + m); }},
    editProjectDriver: () => { log.push('open-editor'); },
  };
  return {log, deps};
}

beforeEach(() => {
  while (openProjects().length > 0) removeProject(openProjects().length - 1);
  presentationState.editDriver = false;
  presentationState.editDriverInfo = false;
  presentationState.ui.originalTuneOpen = false;
  presentationState.ui.originalEditorOpen = false;
});

describe('bootApplication', () => {
  it('runs its phases in one stated order', async () => {
    const {log, deps} = recording();
    await bootApplication(deps);
    expect(log).toEqual(['hash', 'session', 'legacy', 'view']);
  });

  it('a share link ends the restore — no session, legacy or stored view is consulted', async () => {
    const {log, deps} = recording({hash: () => ({project: project('shared'), view: {ui: {}}})});
    await bootApplication(deps);
    expect(log).toEqual(['hash']);
    expect(focusedProject()?.name.value).toBe('shared');
  });

  it('restores the session projects', async () => {
    const session = {projects: [project('one'), project('two')], focusedIndex: 1, refused: []};
    const {deps} = recording({session: () => session});
    await bootApplication(deps);
    expect(openProjects()).toHaveLength(2);
    expect(focusedProject()?.name.value).toBe('two');
  });

  it('quarantines a record that held an entry it could not read, and says so', async () => {
    const session = {projects: [project('one')], focusedIndex: 0, refused: ['entry b: nope']};
    const {log, deps} = recording({session: () => session});
    await bootApplication(deps);
    expect(log).toContain('quarantine');
    expect(log.some(l => l.startsWith('flash:'))).toBe(true);
    expect(openProjects()).toHaveLength(1);
  });

  it('reopens a panel the stored view left open, once a project is there to open it on', async () => {
    const session = {projects: [project('one')], focusedIndex: 0, refused: []};
    const {log, deps} = recording({session: () => session, view: () => ({ui: {originalTuneOpen: true, originalEditorOpen: true}})});
    await bootApplication(deps);
    expect(presentationState.editDriver).toBe(true);
    expect(log.indexOf('view')).toBeLessThan(log.indexOf('open-editor'));
  });

  it('opens no panel when the boot ended with no project', async () => {
    const {deps} = recording({view: () => ({ui: {originalTuneOpen: true, originalEditorOpen: true}})});
    await bootApplication(deps);
    expect(presentationState.editDriver).toBe(false);
    expect(presentationState.editDriverInfo).toBe(false);
  });
});
