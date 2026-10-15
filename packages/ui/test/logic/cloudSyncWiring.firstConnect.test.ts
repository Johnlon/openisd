/**
 * First connect, two devices, real sync over the real Drive client: what a device saved before it
 * connected reaches Drive, and a second device that connects later pulls it.
 */
import {describe, expect, it, vi} from 'vitest';
import {createCloudSyncWiring, type PulledProject} from '../../src/logic/cloudSyncWiring.js';
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
  createProjectBin,
  createProjectBinMarks,
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
function deviceOn(drive: DriveEmulator, fill: number, userAgent = 'Windows') {
  const engine = createEngine();
  const storage = createMemoryStorage();
  const backup = createStorageBackup(storage, () => NOW);
  const rules: LayoutRules = {layout: STORAGE_LAYOUT, steps: LAYOUT_STEPS};
  const projectRepo = createProjectRepo(engine, noFiles, storage, 'http://localhost/', backup, createExportedFiles(rules), () => undefined, () => undefined);
  const appSettingsRepo = createAppSettingsRepo(storage, backup, () => undefined, () => undefined, () => undefined);
  const deviceName = DeviceName.ofBrowser(userAgent, 0);
  const binMarks = createProjectBinMarks(storage, backup);
  const projectBin = createProjectBin({projects: projectRepo, marks: binMarks, backup, device: () => deviceName.text, now: () => NOW, onSaved: () => undefined});

  const pulled: PulledProject[] = [];

  function connect() {
    storage.set(OPENISD_CLOUD_AUTH_KEY, JSON.stringify({kind: 'token', accessToken: 'tok', expiresAt_ms: NOW + 3_600_000, account: 'john@example.com'}));
    return createCloudSyncWiring({
      storage,
      projectRepo,
      projectBin,
      binMarks,
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
      deviceName,
      projectsPulled: p => { pulled.push(...p); },
    });
  }

  function saveProject(name: string): void {
    const project = ProjectBuilder.empty(engine);
    project.name.set(name);
    project.save();
    const saved = projectRepo.saveToStorage(project);
    expect(saved).not.toHaveProperty('error');
  }

  return {engine, storage, projectRepo, projectBin, connect, saveProject, pulled};
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

  it('a pulled edit to a saved project is handed over when the run ends, naming the device it came from', async () => {
    const drive = new DriveEmulator();
    const desktop = deviceOn(drive, 1);
    desktop.saveProject('Sub 12');
    const desktopSync = desktop.connect();
    await desktopSync.scheduler.syncNow();
    const phoneUa = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
    const phone = deviceOn(drive, 2, phoneUa);
    const phoneSync = phone.connect();
    await phoneSync.scheduler.syncNow();
    expect(phone.pulled).toEqual([]);

    const [saved] = phone.projectRepo.listStoredProjects();
    const id = saved?.id ?? '';
    const project = phone.projectRepo.loadStoredProject(id);
    if (Array.isArray(project)) throw new Error('the pulled project does not load');
    project.portVelocityLimit_m_per_s.set(25);
    project.save();
    expect(phone.projectRepo.saveToStorage(project).kind).toBe('saved');
    await phoneSync.scheduler.syncNow();

    await desktopSync.scheduler.syncNow();
    expect(desktop.pulled).toEqual([{id, from: DeviceName.ofBrowser(phoneUa, 0).text}]);
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

  describe('the Bin', () => {
    /** Desktop saved and synced "Sub 12"; the iPhone has pulled it. */
    async function twoDevicesWithOneProject() {
      const drive = new DriveEmulator();
      const desk = deviceOn(drive, 1, 'Windows');
      desk.saveProject('Sub 12');
      const deskSync = desk.connect();
      expect((await deskSync.engine.run()).kind).toBe('synced');
      const phone = deviceOn(drive, 2, 'iPhone');
      const phoneSync = phone.connect();
      expect((await phoneSync.engine.run()).kind).toBe('synced');
      const id = desk.projectRepo.listStoredProjects()[0]?.id ?? '';
      return {drive, desk, deskSync, phone, phoneSync, id};
    }

    it('a project binned on one device is in the Bin on the other, off its project list', async () => {
      const {desk, deskSync, phone, phoneSync, id} = await twoDevicesWithOneProject();
      expect(desk.projectBin.moveToBin(id)).toBe('done');
      expect(desk.projectBin.activeProjects()).toEqual([]);
      expect((await deskSync.engine.run()).kind).toBe('synced');
      expect((await phoneSync.engine.run()).kind).toBe('synced');
      expect(phone.projectBin.activeProjects()).toEqual([]);
      expect(phone.projectBin.binned()).toMatchObject([{id, name: 'Sub 12', device: 'Windows desktop', binnedAt_ms: NOW}]);
    });

    it('Restore on the other device takes it out of the Bin on both', async () => {
      const {desk, deskSync, phone, phoneSync, id} = await twoDevicesWithOneProject();
      desk.projectBin.moveToBin(id);
      await deskSync.engine.run();
      await phoneSync.engine.run();
      expect(phone.projectBin.restore(id)).toBe('done');
      expect((await phoneSync.engine.run()).kind).toBe('synced');
      expect((await deskSync.engine.run()).kind).toBe('synced');
      expect(desk.projectBin.binned()).toEqual([]);
      expect(desk.projectBin.activeProjects().map(p => p.name)).toEqual(['Sub 12']);
    });

    it('an edit made on another device after the bin brings it back, and the event log says where', async () => {
      const {desk, deskSync, phone, phoneSync, id} = await twoDevicesWithOneProject();
      desk.projectBin.moveToBin(id);
      await deskSync.engine.run();
      await phoneSync.engine.run();
      const open = phone.projectRepo.loadStoredProject(id);
      if (Array.isArray(open)) throw new Error(open.join('; '));
      open.name.set('Sub 12 edited');
      expect(phone.projectRepo.saveToStorage(open).kind).toBe('saved');
      expect(phone.projectBin.binned()).toEqual([]);
      expect((await phoneSync.engine.run()).kind).toBe('synced');
      expect((await deskSync.engine.run()).kind).toBe('synced');
      expect(desk.projectBin.binned()).toEqual([]);
      expect(desk.projectBin.activeProjects().map(p => p.name)).toEqual(['Sub 12 edited']);
      expect(deskSync.cloudSync.diagnostics().events).toContainEqual({kind: 'restoredFromBin', at_ms: NOW, name: 'Sub 12 edited', editedOn: 'iPhone'});
    });

    it('Empty Bin takes one backup, deletes them on Drive, and the other device drops them too', async () => {
      const {drive, desk, deskSync, phone, phoneSync, id} = await twoDevicesWithOneProject();
      desk.saveProject('Sub 15');
      await deskSync.engine.run();
      await phoneSync.engine.run();
      const second = desk.projectRepo.listStoredProjects().find(p => p.name === 'Sub 15')?.id ?? '';
      desk.projectBin.moveToBin(id);
      desk.projectBin.moveToBin(second);
      const backups = () => desk.storage.keys().filter(key => key.startsWith(OPENISD_BACKUP_PREFIX)).length;
      const before = backups();
      expect(desk.projectBin.emptyBin()).toBe('done');
      expect(backups()).toBe(before + 1);
      expect(desk.projectRepo.listStoredProjects()).toEqual([]);
      expect((await deskSync.engine.run()).kind).toBe('synced');
      expect(drive.listFiles().filter(f => f.name.startsWith('project-')).every(f => f.appProperties.deleted === '1')).toBe(true);
      expect((await phoneSync.engine.run()).kind).toBe('synced');
      expect(phone.projectRepo.listStoredProjects()).toEqual([]);
      expect(phone.projectBin.binned()).toEqual([]);
    });
  });

  it('a Drive file of a kind this build does not know is left alone, the rest syncs, and the log says so once', async () => {
    const drive = new DriveEmulator();
    drive.seed('future-1.json', {app: 'openisd', kind: 'futureThing', uuid: 'x-1', layout: '9', seq: '1', writer: 'dev-9', hash: 'h'}, '{}');
    const desk = deviceOn(drive, 1);
    desk.saveProject('Sub 12');
    const deskSync = desk.connect();
    await deskSync.scheduler.syncNow();
    expect(deskSync.cloudSync.status().kind).toBe('synced');
    expect(drive.listFiles().map(f => f.name)).toContain('future-1.json');
    expect(drive.listFiles().filter(f => f.name.startsWith('project-'))).toHaveLength(1);
    expect(deskSync.cloudSync.diagnostics().events.filter(e => e.kind === 'skipped')).toEqual([{kind: 'skipped', at_ms: NOW, count: 1}]);
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
