import { describe, it, expect } from 'vitest';
import {
  BodyHash,
  type DocId,
  FileId,
  RevisionId,
} from '../../cloud/syncDoc.js';
import type { CloudMeta } from '../../cloud/cloudTypes.js';
import {
  decideDocSync,
  compareLamport,
  shouldPurgeTombstone,
  type DecideSyncInputs,
} from '../../cloud/syncRules.js';

function makeMeta(params: {
  id: DocId;
  fileId?: string;
  revision: string;
  parentRevision?: string | null;
  layout?: number;
  seq?: number;
  writer?: string;
  deleted?: boolean;
  remoteHash?: string | null;
  tombstonedAt_ms?: number;
}): CloudMeta {
  const fileId = FileId.of(params.fileId ?? 'file-1');
  const revision = RevisionId.of(params.revision);
  const parentRevision = params.parentRevision ? RevisionId.of(params.parentRevision) : null;
  const remoteHash = params.remoteHash ? BodyHash.of(params.remoteHash) : null;
  if (!fileId || !revision) {
    throw new Error('Invalid test metadata params');
  }
  return {
    id: params.id,
    fileId,
    revision,
    parentRevision,
    layout: params.layout ?? 2,
    seq: params.seq ?? 1,
    writer: params.writer ?? 'device-remote',
    deleted: params.deleted ?? false,
    remoteHash,
    ...(params.tombstonedAt_ms !== undefined ? { tombstonedAt_ms: params.tombstonedAt_ms } : {}),
  };
}

describe('syncRules — Drive sync plan section 5.3', () => {
  const projectId: DocId = { kind: 'project', uuid: 'proj-123' };
  const settingsId: DocId = { kind: 'settings' };
  const hashA = BodyHash.of('hash-aaa')!;
  const hashB = BodyHash.of('hash-bbb')!;
  const rev1 = RevisionId.of('rev-1')!;
  const rev2 = RevisionId.of('rev-2')!;

  describe('Pre-condition: equal-hash adoption rule precedes 5.3 rows', () => {
    it('adopts remote revision without copying or pushing when local and remote hashes match', () => {
      const remote = makeMeta({
        id: projectId,
        revision: 'rev-2',
        parentRevision: 'rev-1',
        remoteHash: 'hash-aaa',
        seq: 5,
      });
      const input: DecideSyncInputs = {
        id: projectId,
        local: { hash: hashA, layout: 2 },
        ledger: { hash: hashB, revision: rev1, seq: 1 },
        remote,
        appLayout: 2,
        deviceId: 'device-local',
      };
      const result = decideDocSync(input);
      expect(result).toEqual({ kind: 'adopt', remote });
    });
  });

  describe('Row 14: remote layout > app layout is held', () => {
    it('holds doc when remote layout is newer than this app layout, blocking local edit push', () => {
      const remote = makeMeta({
        id: projectId,
        revision: 'rev-2',
        layout: 3,
        remoteHash: 'hash-bbb',
      });
      const input: DecideSyncInputs = {
        id: projectId,
        local: { hash: hashA, layout: 2 },
        ledger: { hash: hashA, revision: rev1, seq: 1 },
        remote,
        appLayout: 2,
        deviceId: 'device-local',
      };
      const result = decideDocSync(input);
      expect(result).toEqual({ kind: 'held', remote });
    });
  });

  describe('5.3 rows for multi-doc (project, driver, pr)', () => {
    it('clean + unchanged -> nothing', () => {
      const remote = makeMeta({
        id: projectId,
        revision: 'rev-1',
        remoteHash: 'hash-aaa',
      });
      const input: DecideSyncInputs = {
        id: projectId,
        local: { hash: hashA, layout: 2 },
        ledger: { hash: hashA, revision: rev1, seq: 1 },
        remote,
        appLayout: 2,
        deviceId: 'device-local',
      };
      expect(decideDocSync(input)).toEqual({ kind: 'nothing' });
    });

    it('clean + edit lineage ok -> applyRemote', () => {
      const remote = makeMeta({
        id: projectId,
        revision: 'rev-2',
        parentRevision: 'rev-1',
        remoteHash: 'hash-bbb',
      });
      const input: DecideSyncInputs = {
        id: projectId,
        local: { hash: hashA, layout: 2 },
        ledger: { hash: hashA, revision: rev1, seq: 1 },
        remote,
        appLayout: 2,
        deviceId: 'device-local',
      };
      expect(decideDocSync(input)).toEqual({ kind: 'applyRemote', remote });
    });

    it('clean + delete -> removeLocal', () => {
      const remote = makeMeta({
        id: projectId,
        revision: 'rev-2',
        deleted: true,
      });
      const input: DecideSyncInputs = {
        id: projectId,
        local: { hash: hashA, layout: 2 },
        ledger: { hash: hashA, revision: rev1, seq: 1 },
        remote,
        appLayout: 2,
        deviceId: 'device-local',
      };
      expect(decideDocSync(input)).toEqual({ kind: 'removeLocal' });
    });

    it('clean + lineage broken -> conflict (multi-doc keep both)', () => {
      const remote = makeMeta({
        id: projectId,
        revision: 'rev-3',
        parentRevision: 'rev-other',
        remoteHash: 'hash-bbb',
      });
      const input: DecideSyncInputs = {
        id: projectId,
        local: { hash: hashA, layout: 2 },
        ledger: { hash: hashA, revision: rev1, seq: 1 },
        remote,
        appLayout: 2,
        deviceId: 'device-local',
      };
      expect(decideDocSync(input)).toEqual({ kind: 'conflict', remote });
    });

    it('edit + unchanged -> pushUpdate', () => {
      const remote = makeMeta({
        id: projectId,
        revision: 'rev-1',
        remoteHash: 'hash-aaa',
      });
      const input: DecideSyncInputs = {
        id: projectId,
        local: { hash: hashB, layout: 2 },
        ledger: { hash: hashA, revision: rev1, seq: 1 },
        remote,
        appLayout: 2,
        deviceId: 'device-local',
      };
      expect(decideDocSync(input)).toEqual({ kind: 'pushUpdate', expectedRevision: rev1 });
    });

    it('edit + edit (lineage ok or broken) -> conflict (multi-doc keep both)', () => {
      const remote = makeMeta({
        id: projectId,
        revision: 'rev-2',
        parentRevision: 'rev-1',
        remoteHash: 'hash-bbb',
      });
      const input: DecideSyncInputs = {
        id: projectId,
        local: { hash: BodyHash.of('hash-ccc')!, layout: 2 },
        ledger: { hash: hashA, revision: rev1, seq: 1 },
        remote,
        appLayout: 2,
        deviceId: 'device-local',
      };
      expect(decideDocSync(input)).toEqual({ kind: 'conflict', remote });
    });

    it('edit + delete -> edit wins: pushUpdate (undeletes)', () => {
      const remote = makeMeta({
        id: projectId,
        revision: 'rev-2',
        deleted: true,
      });
      const input: DecideSyncInputs = {
        id: projectId,
        local: { hash: hashB, layout: 2 },
        ledger: { hash: hashA, revision: rev1, seq: 1 },
        remote,
        appLayout: 2,
        deviceId: 'device-local',
      };
      expect(decideDocSync(input)).toEqual({ kind: 'pushUpdate', expectedRevision: rev2 });
    });

    it('delete + unchanged -> pushTombstone', () => {
      const remote = makeMeta({
        id: projectId,
        revision: 'rev-1',
        remoteHash: 'hash-aaa',
      });
      const input: DecideSyncInputs = {
        id: projectId,
        local: null,
        ledger: { hash: hashA, revision: rev1, seq: 1 },
        remote,
        appLayout: 2,
        deviceId: 'device-local',
      };
      expect(decideDocSync(input)).toEqual({ kind: 'pushTombstone', expectedRevision: rev1 });
    });

    it('delete + edit -> edit wins: applyRemote', () => {
      const remote = makeMeta({
        id: projectId,
        revision: 'rev-2',
        parentRevision: 'rev-1',
        remoteHash: 'hash-bbb',
      });
      const input: DecideSyncInputs = {
        id: projectId,
        local: null,
        ledger: { hash: hashA, revision: rev1, seq: 1 },
        remote,
        appLayout: 2,
        deviceId: 'device-local',
      };
      expect(decideDocSync(input)).toEqual({ kind: 'applyRemote', remote });
    });

    it('delete + delete -> dropLedger', () => {
      const remote = makeMeta({
        id: projectId,
        revision: 'rev-2',
        deleted: true,
      });
      const input: DecideSyncInputs = {
        id: projectId,
        local: null,
        ledger: { hash: hashA, revision: rev1, seq: 1 },
        remote,
        appLayout: 2,
        deviceId: 'device-local',
      };
      expect(decideDocSync(input)).toEqual({ kind: 'dropLedger' });
    });

    it('new + absent -> pushCreate', () => {
      const input: DecideSyncInputs = {
        id: projectId,
        local: { hash: hashA, layout: 2 },
        ledger: null,
        remote: null,
        appLayout: 2,
        deviceId: 'device-local',
      };
      expect(decideDocSync(input)).toEqual({ kind: 'pushCreate' });
    });

    it('new + present no ledger (different hashes) -> conflict', () => {
      const remote = makeMeta({
        id: projectId,
        revision: 'rev-1',
        remoteHash: 'hash-bbb',
      });
      const input: DecideSyncInputs = {
        id: projectId,
        local: { hash: hashA, layout: 2 },
        ledger: null,
        remote,
        appLayout: 2,
        deviceId: 'device-local',
      };
      expect(decideDocSync(input)).toEqual({ kind: 'conflict', remote });
    });

    it('absent + new -> applyRemote', () => {
      const remote = makeMeta({
        id: projectId,
        revision: 'rev-1',
        remoteHash: 'hash-bbb',
      });
      const input: DecideSyncInputs = {
        id: projectId,
        local: null,
        ledger: null,
        remote,
        appLayout: 2,
        deviceId: 'device-local',
      };
      expect(decideDocSync(input)).toEqual({ kind: 'applyRemote', remote });
    });

    it('remote absent, ledger row exists, local doc exists (user cleared Drive) -> pushCreate', () => {
      const input: DecideSyncInputs = {
        id: projectId,
        local: { hash: hashA, layout: 2 },
        ledger: { hash: hashA, revision: rev1, seq: 1 },
        remote: null,
        appLayout: 2,
        deviceId: 'device-local',
      };
      expect(decideDocSync(input)).toEqual({ kind: 'pushCreate' });
    });

    it('remote absent, ledger row exists, local deleted -> dropLedger', () => {
      const input: DecideSyncInputs = {
        id: projectId,
        local: null,
        ledger: { hash: hashA, revision: rev1, seq: 1 },
        remote: null,
        appLayout: 2,
        deviceId: 'device-local',
      };
      expect(decideDocSync(input)).toEqual({ kind: 'dropLedger' });
    });
  });

  describe('Singleton docs (settings, favourites) with Lamport clock', () => {
    it('edit + edit: remote higher seq wins -> applyRemote', () => {
      const remote = makeMeta({
        id: settingsId,
        revision: 'rev-2',
        seq: 5,
        writer: 'device-B',
        remoteHash: 'hash-bbb',
      });
      const input: DecideSyncInputs = {
        id: settingsId,
        local: { hash: BodyHash.of('hash-ccc')!, layout: 2 },
        ledger: { hash: hashA, revision: rev1, seq: 1 },
        remote,
        appLayout: 2,
        deviceId: 'device-A',
        prospectiveSeq: 2,
      };
      expect(decideDocSync(input)).toEqual({ kind: 'applyRemote', remote });
    });

    it('edit + edit: local higher seq wins -> pushUpdate', () => {
      const remote = makeMeta({
        id: settingsId,
        revision: 'rev-2',
        seq: 2,
        writer: 'device-B',
        remoteHash: 'hash-bbb',
      });
      const input: DecideSyncInputs = {
        id: settingsId,
        local: { hash: BodyHash.of('hash-ccc')!, layout: 2 },
        ledger: { hash: hashA, revision: rev1, seq: 1 },
        remote,
        appLayout: 2,
        deviceId: 'device-A',
        prospectiveSeq: 5,
      };
      expect(decideDocSync(input)).toEqual({ kind: 'pushUpdate', expectedRevision: rev2 });
    });

    it('edit + edit: equal seq tie broken by higher writer id', () => {
      const remoteB = makeMeta({
        id: settingsId,
        revision: 'rev-2',
        seq: 3,
        writer: 'device-B',
        remoteHash: 'hash-bbb',
      });
      // remote 'device-B' > local 'device-A' -> remote wins
      const inputB: DecideSyncInputs = {
        id: settingsId,
        local: { hash: BodyHash.of('hash-ccc')!, layout: 2 },
        ledger: { hash: hashA, revision: rev1, seq: 1 },
        remote: remoteB,
        appLayout: 2,
        deviceId: 'device-A',
        prospectiveSeq: 3,
      };
      expect(decideDocSync(inputB)).toEqual({ kind: 'applyRemote', remote: remoteB });

      const remoteA = makeMeta({
        id: settingsId,
        revision: 'rev-2',
        seq: 3,
        writer: 'device-A',
        remoteHash: 'hash-bbb',
      });
      // local 'device-B' > remote 'device-A' -> local wins
      const inputA: DecideSyncInputs = {
        id: settingsId,
        local: { hash: BodyHash.of('hash-ccc')!, layout: 2 },
        ledger: { hash: hashA, revision: rev1, seq: 1 },
        remote: remoteA,
        appLayout: 2,
        deviceId: 'device-B',
        prospectiveSeq: 3,
      };
      expect(decideDocSync(inputA)).toEqual({ kind: 'pushUpdate', expectedRevision: rev2 });
    });

    it('compareLamport helper orders correctly', () => {
      expect(compareLamport({ seq: 2, writer: 'a' }, { seq: 1, writer: 'z' })).toBe('remote');
      expect(compareLamport({ seq: 1, writer: 'z' }, { seq: 2, writer: 'a' })).toBe('local');
      expect(compareLamport({ seq: 2, writer: 'b' }, { seq: 2, writer: 'a' })).toBe('remote');
      expect(compareLamport({ seq: 2, writer: 'a' }, { seq: 2, writer: 'b' })).toBe('local');
    });
  });

  describe('Tombstone 90-day purge helper', () => {
    const fixedNow = 1776100000000;
    const ninetyOneDaysAgo = fixedNow - 91 * 24 * 60 * 60 * 1000;
    const tenDaysAgo = fixedNow - 10 * 24 * 60 * 60 * 1000;

    it('returns true when tombstone is older than 90 days with no local reference', () => {
      const meta = makeMeta({
        id: projectId,
        revision: 'rev-2',
        deleted: true,
        tombstonedAt_ms: ninetyOneDaysAgo,
      });
      expect(shouldPurgeTombstone(meta, false, fixedNow)).toBe(true);
    });

    it('returns false when tombstone is newer than 90 days', () => {
      const meta = makeMeta({
        id: projectId,
        revision: 'rev-2',
        deleted: true,
        tombstonedAt_ms: tenDaysAgo,
      });
      expect(shouldPurgeTombstone(meta, false, fixedNow)).toBe(false);
    });

    it('returns false when doc has local reference even if older than 90 days', () => {
      const meta = makeMeta({
        id: projectId,
        revision: 'rev-2',
        deleted: true,
        tombstonedAt_ms: ninetyOneDaysAgo,
      });
      expect(shouldPurgeTombstone(meta, true, fixedNow)).toBe(false);
    });

    it('returns false when doc is not deleted', () => {
      const meta = makeMeta({
        id: projectId,
        revision: 'rev-2',
        deleted: false,
        tombstonedAt_ms: ninetyOneDaysAgo,
      });
      expect(shouldPurgeTombstone(meta, false, fixedNow)).toBe(false);
    });
  });
});
