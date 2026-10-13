import {describe, expect, it, vi} from 'vitest';
import {defineComponent, h, provide} from 'vue';
import {renderToString} from 'vue/server-renderer';
import {formatDateTime} from '@openisd/design/fields';
import {APP_LOGIC} from '../../src/logic/app.js';
import {createConfirmPort} from '../../src/logic/confirmPort.js';
import {createLogging} from '../../src/logging/flash.js';
import {useStorageHistory, type StorageHistoryAPI} from '../../src/hooks/StorageHistory-hooks.js';
import {
  createMemoryStorage, OPENISD_BACKUP_PREFIX, OPENISD_PROJECTS_KEY, OPENISD_STORAGE_BUILD_KEY, OPENISD_STORAGE_LAYOUT_KEY,
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
        logging, storageHistory: storageHistoryOn(storage),
        designIO: {...base.designIO, saveStoredBackup: file => { saved.push(file); }},
        confirmPort: {port: {ask: vi.fn().mockResolvedValue(answer)}, state: createConfirmPort().state},
      }));
      return () => h(Child);
    },
  });
  await renderToString(h(Parent));
  return {api, saved, logging};
}

const seeded = () => createMemoryStorage({
  [KEY]: BACKUP, [OPENISD_PROJECTS_KEY]: JSON.stringify({entries: [{}]}),
  [OPENISD_STORAGE_LAYOUT_KEY]: '2', [OPENISD_STORAGE_BUILD_KEY]: 'v20260301T0405Z',
});

describe('useStorageHistory', () => {
  it('words a row for the page: build date, layout, project count, size, when taken', async () => {
    const {api} = await renderHook(true, seeded());
    expect(api.rows.value).toEqual([{
      key: KEY, build: formatDateTime(new Date(Date.UTC(2025, 0, 1, 0, 0))), layout: '2', projects: '2 projects', size: `${BACKUP.length} B`,
      takenAt: formatDateTime(new Date(Date.UTC(2025, 0, 2, 3, 4))), restorable: true, note: '',
    }]);
  });

  it('Back up now adds a row and says so', async () => {
    const {api, logging} = await renderHook(true, seeded());
    api.backUpNow();
    expect(api.rows.value).toHaveLength(2);
    expect(logging.message.value).toBe('Backed up everything in this browser.');
  });

  it('Export hands the backup file to the file saver', async () => {
    const {api, saved} = await renderHook(true, seeded());
    api.exportRow(KEY);
    expect(saved).toEqual([{fileName: 'openisd-backup-20250102T030405Z.json', text: BACKUP}]);
  });

  it('Restore asks first; yes restores and reports the keys, no changes nothing', async () => {
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
    await refused.api.deleteRow(KEY);
    expect(refused.api.rows.value).toHaveLength(1);

    const accepted = await renderHook(true, storage);
    await accepted.api.deleteRow(KEY);
    expect(accepted.api.rows.value).toHaveLength(0);
    expect(storage.get(KEY)).toBeNull();
  });
});
