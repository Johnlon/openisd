/**
 * An open project follows what sync pulled: shown in place when nothing is unsaved; kept as a
 * conflict copy when it holds unsaved edits. bugs/BUG_20261015_synced-open-project-does-not-refresh.md
 */
import {describe, expect, it, vi} from 'vitest';
import {ProjectBuilder, type OpenISDProject} from '@openisd/design';
import {DeviceName} from '@openisd/design/cloud';
import {formatDay} from '@openisd/design/fields';
import {createFileStorage, createMemoryStorage} from '@openisd/persistence';
import {createAppStateFixture} from '../fixtures/appStateFixture.js';
import {projectRepoOn} from '../fixtures/repoOn.js';
import {followPulledProjects} from '../../src/logic/pulledProjects.js';

const NOW = new Date(2026, 9, 15, 13, 17).getTime();
const DESKTOP = DeviceName.ofBrowser('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36', 0);

function setup() {
  const {appState} = createAppStateFixture();
  const projectRepo = projectRepoOn(appState.engine, createFileStorage(), createMemoryStorage(), 'http://localhost');
  const keptBoth = vi.fn<(copyId: string, name: string, item: string, otherDevice: string) => void>();
  const deps = {appState, projectRepo, keptBoth, deviceName: DESKTOP, now: () => NOW};

  /** "Sub 12" saved and open, at a port limit of `limit`. */
  function openSaved(limit: number): {readonly project: OpenISDProject; readonly id: string} {
    const project = ProjectBuilder.empty(appState.engine);
    project.name.set('Sub 12');
    project.portVelocityLimit_m_per_s.set(limit);
    project.save();
    expect(projectRepo.saveToStorage(project).kind).toBe('saved');
    const id = projectRepo.storedIdOf(project);
    if (id === null) throw new Error('saved project has no stored id');
    appState.openProjectOnce(project, {kind: 'stored', id});
    return {project, id};
  }

  /** What a pull writes: the iPhone's version of saved project `id`, at a port limit of `limit`. */
  function pull(id: string, limit: number): void {
    const theirs = ProjectBuilder.empty(appState.engine);
    theirs.name.set('Sub 12');
    theirs.portVelocityLimit_m_per_s.set(limit);
    theirs.save();
    expect(projectRepo.putStoredDoc(id, theirs.toStoredText())).toBe('done');
  }

  return {appState, projectRepo, keptBoth, deps, openSaved, pull};
}

describe('followPulledProjects', () => {
  it('shows a pulled version of an open project in place, keeping its tab and focus', () => {
    const {appState, deps, openSaved, pull} = setup();
    const {project, id} = openSaved(17);
    pull(id, 25);

    expect(followPulledProjects(deps, [{id, from: 'iPhone'}])).toEqual(['refreshed']);
    const [shown] = appState.openProjects();
    expect(appState.openProjects()).toHaveLength(1);
    expect(shown).not.toBe(project);
    expect(shown?.portVelocityLimit_m_per_s.value).toBe(25);
    expect(appState.focusedProject()).toBe(shown);
    expect(appState.openProjectByIdentity({kind: 'stored', id})).toBe(shown);
  });

  it('keeps unsaved edits as a conflict copy that stays open, and the pulled version keeps the name', () => {
    const {appState, projectRepo, keptBoth, deps, openSaved, pull} = setup();
    const {project, id} = openSaved(17);
    project.portVelocityLimit_m_per_s.set(20);
    pull(id, 25);

    expect(followPulledProjects(deps, [{id, from: 'iPhone'}])).toEqual(['keptEdits']);
    const copyName = `Sub 12 (conflict, ${formatDay(new Date(NOW))}, ${DESKTOP.text})`;
    expect(appState.openProjects()).toEqual([project]);
    expect(project.name.value).toBe(copyName);
    expect(project.portVelocityLimit_m_per_s.value).toBe(20);
    expect(appState.projectHasUnsavedChanges(project)).toBe(false);

    const copyId = projectRepo.storedIdOf(project);
    expect(copyId).not.toBe(id);
    expect(appState.openProjectByIdentity({kind: 'stored', id})).toBeNull();
    const listed = projectRepo.listStoredProjects().map(p => p.name).sort();
    expect(listed).toEqual(['Sub 12', copyName]);
    const pulled = projectRepo.loadStoredProject(id);
    expect(Array.isArray(pulled) ? null : pulled.portVelocityLimit_m_per_s.value).toBe(25);
    expect(keptBoth).toHaveBeenCalledWith(copyId, copyName, 'Sub 12', 'iPhone');
  });

  it('leaves a pulled project that is not open alone', () => {
    const {appState, deps} = setup();
    expect(followPulledProjects(deps, [{id: 'not-open', from: 'iPhone'}])).toEqual(['notOpen']);
    expect(appState.openProjects()).toEqual([]);
  });
});
