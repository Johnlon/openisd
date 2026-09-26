/**
 * Every tab of the app shares one session. A tab hears when ANOTHER tab rewrites the open
 * projects or the view, and never its own writes. The same view saved in another key order is
 * the same text, so it is not a change.
 * bugs/BUG_20260926_tabs-overwrite-each-others-open-projects.md
 */
import {describe, expect, it} from 'vitest';
import {createProjectRepo} from '../src/repos/projectRepo.js';
import {createViewStateRepo} from '../src/repos/viewStateRepo.js';
import type {FileStorage} from '../src/storage/fileStorage.js';
import {createSharedMemoryStorage} from '../src/storage/keyValueStorage.js';
import {OpenISDProject} from '@openisd/design';
import {Engine} from '@openisd/design/engine';

const engine = new Engine();

const noFiles: FileStorage = {
  save: () => { throw new Error('no test here writes a file'); },
  saveAs: () => { throw new Error('no test here writes a file'); },
  openFileName: () => null,
  forget: () => { throw new Error('no test here writes a file'); },
};

function project(name: string): OpenISDProject {
  const p = OpenISDProject.empty(engine);
  p.name.set(name);
  p.save();
  return p;
}

describe('open projects shared between tabs', () => {
  it('a tab hears another tab save its open projects', () => {
    const store = createSharedMemoryStorage();
    const first = createProjectRepo(engine, noFiles, store.tab());
    const second = createProjectRepo(engine, noFiles, store.tab());
    let heard = 0;
    second.watchOpenProjects(() => { heard++; });

    first.saveOpenProjects([project('111111')], null);

    expect(heard).toBe(1);
  });

  it('a tab does not hear its own save', () => {
    const store = createSharedMemoryStorage();
    const repo = createProjectRepo(engine, noFiles, store.tab());
    let heard = 0;
    repo.watchOpenProjects(() => { heard++; });

    repo.saveOpenProjects([project('111111')], null);

    expect(heard).toBe(0);
  });

  it('a tab stops hearing once it unsubscribes', () => {
    const store = createSharedMemoryStorage();
    const first = createProjectRepo(engine, noFiles, store.tab());
    const second = createProjectRepo(engine, noFiles, store.tab());
    let heard = 0;
    const stop = second.watchOpenProjects(() => { heard++; });
    stop();

    first.saveOpenProjects([project('111111')], null);

    expect(heard).toBe(0);
  });
});

describe('view shared between tabs', () => {
  it('a tab hears another tab save the view', () => {
    const store = createSharedMemoryStorage();
    const first = createViewStateRepo(store.tab());
    const second = createViewStateRepo(store.tab());
    let heard = 0;
    second.watch(() => { heard++; });

    first.save({ui: {a: 111111}});

    expect(heard).toBe(1);
  });

  it('the same view saved with its fields in another order is not a change', () => {
    const store = createSharedMemoryStorage();
    const first = createViewStateRepo(store.tab());
    const second = createViewStateRepo(store.tab());
    first.save({ui: {a: 111111, b: {c: 1, d: 2}}});
    let heard = 0;
    first.watch(() => { heard++; });

    second.save({ui: {b: {d: 2, c: 1}, a: 111111}});

    expect(heard).toBe(0);
  });
});
