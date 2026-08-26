// Everything in this directory NEEDS A BROWSER. `domain/` is pure and runs anywhere — that is
// why it declares `crypto.randomUUID` by hand rather than pulling in DOM types — so any code
// touching a platform API lives out here, where the name says so. A Node or CLI store would sit
// beside this as `node/`, not inside `domain/`.

import type { ProjectMeta, RecordStore, RecordStoreFactory } from '../domain/index.js';

// Declared narrowly rather than by adding "DOM" to the package's `lib`, which would put the whole
// browser API within reach of `domain/` too. Only what this file actually uses.
declare const indexedDB: {
  open(name: string, version?: number): IDBOpenRequestLike;
};
interface IDBOpenRequestLike {
  result: IDBDatabaseLike;
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
  onupgradeneeded: (() => void) | null;
}
interface IDBDatabaseLike {
  createObjectStore(name: string, opts: { keyPath: string }): IDBObjectStoreLike;
  objectStoreNames: { contains(name: string): boolean };
}
interface IDBObjectStoreLike {
  createIndex(name: string, keyPath: string): void;
}

/** The one object store, and the indexes that make listing cheap. */
const STORE = 'projects';

/**
 * An IndexedDB-backed `RecordStore`, as a GENERIC factory.
 *
 * Generic in `R` and never inspecting it: values go in and come out whole. That is what lets the
 * domain keep its record type private — this file cannot name it, and being parametric it cannot
 * depend on what it turns out to be. The domain instantiates the factory at its own private type
 * inside `useProjectStore()`.
 *
 * Indexing does NOT need the type. IndexedDB declares indexes with runtime keyPath strings, so
 * `'meta.name'` and `'modified'` index a value this code has no compile-time knowledge of — the
 * bytes on disk are a real self-describing JSON document, only the TYPE is opaque.
 *
 * The stored envelope is `{ id, record, meta, modified }`: the record whole and untouched, the
 * label beside it because the store may not read inside, and the timestamp stamped here because
 * "when it was last written" is a fact about the act of writing and this is what performs it.
 */
export function indexedDbStore(dbName: string, now: () => string): RecordStoreFactory {
  // The schema this file owns. `id` is the key; the two indexes answer `list()` without opening
  // a single record.
  function upgrade(db: IDBDatabaseLike): void {
    if (db.objectStoreNames.contains(STORE)) return;
    const os = db.createObjectStore(STORE, { keyPath: 'id' });
    os.createIndex('by_name', 'meta.name');
    os.createIndex('by_modified', 'modified');
  }
  void dbName; void upgrade;   // wired when the async plumbing lands — see the note below

  return <R>(): RecordStore<R> => ({
    put(_id: string, _record: R, _meta: ProjectMeta): void {
      throw new Error('indexedDbStore: not implemented yet');
    },
    get(_id: string): R | null {
      throw new Error('indexedDbStore: not implemented yet');
    },
    list(): { id: string; meta: ProjectMeta; modified: string }[] {
      throw new Error('indexedDbStore: not implemented yet');
    },
    remove(_id: string): void {
      throw new Error('indexedDbStore: not implemented yet');
    },
  });
}

/**
 * A `RecordStore` held entirely in memory — the store a test installs, and the fallback for a
 * browser where IndexedDB is unavailable or blocked.
 *
 * Same generic shape as the real one, so installing it exercises the exact contract the domain
 * depends on. `now` is injected rather than read from a clock here, so a test can make
 * modification times deterministic.
 */
export function memoryStore(now: () => string): RecordStoreFactory {
  const entries = new Map<string, { record: unknown; meta: ProjectMeta; modified: string }>();
  return <R>(): RecordStore<R> => ({
    put(id: string, record: R, meta: ProjectMeta): void {
      entries.set(id, { record, meta, modified: now() });
    },
    get(id: string): R | null {
      const e = entries.get(id);
      return e ? (e.record as R) : null;
    },
    list(): { id: string; meta: ProjectMeta; modified: string }[] {
      return [...entries.entries()].map(([id, e]) => ({ id, meta: e.meta, modified: e.modified }));
    },
    remove(id: string): void {
      entries.delete(id);
    },
  });
}
