import { describe, it, expect, beforeEach } from 'vitest';
import {
  BodyHash,
  DeviceName,
  type DocId,
  FileId,
  RevisionId,
  bodyHashOf,
} from '@openisd/design/cloud';
import type { KeyValueStorage } from '../../src/storage/keyValueStorage.js';
import { createSyncLedger, type SyncLedger } from '../../src/cloud/syncLedger.js';
import type { StorageBackup, Guarded, BackupResult, BackupInfo } from '../../src/repos/storageBackup.js';
import { FakeCloudStore } from './fakeCloudStore.js';
import { FakeLocalDocs } from './fakeLocalDocs.js';
import { createSyncEngine } from '../../src/cloud/syncEngine.js';

class MemoryStorage implements KeyValueStorage {
  private data = new Map<string, string>();
  get(key: string) { return this.data.get(key) ?? null; }
  set(key: string, value: string) { this.data.set(key, value); }
  remove(key: string) { this.data.delete(key); }
  watch() { return () => {}; }
  keys() { return Array.from(this.data.keys()); }
}

class FakeBackup implements StorageBackup {
  guardCalls = 0;
  refuse = false;

  guard<T>(destructive: () => T): Guarded<T> {
    this.guardCalls++;
    if (this.refuse) {
      return { kind: 'refused' };
    }
    return { kind: 'ran', value: destructive() };
  }

  take(): BackupResult { return { kind: 'nothingToBackUp' }; }
  list(): BackupInfo[] { return []; }
  read(): string | null { return null; }
  discard(): boolean { return false; }
  write(): boolean { return true; }
}

describe('SyncEngine — Drive sync plan P1-10 (sections 5.1–5.5)', () => {
  let cloud: FakeCloudStore;
  let localProjects: FakeLocalDocs;
  let localDrivers: FakeLocalDocs;
  let localSettings: FakeLocalDocs;
  let ledger: SyncLedger;
  let backup: FakeBackup;
  let nowMs: number;

  const APP_LAYOUT = 2;
  const project1Id: DocId = { kind: 'project', uuid: 'proj-1' };
  const project2Id: DocId = { kind: 'project', uuid: 'proj-2' };
  const settingsId: DocId = { kind: 'settings' };

  const body1 = JSON.stringify({ name: 'Sub 12', volume: 45 });
  const body1Updated = JSON.stringify({ name: 'Sub 12', volume: 50 });
  const body2 = JSON.stringify({ name: 'Monitor 8', volume: 20 });
  const bodySettings = JSON.stringify({ theme: 'dark' });
  const bodySettingsUpdated = JSON.stringify({ theme: 'light' });

  beforeEach(() => {
    cloud = new FakeCloudStore();
    localProjects = new FakeLocalDocs('project');
    localDrivers = new FakeLocalDocs('driver');
    localSettings = new FakeLocalDocs('settings');
    ledger = createSyncLedger({
      storage: new MemoryStorage(),
      random: () => new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]),
    });
    backup = new FakeBackup();
    nowMs = 1776100000000;
  });

  let progress: string[];

  function createEngine(layout = APP_LAYOUT) {
    progress = [];
    return createSyncEngine({
      progress: { started: () => progress.push('started'), pushed: (n) => progress.push(`pushed ${n}`) },
      cloud,
      local: [localProjects, localDrivers, localSettings],
      ledger,
      backup,
      layout,
      now: () => nowMs,
      deviceName: DeviceName.ofBrowser('', 0),
    });
  }

  describe('Upload concurrency', () => {
    function newProjects(n: number) {
      return Array.from({ length: n }, (_, i) => ({
        id: { kind: 'project', uuid: `new-${i}` } as const,
        body: JSON.stringify({ name: `Box ${i}`, volume: i + 1 }),
        layout: APP_LAYOUT,
      }));
    }

    function trackCreates(failAt: number | null = null) {
      const seen = { inFlight: 0, maxInFlight: 0, calls: 0 };
      const create = cloud.create.bind(cloud);
      cloud.create = async (id, body, meta) => {
        const call = seen.calls++;
        seen.inFlight++;
        seen.maxInFlight = Math.max(seen.maxInFlight, seen.inFlight);
        await new Promise(resolve => setTimeout(resolve, 1));
        seen.inFlight--;
        if (call === failAt) return { kind: 'offline' };
        return create(id, body, meta);
      };
      return seen;
    }

    it('uploads new items four at a time', async () => {
      localProjects.docs = newProjects(10);
      const seen = trackCreates();
      const outcome = await createEngine().run();
      expect(outcome).toMatchObject({ kind: 'synced', pushed: 10 });
      expect(seen.maxInFlight).toBe(4);
      expect(progress.filter(p => p.startsWith('pushed'))).toHaveLength(10);
    });

    it('a failed upload stops new ones; those already sent still count', async () => {
      localProjects.docs = newProjects(10);
      const seen = trackCreates(1);
      const outcome = await createEngine().run();
      // Calls 0, 2, 3 and 4 were sent before call 1 failed; none starts after it.
      expect(seen.calls).toBe(5);
      expect(outcome).toMatchObject({ kind: 'stopped', reason: 'offline', pushedSoFar: 4 });
    });
  });

  describe('Progress', () => {
    it('reports the start of a run and each push as it lands', async () => {
      localProjects.docs = [
        { id: project1Id, body: body1, layout: APP_LAYOUT },
        { id: project2Id, body: body2, layout: APP_LAYOUT },
      ];
      const outcome = await createEngine().run();
      expect(outcome.kind).toBe('synced');
      expect(progress).toEqual(['started', 'pushed 1', 'pushed 2']);
    });
  });

  describe('Core invariants', () => {
    it('equal hashes never make a copy: adopts revision without copy or push', async () => {
      localProjects.docs = [{ id: project1Id, body: body1, layout: APP_LAYOUT }];
      const hash1 = bodyHashOf(body1)!;

      const fileId = FileId.of('file-p1')!;
      const rev1 = RevisionId.of('rev-1')!;
      cloud.seedFile({
        meta: {
          id: project1Id,
          fileId,
          revision: rev1,
          parentRevision: null,
          layout: APP_LAYOUT,
          seq: 1,
          writer: 'device-other',
          deleted: false,
          remoteHash: hash1,
        },
        body: body1,
      });

      const engine = createEngine();
      const outcome = await engine.run();

      expect(outcome.kind).toBe('synced');
      if (outcome.kind === 'synced') {
        expect(outcome.conflicts).toHaveLength(0);
        expect(outcome.pushed).toBe(0);
      }
      expect(localProjects.conflictCalls).toHaveLength(0);
      expect(localProjects.putCalls).toHaveLength(0);
      expect(backup.guardCalls).toBe(0);

      const row = ledger.row(project1Id);
      expect(row).not.toBeNull();
      expect(row?.revision.toString()).toBe('rev-1');
      expect(row?.hash.toString()).toBe(hash1.toString());
    });

    it('a push-only run takes no backup', async () => {
      localProjects.docs = [{ id: project1Id, body: body1, layout: APP_LAYOUT }];

      const engine = createEngine();
      const outcome = await engine.run();

      expect(outcome.kind).toBe('synced');
      if (outcome.kind === 'synced') {
        expect(outcome.pushed).toBe(1);
        expect(outcome.pulled).toBe(0);
      }
      expect(backup.guardCalls).toBe(0);
      expect(cloud.files.size).toBe(1);
    });

    it('a held doc (remote layout > app layout) blocks its local push and counts as held', async () => {
      localProjects.docs = [{ id: project1Id, body: body1Updated, layout: APP_LAYOUT }];
      const hash1 = bodyHashOf(body1)!;
      const rev1 = RevisionId.of('rev-1')!;
      ledger.set({
        id: project1Id,
        fileId: FileId.of('file-p1')!,
        revision: rev1,
        hash: hash1,
        seq: 1,
      });

      // Remote has newer layout (layout 3 vs app layout 2)
      cloud.seedFile({
        meta: {
          id: project1Id,
          fileId: FileId.of('file-p1')!,
          revision: RevisionId.of('rev-2')!,
          parentRevision: rev1,
          layout: 3,
          seq: 2,
          writer: 'device-other',
          deleted: false,
          remoteHash: BodyHash.of('hash-future')!,
        },
        body: 'future-body',
      });

      const engine = createEngine();
      const outcome = await engine.run();

      expect(outcome.kind).toBe('synced');
      if (outcome.kind === 'synced') {
        expect(outcome.held).toBe(1);
        expect(outcome.pushed).toBe(0);
        expect(outcome.pulled).toBe(0);
      }
      // Local edit was blocked from pushing:
      const cloudFile = cloud.files.get('file-p1');
      expect(cloudFile?.meta.layout).toBe(3);
    });

    it('the fake plays the overwrite race: moved reply causes re-pull and conflict copy', async () => {
      localProjects.docs = [{ id: project1Id, body: body1Updated, layout: APP_LAYOUT }];
      const hash1 = bodyHashOf(body1)!;
      const rev1 = RevisionId.of('rev-1')!;
      const fileId = FileId.of('file-p1')!;

      ledger.set({
        id: project1Id,
        fileId,
        revision: rev1,
        hash: hash1,
        seq: 1,
      });

      cloud.seedFile({
        meta: {
          id: project1Id,
          fileId,
          revision: rev1,
          parentRevision: null,
          layout: APP_LAYOUT,
          seq: 1,
          writer: 'device-local',
          deleted: false,
          remoteHash: hash1,
        },
        body: body1,
      });

      // Simulate concurrent update on cloud before push executes
      cloud.simulateConcurrentUpdate(fileId, JSON.stringify({ name: 'Sub 12', volume: 60 }), {
        seq: 2,
        writer: 'device-concurrent',
        hash: BodyHash.of('hash-concurrent')!,
      });

      const engine = createEngine();
      const outcome = await engine.run();

      expect(outcome.kind).toBe('synced');
      if (outcome.kind === 'synced') {
        expect(outcome.conflicts.length).toBeGreaterThan(0);
      }
      // Conflict copy was created locally and pushed as new doc:
      expect(localProjects.conflictCalls).toHaveLength(1);
      expect(cloud.files.size).toBe(2);
    });
  });

  describe('Backup guard handling', () => {
    it('takes ONE backup.guard when removing or replacing local data', async () => {
      localProjects.docs = [{ id: project1Id, body: body1, layout: APP_LAYOUT }];
      const hash1 = bodyHashOf(body1)!;
      const rev1 = RevisionId.of('rev-1')!;
      ledger.set({
        id: project1Id,
        fileId: FileId.of('file-p1')!,
        revision: rev1,
        hash: hash1,
        seq: 1,
      });

      // Remote updated doc
      cloud.seedFile({
        meta: {
          id: project1Id,
          fileId: FileId.of('file-p1')!,
          revision: RevisionId.of('rev-2')!,
          parentRevision: rev1,
          layout: APP_LAYOUT,
          seq: 2,
          writer: 'device-other',
          deleted: false,
          remoteHash: bodyHashOf(body1Updated)!,
        },
        body: body1Updated,
      });

      const engine = createEngine();
      const outcome = await engine.run();

      expect(outcome.kind).toBe('synced');
      expect(backup.guardCalls).toBe(1);
    });

    it('refuses removing/replacing step when backup is refused (noRoom), but pushes unblocked changes', async () => {
      // Doc 1: clean local, remote delete -> needs removal (guarded)
      localProjects.docs = [
        { id: project1Id, body: body1, layout: APP_LAYOUT },
        { id: project2Id, body: body2, layout: APP_LAYOUT }, // local new -> push
      ];
      const hash1 = bodyHashOf(body1)!;
      const rev1 = RevisionId.of('rev-1')!;
      ledger.set({
        id: project1Id,
        fileId: FileId.of('file-p1')!,
        revision: rev1,
        hash: hash1,
        seq: 1,
      });

      cloud.seedFile({
        meta: {
          id: project1Id,
          fileId: FileId.of('file-p1')!,
          revision: RevisionId.of('rev-2')!,
          parentRevision: rev1,
          layout: APP_LAYOUT,
          seq: 2,
          writer: 'device-other',
          deleted: true,
          remoteHash: null,
        },
        body: body1,
      });

      backup.refuse = true;

      const engine = createEngine();
      const outcome = await engine.run();

      expect(outcome.kind).toBe('refused');
      if (outcome.kind === 'refused') {
        expect(outcome.reason).toBe('noRoom');
      }
      // Removal was refused:
      expect(localProjects.docs.some(d => d.id.kind === 'project' && d.id.uuid === 'proj-1')).toBe(true);
      // But push still happened:
      expect(cloud.files.size).toBe(2);
    });
  });

  describe('Failure mapping to RunOutcome', () => {
    it('maps offline to stopped', async () => {
      cloud.simulateOffline = true;
      const engine = createEngine();
      const outcome = await engine.run();
      expect(outcome).toEqual({
        kind: 'stopped',
        reason: 'offline',
        pushedSoFar: 0,
        pendingLocal: 0,
      });
    });

    it('maps quota to stopped', async () => {
      cloud.simulateQuota = 1000;
      const engine = createEngine();
      const outcome = await engine.run();
      expect(outcome).toEqual({
        kind: 'stopped',
        reason: 'quota',
        pushedSoFar: 0,
        pendingLocal: 0,
      });
    });

    it('maps unauthorised to reconnect', async () => {
      cloud.simulateUnauthorised = true;
      const engine = createEngine();
      const outcome = await engine.run();
      expect(outcome).toEqual({
        kind: 'reconnect',
        pendingLocal: 0,
      });
    });

    it('maps malformed to failed', async () => {
      cloud.simulateMalformed = 'Invalid JSON response';
      const engine = createEngine();
      const outcome = await engine.run();
      expect(outcome).toEqual({
        kind: 'failed',
        fault: { operation: 'request', status: 0, reason: 'Invalid JSON response', reply: '' },
        pendingLocal: 0,
      });
    });

    it('maps unreadable bucket to refused bucketUnreadable', async () => {
      localProjects.unreadable = true;
      const engine = createEngine();
      const outcome = await engine.run();
      expect(outcome.kind).toBe('refused');
      if (outcome.kind === 'refused') {
        expect(outcome.reason).toBe('bucketUnreadable');
      }
    });
  });

  describe('Section 5.5 Scenarios', () => {
    it('Scenario 1: Edit project on A offline; edit same project on B; A comes online -> keep both', async () => {
      // Local edit
      localProjects.docs = [{ id: project1Id, body: body1Updated, layout: APP_LAYOUT }];
      const hash1 = bodyHashOf(body1)!;
      const rev1 = RevisionId.of('rev-1')!;
      ledger.set({
        id: project1Id,
        fileId: FileId.of('file-p1')!,
        revision: rev1,
        hash: hash1,
        seq: 1,
      });

      // Remote edit on B
      const bodyB = JSON.stringify({ name: 'Sub 12', volume: 55 });
      cloud.seedFile({
        meta: {
          id: project1Id,
          fileId: FileId.of('file-p1')!,
          revision: RevisionId.of('rev-2')!,
          parentRevision: rev1,
          layout: APP_LAYOUT,
          seq: 2,
          writer: 'device-B',
          deleted: false,
          remoteHash: bodyHashOf(bodyB)!,
        },
        body: bodyB,
      });

      const engine = createEngine();
      const outcome = await engine.run();

      expect(outcome.kind).toBe('synced');
      if (outcome.kind === 'synced') {
        expect(outcome.conflicts.length).toBe(1);
      }
      expect(localProjects.conflictCalls).toHaveLength(1);
      // B's edit is now the local project-1:
      const p1 = localProjects.docs.find(d => d.id.kind === 'project' && d.id.uuid === 'proj-1');
      expect(p1?.body).toBe(bodyB);
      // Conflict copy was pushed:
      expect(cloud.files.size).toBe(2);
    });

    it('Scenario 2: Both devices made the same edit -> adopt, no copy', async () => {
      localProjects.docs = [{ id: project1Id, body: body1Updated, layout: APP_LAYOUT }];
      const hash1 = bodyHashOf(body1)!;
      const rev1 = RevisionId.of('rev-1')!;
      ledger.set({
        id: project1Id,
        fileId: FileId.of('file-p1')!,
        revision: rev1,
        hash: hash1,
        seq: 1,
      });

      cloud.seedFile({
        meta: {
          id: project1Id,
          fileId: FileId.of('file-p1')!,
          revision: RevisionId.of('rev-2')!,
          parentRevision: rev1,
          layout: APP_LAYOUT,
          seq: 2,
          writer: 'device-B',
          deleted: false,
          remoteHash: bodyHashOf(body1Updated)!,
        },
        body: body1Updated,
      });

      const engine = createEngine();
      const outcome = await engine.run();

      expect(outcome.kind).toBe('synced');
      if (outcome.kind === 'synced') {
        expect(outcome.conflicts).toHaveLength(0);
        expect(outcome.pushed).toBe(0);
      }
      expect(localProjects.conflictCalls).toHaveLength(0);
    });

    it('Scenario 3: Open project, autosave rewrites it, canonical hash unchanged -> not a local edit', async () => {
      // Re-serialised with different whitespace/key order
      const rewrittenBody = '{\n  "volume": 45,\n  "name": "Sub 12"\n}';
      localProjects.docs = [{ id: project1Id, body: rewrittenBody, layout: APP_LAYOUT }];
      const hash1 = bodyHashOf(body1)!;
      const rev1 = RevisionId.of('rev-1')!;
      ledger.set({
        id: project1Id,
        fileId: FileId.of('file-p1')!,
        revision: rev1,
        hash: hash1,
        seq: 1,
      });

      cloud.seedFile({
        meta: {
          id: project1Id,
          fileId: FileId.of('file-p1')!,
          revision: rev1,
          parentRevision: null,
          layout: APP_LAYOUT,
          seq: 1,
          writer: 'device-local',
          deleted: false,
          remoteHash: hash1,
        },
        body: body1,
      });

      const engine = createEngine();
      expect(engine.pendingLocal()).toBe(0);
      const outcome = await engine.run();

      expect(outcome.kind).toBe('synced');
      if (outcome.kind === 'synced') {
        expect(outcome.pushed).toBe(0);
      }
    });

    it('Scenario 4: Delete on A; edit on B -> B edit wins everywhere', async () => {
      // Deleted locally on A
      localProjects.docs = [];
      const hash1 = bodyHashOf(body1)!;
      const rev1 = RevisionId.of('rev-1')!;
      ledger.set({
        id: project1Id,
        fileId: FileId.of('file-p1')!,
        revision: rev1,
        hash: hash1,
        seq: 1,
      });

      // Edited on B
      const bodyB = JSON.stringify({ name: 'Sub 12', volume: 60 });
      cloud.seedFile({
        meta: {
          id: project1Id,
          fileId: FileId.of('file-p1')!,
          revision: RevisionId.of('rev-2')!,
          parentRevision: rev1,
          layout: APP_LAYOUT,
          seq: 2,
          writer: 'device-B',
          deleted: false,
          remoteHash: bodyHashOf(bodyB)!,
        },
        body: bodyB,
      });

      const engine = createEngine();
      const outcome = await engine.run();

      expect(outcome.kind).toBe('synced');
      // Local got the project back:
      expect(localProjects.docs).toHaveLength(1);
      expect(localProjects.docs[0].body).toBe(bodyB);
    });

    it('Scenario 5: Delete on A; B clean -> B removes it after whole-store backup; Drive keeps tombstone', async () => {
      // Clean on B
      localProjects.docs = [{ id: project1Id, body: body1, layout: APP_LAYOUT }];
      const hash1 = bodyHashOf(body1)!;
      const rev1 = RevisionId.of('rev-1')!;
      ledger.set({
        id: project1Id,
        fileId: FileId.of('file-p1')!,
        revision: rev1,
        hash: hash1,
        seq: 1,
      });

      // Tombstone on Drive
      cloud.seedFile({
        meta: {
          id: project1Id,
          fileId: FileId.of('file-p1')!,
          revision: RevisionId.of('rev-2')!,
          parentRevision: rev1,
          layout: APP_LAYOUT,
          seq: 2,
          writer: 'device-A',
          deleted: true,
          remoteHash: null,
        },
        body: body1,
      });

      const engine = createEngine();
      const outcome = await engine.run();

      expect(outcome.kind).toBe('synced');
      expect(backup.guardCalls).toBe(1);
      expect(localProjects.docs).toHaveLength(0);
      expect(ledger.row(project1Id)).toBeNull();
    });

    it('Scenario 6: New device, first sync, empty local -> listAll, apply everything, ledger built', async () => {
      localProjects.docs = [];
      const hash1 = bodyHashOf(body1)!;
      cloud.seedFile({
        meta: {
          id: project1Id,
          fileId: FileId.of('file-p1')!,
          revision: RevisionId.of('rev-1')!,
          parentRevision: null,
          layout: APP_LAYOUT,
          seq: 1,
          writer: 'device-other',
          deleted: false,
          remoteHash: hash1,
        },
        body: body1,
      });

      const engine = createEngine();
      const outcome = await engine.run();

      expect(outcome.kind).toBe('synced');
      if (outcome.kind === 'synced') {
        expect(outcome.pulled).toBe(1);
      }
      expect(localProjects.docs).toHaveLength(1);
      expect(ledger.row(project1Id)).not.toBeNull();
    });

    it('Scenario 7: User clears app folder in Drive settings -> local docs pushed back as new', async () => {
      localProjects.docs = [{ id: project1Id, body: body1, layout: APP_LAYOUT }];
      ledger.set({
        id: project1Id,
        fileId: FileId.of('file-old')!,
        revision: RevisionId.of('rev-old')!,
        hash: bodyHashOf(body1)!,
        seq: 1,
      });
      // Cloud is completely empty

      const engine = createEngine();
      const outcome = await engine.run();

      expect(outcome.kind).toBe('synced');
      if (outcome.kind === 'synced') {
        expect(outcome.pushed).toBe(1);
      }
      expect(cloud.files.size).toBe(1);
    });

    it('Scenario 8: Tombstones older than 90 days with no local reference are purged', async () => {
      const ninetyOneDaysAgo = nowMs - 91 * 24 * 60 * 60 * 1000;
      const fileId = FileId.of('file-tomb-old')!;
      cloud.seedFile(
        {
          meta: {
            id: project1Id,
            fileId,
            revision: RevisionId.of('rev-tomb')!,
            parentRevision: null,
            layout: APP_LAYOUT,
            seq: 1,
            writer: 'device-other',
            deleted: true,
            remoteHash: null,
          },
          body: body1,
        },
        ninetyOneDaysAgo
      );

      const engine = createEngine();
      const outcome = await engine.run();

      expect(outcome.kind).toBe('synced');
      expect(cloud.purgeCalls).toContainEqual(fileId);
      expect(cloud.files.has('file-tomb-old')).toBe(false);
    });
  });

  describe('Singletons (settings) with Lamport clock', () => {
    it('applies remote settings when remote has higher seq', async () => {
      localSettings.docs = [{ id: settingsId, body: bodySettingsUpdated, layout: APP_LAYOUT }];
      const hashOriginal = bodyHashOf(bodySettings)!;
      ledger.set({
        id: settingsId,
        fileId: FileId.of('file-settings')!,
        revision: RevisionId.of('rev-1')!,
        hash: hashOriginal,
        seq: 1,
      });

      const bodyRemote = JSON.stringify({ theme: 'system' });
      cloud.seedFile({
        meta: {
          id: settingsId,
          fileId: FileId.of('file-settings')!,
          revision: RevisionId.of('rev-2')!,
          parentRevision: RevisionId.of('rev-1')!,
          layout: APP_LAYOUT,
          seq: 10,
          writer: 'device-other',
          deleted: false,
          remoteHash: bodyHashOf(bodyRemote)!,
        },
        body: bodyRemote,
      });

      const engine = createEngine();
      const outcome = await engine.run();

      expect(outcome.kind).toBe('synced');
      expect(localSettings.docs[0].body).toBe(bodyRemote);
    });
  });

  describe('Migration on read', () => {
    it('migrates a layout 1 remote doc when app layout is 2', async () => {
      localProjects.docs = [];
      localProjects.migrator = (doc) => {
        return JSON.stringify({ ...JSON.parse(doc.body), migrated: true });
      };

      cloud.seedFile({
        meta: {
          id: project1Id,
          fileId: FileId.of('file-p1')!,
          revision: RevisionId.of('rev-1')!,
          parentRevision: null,
          layout: 1, // older layout
          seq: 1,
          writer: 'device-other',
          deleted: false,
          remoteHash: bodyHashOf(body1)!,
        },
        body: body1,
      });

      const engine = createEngine();
      const outcome = await engine.run();

      expect(outcome.kind).toBe('synced');
      expect(localProjects.docs).toHaveLength(1);
      expect(localProjects.docs[0].body).toContain('"migrated":true');
    });
  });
});
