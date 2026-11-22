import {
  ChangeCursor,
  type CloudChange,
  type CloudChanges,
  type CloudDoc,
  type CloudFileList,
  type CloudMeta,
  type CloudResult,
  type DocId,
  FileId,
  RevisionId,
  type WriteMeta,
} from '@openisd/design/cloud';
import type { CloudStore } from '../../src/cloud/cloudStore.js';

export interface StoredCloudFile {
  meta: CloudMeta & { readonly tombstonedAt_ms?: number };
  body: string;
}

export class FakeCloudStore implements CloudStore {
  files = new Map<string, StoredCloudFile>();
  changes: { cursor: number; change: CloudChange }[] = [];
  cursorCounter = 1;
  revCounter = 1;
  fileCounter = 1;

  simulateOffline = false;
  simulateQuota: number | null = null;
  simulateUnauthorised = false;
  simulateMalformed: string | null = null;
  simulateCursorExpired = false;

  purgeCalls: FileId[] = [];
  removeCalls: FileId[] = [];

  seedFile(doc: CloudDoc, tombstonedAt_ms?: number): void {
    const meta: CloudMeta & { readonly tombstonedAt_ms?: number } = {
      ...doc.meta,
      ...(tombstonedAt_ms !== undefined ? { tombstonedAt_ms } : {}),
    };
    this.files.set(doc.meta.fileId.toString(), {
      meta,
      body: doc.body,
    });
    this.changes.push({
      cursor: this.cursorCounter++,
      change: meta,
    });
  }

  simulateConcurrentUpdate(fileId: FileId, newBody: string, newMeta: Partial<WriteMeta>): CloudMeta {
    const existing = this.files.get(fileId.toString());
    if (!existing) {
      throw new Error(`File ${fileId.toString()} not found in fake store`);
    }
    const newRev = RevisionId.of(`rev-${++this.revCounter}`);
    if (!newRev) throw new Error('Could not create revision');
    const updatedMeta: CloudMeta = {
      id: existing.meta.id,
      fileId,
      revision: newRev,
      parentRevision: existing.meta.revision,
      layout: newMeta.layout ?? existing.meta.layout,
      seq: newMeta.seq ?? existing.meta.seq + 1,
      writer: newMeta.writer ?? 'concurrent-writer',
      device: newMeta.device ?? '',
      deleted: false,
      remoteHash: newMeta.hash ?? null,
    };
    this.files.set(fileId.toString(), {
      meta: updatedMeta,
      body: newBody,
    });
    this.changes.push({
      cursor: this.cursorCounter++,
      change: updatedMeta,
    });
    return updatedMeta;
  }

  async listAll(): Promise<CloudResult<CloudFileList>> {
    const err = this.checkErrors();
    if (err) return err;

    const docs: CloudMeta[] = [];
    for (const file of this.files.values()) {
      docs.push(file.meta);
    }
    const next = ChangeCursor.of(`cursor-${this.cursorCounter}`);
    return {
      kind: 'ok',
      value: {
        docs,
        next,
        skipped: 0,
      },
    };
  }

  async changesSince(cursor: ChangeCursor): Promise<CloudResult<CloudChanges>> {
    const err = this.checkErrors();
    if (err) return err;

    if (this.simulateCursorExpired) {
      this.simulateCursorExpired = false;
      return { kind: 'cursorExpired' };
    }

    const match = /^cursor-(\d+)$/.exec(cursor.toString());
    const cursorNum = match ? parseInt(match[1], 10) : 0;

    const changed: CloudChange[] = [];
    for (const entry of this.changes) {
      if (entry.cursor >= cursorNum) {
        changed.push(entry.change);
      }
    }

    const newStart = ChangeCursor.of(`cursor-${this.cursorCounter}`);
    if (!newStart) throw new Error('Could not create cursor');
    return {
      kind: 'ok',
      value: {
        kind: 'done',
        changed,
        newStart,
        skipped: 0,
      },
    };
  }

  async startCursor(): Promise<CloudResult<ChangeCursor>> {
    const err = this.checkErrors();
    if (err) return err;
    const c = ChangeCursor.of(`cursor-${this.cursorCounter}`);
    if (!c) throw new Error('Could not create cursor');
    return {
      kind: 'ok',
      value: c,
    };
  }

  async read(fileId: FileId): Promise<CloudResult<CloudDoc>> {
    const err = this.checkErrors();
    if (err) return err;

    const file = this.files.get(fileId.toString());
    if (!file) {
      return { kind: 'failed', status: 404, reason: 'File not found' };
    }
    return {
      kind: 'ok',
      value: {
        meta: file.meta,
        body: file.body,
      },
    };
  }

  async create(id: DocId, body: string, meta: WriteMeta): Promise<CloudResult<CloudMeta>> {
    const err = this.checkErrors();
    if (err) return err;

    const fileId = FileId.of(`file-${++this.fileCounter}`);
    const revision = RevisionId.of(`rev-${++this.revCounter}`);
    if (!fileId || !revision) throw new Error('Could not create fileId or revision');
    const cloudMeta: CloudMeta = {
      id,
      fileId,
      revision,
      parentRevision: meta.parentRevision,
      layout: meta.layout,
      seq: meta.seq,
      writer: meta.writer,
      device: meta.device,
      deleted: false,
      remoteHash: meta.hash,
    };
    this.files.set(fileId.toString(), {
      meta: cloudMeta,
      body,
    });
    this.changes.push({
      cursor: this.cursorCounter++,
      change: cloudMeta,
    });
    return { kind: 'ok', value: cloudMeta };
  }

  async update(
    fileId: FileId,
    expectedRevision: RevisionId,
    body: string,
    meta: WriteMeta
  ): Promise<CloudResult<CloudMeta>> {
    const err = this.checkErrors();
    if (err) return err;

    const existing = this.files.get(fileId.toString());
    if (!existing) {
      return { kind: 'failed', status: 404, reason: 'File not found' };
    }

    if (existing.meta.revision.toString() !== expectedRevision.toString()) {
      return { kind: 'moved', head: existing.meta };
    }

    const revision = RevisionId.of(`rev-${++this.revCounter}`);
    if (!revision) throw new Error('Could not create revision');
    const cloudMeta: CloudMeta = {
      id: existing.meta.id,
      fileId,
      revision,
      parentRevision: expectedRevision,
      layout: meta.layout,
      seq: meta.seq,
      writer: meta.writer,
      device: meta.device,
      deleted: false,
      remoteHash: meta.hash,
    };
    this.files.set(fileId.toString(), {
      meta: cloudMeta,
      body,
    });
    this.changes.push({
      cursor: this.cursorCounter++,
      change: cloudMeta,
    });
    return { kind: 'ok', value: cloudMeta };
  }

  async tombstone(
    fileId: FileId,
    expectedRevision: RevisionId,
    meta: WriteMeta
  ): Promise<CloudResult<CloudMeta>> {
    const err = this.checkErrors();
    if (err) return err;

    const existing = this.files.get(fileId.toString());
    if (!existing) {
      return { kind: 'failed', status: 404, reason: 'File not found' };
    }

    if (existing.meta.revision.toString() !== expectedRevision.toString()) {
      return { kind: 'moved', head: existing.meta };
    }

    const revision = RevisionId.of(`rev-${++this.revCounter}`);
    if (!revision) throw new Error('Could not create revision');
    const cloudMeta: CloudMeta & { readonly tombstonedAt_ms?: number } = {
      id: existing.meta.id,
      fileId,
      revision,
      parentRevision: expectedRevision,
      layout: meta.layout,
      seq: meta.seq,
      writer: meta.writer,
      device: meta.device,
      deleted: true,
      remoteHash: meta.hash,
      tombstonedAt_ms: Date.now(),
    };
    this.files.set(fileId.toString(), {
      meta: cloudMeta,
      body: existing.body,
    });
    this.changes.push({
      cursor: this.cursorCounter++,
      change: cloudMeta,
    });
    return { kind: 'ok', value: cloudMeta };
  }

  async removeFile(fileId: FileId): Promise<CloudResult<void>> {
    const err = this.checkErrors();
    if (err) return err;
    this.removeCalls.push(fileId);
    if (!this.files.delete(fileId.toString())) {
      return { kind: 'failed', status: 404, reason: 'File not found' };
    }
    this.changes.push({ cursor: this.cursorCounter++, change: { fileId, gone: true } });
    return { kind: 'ok', value: undefined };
  }

  async purge(fileId: FileId): Promise<CloudResult<void>> {
    const err = this.checkErrors();
    if (err) return err;

    this.purgeCalls.push(fileId);
    const existing = this.files.get(fileId.toString());
    if (!existing) {
      return { kind: 'failed', status: 404, reason: 'File not found' };
    }
    if (!existing.meta.deleted) {
      return { kind: 'failed', status: 400, reason: 'File is not tombstoned' };
    }
    this.files.delete(fileId.toString());
    this.changes.push({
      cursor: this.cursorCounter++,
      change: { fileId, gone: true },
    });
    return { kind: 'ok', value: undefined };
  }

  private checkErrors(): CloudResult<never> | null {
    if (this.simulateOffline) {
      return { kind: 'offline' };
    }
    if (this.simulateQuota !== null) {
      return { kind: 'quota', retryAfter_ms: this.simulateQuota };
    }
    if (this.simulateUnauthorised) {
      return { kind: 'unauthorised' };
    }
    if (this.simulateMalformed !== null) {
      return { kind: 'malformed', reason: this.simulateMalformed };
    }
    return null;
  }
}
