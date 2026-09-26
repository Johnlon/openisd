/**
 * Every tab shows the same session. This tab saves its own changes for the others, adopts the
 * changes another tab saves, and never writes an adopted session back — a tab that did would
 * make every other tab hear a change and adopt it again, forever.
 * bugs/BUG_20260926_tabs-overwrite-each-others-open-projects.md
 */
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {nextTick} from 'vue';
import {Engine} from '@openisd/design/engine';
import {OpenISDProject} from '@openisd/design';
import {createProjectRepo, createSharedMemoryStorage, createViewStateRepo, type FileStorage} from '@openisd/persistence';
import {startSessionSync} from '../../src/logic/sessionSync.js';
import {addProject, openProjects, removeProject} from '../../src/logic/appState.js';
import {presentationState} from '../../src/logic/presentationState.js';

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

function closeAll(): void {
  while (openProjects().length > 0) removeProject(0);
}

let stop: () => void = () => {};
beforeEach(closeAll);
afterEach(() => { stop(); closeAll(); });

describe('startSessionSync', () => {
  it('adopts the open projects another tab saves', async () => {
    const store = createSharedMemoryStorage();
    const otherTab = createProjectRepo(engine, noFiles, store.tab());
    const tab = store.tab();
    stop = startSessionSync({projectRepo: createProjectRepo(engine, noFiles, tab), viewStateRepo: createViewStateRepo(tab)});

    otherTab.saveOpenProjects([project('111111'), project('222222')], null);
    await nextTick();

    expect(openProjects().map(p => p.name.value)).toEqual(['111111', '222222']);
  });

  it('does not write an adopted session back for the other tabs', async () => {
    const store = createSharedMemoryStorage();
    const otherTab = createProjectRepo(engine, noFiles, store.tab());
    const tab = store.tab();
    stop = startSessionSync({projectRepo: createProjectRepo(engine, noFiles, tab), viewStateRepo: createViewStateRepo(tab)});
    let heardByOtherTab = 0;
    otherTab.watchOpenProjects(() => { heardByOtherTab++; });

    otherTab.saveOpenProjects([project('111111')], null);
    await nextTick();
    await nextTick();

    expect(heardByOtherTab).toBe(0);
  });

  it('saves a project opened in this tab for the other tabs', async () => {
    const store = createSharedMemoryStorage();
    const otherTab = createProjectRepo(engine, noFiles, store.tab());
    const tab = store.tab();
    stop = startSessionSync({projectRepo: createProjectRepo(engine, noFiles, tab), viewStateRepo: createViewStateRepo(tab)});

    addProject(project('333333'));
    await nextTick();

    const session = otherTab.loadOpenProjects();
    if (session === null || Array.isArray(session)) throw new Error('expected a session');
    expect(session.projects.map(p => p.name.value)).toEqual(['333333']);
  });

  it('adopts the view another tab saves', async () => {
    const store = createSharedMemoryStorage();
    const otherTab = createViewStateRepo(store.tab());
    const tab = store.tab();
    stop = startSessionSync({projectRepo: createProjectRepo(engine, noFiles, tab), viewStateRepo: createViewStateRepo(tab)});

    otherTab.save({ui: {...presentationState.ui, unitTokens: {probe_111111: 'x'}}});
    await nextTick();

    expect(presentationState.ui.unitTokens).toEqual({probe_111111: 'x'});
  });
});
