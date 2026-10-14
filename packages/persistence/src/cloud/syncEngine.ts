import {
  BodyHash,
  type ChangeCursor,
  type CloudMeta,
  type CloudResult,
  type DeviceName,
  type DocId,
  type DocKind,
  DriverId,
  type FileId,
  PrId,
  ProjectId,
  type RevisionId,
  type WriteMeta,
  bodyHashOf,
  type CloudError,
  cloudFaultOf,
  conflictProjectName,
  decideDocSync,
  shouldPurgeTombstone,
} from '@openisd/design/cloud';
import type { CloudStore } from './cloudStore.js';
import type { LocalDoc, LocalDocs } from './localDocs.js';
import type { LedgerRow, SyncLedger } from './syncLedger.js';
import type { RunOutcome, SyncEngine, SyncProgress } from './syncRun.js';
import type { StorageBackup } from '../repos/storageBackup.js';

export interface SyncEngineDeps {
  readonly cloud: CloudStore;
  readonly local: readonly LocalDocs[];
  readonly ledger: SyncLedger;
  readonly backup: StorageBackup;
  readonly layout: number;
  readonly now: () => number;
  /** Names this device in conflict copies. */
  readonly deviceName: DeviceName;
  /** Told when a run starts and after each push lands. */
  readonly progress: SyncProgress;
}

/** New items upload this many at a time; each is one request that names nothing another uses. */
const CREATE_CONCURRENCY = 4;

/** The hash of the body a store holds for `id` after a write: a store may re-save a body in its
 *  own form, and the ledger must record what is there, or the doc counts as changed forever. */
function storedHashOf(bucket: LocalDocs, id: DocId): BodyHash | null {
  const read = bucket.list();
  if (read.kind !== 'ok') return null;
  const key = docIdKey(id);
  const doc = read.docs.find(d => docIdKey(d.id) === key);
  return doc === undefined ? null : bodyHashOf(doc.body);
}

function docIdKey(id: DocId): string {
  switch (id.kind) {
    case 'project':
    case 'driver':
    case 'pr':
      return `${id.kind}:${id.uuid}`;
    case 'settings':
      return 'settings';
    case 'favourites':
      return 'favourites';
  }
}

function toConflictCopyId(id: DocId): ProjectId | DriverId | PrId | null {
  switch (id.kind) {
    case 'project':
      return ProjectId.of(id.uuid);
    case 'driver':
      return DriverId.of(id.uuid);
    case 'pr':
      return PrId.of(id.uuid);
    case 'settings':
    case 'favourites':
      return null;
  }
}

function extractDocName(doc: LocalDoc): string {
  try {
    const parsed: unknown = JSON.parse(doc.body);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      if ('name' in parsed && typeof parsed.name === 'string') return parsed.name;
      if ('project' in parsed) {
        const pr = parsed.project;
        if (typeof pr === 'object' && pr !== null && 'name' in pr && typeof pr.name === 'string') {
          return pr.name;
        }
      }
      if ('saved' in parsed) {
        const s = parsed.saved;
        if (typeof s === 'object' && s !== null && 'meta' in s) {
          const m = s.meta;
          if (typeof m === 'object' && m !== null && 'name' in m && typeof m.name === 'string') {
            return m.name;
          }
        }
      }
      if ('model' in parsed && typeof parsed.model === 'string') return parsed.model;
    }
  } catch {
    // ignore
  }
  if ('uuid' in doc.id) return doc.id.uuid;
  return doc.id.kind;
}

interface PlannedLocalWrite {
  readonly kind: 'applyRemote';
  readonly bucket: LocalDocs;
  readonly doc: LocalDoc;
  readonly row: LedgerRow;
  readonly replacesExisting: boolean;
}

interface PlannedLocalRemove {
  readonly kind: 'removeLocal';
  readonly bucket: LocalDocs;
  readonly id: DocId;
}

interface PlannedConflict {
  readonly kind: 'conflict';
  readonly bucket: LocalDocs;
  readonly localDoc: LocalDoc;
  readonly remoteDoc: LocalDoc;
  readonly remoteMeta: CloudMeta;
  readonly remoteHash: BodyHash;
  readonly replacesExisting: boolean;
}

interface PushedDoc {
  readonly docId: DocId;
  readonly bucket: LocalDocs;
  readonly body: string;
  readonly hash: BodyHash;
}

type PlannedPush =
  | PushedDoc & { readonly kind: 'pushCreate' }
  | PushedDoc & { readonly kind: 'pushUpdate' | 'pushTombstone'; readonly fileId: FileId; readonly expectedRevision: RevisionId };

export function createSyncEngine(deps: SyncEngineDeps): SyncEngine {
  function getBucket(kind: DocKind): LocalDocs | null {
    for (const b of deps.local) {
      if (b.kind === kind) return b;
    }
    return null;
  }

  function countPendingLocal(): number {
    let pending = 0;
    const seenLocalKeys = new Set<string>();

    for (const bucket of deps.local) {
      const read = bucket.list();
      if (read.kind === 'unreadable') continue;

      for (const doc of read.docs) {
        const key = docIdKey(doc.id);
        seenLocalKeys.add(key);
        const row = deps.ledger.row(doc.id);
        if (row === null) {
          pending++;
        } else {
          const hash = bodyHashOf(doc.body);
          if (hash === null || hash.toString() !== row.hash.toString()) {
            pending++;
          }
        }
      }
    }

    for (const row of deps.ledger.rows()) {
      const key = docIdKey(row.id);
      if (!seenLocalKeys.has(key)) {
        pending++;
      }
    }

    return pending;
  }

  async function run(): Promise<RunOutcome> {
    deps.progress.started();
    let removedDuplicates = 0;

    /** Of several Drive files for one doc, keeps the newest (highest seq) and deletes the rest. */
    async function keepNewestCopies(docs: readonly CloudMeta[]): Promise<CloudResult<readonly CloudMeta[]>> {
      const byDoc = new Map<string, CloudMeta[]>();
      for (const doc of docs) {
        const key = docIdKey(doc.id);
        byDoc.set(key, [...(byDoc.get(key) ?? []), doc]);
      }
      const kept: CloudMeta[] = [];
      for (const copies of byDoc.values()) {
        const [newest, ...older] = [...copies].sort((a, b) => b.seq - a.seq || b.revision.toString().localeCompare(a.revision.toString()));
        if (newest === undefined) continue;
        kept.push(newest);
        for (const copy of older) {
          const res = await deps.cloud.removeFile(copy.fileId);
          if (res.kind !== 'ok') return res;
          removedDuplicates++;
        }
      }
      return { kind: 'ok', value: kept };
    }
    // 1. Check bucket readability
    for (const bucket of deps.local) {
      const read = bucket.list();
      if (read.kind === 'unreadable') {
        return {
          kind: 'refused',
          reason: 'bucketUnreadable',
          pendingLocal: countPendingLocal(),
        };
      }
    }

    // 2. Pull remote changes
    const cursor = deps.ledger.cursor();
    const remoteDocs = new Map<string, CloudMeta>();
    let newCursor: ChangeCursor | null = null;
    // True when remoteDocs holds only what changed since the cursor, not every Drive file.
    let changesOnly = false;

    if (cursor === null) {
      const listRes = await deps.cloud.listAll();
      if (listRes.kind !== 'ok') {
        return mapCloudError(listRes, 0);
      }
      const kept = await keepNewestCopies(listRes.value.docs);
      if (kept.kind !== 'ok') {
        return mapCloudError(kept, 0);
      }
      for (const doc of kept.value) {
        remoteDocs.set(docIdKey(doc.id), doc);
      }
      if (listRes.value.next !== null) {
        newCursor = listRes.value.next;
      } else {
        const startRes = await deps.cloud.startCursor();
        if (startRes.kind === 'ok') {
          newCursor = startRes.value;
        }
      }
    } else {
      const changesRes = await deps.cloud.changesSince(cursor);
      if (changesRes.kind === 'cursorExpired') {
        const listRes = await deps.cloud.listAll();
        if (listRes.kind !== 'ok') {
          return mapCloudError(listRes, 0);
        }
        const kept = await keepNewestCopies(listRes.value.docs);
        if (kept.kind !== 'ok') {
          return mapCloudError(kept, 0);
        }
        for (const doc of kept.value) {
          remoteDocs.set(docIdKey(doc.id), doc);
        }
        if (listRes.value.next !== null) {
          newCursor = listRes.value.next;
        } else {
          const startRes = await deps.cloud.startCursor();
          if (startRes.kind === 'ok') {
            newCursor = startRes.value;
          }
        }
      } else if (changesRes.kind !== 'ok') {
        return mapCloudError(changesRes, 0);
      } else {
        newCursor = changesRes.value.kind === 'done' ? changesRes.value.newStart : changesRes.value.next;
        changesOnly = true;
        for (const ch of changesRes.value.changed) {
          if ('id' in ch) {
            remoteDocs.set(docIdKey(ch.id), ch);
          }
        }
      }
    }

    // Lamport observe all seen remote seqs
    for (const meta of remoteDocs.values()) {
      deps.ledger.observe(meta.seq);
    }

    // Index local docs
    const localDocs = new Map<string, LocalDoc>();
    for (const bucket of deps.local) {
      const read = bucket.list();
      if (read.kind === 'ok') {
        for (const doc of read.docs) {
          localDocs.set(docIdKey(doc.id), doc);
        }
      }
    }

    // Index ledger rows
    const ledgerRows = new Map<string, LedgerRow>();
    for (const row of deps.ledger.rows()) {
      ledgerRows.set(docIdKey(row.id), row);
    }

    // A changes-only pull omits every Drive file that did not change since the cursor. Such a file
    // is, for this device, exactly what its ledger row says: unchanged, at that revision and hash.
    const unchangedSinceLedger = new Set<string>();
    if (changesOnly) {
      for (const [key, row] of ledgerRows) {
        if (remoteDocs.has(key)) continue;
        unchangedSinceLedger.add(key);
        remoteDocs.set(key, {
          id: row.id,
          fileId: row.fileId,
          revision: row.revision,
          parentRevision: null,
          layout: deps.layout,
          seq: row.seq,
          writer: '',
          deleted: false,
          remoteHash: row.hash,
        });
      }
    }

    // Collect all doc keys
    const allKeys = new Set<string>([
      ...localDocs.keys(),
      ...ledgerRows.keys(),
      ...remoteDocs.keys(),
    ]);

    let pulledCount = 0;
    let pushedCount = 0;
    let heldCount = 0;

    const plannedLocalWrites: PlannedLocalWrite[] = [];
    const plannedLocalRemoves: PlannedLocalRemove[] = [];
    const plannedConflicts: PlannedConflict[] = [];
    const plannedPushes: PlannedPush[] = [];
    const heldDocKeys = new Set<string>();

    for (const key of allKeys) {
      const localDoc = localDocs.get(key) ?? null;
      const ledgerRow = ledgerRows.get(key) ?? null;
      const remoteMeta = remoteDocs.get(key) ?? null;

      let id: DocId;
      if (localDoc !== null) id = localDoc.id;
      else if (ledgerRow !== null) id = ledgerRow.id;
      else if (remoteMeta !== null) id = remoteMeta.id;
      else continue;

      const bucket = getBucket(id.kind);
      if (bucket === null) continue;

      const localHash = localDoc !== null ? bodyHashOf(localDoc.body) : null;

      // Handle held docs (remote layout > app layout)
      if (remoteMeta !== null && remoteMeta.layout > deps.layout) {
        heldCount++;
        heldDocKeys.add(key);
        continue;
      }

      // Check remote content if needed
      let remoteBody: string | null = null;
      let remoteHash: BodyHash | null = remoteMeta?.remoteHash ?? null;

      if (remoteMeta !== null && !remoteMeta.deleted) {
        const canSkipRead = unchangedSinceLedger.has(key) || (
          localDoc !== null &&
          localHash !== null &&
          remoteMeta.remoteHash !== null &&
          remoteMeta.remoteHash.toString() === localHash.toString());

        if (!canSkipRead) {
          const readRes = await deps.cloud.read(remoteMeta.fileId);
          if (readRes.kind !== 'ok') {
            return mapCloudError(readRes, pushedCount);
          }
          let fetchedBody = readRes.value.body;
          if (remoteMeta.layout < deps.layout) {
            const migrated = bucket.migrate({
              id,
              body: fetchedBody,
              layout: remoteMeta.layout,
            });
            if (migrated !== null) {
              fetchedBody = migrated;
            }
          }
          remoteBody = fetchedBody;
          if (remoteHash === null) {
            remoteHash = bodyHashOf(fetchedBody);
          }
        } else {
          // An unchanged file's body is never needed: the rules can only push or do nothing.
          remoteBody = localDoc?.body ?? null;
        }
      }

      // Pure rule decision
      const action = decideDocSync({
        id,
        local: localDoc !== null && localHash !== null ? { hash: localHash, layout: localDoc.layout } : null,
        ledger: ledgerRow !== null ? { hash: ledgerRow.hash, revision: ledgerRow.revision, seq: ledgerRow.seq } : null,
        remote: remoteMeta,
        appLayout: deps.layout,
        deviceId: deps.ledger.deviceId().text,
        prospectiveSeq: ledgerRow !== null ? ledgerRow.seq + 1 : 1,
      });

      switch (action.kind) {
        case 'nothing':
          break;

        case 'held':
          heldCount++;
          heldDocKeys.add(key);
          break;

        case 'adopt': {
          const adoptHash = localHash ?? action.remote.remoteHash ?? remoteHash;
          if (adoptHash !== null) {
            deps.ledger.set({
              id,
              fileId: action.remote.fileId,
              revision: action.remote.revision,
              hash: adoptHash,
              seq: action.remote.seq,
            });
            if (ledgerRow === null || ledgerRow.revision.toString() !== action.remote.revision.toString()) {
              pulledCount++;
            }
          }
          break;
        }

        case 'applyRemote':
          if (remoteBody !== null && remoteHash !== null) {
            plannedLocalWrites.push({
              kind: 'applyRemote',
              bucket,
              doc: { id, body: remoteBody, layout: deps.layout },
              row: {
                id,
                fileId: action.remote.fileId,
                revision: action.remote.revision,
                hash: remoteHash,
                seq: action.remote.seq,
              },
              replacesExisting: localDoc !== null,
            });
          }
          break;

        case 'removeLocal':
          plannedLocalRemoves.push({
            kind: 'removeLocal',
            bucket,
            id,
          });
          break;

        case 'conflict':
          if (localDoc !== null && remoteBody !== null && remoteHash !== null) {
            plannedConflicts.push({
              kind: 'conflict',
              bucket,
              localDoc,
              remoteDoc: { id, body: remoteBody, layout: deps.layout },
              remoteMeta: action.remote,
              remoteHash,
              replacesExisting: true,
            });
          }
          break;

        case 'dropLedger':
          deps.ledger.drop(id);
          break;

        case 'pushCreate':
          if (localDoc !== null && localHash !== null) {
            plannedPushes.push({
              kind: 'pushCreate',
              docId: id,
              bucket,
              body: localDoc.body,
              hash: localHash,
            });
          }
          break;

        case 'pushUpdate':
          if (localDoc !== null && localHash !== null) {
            // No known Drive file for this doc: it is pushed as new, never skipped.
            const fileId = ledgerRow?.fileId ?? remoteMeta?.fileId ?? null;
            const pushed = { docId: id, bucket, body: localDoc.body, hash: localHash };
            plannedPushes.push(fileId === null
              ? { ...pushed, kind: 'pushCreate' }
              : { ...pushed, kind: 'pushUpdate', fileId, expectedRevision: action.expectedRevision });
          }
          break;

        case 'pushTombstone':
          if (ledgerRow !== null) {
            plannedPushes.push({
              kind: 'pushTombstone',
              docId: id,
              bucket,
              body: '',
              hash: ledgerRow.hash,
              fileId: ledgerRow.fileId,
              expectedRevision: action.expectedRevision,
            });
          }
          break;
      }
    }

    // 3. Local writes & backup guard
    const hasDestructive =
      plannedLocalRemoves.length > 0 ||
      plannedLocalWrites.some(w => w.replacesExisting) ||
      plannedConflicts.some(c => c.replacesExisting);

    let backupRan = false;
    let backupRefused = false;

    if (hasDestructive) {
      const guardRes = deps.backup.guard(() => {
        applyLocalWrites();
      });
      if (guardRes.kind === 'refused') {
        backupRefused = true;
      } else {
        backupRan = true;
      }
    } else {
      applyLocalWrites();
    }

    function applyLocalWrites(): void {
      for (const w of plannedLocalWrites) {
        w.bucket.put(w.doc);
        deps.ledger.set({ ...w.row, hash: storedHashOf(w.bucket, w.doc.id) ?? w.row.hash });
        pulledCount++;
      }
      for (const r of plannedLocalRemoves) {
        r.bucket.remove(r.id);
        deps.ledger.drop(r.id);
        pulledCount++;
      }
      for (const c of plannedConflicts) {
        // Remote wins the original id
        c.bucket.put(c.remoteDoc);
        deps.ledger.set({
          id: c.remoteDoc.id,
          fileId: c.remoteMeta.fileId,
          revision: c.remoteMeta.revision,
          hash: storedHashOf(c.bucket, c.remoteDoc.id) ?? c.remoteHash,
          seq: c.remoteMeta.seq,
        });
        pulledCount++;

        // Local body becomes a conflict copy
        const copyRes = c.bucket.putConflictCopy(c.localDoc, deps.deviceName, deps.now());
        if (copyRes !== 'refused') {
          const conflictId = toConflictCopyId(copyRes.id);
          if (conflictId !== null) {
            const conflictName = conflictProjectName(extractDocName(c.localDoc), deps.deviceName, deps.now());
            deps.ledger.addConflict({
              id: conflictId,
              name: conflictName,
              from: deps.ledger.deviceId(),
              at_ms: deps.now(),
            });
          }
          const copyHash = bodyHashOf(c.localDoc.body);
          if (copyHash !== null) {
            plannedPushes.push({
              kind: 'pushCreate',
              docId: copyRes.id,
              bucket: c.bucket,
              body: c.localDoc.body,
              hash: copyHash,
            });
          }
        }
      }
    }

    // 4. Push local changes: new items CREATE_CONCURRENCY at a time, then changes and deletions
    // one at a time (each reads the Drive head before it writes).
    const creates = plannedPushes.filter(
      (push): push is PlannedPush & { readonly kind: 'pushCreate' } =>
        push.kind === 'pushCreate' && !heldDocKeys.has(docIdKey(push.docId)));
    let nextCreate = 0;
    let createFailure: CloudError | null = null;
    async function createWorker(): Promise<void> {
      while (createFailure === null && nextCreate < creates.length) {
        const push = creates[nextCreate++];
        if (push === undefined) return;
        const meta: WriteMeta = {
          parentRevision: null,
          layout: deps.layout,
          seq: deps.ledger.nextSeq(),
          writer: deps.ledger.deviceId().text,
          hash: push.hash,
        };
        const res = await deps.cloud.create(push.docId, push.body, meta);
        if (res.kind !== 'ok') {
          createFailure ??= res;
          return;
        }
        deps.ledger.set({
          id: push.docId,
          fileId: res.value.fileId,
          revision: res.value.revision,
          hash: push.hash,
          seq: res.value.seq,
        });
        pushedCount++;
        deps.progress.pushed(pushedCount);
      }
    }
    await Promise.all(Array.from({ length: Math.min(CREATE_CONCURRENCY, creates.length) }, createWorker));
    if (createFailure !== null) {
      return mapCloudError(createFailure, pushedCount);
    }

    for (const push of plannedPushes) {
      if (heldDocKeys.has(docIdKey(push.docId))) {
        continue;
      }

      if (push.kind === 'pushCreate') {
        continue;
      } else if (push.kind === 'pushUpdate') {
        const meta: WriteMeta = {
          parentRevision: push.expectedRevision,
          layout: deps.layout,
          seq: deps.ledger.nextSeq(),
          writer: deps.ledger.deviceId().text,
          hash: push.hash,
        };
        const res = await deps.cloud.update(push.fileId, push.expectedRevision, push.body, meta);
        if (res.kind === 'moved') {
          // OVERWRITE RACE
          deps.ledger.observe(res.head.seq);
          if (res.head.layout > deps.layout) {
            heldCount++;
            heldDocKeys.add(docIdKey(push.docId));
            continue;
          }

          if (res.head.remoteHash !== null && res.head.remoteHash.toString() === push.hash.toString()) {
            // Adopt
            deps.ledger.set({
              id: push.docId,
              fileId: res.head.fileId,
              revision: res.head.revision,
              hash: push.hash,
              seq: res.head.seq,
            });
          } else {
            const headRead = await deps.cloud.read(res.head.fileId);
            if (headRead.kind !== 'ok') {
              return mapCloudError(headRead, pushedCount);
            }
            const headHash = headRead.value.meta.remoteHash ?? bodyHashOf(headRead.value.body);

            if (push.docId.kind === 'settings' || push.docId.kind === 'favourites') {
              // Singleton: higher seq wins
              if (res.head.seq > meta.seq || (res.head.seq === meta.seq && res.head.writer > meta.writer)) {
                push.bucket.put({ id: push.docId, body: headRead.value.body, layout: deps.layout });
                deps.ledger.set({
                  id: push.docId,
                  fileId: res.head.fileId,
                  revision: res.head.revision,
                  hash: headHash ?? push.hash,
                  seq: res.head.seq,
                });
                pulledCount++;
              } else {
                // Retry push with expected revision = head
                const retryRes = await deps.cloud.update(push.fileId, res.head.revision, push.body, {
                  ...meta,
                  parentRevision: res.head.revision,
                });
                if (retryRes.kind === 'ok') {
                  deps.ledger.set({
                    id: push.docId,
                    fileId: retryRes.value.fileId,
                    revision: retryRes.value.revision,
                    hash: push.hash,
                    seq: retryRes.value.seq,
                  });
                  pushedCount++;
                  deps.progress.pushed(pushedCount);
                }
              }
            } else {
              // Multi-doc: keep both!
              const doConflict = () => {
                push.bucket.put({ id: push.docId, body: headRead.value.body, layout: deps.layout });
                deps.ledger.set({
                  id: push.docId,
                  fileId: res.head.fileId,
                  revision: res.head.revision,
                  hash: headHash ?? push.hash,
                  seq: res.head.seq,
                });
                pulledCount++;

                const copyRes = push.bucket.putConflictCopy(
                  { id: push.docId, body: push.body, layout: deps.layout },
                  deps.deviceName,
                  deps.now()
                );
                return copyRes;
              };

              let copyRes: { readonly id: DocId } | 'refused';
              if (!backupRan) {
                const g = deps.backup.guard(() => doConflict());
                if (g.kind === 'ran') {
                  copyRes = g.value;
                  backupRan = true;
                } else {
                  copyRes = 'refused';
                }
              } else {
                copyRes = doConflict();
              }

              if (copyRes !== 'refused') {
                const conflictId = toConflictCopyId(copyRes.id);
                if (conflictId !== null) {
                  deps.ledger.addConflict({
                    id: conflictId,
                    name: conflictProjectName(extractDocName({ id: push.docId, body: push.body, layout: deps.layout }), deps.deviceName, deps.now()),
                    from: deps.ledger.deviceId(),
                    at_ms: deps.now(),
                  });
                }
                const copyMeta: WriteMeta = {
                  parentRevision: null,
                  layout: deps.layout,
                  seq: deps.ledger.nextSeq(),
                  writer: deps.ledger.deviceId().text,
                  hash: push.hash,
                };
                const createRes = await deps.cloud.create(copyRes.id, push.body, copyMeta);
                if (createRes.kind === 'ok') {
                  pushedCount++;
                  deps.progress.pushed(pushedCount);
                }
              }
            }
          }
        } else if (res.kind !== 'ok') {
          return mapCloudError(res, pushedCount);
        } else {
          deps.ledger.set({
            id: push.docId,
            fileId: res.value.fileId,
            revision: res.value.revision,
            hash: push.hash,
            seq: res.value.seq,
          });
          pushedCount++;
          deps.progress.pushed(pushedCount);
        }
      } else {
        const meta: WriteMeta = {
          parentRevision: push.expectedRevision,
          layout: deps.layout,
          seq: deps.ledger.nextSeq(),
          writer: deps.ledger.deviceId().text,
          hash: push.hash,
        };
        const res = await deps.cloud.tombstone(push.fileId, push.expectedRevision, meta);
        if (res.kind === 'moved') {
          deps.ledger.observe(res.head.seq);
          if (res.head.deleted) {
            deps.ledger.drop(push.docId);
          }
        } else if (res.kind !== 'ok') {
          return mapCloudError(res, pushedCount);
        } else {
          deps.ledger.drop(push.docId);
          pushedCount++;
          deps.progress.pushed(pushedCount);
        }
      }
    }

    // 5. Purge tombstones older than 90 days
    for (const meta of remoteDocs.values()) {
      if (meta.deleted) {
        const key = docIdKey(meta.id);
        const hasLocalRef = localDocs.has(key) || deps.ledger.row(meta.id) !== null;
        if (shouldPurgeTombstone(meta, hasLocalRef, deps.now())) {
          await deps.cloud.purge(meta.fileId);
        }
      }
    }

    // 6. Update cursor
    if (newCursor !== null) {
      deps.ledger.setCursor(newCursor);
    }

    if (backupRefused) {
      return {
        kind: 'refused',
        reason: 'noRoom',
        pendingLocal: countPendingLocal(),
      };
    }

    return {
      kind: 'synced',
      pulled: pulledCount,
      pushed: pushedCount,
      conflicts: deps.ledger.conflicts(),
      held: heldCount,
      left: countPendingLocal(),
      removedDuplicates,
    };
  }

  function mapCloudError(err: CloudError, pushedSoFar: number): RunOutcome {
    switch (err.kind) {
      case 'offline':
      case 'quota':
        return { kind: 'stopped', reason: err.kind, pushedSoFar, pendingLocal: countPendingLocal() };
      case 'unauthorised':
        return { kind: 'reconnect', pendingLocal: countPendingLocal() };
      case 'faulted':
        return { kind: 'failed', fault: err.fault, pendingLocal: countPendingLocal() };
      case 'malformed':
        return { kind: 'failed', fault: cloudFaultOf('request', 0, err.reason, ''), pendingLocal: countPendingLocal() };
      case 'failed':
        return { kind: 'failed', fault: cloudFaultOf('request', err.status, err.reason, ''), pendingLocal: countPendingLocal() };
      case 'moved':
      case 'cursorExpired':
        return { kind: 'failed', fault: cloudFaultOf('request', 0, err.kind, ''), pendingLocal: countPendingLocal() };
    }
  }

  return {
    run,
    pendingLocal: countPendingLocal,
  };
}
