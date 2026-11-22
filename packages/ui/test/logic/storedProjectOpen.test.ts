/** A project that is stored the moment it opens is open already: choosing its row focuses it. */
import {describe, expect, it} from 'vitest';
import {ProjectBuilder} from '@openisd/design';
import {createMemoryStorage} from '@openisd/persistence';
import {openStoredProject} from '../../src/logic/storedProjectOpen.js';
import {createAppStateFixture} from '../fixtures/appStateFixture.js';
import {projectRepoOn} from '../fixtures/repoOn.js';

describe('openStoredProject', () => {
  it('focuses an open project that holds the stored id, and opens no second copy', () => {
    const {appState} = createAppStateFixture();
    const repo = projectRepoOn(appState.engine, {
      save: () => { throw new Error('no file'); }, saveAs: () => { throw new Error('no file'); },
      openFileName: () => null, forget: () => undefined,
    }, createMemoryStorage(), 'http://localhost');
    const first = ProjectBuilder.empty(appState.engine);
    first.name.set('First');
    first.save();
    const second = ProjectBuilder.empty(appState.engine);
    second.name.set('Second');
    second.save();
    appState.addProject(first);
    appState.addProject(second);
    repo.storeNew(first);
    const id = repo.storedIdOf(first);
    if (id === null) throw new Error('not stored');
    const result = openStoredProject(appState, repo, id);
    expect(result.kind).toBe('opened');
    expect(appState.openProjects()).toHaveLength(2);
    expect(appState.focusedProject()).toBe(first);
  });
});
