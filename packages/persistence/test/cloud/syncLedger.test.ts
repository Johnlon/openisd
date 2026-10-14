import { describe, it, expect, beforeEach } from 'vitest';
import { createSyncLedger } from '../../src/cloud/syncLedger.js';
import { createMemoryStorage } from '../../src/storage/keyValueStorage.js';
import {
  BodyHash,
  ChangeCursor,
  type ConflictCopy,
  DeviceId,
  type DocId,
  DriverId,
  FileId,
  PrId,
  ProjectId,
  RevisionId,
} from '@openisd/design/cloud';

function makeDocId(kind: DocId['kind'], uuid?: string): DocId {
  if (kind === 'settings' || kind === 'favourites') {
    return { kind };
  }
  return { kind, uuid: uuid ?? 'test-uuid' };
}

function makeRow(docId: DocId, seq: number = 1): {
  id: DocId;
  fileId: FileId;
  revision: RevisionId;
  hash: BodyHash;
  seq: number;
} {
  return {
    id: docId,
    fileId: FileId.of(`file-${docId.kind}`)!,
    revision: RevisionId.of(`rev-${docId.kind}`)!,
    hash: BodyHash.of('hash-value')!,
    seq,
  };
}

function makeConflictCopy(id: ProjectId | DriverId | PrId, name: string): ConflictCopy {
  return {
    id,
    name,
    from: DeviceId.of('test-device')!,
    at_ms: Date.now(),
  };
}

describe('syncLedger', () => {
  let storage: ReturnType<typeof createMemoryStorage>;

  beforeEach(() => {
    storage = createMemoryStorage({});
  });

  describe('deviceId', () => {
    it('is minted once and stable across two ledgers on the same storage', () => {
      const ledger1 = createSyncLedger({ storage, random: () => new Uint8Array([1, 2, 3, 4]) });
      const ledger2 = createSyncLedger({ storage, random: () => new Uint8Array([5, 6, 7, 8]) });

      expect(ledger1.deviceId().equals(ledger2.deviceId())).toBe(true);
    });

    it('is minted from injected random on first creation', () => {
      const ledger = createSyncLedger({ storage, random: () => new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]) });
      const id = ledger.deviceId();
      expect(id.text.length).toBeGreaterThan(0);
    });
  });

  describe('Lamport clock', () => {
    it('nextSeq after observe(7) is 8', () => {
      const ledger = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      ledger.observe(7);
      expect(ledger.nextSeq()).toBe(8);
    });

    it('nextSeq after observe(7) then observe(3) is still 8 (max seen)', () => {
      const ledger = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      ledger.observe(7);
      ledger.observe(3);
      expect(ledger.nextSeq()).toBe(8);
    });

    it('nextSeq starts at 1 when nothing observed', () => {
      const ledger = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      expect(ledger.nextSeq()).toBe(1);
    });

    it('nextSeq increments based on max of all observed values', () => {
      const ledger = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      ledger.observe(5);
      ledger.observe(10);
      ledger.observe(3);
      expect(ledger.nextSeq()).toBe(11);
    });
  });

  describe('rows', () => {
    it('returns empty array initially', () => {
      const ledger = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      expect(ledger.rows()).toEqual([]);
    });

    it('set and row round trip for project', () => {
      const ledger = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      const docId = makeDocId('project', 'proj-123');
      const row = makeRow(docId, 5);
      ledger.set(row);
      const retrieved = ledger.row(docId);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toEqual(row.id);
      expect(retrieved!.fileId.value).toBe(row.fileId.value);
      expect(retrieved!.revision.value).toBe(row.revision.value);
      expect(retrieved!.hash.value).toBe(row.hash.value);
      expect(retrieved!.seq).toBe(row.seq);
    });

    it('set and row round trip for driver', () => {
      const ledger = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      const docId = makeDocId('driver', 'drv-456');
      const row = makeRow(docId, 3);
      ledger.set(row);
      const retrieved = ledger.row(docId);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toEqual(row.id);
      expect(retrieved!.fileId.value).toBe(row.fileId.value);
      expect(retrieved!.revision.value).toBe(row.revision.value);
      expect(retrieved!.hash.value).toBe(row.hash.value);
      expect(retrieved!.seq).toBe(row.seq);
    });

    it('set and row round trip for pr', () => {
      const ledger = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      const docId = makeDocId('pr', 'pr-789');
      const row = makeRow(docId, 7);
      ledger.set(row);
      const retrieved = ledger.row(docId);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toEqual(row.id);
      expect(retrieved!.fileId.value).toBe(row.fileId.value);
      expect(retrieved!.revision.value).toBe(row.revision.value);
      expect(retrieved!.hash.value).toBe(row.hash.value);
      expect(retrieved!.seq).toBe(row.seq);
    });

    it('set and row round trip for settings', () => {
      const ledger = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      const docId = makeDocId('settings');
      const row = makeRow(docId, 2);
      ledger.set(row);
      const retrieved = ledger.row(docId);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toEqual(row.id);
      expect(retrieved!.fileId.value).toBe(row.fileId.value);
      expect(retrieved!.revision.value).toBe(row.revision.value);
      expect(retrieved!.hash.value).toBe(row.hash.value);
      expect(retrieved!.seq).toBe(row.seq);
    });

    it('set and row round trip for favourites', () => {
      const ledger = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      const docId = makeDocId('favourites');
      const row = makeRow(docId, 4);
      ledger.set(row);
      const retrieved = ledger.row(docId);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toEqual(row.id);
      expect(retrieved!.fileId.value).toBe(row.fileId.value);
      expect(retrieved!.revision.value).toBe(row.revision.value);
      expect(retrieved!.hash.value).toBe(row.hash.value);
      expect(retrieved!.seq).toBe(row.seq);
    });

    it('row returns null for non-existent id', () => {
      const ledger = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      const docId = makeDocId('project', 'non-existent');
      expect(ledger.row(docId)).toBeNull();
    });

    it('drop removes a row', () => {
      const ledger = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      const docId = makeDocId('project', 'proj-123');
      const row = makeRow(docId, 5);
      ledger.set(row);
      expect(ledger.row(docId)).not.toBeNull();
      ledger.drop(docId);
      expect(ledger.row(docId)).toBeNull();
    });

    it('rows returns all set rows', () => {
      const ledger = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      const docId1 = makeDocId('project', 'proj-1');
      const docId2 = makeDocId('driver', 'drv-1');
      const row1 = makeRow(docId1, 1);
      const row2 = makeRow(docId2, 2);
      ledger.set(row1);
      ledger.set(row2);
      const allRows = ledger.rows();
      expect(allRows).toHaveLength(2);
    });

    it('equal DocIds (same kind and uuid) refer to the same row', () => {
      const ledger = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      const docId1 = makeDocId('project', 'same-uuid');
      const docId2 = makeDocId('project', 'same-uuid');
      const row = makeRow(docId1, 10);
      ledger.set(row);
      expect(ledger.row(docId2)).not.toBeNull();
      expect(ledger.row(docId2)!.seq).toBe(10);
    });

    it('drops a row that does not rebuild (corrupt FileId)', () => {
      const ledger = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      const docId = makeDocId('project', 'proj-123');
      const row = makeRow(docId, 5);
      ledger.set(row);

      // Corrupt the stored JSON directly
      const raw = storage.get('openisd_cloud_state');
      expect(raw).not.toBeNull();
      storage.set('openisd_cloud_state', raw!.replace('"fileId":"file-project"', '"fileId":""'));

      // Create new ledger - should drop the corrupt row
      const ledger2 = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      expect(ledger2.row(docId)).toBeNull();
    });

    it('drops a row that does not rebuild (corrupt RevisionId)', () => {
      const ledger = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      const docId = makeDocId('project', 'proj-123');
      const row = makeRow(docId, 5);
      ledger.set(row);

      const raw = storage.get('openisd_cloud_state');
      expect(raw).not.toBeNull();
      storage.set('openisd_cloud_state', raw!.replace('"revision":"rev-project"', '"revision":""'));

      const ledger2 = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      expect(ledger2.row(docId)).toBeNull();
    });

    it('drops a row that does not rebuild (corrupt BodyHash)', () => {
      const ledger = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      const docId = makeDocId('project', 'proj-123');
      const row = makeRow(docId, 5);
      ledger.set(row);

      const raw = storage.get('openisd_cloud_state');
      expect(raw).not.toBeNull();
      storage.set('openisd_cloud_state', raw!.replace('"hash":"hash-value"', '"hash":""'));

      const ledger2 = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      expect(ledger2.row(docId)).toBeNull();
    });
  });

  describe('cursor', () => {
    it('returns null initially', () => {
      const ledger = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      expect(ledger.cursor()).toBeNull();
    });

    it('setCursor and cursor round trip', () => {
      const ledger = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      const cursor = ChangeCursor.of('cursor-123')!;
      ledger.setCursor(cursor);
      expect(ledger.cursor()?.value).toBe('cursor-123');
    });

    it('setCursor can be called with null', () => {
      const ledger = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      ledger.setCursor(ChangeCursor.of('cursor-123')!);
      ledger.setCursor(null);
      expect(ledger.cursor()).toBeNull();
    });
  });

  describe('conflicts', () => {
    it('returns empty array initially', () => {
      const ledger = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      expect(ledger.conflicts()).toEqual([]);
    });

    it('addConflict and conflicts round trip', () => {
      const ledger = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      const projectId = ProjectId.of('proj-123')!;
      const conflict = makeConflictCopy(projectId, 'Project 1');
      ledger.addConflict(conflict);
      const conflicts = ledger.conflicts();
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].id).toEqual(conflict.id);
      expect(conflicts[0].name).toBe(conflict.name);
      expect(conflicts[0].from.equals(conflict.from)).toBe(true);
      expect(conflicts[0].at_ms).toBe(conflict.at_ms);
    });

    it('addConflict works with DriverId', () => {
      const ledger = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      const driverId = DriverId.of('drv-456')!;
      const conflict = makeConflictCopy(driverId, 'Driver 1');
      ledger.addConflict(conflict);
      expect(ledger.conflicts()).toHaveLength(1);
    });

    it('addConflict works with PrId', () => {
      const ledger = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      const prId = PrId.of('pr-789')!;
      const conflict = makeConflictCopy(prId, 'PR 1');
      ledger.addConflict(conflict);
      expect(ledger.conflicts()).toHaveLength(1);
    });

    it('clearConflict removes a conflict by id', () => {
      const ledger = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      const projectId = ProjectId.of('proj-123')!;
      const conflict = makeConflictCopy(projectId, 'Project 1');
      ledger.addConflict(conflict);
      expect(ledger.conflicts()).toHaveLength(1);
      ledger.clearConflict(projectId);
      expect(ledger.conflicts()).toHaveLength(0);
    });

    it('clearConflict does nothing for non-existent id', () => {
      const ledger = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      const projectId = ProjectId.of('proj-123')!;
      ledger.clearConflict(projectId);
      expect(ledger.conflicts()).toHaveLength(0);
    });
  });

  describe('forgetAll', () => {
    it('removes all rows', () => {
      const ledger = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      const docId = makeDocId('project', 'proj-123');
      ledger.set(makeRow(docId, 1));
      ledger.forgetAll();
      expect(ledger.rows()).toEqual([]);
    });

    it('removes cursor', () => {
      const ledger = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      ledger.setCursor(ChangeCursor.of('cursor-123')!);
      ledger.forgetAll();
      expect(ledger.cursor()).toBeNull();
    });

    it('removes conflicts', () => {
      const ledger = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      const projectId = ProjectId.of('proj-123')!;
      ledger.addConflict(makeConflictCopy(projectId, 'Project 1'));
      ledger.forgetAll();
      expect(ledger.conflicts()).toEqual([]);
    });

    it('keeps the device id', () => {
      const ledger = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      const deviceId = ledger.deviceId();
      ledger.forgetAll();
      expect(ledger.deviceId().equals(deviceId)).toBe(true);
    });

    it('keeps the device id across new ledger instances after forgetAll', () => {
      const ledger1 = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      const deviceId = ledger1.deviceId();
      ledger1.forgetAll();

      const ledger2 = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      expect(ledger2.deviceId().equals(deviceId)).toBe(true);
    });
  });

  describe('corrupt stored value', () => {
    it('reads as empty ledger when stored JSON is invalid', () => {
      storage.set('openisd_cloud_state', 'not valid json');
      const ledger = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      expect(ledger.rows()).toEqual([]);
      expect(ledger.cursor()).toBeNull();
      expect(ledger.conflicts()).toEqual([]);
      expect(ledger.deviceId().text.length).toBeGreaterThan(0);
    });

    it('reads as empty ledger when stored value is not an object', () => {
      storage.set('openisd_cloud_state', '"just a string"');
      const ledger = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      expect(ledger.rows()).toEqual([]);
      expect(ledger.cursor()).toBeNull();
      expect(ledger.conflicts()).toEqual([]);
    });

    it('reads as empty ledger when stored value is null', () => {
      storage.set('openisd_cloud_state', 'null');
      const ledger = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      expect(ledger.rows()).toEqual([]);
      expect(ledger.cursor()).toBeNull();
      expect(ledger.conflicts()).toEqual([]);
    });

    it('reads as empty ledger when stored value is an array', () => {
      storage.set('openisd_cloud_state', '[]');
      const ledger = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      expect(ledger.rows()).toEqual([]);
      expect(ledger.cursor()).toBeNull();
      expect(ledger.conflicts()).toEqual([]);
    });

    it('reads as empty ledger when rows is not an array', () => {
      storage.set('openisd_cloud_state', JSON.stringify({ rows: 'not an array' }));
      const ledger = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      expect(ledger.rows()).toEqual([]);
      expect(ledger.cursor()).toBeNull();
      expect(ledger.conflicts()).toEqual([]);
    });
  });

  describe('persistence across instances', () => {
    it('rows persist across ledger instances', () => {
      const ledger1 = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      const docId = makeDocId('project', 'proj-123');
      ledger1.set(makeRow(docId, 5));

      const ledger2 = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      expect(ledger2.row(docId)?.seq).toBe(5);
    });

    it('cursor persists across ledger instances', () => {
      const ledger1 = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      ledger1.setCursor(ChangeCursor.of('cursor-123')!);

      const ledger2 = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      expect(ledger2.cursor()?.value).toBe('cursor-123');
    });

    it('conflicts persist across ledger instances', () => {
      const ledger1 = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      const projectId = ProjectId.of('proj-123')!;
      ledger1.addConflict(makeConflictCopy(projectId, 'Project 1'));

      const ledger2 = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      expect(ledger2.conflicts()).toHaveLength(1);
    });

    it('Lamport clock persists across ledger instances', () => {
      const ledger1 = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      ledger1.observe(7);

      const ledger2 = createSyncLedger({ storage, random: () => new Uint8Array(16) });
      expect(ledger2.nextSeq()).toBe(8);
    });
  });
});
describe('relistOnce', () => {
  it('drops the change cursor once, so the next run lists every Drive file; later calls keep it', async () => {
    const { relistOnce } = await import('../../src/cloud/syncLedger.js');
    const { ChangeCursor } = await import('@openisd/design/cloud');
    const storage = createMemoryStorage();
    const ledger = createSyncLedger({ storage, random: () => new Uint8Array(16).fill(7) });
    const cursor = ChangeCursor.of('c-1');
    if (cursor === null) throw new Error('cursor');
    ledger.setCursor(cursor);

    relistOnce(storage, ledger);
    expect(ledger.cursor()).toBeNull();

    ledger.setCursor(cursor);
    relistOnce(storage, ledger);
    expect(ledger.cursor()?.toString()).toBe('c-1');
  });
});
