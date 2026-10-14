import {describe, expect, it} from 'vitest';
import {ProjectBuilder} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';
import {createProjectBin} from '../src/repos/projectBin.js';
import {createProjectBinMarks} from '../src/repos/projectBinMarks.js';
import type {FileStorage} from '../src/storage/fileStorage.js';
import {createMemoryStorage} from '../src/storage/keyValueStorage.js';
import {OPENISD_BACKUP_PREFIX, OPENISD_PROJECT_BIN_KEY} from '../src/repos/storageKeys.js';
import {createProjectRepo} from '../src/repos/projectRepo.js';
import {backupOn, exportedFilesOn} from './fixtures/repoOn.js';

const engine = createEngine();
const noFiles: FileStorage = {
  save: () => { throw new Error('no test writes files'); },
  saveAs: () => { throw new Error('no test writes files'); },
  openFileName: () => null,
  forget: () => { throw new Error('no test writes files'); },
};
const AT = Date.UTC(2026, 9, 14, 12, 20);

function binWith(...names: string[]) {
  const storage = createMemoryStorage();
  // One backup for every store, as the app has: a guard inside a guard then takes no second backup.
  const backup = backupOn(storage);
  const projects = createProjectRepo(engine, noFiles, storage, 'http://localhost', backup, exportedFilesOn(), () => undefined, () => undefined);
  for (const name of names) {
    const p = ProjectBuilder.empty(engine);
    p.name.set(name);
    p.save();
    projects.saveToStorage(p);
  }
  let saves = 0;
  const bin = createProjectBin({
    projects, marks: createProjectBinMarks(storage, backup), backup,
    device: () => 'Windows desktop', now: () => AT, onSaved: () => { saves++; },
  });
  const idOf = (name: string): string => projects.listStoredProjects().find(p => p.name === name)?.id ?? '';
  return {storage, projects, bin, idOf, saves: () => saves};
}

describe('projectBin', () => {
  it('Move to Bin takes it off the project list and lists it in the Bin with its date, device and size, then asks for a sync', () => {
    const {bin, idOf, saves} = binWith('Sub 12', 'Sub 15');
    expect(bin.moveToBin(idOf('Sub 12'))).toBe('done');
    expect(bin.activeProjects().map(p => p.name)).toEqual(['Sub 15']);
    const [binned] = bin.binned();
    expect(binned).toMatchObject({id: idOf('Sub 12'), name: 'Sub 12', binnedAt_ms: AT, device: 'Windows desktop'});
    expect(binned?.bytes).toBeGreaterThan(100);
    expect(saves()).toBe(1);
  });

  it('Restore puts it back on the list', () => {
    const {bin, idOf} = binWith('Sub 12');
    bin.moveToBin(idOf('Sub 12'));
    expect(bin.restore(idOf('Sub 12'))).toBe('done');
    expect(bin.binned()).toEqual([]);
    expect(bin.activeProjects().map(p => p.name)).toEqual(['Sub 12']);
  });

  it('an edit saved after it was binned takes it out of the Bin', () => {
    const {projects, bin, idOf} = binWith('Sub 12');
    const id = idOf('Sub 12');
    bin.moveToBin(id);
    const open = projects.loadStoredProject(id);
    if (Array.isArray(open)) throw new Error(open.join('; '));
    open.name.set('Sub 12b');
    projects.saveToStorage(open);
    expect(bin.isBinned(id)).toBe(false);
    expect(bin.activeProjects().map(p => p.name)).toEqual(['Sub 12b']);
  });

  it('Delete forever removes only a binned project, and its mark', () => {
    const {storage, projects, bin, idOf} = binWith('Sub 12', 'Sub 15');
    expect(bin.deleteForever(idOf('Sub 15'))).toBe('refused');
    bin.moveToBin(idOf('Sub 12'));
    expect(bin.deleteForever(idOf('Sub 12'))).toBe('done');
    expect(projects.listStoredProjects().map(p => p.name)).toEqual(['Sub 15']);
    expect(storage.get(OPENISD_PROJECT_BIN_KEY)).toBe('{"entries":[]}');
  });

  it('Empty Bin deletes every binned project under one backup and keeps the rest', () => {
    const {storage, projects, bin, idOf} = binWith('A', 'B', 'C');
    bin.moveToBin(idOf('A'));
    bin.moveToBin(idOf('B'));
    const backups = () => storage.keys().filter(k => k.startsWith(OPENISD_BACKUP_PREFIX)).length;
    const before = backups();
    expect(bin.emptyBin()).toBe('done');
    expect(backups()).toBe(before + 1);
    expect(projects.listStoredProjects().map(p => p.name)).toEqual(['C']);
    expect(bin.binned()).toEqual([]);
  });

  it('an unreadable Bin store bins nothing and lists every project', () => {
    const {storage, bin, idOf} = binWith('Sub 12');
    storage.set(OPENISD_PROJECT_BIN_KEY, 'not json');
    expect(bin.binned()).toEqual([]);
    expect(bin.activeProjects().map(p => p.name)).toEqual(['Sub 12']);
    expect(bin.moveToBin(idOf('Sub 12'))).toBe('refused');
  });

  it('Delete forever also drops a copy kept of that project when it would not load', () => {
    const {storage, projects, bin, idOf} = binWith('Sub 12', 'Mid 5');
    const backup = backupOn(storage);
    const docs = projects.storedDocs();
    const text = docs.kind === 'ok' ? docs.docs.find(d => d.id === idOf('Sub 12'))?.body ?? '' : '';
    backup.refuse('wouldNotLoad', 'Sub 12', text);
    backup.refuse('wouldNotLoad', 'Other', 'other text');
    expect(bin.moveToBin(idOf('Sub 12'))).toBe('done');
    expect(bin.deleteForever(idOf('Sub 12'))).toBe('done');
    expect(backup.refusedCopies().map(c => c.name)).toEqual(['Other']);
  });
});

