import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createBackupRepo} from '../src/repos/backupRepo.js';
import {createStorageBackup} from '../src/repos/storageBackup.js';
import {createStorageHistory} from '../src/repos/storageHistory.js';
import {envelopeText} from '../src/repos/storageSnapshot.js';
import {BuildStamp} from '../src/repos/buildStamp.js';
import {
  OPENISD_BACKUP_KEYS, OPENISD_BACKUP_PREFIX, OPENISD_MY_DRIVERS_KEY, OPENISD_QUARANTINE_SESSION_KEY, OPENISD_PROJECTS_KEY, OPENISD_STORAGE_BUILD_KEY, OPENISD_STORAGE_LAYOUT_KEY,
} from '../src/repos/storageKeys.js';
import {createMemoryStorage, type ListableStorage} from '../src/storage/keyValueStorage.js';
import {APP_RULES, FIXED_NOW_MS, exportedFilesOn} from './fixtures/repoOn.js';
import {ProjectBuilder} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';
import {createProjectRepo} from '../src/repos/projectRepo.js';
import type {FileStorage} from '../src/storage/fileStorage.js';

const engine = createEngine();
const noFiles: FileStorage = {
  save: () => { throw new Error('no test writes files'); },
  saveAs: () => { throw new Error('no test writes files'); },
  openFileName: () => null,
  forget: () => { throw new Error('no test writes files'); },
};
const projectsOn = (storage: ListableStorage) =>
  createProjectRepo(engine, noFiles, storage, 'http://localhost', createStorageBackup(storage, () => FIXED_NOW_MS), exportedFilesOn(), () => undefined, () => undefined);

const KEY_OLD = `${OPENISD_BACKUP_PREFIX}v20250101T0000Z_20250102T030405Z`;
const KEY_NEW = `${OPENISD_BACKUP_PREFIX}v20251231T2359Z_20260101T000000Z`;
const KEY_FUTURE = `${OPENISD_BACKUP_PREFIX}v20270101T0000Z_20270102T000000Z`;
const KEY_BROKEN = `${OPENISD_BACKUP_PREFIX}vbroken`;

const projects = (n: number) => JSON.stringify({entries: Array.from({length: n}, (_, i) => ({id: `p${i}`, text: '{}', modified: ''}))});
const backupText = (layout: number, build: string, takenAt: string, data: Record<string, string>) =>
  envelopeText({layout, build: BuildStamp.ofStored(build), exportedAt: takenAt, data}, false, 'sync');

function historyOver(storage: ListableStorage) {
  const backup = createStorageBackup(storage, () => FIXED_NOW_MS);
  return createStorageHistory(backup, createBackupRepo(storage, backup, () => FIXED_NOW_MS, APP_RULES, () => undefined), APP_RULES, projectsOn(storage));
}

const seeded = () => createMemoryStorage({
  [OPENISD_PROJECTS_KEY]: projects(1), [OPENISD_STORAGE_LAYOUT_KEY]: '2', [OPENISD_STORAGE_BUILD_KEY]: 'v20260301T0405Z',
  [KEY_OLD]: backupText(1, 'v20250101T0000Z', '20250102T030405Z', {[OPENISD_PROJECTS_KEY]: JSON.stringify({version: 1, entries: [{}, {}, {}]})}),
  [KEY_NEW]: backupText(2, 'v20251231T2359Z', '20260101T000000Z', {[OPENISD_PROJECTS_KEY]: projects(2), [OPENISD_MY_DRIVERS_KEY]: '{"entries":[]}'}),
  [KEY_FUTURE]: backupText(9, 'v20270101T0000Z', '20270102T000000Z', {}),
  [KEY_BROKEN]: 'not an envelope',
});

describe('storage history rows', () => {
  it('one row per backup, newest first, with build, layout, project count and size', () => {
    const storage = seeded();
    const rows = historyOver(storage).rows();
    assert.deepEqual(rows.filter(r => r.readable).map(r => [r.key, r.build, r.layout, r.projectCount, r.takenAt]), [
      [KEY_FUTURE, 'v20270101T0000Z', 9, 0, '20270102T000000Z'],
      [KEY_NEW, 'v20251231T2359Z', 2, 2, '20260101T000000Z'],
      [KEY_OLD, 'v20250101T0000Z', 1, 3, '20250102T030405Z'],
    ]);
    assert.equal(rows.find(r => r.key === KEY_NEW)?.size, (storage.get(KEY_NEW) ?? '').length);
  });

  it('a backup of a newer layout cannot be restored; an older one can', () => {
    const rows = historyOver(seeded()).rows();
    assert.equal(rows.find(r => r.key === KEY_FUTURE)?.restorable, false);
    assert.equal(rows.find(r => r.key === KEY_OLD)?.restorable, true);
  });

  it('an unreadable backup is a row that can only be exported or deleted', () => {
    const row = historyOver(seeded()).rows().find(r => r.key === KEY_BROKEN);
    assert.deepEqual(row && [row.readable, row.restorable, row.layout, row.projectCount], [false, false, 0, 0]);
  });
});

describe('storage history actions', () => {
  it('Back up now takes a backup of the store as it is', () => {
    const storage = seeded();
    const result = historyOver(storage).backUpNow();
    assert.ok(result.kind === 'taken');
    assert.ok(storage.get(result.key) !== null);
    assert.ok(result.key.startsWith(`${OPENISD_BACKUP_PREFIX}v20260301T0405Z_`));
  });

  it('Back up now on an empty store says there is nothing to back up', () => {
    assert.deepEqual(historyOver(createMemoryStorage()).backUpNow(), {kind: 'nothingToBackUp'});
  });

  it('Export hands over the backup text under a name carrying when it was taken', () => {
    const storage = seeded();
    assert.deepEqual(historyOver(storage).exportFile(KEY_NEW), {fileName: 'openisd-backup-20260101T000000Z.json', text: storage.get(KEY_NEW) ?? ''});
    assert.equal(historyOver(storage).exportFile(`${OPENISD_BACKUP_PREFIX}none`), null);
  });

  it('Restore puts the backup into the live store, backing the live store up first', () => {
    const storage = seeded();
    const result = historyOver(storage).restore(KEY_OLD);
    assert.equal(result.kind, 'ok');
    assert.equal(storage.get(OPENISD_PROJECTS_KEY), JSON.stringify({entries: [{}, {}, {}]}), 'restored and migrated');
    assert.equal(storage.get(OPENISD_MY_DRIVERS_KEY), null, 'replace everything: what the backup lacks is gone');
    const live = storage.keys().filter(k => k.startsWith(`${OPENISD_BACKUP_PREFIX}v20260301T0405Z_`));
    assert.equal(live.length, 1, 'the live store was backed up first');
  });

  it('Restore refuses a backup of a newer layout and changes nothing', () => {
    const storage = seeded();
    const before = storage.get(OPENISD_PROJECTS_KEY);
    assert.equal(historyOver(storage).restore(KEY_FUTURE).kind, 'invalid');
    assert.equal(storage.get(OPENISD_PROJECTS_KEY), before);
  });

  it('Delete removes the backup; it will not delete anything that is not a backup', () => {
    const storage = seeded();
    const history = historyOver(storage);
    assert.equal(history.remove(KEY_OLD), true);
    assert.equal(storage.get(KEY_OLD), null);
    assert.equal(history.remove(OPENISD_PROJECTS_KEY), false);
    assert.notEqual(storage.get(OPENISD_PROJECTS_KEY), null);
    assert.equal(history.remove(KEY_OLD), false);
  });

  it('lists the copies repairs kept, with their sizes, and deletes one by its kind', () => {
    const storage = createMemoryStorage({
      [OPENISD_PROJECTS_KEY]: projects(1),
      [OPENISD_BACKUP_KEYS.projects]: 'x'.repeat(40),
      [OPENISD_QUARANTINE_SESSION_KEY]: 'y'.repeat(7),
    });
    const history = historyOver(storage);
    assert.deepEqual(history.copies(), [{kind: 'projects', takenAt: '', size: 40}, {kind: 'quarantineSession', takenAt: '', size: 7}]);
    assert.equal(history.removeCopy('projects'), true);
    assert.equal(storage.get(OPENISD_BACKUP_KEYS.projects), null);
    assert.notEqual(storage.get(OPENISD_PROJECTS_KEY), null);
    assert.equal(history.removeCopy('projects'), false);
    assert.deepEqual(history.copies(), [{kind: 'quarantineSession', takenAt: '', size: 7}]);
  });

  it('records why each backup was taken', () => {
    const storage = createMemoryStorage({[OPENISD_PROJECTS_KEY]: projects(1)});
    const history = historyOver(storage);
    history.backUpNow();
    assert.deepEqual(history.rows().map(r => r.reason), ['manual']);
  });

  it('restores one project from a backup under a new name, leaving every other project as it is', () => {
    const storage = createMemoryStorage();
    const repo = projectsOn(storage);
    for (const name of ['Sub 12', 'Mid 5']) {
      const p = ProjectBuilder.empty(engine);
      p.name.set(name);
      p.save();
      repo.saveToStorage(p);
    }
    const history = historyOver(storage);
    history.backUpNow();
    const [row] = history.rows();
    const sub12 = repo.listStoredProjects().find(p => p.name === 'Sub 12')?.id ?? '';
    assert.equal(repo.deleteStoredProject(sub12), 'done');

    const inBackup = history.projectsIn(row?.key ?? '');
    assert.deepEqual(inBackup.map(p => p.name).sort(), ['Mid 5', 'Sub 12']);
    const picked = inBackup.find(p => p.name === 'Sub 12');
    assert.deepEqual(history.restoreProject(row?.key ?? '', picked?.id ?? '', 'Sub 12 (restored 14 Oct 2026)'),
      {kind: 'restored', name: 'Sub 12 (restored 14 Oct 2026)'});
    assert.deepEqual(repo.listStoredProjects().map(p => p.name).sort(), ['Mid 5', 'Sub 12 (restored 14 Oct 2026)']);
    assert.equal(history.restoreProject(row?.key ?? '', 'no-such-id', 'x').kind, 'refused');
  });

  it('Delete all backups removes every backup and kept copy, the pre-upgrade one too, and nothing else', () => {
    const storage = seeded();
    storage.set(OPENISD_BACKUP_KEYS.projects, 'copy');
    storage.set(OPENISD_QUARANTINE_SESSION_KEY, 'refused session');
    const history = historyOver(storage);
    const held = history.entries().length;
    assert.equal(history.removeAllBackups(), held);
    assert.deepEqual(history.entries(), []);
    assert.notEqual(storage.get(OPENISD_PROJECTS_KEY), null);
  });

  it('lists a project kept because it would not load; Export gives its text; Delete removes it', () => {
    const storage = createMemoryStorage({[OPENISD_PROJECTS_KEY]: projects(1)});
    const backup = createStorageBackup(storage, () => FIXED_NOW_MS);
    assert.equal(backup.refuse('wouldNotLoad', 'Sub 12', '{"broken":true}'), true);
    const history = historyOver(storage);
    const refused = history.entries().find(e => e.kind === 'refused');
    assert.equal(refused?.kind === 'refused' ? refused.refused.name : '', 'Sub 12');
    const key = refused?.kind === 'refused' ? refused.refused.key : '';
    assert.equal(history.exportRefused(key)?.text, '{"broken":true}');
    assert.equal(history.removeRefused(key), true);
    assert.equal(history.entries().some(e => e.kind === 'refused'), false);
  });
});

