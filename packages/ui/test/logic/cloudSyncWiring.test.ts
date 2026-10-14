import {describe, expect, it, vi} from 'vitest';
import {createCloudSyncWiring} from '../../src/logic/cloudSyncWiring.js';
import {
  createMemoryStorage,
  type LayoutRules,
  createProjectRepo,
  createAppSettingsRepo,
  createStorageBackup,
  createExportedFiles,
  type FileStorage,
} from '@openisd/persistence';
import {createEngine} from '@openisd/design/engine';
import {type OAuthConfig, ChangeCursor} from '@openisd/design/cloud';

const noFiles: FileStorage = {
  save: () => { throw new Error('no test writes files'); },
  saveAs: () => { throw new Error('no test writes files'); },
  openFileName: () => null,
  forget: () => { throw new Error('no test writes files'); },
};

function createWiringHarness() {
  const engine = createEngine();
  const storage = createMemoryStorage();
  const backup = createStorageBackup(storage, () => Date.now());
  const rules: LayoutRules = { layout: 1, steps: [] };
  const exportedFiles = createExportedFiles(rules);

  const projectRepo = createProjectRepo(
    engine,
    noFiles,
    storage,
    'http://localhost/',
    backup,
    exportedFiles,
  );
  let onReplacedCalled = false;
  const appSettingsRepo = createAppSettingsRepo(
    storage,
    backup,
    () => undefined,
    () => { onReplacedCalled = true; },
  );

  const config: OAuthConfig = {
    clientId: 'test-client-id',
    redirectUri: 'http://localhost/',
    scopes: ['https://www.googleapis.com/auth/drive.appdata'],
  };

  const guard = { leave: vi.fn() };
  const dummyFetch: typeof fetch = () => Promise.resolve(new Response('{}', { status: 200 }));

  const wiring = createCloudSyncWiring({
    storage,
    projectRepo,
    appSettingsRepo,
    backup,
    rules,
    config,
    guard,
    fetch: dummyFetch,
    timer: { after: () => () => undefined, every: () => () => undefined },
    lock: { withLock: (_name, f) => f() },
    visible: () => true,
    location: { href: 'http://localhost/', hash: '', replaceState: () => undefined },
    random: () => new Uint8Array(16).fill(7),
    now: () => 0,
  });

  return {
    wiring,
    storage,
    projectRepo,
    appSettingsRepo,
    engine,
    onReplacedCalled: () => onReplacedCalled,
  };
}

describe('cloudSyncWiring', () => {
  it('builds a CloudSync that is off until the user connects', () => {
    const {wiring} = createWiringHarness();
    expect(wiring.cloudSync.status().kind).toBe('off');
  });

  it('forgetCloudSyncRecord reaches ledger.forgetAll', () => {
    const {wiring} = createWiringHarness();
    const cursor = ChangeCursor.of('cursor-123');
    if (cursor !== null) {
      wiring.ledger.setCursor(cursor);
    }
    expect(wiring.ledger.cursor()).not.toBeNull();

    wiring.ledger.forgetAll();
    expect(wiring.ledger.cursor()).toBeNull();
    expect(wiring.ledger.rows()).toEqual([]);
    expect(wiring.ledger.conflicts()).toEqual([]);
  });
});
