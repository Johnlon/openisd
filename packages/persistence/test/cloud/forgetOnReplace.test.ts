import {describe, it, expect, vi} from 'vitest';
import {createBackupRepo} from '../../src/repos/backupRepo.js';
import {createAppSettingsRepo} from '../../src/repos/appSettingsRepo.js';
import {createViewStateRepo} from '../../src/repos/viewStateRepo.js';
import {createStoreOpening} from '../../src/repos/storeGate.js';
import {createStorageBackup} from '../../src/repos/storageBackup.js';
import {createBuildStamp} from '../../src/repos/buildStamp.js';
import {createMemoryStorage, type ListableStorage} from '../../src/storage/keyValueStorage.js';
import {
  OPENISD_APP_SETTINGS_KEY,
  OPENISD_PROJECTS_KEY,
  OPENISD_STORAGE_LAYOUT_KEY,
  OPENISD_VIEW_KEY,
} from '../../src/repos/storageKeys.js';
import {DEFAULT_ENV_DEFAULTS, DEFAULT_VENTED_DESIGN_LIMITS} from '@openisd/design/engine';

const FIXED_NOW_MS = Date.UTC(2026, 0, 1, 1, 2, 3);
const APP_RULES = {
  layout: 2,
  steps: [
    {
      from: 1,
      migrate: (data: Readonly<Record<string, string>>) => data,
      migrateFile: (file: Readonly<Record<string, unknown>>) => file,
    },
  ],
};

function backupOn(storage: ListableStorage) {
  return createStorageBackup(storage, () => FIXED_NOW_MS);
}

const BACKUP_FILE = JSON.stringify({
  openisdBackup: true,
  schemaVersion: 1,
  layout: 1,
  exportedAt: '20260101T000000Z',
  data: {
    [OPENISD_PROJECTS_KEY]: '{"version":1,"entries":[]}',
  },
});

describe('forgetOnReplace — backupRepo', () => {
  it('calls onReplaced once when importAll restores a backup', () => {
    const storage = createMemoryStorage({[OPENISD_PROJECTS_KEY]: '{"old":true}'});
    const onReplaced = vi.fn();
    const repo = createBackupRepo(storage, backupOn(storage), () => FIXED_NOW_MS, APP_RULES, onReplaced);

    const result = repo.importAll(BACKUP_FILE, {replaceEverything: true});
    expect(result.kind).toBe('ok');
    expect(onReplaced).toHaveBeenCalledTimes(1);
  });

  it('calls onReplaced zero times on exportAll or failed restore', () => {
    const storage = createMemoryStorage();
    const onReplaced = vi.fn();
    const repo = createBackupRepo(storage, backupOn(storage), () => FIXED_NOW_MS, APP_RULES, onReplaced);

    repo.exportAll();
    expect(onReplaced).toHaveBeenCalledTimes(0);

    const invalidResult = repo.importAll('not-json', {replaceEverything: true});
    expect(invalidResult.kind).toBe('invalid');
    expect(onReplaced).toHaveBeenCalledTimes(0);
  });
});

describe('forgetOnReplace — appSettingsRepo', () => {
  it('calls onReplaced once when reset succeeds', () => {
    const storage = createMemoryStorage({[OPENISD_APP_SETTINGS_KEY]: '{"differenceCues":false}'});
    const onReplaced = vi.fn();
    const repo = createAppSettingsRepo(storage, backupOn(storage), () => undefined, onReplaced, () => undefined);

    const resetOk = repo.reset();
    expect(resetOk).toBe(true);
    expect(onReplaced).toHaveBeenCalledTimes(1);
  });

  it('calls onReplaced zero times on ordinary saves', () => {
    const storage = createMemoryStorage();
    const onReplaced = vi.fn();
    const repo = createAppSettingsRepo(storage, backupOn(storage), () => undefined, onReplaced, () => undefined);

    repo.setVentedLimits(DEFAULT_VENTED_DESIGN_LIMITS);
    repo.setEnvDefaults(DEFAULT_ENV_DEFAULTS);
    repo.setDifferenceCuesShown(false);

    expect(onReplaced).toHaveBeenCalledTimes(0);
  });
});

describe('forgetOnReplace — viewStateRepo', () => {
  it('calls onReplaced once when reset succeeds', () => {
    const storage = createMemoryStorage({[OPENISD_VIEW_KEY]: '{"ui":{}}'});
    const onReplaced = vi.fn();
    const repo = createViewStateRepo(storage, backupOn(storage), onReplaced);

    const resetOk = repo.reset();
    expect(resetOk).toBe(true);
    expect(onReplaced).toHaveBeenCalledTimes(1);
  });

  it('calls onReplaced zero times on ordinary save', () => {
    const storage = createMemoryStorage();
    const onReplaced = vi.fn();
    const repo = createViewStateRepo(storage, backupOn(storage), onReplaced);

    repo.save({ui: {}});
    expect(onReplaced).toHaveBeenCalledTimes(0);
  });
});

describe('forgetOnReplace — storeGate', () => {
  it('does not forget the sync record when a layout migration rewrites the store; it tells of each rewritten project', () => {
    const entry = (id: string, text: string) => ({id, text, modified: ''});
    const storage = createMemoryStorage({
      [OPENISD_STORAGE_LAYOUT_KEY]: '2',
      [OPENISD_PROJECTS_KEY]: JSON.stringify({entries: [entry('p-1', '{"label":"A","saved":{}}')]}),
    });
    const onReplaced = vi.fn();
    const projectRewritten = vi.fn();
    const opening = createStoreOpening(
      storage,
      {
        build: createBuildStamp('v20260101T000000Z'),
        now: () => FIXED_NOW_MS,
        rules: {layout: 3, steps: [{
          from: 2,
          migrate: data => ({...data, [OPENISD_PROJECTS_KEY]: JSON.stringify({entries: [entry('p-1', '{"id":"p-1","label":"A","saved":{}}')]})}),
          migrateFile: file => file,
        }]},
        memoryStorage: createMemoryStorage,
        projectRewritten,
      },
      onReplaced,
    );

    expect(opening.kind).toBe('ready');
    expect(onReplaced).toHaveBeenCalledTimes(0);
    expect(projectRewritten).toHaveBeenCalledTimes(1);
    expect(projectRewritten).toHaveBeenCalledWith('p-1', '{"label":"A","saved":{}}', '{"id":"p-1","label":"A","saved":{}}');
  });

  it('calls onReplaced zero times on startup with matching layout', () => {
    const storage = createMemoryStorage({
      [OPENISD_STORAGE_LAYOUT_KEY]: '2',
      [OPENISD_PROJECTS_KEY]: '{"projects":[]}',
    });
    const onReplaced = vi.fn();
    const opening = createStoreOpening(
      storage,
      {
        build: createBuildStamp('v20260101T000000Z'),
        now: () => FIXED_NOW_MS,
        rules: APP_RULES,
        memoryStorage: createMemoryStorage,
        projectRewritten: () => undefined,
      },
      onReplaced,
    );

    expect(opening.kind).toBe('ready');
    expect(onReplaced).toHaveBeenCalledTimes(0);
  });
});
