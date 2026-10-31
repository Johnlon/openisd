/**
 * A project is stored the moment it is made (John, 17 Oct 2026): from New project, the wizard,
 * Open a file and Duplicate alike. Later edits are the only unsaved changes.
 */
import {describe, expect, it, vi} from 'vitest';
import {nextTick} from 'vue';
import {ProjectBuilder} from '@openisd/design';
import {createMemoryStorage} from '@openisd/persistence';
import {startStoringNewProjects} from '../../src/logic/newProjectStore.js';
import {createAppStateFixture} from '../fixtures/appStateFixture.js';
import {projectRepoOn} from '../fixtures/repoOn.js';

function setup(storage = createMemoryStorage()) {
  const {appState} = createAppStateFixture();
  const projectRepo = projectRepoOn(appState.engine, {
    save: () => { throw new Error('no file'); }, saveAs: () => { throw new Error('no file'); },
    openFileName: () => null, forget: () => undefined,
  }, storage, 'http://localhost');
  const onFailed = vi.fn<() => void>();
  const stop = startStoringNewProjects({appState, projectRepo, onFailed});
  const made = (name: string) => {
    const p = ProjectBuilder.empty(appState.engine);
    p.name.set(name);
    p.save();
    return p;
  };
  return {appState, projectRepo, onFailed, stop, made};
}

describe('startStoringNewProjects', () => {
  it('stores a project when it is opened, and it is not an unsaved change', async () => {
    const {appState, projectRepo, made} = setup();
    const p = made('New one');
    appState.addProject(p);
    await nextTick();
    expect(projectRepo.isStored(p)).toBe(true);
    expect(p.isModified()).toBe(false);
  });

  it('an edit afterwards is an unsaved change', async () => {
    const {appState, made} = setup();
    const p = made('Edited');
    appState.addProject(p);
    await nextTick();
    p.name.set('Edited more');
    expect(p.isModified()).toBe(true);
  });

  it('stores a project already open when it starts', () => {
    const {appState, projectRepo, made, stop} = setup();
    stop();
    const p = made('Early');
    appState.addProject(p);
    const again = startStoringNewProjects({appState, projectRepo, onFailed: () => undefined});
    again();
    expect(projectRepo.isStored(p)).toBe(true);
  });

  it('a project the store will not take is not created, and the user is told', async () => {
    const storage = createMemoryStorage();
    const {appState, projectRepo, onFailed, made} = setup(storage);
    vi.spyOn(storage, 'set').mockImplementation(() => { throw new Error('quota'); });
    const p = made('Too big');
    appState.addProject(p);
    await nextTick();
    expect(onFailed).toHaveBeenCalledTimes(1);
    expect(projectRepo.isStored(p)).toBe(false);
    expect(appState.openProjects()).not.toContain(p);
  });
});
