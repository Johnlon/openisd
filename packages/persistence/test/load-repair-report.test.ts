/**
 * A drive level below 10 mV in a stored project (written by a build before T918) is repaired when the
 * project is opened from browser storage, and the repair is reported for the toast, one line per
 * repair (John, 18 Nov 2026, QO953.c31: "all you can do is show a toast"). File > Open reports its own
 * repairs to its caller (`openProjectText`), never twice; a listing opens nothing and reports nothing.
 */
import {describe, expect, it, vi} from 'vitest';
import {createProjectRepo, type LoadRepairReport} from '../src/repos/projectRepo.js';
import type {FileStorage} from '../src/storage/fileStorage.js';
import {createMemoryStorage} from '../src/storage/keyValueStorage.js';
import {OPENISD_OPEN_SESSIONS_KEY, OPENISD_PROJECTS_KEY} from '../src/repos/storageKeys.js';
import {ProjectBuilder} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';
import {backupOn, exportedFilesOn} from './fixtures/repoOn.js';

const engine = createEngine();

const noFiles: FileStorage = {
  save: () => { throw new Error('no test here writes a file'); },
  saveAs: () => { throw new Error('no test here writes a file'); },
  openFileName: () => null,
  forget: () => { throw new Error('no test here writes a file'); },
};

const LINE = 'Driver input voltage (each) -6 V in the file: set to the 10 mV minimum';

/** A saved project named `name` whose stored text holds an entered drive voltage of -6 V. */
function minusSixVoltText(name: string): {id: string; text: string} {
  const p = ProjectBuilder.empty(engine);
  p.name.set(name);
  p.save();
  const session = p.cloneSession();
  return {id: session.id, text: JSON.stringify({...session, saved: {...session.saved, signal: {voltage_V: {state: 'E', value: -6}}}})};
}

function repoOver(seed: Record<string, string>, onLoadRepaired: (report: LoadRepairReport) => void) {
  const storage = createMemoryStorage(seed);
  return createProjectRepo(engine, noFiles, storage, 'http://localhost', backupOn(storage), exportedFilesOn(), () => undefined, () => undefined, onLoadRepaired);
}

describe('a drive level repaired on opening a stored project is reported for the toast (QO953.c31)', () => {
  it('restoring the open projects at start-up reports the repair, and the project shows 10 mV', () => {
    const {id, text} = minusSixVoltText('old build');
    const told = vi.fn<(report: LoadRepairReport) => void>();
    const session = repoOver({[OPENISD_OPEN_SESSIONS_KEY]: JSON.stringify({entries: [{id, text, modified: '', traceHidden: false}], focusedId: id})}, told)
      .loadOpenProjects();
    if (session === null || Array.isArray(session)) throw new Error('expected a session');
    expect(session.projects[0]?.driveVoltage_V.value).toBe(0.01);
    expect(session.projects[0]?.driveVoltage_V.dq).toEqual([]);
    expect(told).toHaveBeenCalledWith({projectName: 'old build', lines: [LINE]});
    expect(told).toHaveBeenCalledTimes(1);
  });

  it('opening a saved project from the projects list reports the repair; listing them reports nothing', () => {
    const {id, text} = minusSixVoltText('saved one');
    const told = vi.fn<(report: LoadRepairReport) => void>();
    const repo = repoOver({[OPENISD_PROJECTS_KEY]: JSON.stringify({version: 1, entries: [{id, text, modified: '2026-01-01T00:00:00Z'}]})}, told);
    expect(repo.listStoredProjects()).toHaveLength(1);
    expect(told).not.toHaveBeenCalled();
    const project = repo.loadStoredProject(id);
    if (project === null || Array.isArray(project)) throw new Error('expected a project');
    expect(project.driveVoltage_V.value).toBe(0.01);
    expect(told).toHaveBeenCalledWith({projectName: 'saved one', lines: [LINE]});
  });

  it('File > Open hands the repair to its caller and does not report it a second time', () => {
    const {text} = minusSixVoltText('a file');
    const told = vi.fn<(report: LoadRepairReport) => void>();
    const opened = repoOver({}, told).openProjectText(text);
    if (Array.isArray(opened)) throw new Error(opened.join('; '));
    expect(opened.loadRepairs.map(r => r.text)).toEqual([LINE]);
    expect(told).not.toHaveBeenCalled();
  });

  it('a backup or archive entry read as project text (restore) reports the repair', () => {
    const {text} = minusSixVoltText('restored');
    const told = vi.fn<(report: LoadRepairReport) => void>();
    const project = repoOver({}, told).readProjectText(text);
    if (Array.isArray(project)) throw new Error(project.join('; '));
    expect(project.driveVoltage_V.value).toBe(0.01);
    expect(told).toHaveBeenCalledWith({projectName: 'restored', lines: [LINE]});
  });
});
