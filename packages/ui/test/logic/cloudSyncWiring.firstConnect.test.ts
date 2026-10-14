/**
 * First connect, two devices, real sync over the real Drive client: what a device saved before it
 * connected reaches Drive, and a second device that connects later pulls it.
 */
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
  OPENISD_BACKUP_PREFIX,
  OPENISD_CLOUD_AUTH_KEY,
  OPENISD_MY_DRIVERS_KEY,
  STORAGE_LAYOUT,
  LAYOUT_STEPS,
} from '@openisd/persistence';
import {ProjectBuilder} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';
import {DeviceName, type OAuthConfig} from '@openisd/design/cloud';
import {DriveEmulator} from '../fixtures/driveEmulator.js';

const noFiles: FileStorage = {
  save: () => { throw new Error('no test writes files'); },
  saveAs: () => { throw new Error('no test writes files'); },
  openFileName: () => null,
  forget: () => { throw new Error('no test writes files'); },
};

const config: OAuthConfig = {
  clientId: 'test-client-id',
  redirectUri: 'http://localhost/',
  scopes: ['https://www.googleapis.com/auth/drive.appdata'],
};

const NOW = Date.UTC(2026, 9, 14, 10, 0, 0);

/** One device: its own browser storage, repos and sync, signed in, sharing `drive`. */
function deviceOn(drive: DriveEmulator, fill: number) {
  const engine = createEngine();
  const storage = createMemoryStorage();
  const backup = createStorageBackup(storage, () => NOW);
  const rules: LayoutRules = {layout: STORAGE_LAYOUT, steps: LAYOUT_STEPS};
  const projectRepo = createProjectRepo(engine, noFiles, storage, 'http://localhost/', backup, createExportedFiles(rules), () => undefined, () => undefined);
  const appSettingsRepo = createAppSettingsRepo(storage, backup, () => undefined, () => undefined, () => undefined);

  function connect() {
    storage.set(OPENISD_CLOUD_AUTH_KEY, JSON.stringify({kind: 'token', accessToken: 'tok', expiresAt_ms: NOW + 3_600_000, account: 'john@example.com'}));
    return createCloudSyncWiring({
      storage,
      projectRepo,
      appSettingsRepo,
      backup,
      rules,
      config,
      guard: {leave: vi.fn()},
      fetch: drive.fetch,
      online: () => true,
      timer: {after: () => () => undefined, every: () => () => undefined},
      lock: {withLock: (_name, f) => f()},
      visible: () => true,
      location: {href: 'http://localhost/', hash: '', replaceState: () => undefined},
      random: () => new Uint8Array(16).fill(fill),
      now: () => NOW,
      deviceName: DeviceName.ofBrowser('', 0),
    });
  }

  function saveProject(name: string): void {
    const project = ProjectBuilder.empty(engine);
    project.name.set(name);
    project.save();
    const saved = projectRepo.saveToStorage(project);
    expect(saved).not.toHaveProperty('error');
  }

  return {engine, storage, projectRepo, connect, saveProject};
}

describe('cloud sync first connect', () => {
  it('pushes what was saved before connecting, and a second device pulls it', async () => {
    const drive = new DriveEmulator();
    const desktop = deviceOn(drive, 1);
    desktop.saveProject('Sub 12');
    desktop.storage.set(OPENISD_MY_DRIVERS_KEY, JSON.stringify({entries: [{uuid: 'd-1', record: {brand: 'Peerless', model: 'XXLS'}}]}));

    const desktopRun = await desktop.connect().engine.run();
    expect(desktopRun.kind).toBe('synced');
    const names = drive.listFiles().map(f => f.name);
    expect(names.filter(n => n.startsWith('project-'))).toHaveLength(1);
    expect(names).toContain('driver-d-1.json');

    const phone = deviceOn(drive, 2);
    const phoneRun = await phone.connect().engine.run();
    expect(phoneRun.kind).toBe('synced');
    expect(phone.projectRepo.listStoredProjects().map(p => p.name)).toEqual(['Sub 12']);
    expect(phone.storage.get(OPENISD_MY_DRIVERS_KEY)).toContain('Peerless');
  });

  it('Delete on one device removes the project from the other device after both sync', async () => {
    const drive = new DriveEmulator();
    const desktop = deviceOn(drive, 1);
    desktop.saveProject('Sub 12');
    const desktopSync = desktop.connect();
    expect((await desktopSync.engine.run()).kind).toBe('synced');
    const phone = deviceOn(drive, 2);
    const phoneSync = phone.connect();
    expect((await phoneSync.engine.run()).kind).toBe('synced');
    expect(phone.projectRepo.listStoredProjects().map(p => p.name)).toEqual(['Sub 12']);

    const [saved] = desktop.projectRepo.listStoredProjects();
    expect(desktop.projectRepo.deleteStoredProject(saved?.id ?? '')).toBe('done');
    expect(desktopSync.engine.pendingLocal()).toBe(1);
    expect((await desktopSync.engine.run()).kind).toBe('synced');
    expect(desktopSync.engine.pendingLocal()).toBe(0);

    expect((await phoneSync.engine.run()).kind).toBe('synced');
    expect(phone.projectRepo.listStoredProjects()).toEqual([]);
  });

  it('a pulled run that replaces several saved drivers takes one whole-store backup, not one per item', async () => {
    const drive = new DriveEmulator();
    const desktop = deviceOn(drive, 1);
    const drivers = (brand: string) => JSON.stringify({entries: ['d-1', 'd-2', 'd-3'].map(uuid => ({uuid, record: {brand, model: uuid}}))});
    desktop.storage.set(OPENISD_MY_DRIVERS_KEY, drivers('Peerless'));
    expect((await desktop.connect().engine.run()).kind).toBe('synced');

    const phone = deviceOn(drive, 2);
    phone.storage.set(OPENISD_MY_DRIVERS_KEY, drivers('Scan-Speak'));
    expect((await phone.connect().engine.run()).kind).toBe('synced');

    expect(phone.storage.get(OPENISD_MY_DRIVERS_KEY)).toContain('Peerless');
    expect(phone.storage.keys().filter(key => key.startsWith(OPENISD_BACKUP_PREFIX))).toHaveLength(1);
  });
});
