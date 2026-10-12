/**
 * Every tab shows the same session. This tab saves its own changes for the others, adopts the
 * changes another tab saves, and never writes an adopted session back — a tab that did would
 * make every other tab hear a change and adopt it again, forever.
 * bugs/archive/BUG_20260926_tabs-overwrite-each-others-open-projects.md
 */
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {nextTick} from 'vue';
import {createEngine} from '@openisd/design/engine';
import {NumberField} from '@openisd/design/fields';
import {OpenISDProject, ProjectBuilder} from '@openisd/design';
import {createProjectRepo, createSharedMemoryStorage, createViewStateRepo, type FileStorage, type ProjectRepairReport} from '@openisd/persistence';
import {readFileSync} from 'node:fs';
import {ensureSampleProject, SAMPLE_PROJECT_OWPR} from '../fixtures/sampleProject.js';
import {startSessionSync} from '../../src/logic/sessionSync.js';
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

const engine = createEngine();

const noFiles: FileStorage = {
  save: () => { throw new Error('no test here writes a file'); },
  saveAs: () => { throw new Error('no test here writes a file'); },
  openFileName: () => null,
  forget: () => { throw new Error('no test here writes a file'); },
};

function project(name: string): OpenISDProject {
  const p = ProjectBuilder.empty(engine);
  p.name.set(name);
  p.save();
  return p;
}

function closeAll(): void {
  while (appState.openProjects().length > 0) appState.removeProject(0);
}

let stop: () => void = () => {};
beforeEach(closeAll);
afterEach(() => { stop(); closeAll(); });

describe('startSessionSync', () => {
  it('adopts the open projects another tab saves', async () => {
    const store = createSharedMemoryStorage();
    const otherTab = createProjectRepo(engine, noFiles, store.tab(), 'http://localhost');
    const tab = store.tab();
    stop = startSessionSync({projectRepo: createProjectRepo(engine, noFiles, tab, 'http://localhost'), viewStateRepo: createViewStateRepo(tab), appState});

    otherTab.saveOpenProjects([project('111111'), project('222222')], null, new Set());
    await nextTick();

    expect(appState.openProjects().map(p => p.name.value)).toEqual(['111111', '222222']);
  });

  it('does not write an adopted session back for the other tabs', async () => {
    const store = createSharedMemoryStorage();
    const otherTab = createProjectRepo(engine, noFiles, store.tab(), 'http://localhost');
    const tab = store.tab();
    stop = startSessionSync({projectRepo: createProjectRepo(engine, noFiles, tab, 'http://localhost'), viewStateRepo: createViewStateRepo(tab), appState});
    let heardByOtherTab = 0;
    otherTab.watchOpenProjects(() => { heardByOtherTab++; });

    otherTab.saveOpenProjects([project('111111')], null, new Set());
    await nextTick();
    await nextTick();

    expect(heardByOtherTab).toBe(0);
  });

  it('saves a project opened in this tab for the other tabs', async () => {
    const store = createSharedMemoryStorage();
    const otherTab = createProjectRepo(engine, noFiles, store.tab(), 'http://localhost');
    const tab = store.tab();
    stop = startSessionSync({projectRepo: createProjectRepo(engine, noFiles, tab, 'http://localhost'), viewStateRepo: createViewStateRepo(tab), appState});

    appState.addProject(project('333333'));
    await nextTick();

    const session = otherTab.loadOpenProjects();
    if (session === null || Array.isArray(session)) throw new Error('expected a session');
    expect(session.projects.map(p => p.name.value)).toEqual(['333333']);
  });

  // bugs/BUG_20261005_project-selection-lost-on-reload.md
  it('saves a trace hidden in this tab, so a reload restores it hidden', async () => {
    const store = createSharedMemoryStorage();
    const tab = store.tab();
    stop = startSessionSync({projectRepo: createProjectRepo(engine, noFiles, tab, 'http://localhost'), viewStateRepo: createViewStateRepo(tab), appState});
    appState.addProject(project('111111'));
    appState.addProject(project('222222'));
    await nextTick();

    appState.setTraceVisible(appState.openProjects()[0], false);
    await nextTick();

    const session = createProjectRepo(engine, noFiles, store.tab(), 'http://localhost').loadOpenProjects();
    if (session === null || Array.isArray(session)) throw new Error('expected a session');
    expect(session.projects.map(p => session.traceHidden.has(p))).toEqual([true, false]);
  });

  it('adopts which traces another tab hid', async () => {
    const store = createSharedMemoryStorage();
    const otherTab = createProjectRepo(engine, noFiles, store.tab(), 'http://localhost');
    const tab = store.tab();
    stop = startSessionSync({projectRepo: createProjectRepo(engine, noFiles, tab, 'http://localhost'), viewStateRepo: createViewStateRepo(tab), appState});
    const hidden = project('111111');

    otherTab.saveOpenProjects([hidden, project('222222')], null, new Set([hidden]));
    await nextTick();

    expect(appState.openProjects().map(p => appState.isTraceVisible(p))).toEqual([false, true]);
  });

  it('adopts the view another tab saves', async () => {
    const store = createSharedMemoryStorage();
    const otherTab = createViewStateRepo(store.tab());
    const tab = store.tab();
    stop = startSessionSync({projectRepo: createProjectRepo(engine, noFiles, tab, 'http://localhost'), viewStateRepo: createViewStateRepo(tab), appState});

    otherTab.save({ui: {...presentationState.ui, unitTokens: {[NumberField.BOX_FB_HZ.value]: 'kHz'}}});
    await nextTick();

    expect(presentationState.ui.unitTokens).toEqual({[NumberField.BOX_FB_HZ.value]: 'kHz'});
  });
});

describe('startSessionSync — a stored session the app wrote', () => {
  it('reads back in another tab with nothing repaired and nothing written', async () => {
    ensureSampleProject();
    const store = createSharedMemoryStorage();
    const repairs: ProjectRepairReport[] = [];
    const otherTab = store.tab();
    const otherRepo = createProjectRepo(engine, noFiles, otherTab, 'http://localhost', r => { repairs.push(r); });
    const tab = store.tab();
    stop = startSessionSync({projectRepo: createProjectRepo(engine, noFiles, tab, 'http://localhost', r => { repairs.push(r); }), viewStateRepo: createViewStateRepo(tab), appState});
    const sample = OpenISDProject.fromOwprText(readFileSync(SAMPLE_PROJECT_OWPR, 'utf8'), engine);
    if (Array.isArray(sample)) throw new Error(sample.join('; '));
    let heardByOtherTab = 0;
    otherRepo.watchOpenProjects(() => { heardByOtherTab++; });

    appState.addProject(sample);
    await nextTick();
    await nextTick();
    const session = otherRepo.loadOpenProjects();

    expect(Array.isArray(session) ? session : []).toEqual([]);
    expect(repairs).toEqual([]);
    expect(heardByOtherTab).toBe(1);
  });
});

// bugs/archive/BUG_20261001_boot-rewrites-open-sessions-and-other-tabs-rebuild.md
describe('startSessionSync — a project imported in one tab', () => {
  it('is stored in the form another tab reads it in, so that tab has nothing to write back', async () => {
    ensureSampleProject();
    const store = createSharedMemoryStorage();
    const tab = store.tab();
    stop = startSessionSync({projectRepo: createProjectRepo(engine, noFiles, tab, 'http://localhost'), viewStateRepo: createViewStateRepo(tab), appState});
    const imported = OpenISDProject.fromOwprText(readFileSync(SAMPLE_PROJECT_OWPR, 'utf8'), engine);
    if (Array.isArray(imported)) throw new Error(imported.join('; '));
    imported.save(); // File → Open commits the loaded design before opening it
    appState.addProject(imported);
    await nextTick();
    const written = tab.get('openisd_open_sessions');

    const reader = createProjectRepo(engine, noFiles, store.tab(), 'http://localhost');
    const session = reader.loadOpenProjects();
    if (session === null || Array.isArray(session)) throw new Error('expected a session');
    stop();
    closeAll();
    appState.restoreProjects(session.projects, session.focusedIndex, session.traceHidden);
    session.projects[session.focusedIndex]?.save(); // the boot commits the restored design
    let heard = 0;
    tab.watch('openisd_open_sessions', () => { heard++; });
    reader.saveOpenProjects(appState.openProjects(), session.projects[session.focusedIndex] ?? null, session.traceHidden);

    expect(written).not.toBeNull();
    expect(heard).toBe(0);
  });
});
