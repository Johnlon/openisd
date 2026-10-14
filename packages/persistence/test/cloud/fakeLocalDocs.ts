import {
  type DeviceName,
  type DocId,
  type DocKind,
} from '@openisd/design/cloud';
import type {
  LocalDoc,
  LocalDocs,
  LocalRead,
} from '../../src/cloud/localDocs.js';

export class FakeLocalDocs implements LocalDocs {
  readonly kind: DocKind;
  docs: LocalDoc[] = [];
  unreadable = false;
  refusePut = false;
  refuseRemove = false;
  refuseConflict = false;
  migrator: ((doc: LocalDoc) => string | null) | null = null;
  /** A store that re-saves a body in its own form, as the settings store does. */
  normalise: ((body: string) => string) | null = null;

  putCalls: LocalDoc[] = [];
  removeCalls: DocId[] = [];
  conflictCalls: { doc: LocalDoc; from: DeviceName; at_ms: number }[] = [];

  constructor(kind: DocKind, initialDocs: readonly LocalDoc[] = []) {
    this.kind = kind;
    this.docs = [...initialDocs];
  }

  list(): LocalRead {
    if (this.unreadable) {
      return { kind: 'unreadable' };
    }
    return { kind: 'ok', docs: [...this.docs] };
  }

  put(doc: LocalDoc): 'done' | 'refused' {
    if (this.refusePut) {
      return 'refused';
    }
    this.putCalls.push(doc);
    if (this.normalise !== null) {
      doc = { ...doc, body: this.normalise(doc.body) };
    }
    const existingIndex = this.docs.findIndex((d) => this.idsEqual(d.id, doc.id));
    if (existingIndex >= 0) {
      this.docs[existingIndex] = doc;
    } else {
      this.docs.push(doc);
    }
    return 'done';
  }

  remove(id: DocId): 'done' | 'refused' {
    if (this.refuseRemove) {
      return 'refused';
    }
    this.removeCalls.push(id);
    this.docs = this.docs.filter((d) => !this.idsEqual(d.id, id));
    return 'done';
  }

  migrate(doc: LocalDoc): string | null {
    if (this.migrator) {
      return this.migrator(doc);
    }
    return doc.body;
  }

  putConflictCopy(doc: LocalDoc, from: DeviceName, at_ms: number): { readonly id: DocId } | 'refused' {
    if (this.refuseConflict) {
      return 'refused';
    }
    this.conflictCalls.push({ doc, from, at_ms });

    let conflictId: DocId;
    if (doc.id.kind === 'project' || doc.id.kind === 'driver' || doc.id.kind === 'pr') {
      conflictId = { kind: doc.id.kind, uuid: `${doc.id.uuid}-conflict` };
    } else {
      conflictId = doc.id;
    }

    let modifiedBody = doc.body;
    try {
      const parsed: unknown = JSON.parse(doc.body);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        if ('name' in parsed && typeof parsed.name === 'string') {
          modifiedBody = JSON.stringify({ ...parsed, name: `${parsed.name} (conflict)` });
        }
      }
    } catch {
      // keep original
    }

    const copyDoc: LocalDoc = {
      id: conflictId,
      body: modifiedBody,
      layout: doc.layout,
    };
    this.docs.push(copyDoc);
    return { id: conflictId };
  }

  private idsEqual(a: DocId, b: DocId): boolean {
    if (a.kind !== b.kind) return false;
    if ('uuid' in a && 'uuid' in b) {
      return a.uuid === b.uuid;
    }
    return true;
  }
}
