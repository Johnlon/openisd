import {describe, expect, it, vi} from 'vitest';
import {defineComponent, h, provide} from 'vue';
import {renderToString} from 'vue/server-renderer';
import {formatDateTime, restoredProjectName} from '@openisd/design/fields';
import {ProjectBuilder} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';
import {APP_LOGIC} from '../../src/logic/app.js';
import {createConfirmPort} from '../../src/logic/confirmPort.js';
import {createLogging} from '../../src/logging/flash.js';
import {useStorageHistory, type StorageHistoryAPI} from '../../src/hooks/StorageHistory-hooks.js';
import {
  createMemoryStorage, OPENISD_BACKUP_KEYS, OPENISD_BACKUP_PREFIX, OPENISD_PROJECTS_KEY, OPENISD_STORAGE_BUILD_KEY, OPENISD_STORAGE_LAYOUT_KEY,
  type HistoryFile, type ListableStorage,
} from '@openisd/persistence';
import {testAppLogic} from './testAppLogic.js';
import {storageHistoryOn} from '../fixtures/repoOn.js';

const KEY = `${OPENISD_BACKUP_PREFIX}v20250101T0000Z_20250102T030405Z`;
const BACKUP = JSON.stringify({
  openisdBackup: true, schemaVersion: 1, layout: 2, build: 'v20250101T0000Z', exportedAt: '20250102T030405Z',
  data: {[OPENISD_PROJECTS_KEY]: JSON.stringify({entries: [{}, {}]})},
});

async function renderHook(answer: boolean, storage: ListableStorage) {
  const saved: HistoryFile[] = [];
  const logging = createLogging();
  const base = testAppLogic();
  let api!: StorageHistoryAPI;
  const Child = defineComponent({
    setup() { api = useStorageHistory(); return () => null; },
    render() { return h('div'); },
  });
  const Parent = defineComponent({
    setup() {
      provide(APP_LOGIC, testAppLogic({
        logging, storageHistory: storageHistoryOn(storage, base.projectRepo),
        designIO: {...base.designIO, saveStoredBackup: file => { saved.push(file); }},
        confirmPort: {port: {ask: vi.fn().mockResolvedValue(answer)}, state: createConfirmPort().state},
      }));
      return () => h(Child);
    },
  });
  await renderToString(h(Parent));
  return {api, saved, logging, base};
}

const seeded = () => createMemoryStorage({
  [KEY]: BACKUP, [OPENISD_PROJECTS_KEY]: JSON.stringify({entries: [{}]}),
  [OPENISD_STORAGE_LAYOUT_KEY]: '2', [OPENISD_STORAGE_BUILD_KEY]: 'v20260301T0405Z',
});

describe('useStorageHistory', () => {
  it('words a backup row for the page: when taken, why, project count, size', async () => {
    const {api} = await renderHook(true, seeded());
    expect(api.rows.value).toEqual([{
      kind: 'backup', key: KEY, takenAt: formatDateTime(new Date(Date.UTC(2025, 0, 2, 3, 4))), reason: 'Not recorded',
      projects: '2 projects', size: `${BACKUP.length} B`, restorable: true, note: '',
    }]);
    expect(api.keepRule).toContain('The newest 3 are kept, plus the last one made before an app update; older ones are removed.');
    expect(api.totalSize.value).toBe(`${BACKUP.length} B`);
  });

  it('Back up now adds a row, says why it was taken, and says so', async () => {
    const {api, logging} = await renderHook(true, seeded());
    api.backUpNow();
    expect(api.rows.value).toHaveLength(2);
    expect(api.rows.value[0]?.reason).toBe('Back up now');
    expect(logging.message.value).toBe('Backed up everything in this browser.');
  });

  it('Download hands the backup file to the file saver', async () => {
    const {api, saved} = await renderHook(true, seeded());
    const [row] = api.rows.value;
    if (row === undefined) throw new Error('no row');
    api.exportRow(row);
    expect(saved).toEqual([{fileName: 'openisd-backup-20250102T030405Z.json', text: BACKUP}]);
  });

  it('Restore everything asks first; yes restores and reports the keys, no changes nothing', async () => {
    const storage = seeded();
    const refused = await renderHook(false, storage);
    expect(await refused.api.restoreRow(KEY)).toEqual({kind: 'cancelled'});
    expect(storage.get(OPENISD_PROJECTS_KEY)).toBe(JSON.stringify({entries: [{}]}));

    const accepted = await renderHook(true, storage);
    expect(await accepted.api.restoreRow(KEY)).toEqual({kind: 'restored', keysRestored: 1});
    expect(storage.get(OPENISD_PROJECTS_KEY)).toBe(JSON.stringify({entries: [{}, {}]}));
  });

  it('Delete asks first; yes removes the row', async () => {
    const storage = seeded();
    const refused = await renderHook(false, storage);
    const [row] = refused.api.rows.value;
    if (row === undefined) throw new Error('no row');
    await refused.api.deleteRow(row);
    expect(refused.api.rows.value).toHaveLength(1);

    const accepted = await renderHook(true, storage);
    await accepted.api.deleteRow(row);
    expect(accepted.api.rows.value).toHaveLength(0);
    expect(storage.get(KEY)).toBeNull();
  });

  it('Restore one project lists the projects in the backup and adds the picked one, renamed, touching nothing else', async () => {
    const project = ProjectBuilder.empty(createEngine());
    project.name.set('Sub 12');
    project.save();
    const key = `${OPENISD_BACKUP_PREFIX}v20260101T0000Z_20260102T030405Z`;
    const storage = createMemoryStorage({
      [key]: JSON.stringify({
        openisdBackup: true, schemaVersion: 1, layout: 2, build: 'v20260101T0000Z', exportedAt: '20260102T030405Z', reason: 'sync',
        data: {[OPENISD_PROJECTS_KEY]: JSON.stringify({entries: [{id: 'p1', text: project.toStoredText(), modified: ''}, {id: 'p2', text: 'not json', modified: ''}]})},
      }),
    });
    const {api, logging, base: app} = await renderHook(true, storage);
    expect(api.rows.value[0]?.reason).toBe('Before sync');
    api.openPicker(key);
    expect(api.picker.value?.projects).toEqual([
      {id: 'p1', name: 'Sub 12', readable: true},
      {id: 'p2', name: 'Unreadable project', readable: false},
    ]);
    const [picked] = api.picker.value?.projects ?? [];
    if (picked === undefined) throw new Error('no project listed');
    const before = app.projectRepo.listStoredProjects().length;
    api.restoreProject(picked);
    const name = restoredProjectName('Sub 12', new Date());
    expect(app.projectRepo.listStoredProjects().map(p => p.name)).toContain(name);
    expect(app.projectRepo.listStoredProjects()).toHaveLength(before + 1);
    expect(logging.message.value).toBe(`Added "${name}" to your saved projects.`);
    expect(api.picker.value).toBeNull();
  });

  it('lists a copy kept before a repair beside the backups; Delete asks first, then removes it', async () => {
    const storage = seeded();
    storage.set(OPENISD_BACKUP_KEYS.projects, 'x'.repeat(40));
    const {api} = await renderHook(true, storage);
    const copy = api.rows.value.find(r => r.kind === 'copy');
    expect(copy).toEqual({kind: 'copy', copy: 'projects', takenAt: 'Unknown', reason: 'Before repair', size: '40 B', holds: 'Saved projects'});
    if (copy === undefined) throw new Error('no copy listed');
    await api.deleteRow(copy);
    expect(storage.get(OPENISD_BACKUP_KEYS.projects)).toBeNull();
    expect(api.rows.value.filter(r => r.kind === 'copy')).toEqual([]);
  });

  it('Delete of a copy does nothing when the user says no', async () => {
    const storage = seeded();
    storage.set(OPENISD_BACKUP_KEYS.state, 'y');
    const {api} = await renderHook(false, storage);
    const copy = api.rows.value.find(r => r.kind === 'copy');
    if (copy === undefined) throw new Error('no copy listed');
    await api.deleteRow(copy);
    expect(storage.get(OPENISD_BACKUP_KEYS.state)).toBe('y');
  });

  it('Storage says how much is used and splits it by kind; Empty Bin is off with nothing binned', async () => {
    const {api} = await renderHook(true, seeded());
    expect(api.usedLine.value).toMatch(/^Using \d+(\.\d)? (B|KB|MB) of about 5 MB in this browser\.$/);
    expect(api.usageRows.value.map(r => r.label)).toEqual(['Projects', 'My Drivers', 'Bin', 'Backups', 'Settings']);
    expect(api.binHasProjects.value).toBe(false);
  });

  it('Delete all backups asks first, then removes every backup and kept copy and says so', async () => {
    const storage = seeded();
    storage.set(OPENISD_BACKUP_KEYS.view, 'old view');
    const refused = await renderHook(false, storage);
    await refused.api.deleteAllBackups();
    expect(refused.api.rows.value).toHaveLength(2);

    const {api, logging} = await renderHook(true, storage);
    await api.deleteAllBackups();
    expect(api.rows.value).toEqual([]);
    expect(storage.get(KEY)).toBeNull();
    expect(storage.get(OPENISD_BACKUP_KEYS.view)).toBeNull();
    expect(logging.message.value).toBe('All backups deleted.');
  });
});

