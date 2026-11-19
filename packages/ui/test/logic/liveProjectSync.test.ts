/**
 * Cloud sync sends the whole project, unsaved edits included, a few seconds after editing stops (John,
 * 18 Nov 2026, QO946.c247: "why are we sending on saved state and not entire project? why force user to do
 * anything"; c248: option A). Two devices, each with its own store, app state and real sync, over one
 * emulated Drive: what one has on screen, saved checkpoint and unsaved edits, the other gets.
 */
import {describe, expect, it, vi} from 'vitest';
import {nextTick} from 'vue';
import {ProjectBuilder, type OpenISDProject} from '@openisd/design';
import {DeviceName, type OAuthConfig, SYNC_AFTER_EDIT_MS} from '@openisd/design/cloud';
import {
  createAppSettingsRepo,
  createExportedFiles,
  createLayoutSteps,
  createMemoryStorage,
  createProjectBin,
  createProjectBinMarks,
  createProjectRepo,
  createStorageBackup,
  type FileStorage,
  type LayoutRules,
  OPENISD_CLOUD_AUTH_KEY,
  STORAGE_LAYOUT,
  type Timer,
} from '@openisd/persistence';
import {createEngine} from '@openisd/design/engine';
import {createCloudSyncWiring} from '../../src/logic/cloudSyncWiring.js';
import {followPulledProjects, keepAsConflictCopy, type PulledProjectsDeps} from '../../src/logic/pulledProjects.js';
import {startLiveProjectSync, type LiveProjectSync} from '../../src/logic/liveProjectSync.js';
import {createAppStateFixture} from '../fixtures/appStateFixture.js';
import {DriveEmulator} from '../fixtures/driveEmulator.js';

const NOW = Date.UTC(2026, 10, 18, 10, 0, 0);
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';
const PHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

const noFiles: FileStorage = {
  save: () => { throw new Error('no test writes files'); },
  saveAs: () => { throw new Error('no test writes files'); },
  openFileName: () => null,
  forget: () => { throw new Error('no test writes files'); },
};

const config: OAuthConfig = {clientId: 'test-client-id', redirectUri: 'http://localhost/', scopes: ['https://www.googleapis.com/auth/drive.appdata']};

/** A timer the test moves on by hand. */
function manualTimer(): Timer & {advance(ms: number): void} {
  let at = 0;
  let waiting: {due: number; f: () => void}[] = [];
  return {
    after(ms, f) {
      const job = {due: at + ms, f};
      waiting.push(job);
      return () => { waiting = waiting.filter(w => w !== job); };
    },
    every: () => () => undefined,
    advance(ms) {
      at += ms;
      const due = waiting.filter(w => w.due <= at);
      waiting = waiting.filter(w => w.due > at);
      for (const job of due) job.f();
    },
  };
}

/** One device: its own browser store, app state and sync, signed in to `drive`. */
function deviceOn(drive: DriveEmulator, fill: number, userAgent: string) {
  const storage = createMemoryStorage();
  const {appState} = createAppStateFixture(storage);
  const backup = createStorageBackup(storage, () => NOW);
  const rules: LayoutRules = {layout: STORAGE_LAYOUT, steps: createLayoutSteps(createEngine(), () => 'test-project-id')};
  const projectRepo = createProjectRepo(appState.engine, noFiles, storage, 'http://localhost/', backup, createExportedFiles(rules), () => undefined, () => undefined, () => undefined);
  const appSettingsRepo = createAppSettingsRepo(storage, backup, () => undefined, () => undefined, () => undefined);
  const deviceName = DeviceName.ofBrowser(userAgent, 0);
  const binMarks = createProjectBinMarks(storage, backup);
  const projectBin = createProjectBin({projects: projectRepo, marks: binMarks, backup, device: () => deviceName.text, now: () => NOW, onSaved: () => undefined});
  const timer = manualTimer();
  const runs: Promise<void>[] = [];
  let live: LiveProjectSync | null = null;
  storage.set(OPENISD_CLOUD_AUTH_KEY, JSON.stringify({kind: 'token', accessToken: 'tok', expiresAt_ms: NOW + 3_600_000, account: 'john@example.com'}));
  const followDeps = (): PulledProjectsDeps => ({
    appState, projectRepo, deviceName, now: () => NOW,
    keptBoth: (copyId, name, item, otherDevice) => wiring.cloudSync.projectKeptBoth(copyId, name, item, otherDevice),
  });
  const wiring = createCloudSyncWiring({
    storage, projectRepo, projectBin, binMarks, appSettingsRepo, backup, rules, config,
    guard: {leave: vi.fn()},
    fetch: drive.fetch,
    online: () => true,
    timer,
    lock: {withLock: (_name, f) => f()},
    visible: () => true,
    location: {href: 'http://localhost/', hash: '', replaceState: () => undefined},
    random: () => new Uint8Array(16).fill(fill),
    now: () => NOW,
    deviceName,
    projectsPulled: pulled => void followPulledProjects(followDeps(), pulled),
    beforeRun: () => { live?.flush(); },
  });
  live = startLiveProjectSync({
    appState, projectRepo, timer,
    active: () => wiring.session.grant().kind !== 'none',
    push: () => { runs.push(wiring.scheduler.syncNow()); },
    keepBoth: project => void keepAsConflictCopy(followDeps(), project, ''),
  });

  /** Lets the app hear the edits, then lets `ms` pass, then waits for any run that started. */
  async function wait(ms: number): Promise<void> {
    await nextTick();
    timer.advance(ms);
    await Promise.all(runs.splice(0));
  }

  /** The project open on this device (the test opens one). */
  function open(): OpenISDProject {
    const [project] = appState.openProjects();
    if (project === undefined) throw new Error('no project is open');
    return project;
  }

  /** Opens stored project `id`, as the Projects list does. */
  function openStored(id: string): OpenISDProject {
    const project = projectRepo.loadStoredProject(id);
    if (Array.isArray(project)) throw new Error(project.join('; '));
    return appState.openProjectOnce(project, {kind: 'stored', id});
  }

  return {appState, projectRepo, wiring, timer, wait, open, openStored, sync: () => wiring.scheduler.syncNow()};
}

/** Desktop saved "Sub 12" at a port limit of 17 m/s and synced it; the iPhone pulled it; both have it open. */
async function bothOpen() {
  const drive = new DriveEmulator();
  const desk = deviceOn(drive, 1, DESKTOP_UA);
  const project = ProjectBuilder.empty(desk.appState.engine);
  project.name.set('Sub 12');
  project.portVelocityLimit_m_per_s.set(17);
  project.save();
  expect(desk.projectRepo.saveToStorage(project).kind).toBe('saved');
  const id = project.uuid();
  desk.appState.openProjectOnce(project, {kind: 'stored', id});
  await desk.sync();
  const phone = deviceOn(drive, 2, PHONE_UA);
  await phone.sync();
  phone.openStored(id);
  return {drive, desk, phone, id};
}


function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The port limit a stored project text holds in its `side` layer: null when it has no such layer. */
function limitIn(text: string, side: 'saved' | 'edited'): unknown {
  const parsed: unknown = JSON.parse(text);
  if (!isRecord(parsed)) throw new Error('not a stored project');
  const layer = parsed[side];
  if (!isRecord(layer)) return null;
  const box = layer['box'];
  return isRecord(box) ? box['portVelocityLimit_m_per_s'] : undefined;
}

/** The port limit Drive's copy of the project holds in its `side` layer: null when it has no such layer. */
function onDrive(drive: DriveEmulator, side: 'saved' | 'edited'): unknown {
  return limitIn(drive.bodyOf('project-'), side);
}

describe('an edit is sent with the project, unsaved', () => {
  it('reaches Drive SYNC_AFTER_EDIT_MS after the last edit, the saved checkpoint unchanged and the edit as the unsaved layer', async () => {
    const {drive, desk} = await bothOpen();
    desk.open().portVelocityLimit_m_per_s.set(19);
    await desk.wait(1000);
    desk.open().portVelocityLimit_m_per_s.set(20);
    await desk.wait(SYNC_AFTER_EDIT_MS - 1);
    expect(onDrive(drive, 'edited')).toBeNull();

    await desk.wait(1);
    expect(onDrive(drive, 'saved')).toBe(17);
    expect(onDrive(drive, 'edited')).toBe(20);
    // Still unsaved on the device that edited it: sending it is not a Save.
    expect(desk.appState.projectHasUnsavedChanges(desk.open())).toBe(true);
  });

  it('is sent by a run that starts before the wait is over (Sync now): a run sends what is on screen', async () => {
    const {drive, desk} = await bothOpen();
    desk.open().portVelocityLimit_m_per_s.set(20);
    await nextTick();
    await desk.sync();
    expect(onDrive(drive, 'edited')).toBe(20);
  });

  it('Save sends the new checkpoint with no unsaved layer', async () => {
    const {drive, desk} = await bothOpen();
    desk.open().portVelocityLimit_m_per_s.set(20);
    await desk.wait(SYNC_AFTER_EDIT_MS);
    const project = desk.open();
    expect(desk.projectRepo.saveToStorage(project.committedSnapshot()).kind).toBe('saved');
    project.save();
    await desk.sync();
    expect(onDrive(drive, 'saved')).toBe(20);
    expect(onDrive(drive, 'edited')).toBeNull();
  });
});

describe('the other device', () => {
  it('shows the same saved checkpoint and the same unsaved edits, marked unsaved', async () => {
    const {desk, phone} = await bothOpen();
    desk.open().portVelocityLimit_m_per_s.set(20);
    await desk.wait(SYNC_AFTER_EDIT_MS);
    await phone.sync();

    const shown = phone.open();
    expect(phone.appState.openProjects()).toHaveLength(1);
    expect(shown.portVelocityLimit_m_per_s.value).toBe(20);
    expect(phone.appState.projectHasUnsavedChanges(shown)).toBe(true);
    expect(shown.name.value).toBe('Sub 12');
  });

  it('Revert there returns to the shared checkpoint, and that is sent back too', async () => {
    const {drive, desk, phone} = await bothOpen();
    desk.open().portVelocityLimit_m_per_s.set(20);
    await desk.wait(SYNC_AFTER_EDIT_MS);
    await phone.sync();

    expect(await phone.open().cancel(async () => true)).toBe(true);
    expect(phone.open().portVelocityLimit_m_per_s.value).toBe(17);
    await phone.wait(SYNC_AFTER_EDIT_MS);
    expect(onDrive(drive, 'edited')).toBeNull();

    await desk.sync();
    expect(desk.open().portVelocityLimit_m_per_s.value).toBe(17);
    expect(desk.appState.projectHasUnsavedChanges(desk.open())).toBe(false);
    expect(desk.wiring.cloudSync.conflicts()).toEqual([]);
  });

  it('closing the project without saving clears its unsaved edits in the store and on Drive', async () => {
    const {drive, desk, id} = await bothOpen();
    desk.open().portVelocityLimit_m_per_s.set(20);
    await desk.wait(SYNC_AFTER_EDIT_MS);
    expect(onDrive(drive, 'edited')).toBe(20);

    desk.appState.removeProject(0);
    await desk.wait(0);
    expect(onDrive(drive, 'edited')).toBeNull();
    const reopened = desk.projectRepo.loadStoredProject(id);
    expect(Array.isArray(reopened) ? null : reopened.isModified()).toBe(false);
  });
});

describe('two devices edit the same project before either syncs', () => {
  it('keeps both versions: the other device\'s keeps the name, this device\'s stays open as the announced conflict copy', async () => {
    const {desk, phone, id} = await bothOpen();
    desk.open().portVelocityLimit_m_per_s.set(20);
    phone.open().portVelocityLimit_m_per_s.set(25);
    await desk.wait(SYNC_AFTER_EDIT_MS);
    await phone.wait(SYNC_AFTER_EDIT_MS);

    const mine = phone.open();
    expect(mine.portVelocityLimit_m_per_s.value).toBe(25);
    expect(mine.name.value).toMatch(/^Sub 12 \(conflict, .*iPhone\)$/);
    expect(phone.appState.projectHasUnsavedChanges(mine)).toBe(true);
    const theirs = phone.projectRepo.loadStoredProject(id);
    expect(Array.isArray(theirs) ? null : theirs.portVelocityLimit_m_per_s.value).toBe(20);
    expect(phone.wiring.cloudSync.conflicts()).toMatchObject([{item: 'Sub 12', name: mine.name.value}]);

    await desk.sync();
    expect(desk.projectRepo.listStoredProjects().map(p => p.name).sort()).toEqual(['Sub 12', mine.name.value]);
  });

  it('never writes over another version that reached the store before the open project\'s edits: the edits become a conflict copy', async () => {
    const {desk, id} = await bothOpen();
    const other = desk.projectRepo.loadStoredProject(id);
    if (Array.isArray(other)) throw new Error(other.join('; '));
    other.portVelocityLimit_m_per_s.set(30);
    // Another version lands in the store while the open project is not following it (as before the session is restored).
    expect(desk.projectRepo.putStoredDoc(id, other.toStoredText())).toBe('done');
    desk.open().portVelocityLimit_m_per_s.set(20);
    await desk.wait(SYNC_AFTER_EDIT_MS);

    const kept = desk.projectRepo.loadStoredProject(id);
    expect(Array.isArray(kept) ? null : kept.portVelocityLimit_m_per_s.value).toBe(30);
    expect(desk.open().name.value).toMatch(/^Sub 12 \(conflict, /);
    expect(desk.open().portVelocityLimit_m_per_s.value).toBe(20);
    expect(desk.wiring.cloudSync.conflicts()).toMatchObject([{item: 'Sub 12'}]);
  });
});

describe('older documents', () => {
  it('a Drive document without the unsaved layer loads, as saved with nothing unsaved', async () => {
    const {drive, phone, id} = await bothOpen();
    phone.appState.removeProject(0);
    // Written by a build that wrote no `edited` key: the saved project only, at a port limit of 21 m/s.
    drive.editAsDevice('project-', body => {
      const parsed: unknown = JSON.parse(body);
      if (!isRecord(parsed)) throw new Error('not a stored project');
      const {edited: _edited, saved, ...rest} = parsed;
      if (!isRecord(saved) || !isRecord(saved['box'])) throw new Error('not a stored project');
      return JSON.stringify({...rest, saved: {...saved, box: {...saved['box'], portVelocityLimit_m_per_s: 21}}});
    }, 'Old laptop');
    await phone.sync();
    expect(JSON.parse(drive.bodyOf('project-'))).not.toHaveProperty('edited');
    const loaded = phone.projectRepo.loadStoredProject(id);
    if (Array.isArray(loaded)) throw new Error(loaded.join('; '));
    expect(loaded.portVelocityLimit_m_per_s.value).toBe(21);
    expect(loaded.isModified()).toBe(false);
    expect(phone.openStored(id).portVelocityLimit_m_per_s.value).toBe(21);
  });
});

describe('with Cloud sync not connected', () => {
  it('writes nothing and runs nothing', async () => {
    const {desk, id} = await bothOpen();
    await desk.wiring.cloudSync.disconnect();
    const before = desk.projectRepo.storedDocs();
    desk.open().portVelocityLimit_m_per_s.set(20);
    await desk.wait(SYNC_AFTER_EDIT_MS);
    expect(desk.projectRepo.storedDocs()).toEqual(before);
    const stored = desk.projectRepo.loadStoredProject(id);
    expect(Array.isArray(stored) ? null : stored.isModified()).toBe(false);
  });
});

describe('two tabs of one browser', () => {
  /** A tab over `storage`: its own app state and store reader, Cloud sync connected. */
  function tabOn(storage: ReturnType<typeof createMemoryStorage>) {
    const {appState} = createAppStateFixture(storage);
    const rules: LayoutRules = {layout: STORAGE_LAYOUT, steps: createLayoutSteps(createEngine(), () => 'test-project-id')};
    const projectRepo = createProjectRepo(appState.engine, noFiles, storage, 'http://localhost/', createStorageBackup(storage, () => NOW), createExportedFiles(rules), () => undefined, () => undefined, () => undefined);
    const timer = manualTimer();
    const keepBoth = vi.fn<(project: OpenISDProject) => void>();
    startLiveProjectSync({appState, projectRepo, timer, active: () => true, push: () => undefined, keepBoth});
    /** Shows stored project `id` as this tab has it now (as adopting the other tab's session does). */
    function show(id: string): OpenISDProject {
      for (const open of [...appState.openProjects()]) appState.removeProject(appState.openProjects().indexOf(open));
      const project = projectRepo.loadStoredProject(id);
      if (Array.isArray(project)) throw new Error(project.join('; '));
      return appState.openProjectOnce(project, {kind: 'stored', id});
    }
    async function wait(ms: number): Promise<void> {
      await nextTick();
      timer.advance(ms);
    }
    return {appState, projectRepo, keepBoth, show, wait};
  }

  it('write over each other\'s unsaved edits without making conflict copies', async () => {
    const storage = createMemoryStorage();
    const first = tabOn(storage);
    const project = ProjectBuilder.empty(first.appState.engine);
    project.name.set('Sub 12');
    project.save();
    expect(first.projectRepo.saveToStorage(project).kind).toBe('saved');
    const id = project.uuid();
    const second = tabOn(storage);
    const mine = first.show(id);
    await first.wait(0);

    mine.portVelocityLimit_m_per_s.set(20);
    await first.wait(SYNC_AFTER_EDIT_MS);
    const theirs = second.show(id);
    await second.wait(0);
    theirs.portVelocityLimit_m_per_s.set(23);
    await second.wait(SYNC_AFTER_EDIT_MS);
    mine.portVelocityLimit_m_per_s.set(24);
    await first.wait(SYNC_AFTER_EDIT_MS);

    expect(first.keepBoth).not.toHaveBeenCalled();
    expect(second.keepBoth).not.toHaveBeenCalled();
    const stored = first.projectRepo.loadStoredProject(id);
    expect(Array.isArray(stored) ? null : stored.portVelocityLimit_m_per_s.value).toBe(24);
    expect(first.projectRepo.listStoredProjects()).toHaveLength(1);
  });
});
