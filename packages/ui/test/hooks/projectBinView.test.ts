/**
 * The Projects list: one row for each project, whatever its name or stored id
 * (bugs/BUG_20261017_same-name-projects-show-as-one-row.md).
 */
import {describe, expect, it} from 'vitest';
import {ProjectBuilder, type OpenISDProject} from '@openisd/design';
import {createProjectBinView} from '../../src/hooks/projectBinView.js';
import {testAppLogic} from './testAppLogic.js';

function viewOf(logic = testAppLogic()) {
  const {appState, projectRepo, projectBin, confirmPort} = logic;
  const view = createProjectBinView({
    appState, projectRepo, projectBin, confirm: confirmPort.port,
    cloudMarks: () => ({cloudOn: false, running: false, notOnDrive: new Set(), conflictCopies: new Set()}),
    unitTokens: () => ({}),
    alert: () => undefined,
  });
  return {logic, view};
}

function namedProject(logic: ReturnType<typeof testAppLogic>, name: string): OpenISDProject {
  const project = ProjectBuilder.empty(logic.engine);
  project.name.set(name);
  project.save();
  logic.appState.addProject(project);
  return project;
}

describe('createProjectBinView: projects named alike', () => {
  it('two open projects called ABC, each stored when made, are two rows', () => {
    const logic = testAppLogic();
    const first = namedProject(logic, 'ABC');
    const second = namedProject(logic, 'ABC');
    logic.projectRepo.storeNew(first);
    logic.projectRepo.storeNew(second);
    const {view} = viewOf(logic);
    expect(view.projectRows.value).toHaveLength(2);
    expect(new Set(view.projectRows.value.map(r => r.key)).size).toBe(2);
    expect(view.projectRows.value.every(r => r.open.kind === 'open')).toBe(true);
  });

  it('a stored project that is not open is a row with no open mark', () => {
    const logic = testAppLogic();
    const closed = ProjectBuilder.empty(logic.engine);
    closed.name.set('Shelved');
    logic.projectRepo.storeNew(closed);
    const {view} = viewOf(logic);
    expect(view.projectRows.value.map(r => [r.name, r.open.kind])).toEqual([['Shelved', 'closed']]);
  });
});

describe('createProjectBinView: a search box that is not offered', () => {
  it('a word typed earlier does not hide rows once the list is too short to show the box', () => {
    const logic = testAppLogic();
    for (let i = 1; i <= 9; i++) {
      const p = namedProject(logic, `Box ${i}`);
      logic.projectRepo.storeNew(p);
    }
    const {view} = viewOf(logic);
    expect(view.searchOffered.value).toBe(true);
    view.query.value = 'Box 9';
    expect(view.shownProjects.value).toHaveLength(1);
    const [binned] = logic.projectRepo.listStoredProjects();
    logic.projectBin.moveToBin(binned.id);
    view.refresh();
    expect(view.searchOffered.value).toBe(false);
    expect(view.shownProjects.value).toHaveLength(8);
  });
});
