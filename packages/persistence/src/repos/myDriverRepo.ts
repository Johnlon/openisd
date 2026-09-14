/** REPO: domain access to the My Drivers collection. Takes a storage, returns domain objects. */
import { OpenISDDriver } from '@openisd/design';
import type { Engine } from '@openisd/design/engine';
import type { KeyValueStorage } from '../storage/keyValueStorage.js';
import { createSavedEntries, type BrokenEntry, type SavedEntries } from './savedEntries.js';
import { OPENISD_MY_DRIVERS_KEY } from './storageKeys.js';

// "My Drivers" — the user's own saved-driver collection, in browser storage.
// THE one place that knows the storage key, and THE one write path: every route that creates a
// user driver (Add new, Clone, Load File, Save-and-reload) ends in `upsert`, so there is
// exactly one rule for what saving means.
//
// A REPO: it is handed a storage, takes arguments and returns DOMAIN OBJECTS. It does not
// know a dialog is open and it never decides what happens next — that is the logic layer's job.
//
// The bucket's shape, its failure states and its identity rules are `savedEntries.ts`'s — the
// SAME envelope the passive-radiator library uses. This file supplies only the two things that
// are specific to a driver: which storage key, and which domain seam validates a record.

export const MY_DRIVERS_KEY = OPENISD_MY_DRIVERS_KEY;

export type MyDriversRead =
  /** Bucket readable. `broken` entries are preserved in storage and surfaced, never hidden. */
  | { kind: 'ok'; drivers: { uuid: string; driver: OpenISDDriver }[]; broken: BrokenEntry[] }
  /** Storage itself is inaccessible (private mode, browser policy). Not a corruption. */
  | { kind: 'unavailable' }
  /** The bucket's string is not a readable envelope. The bucket is READ-ONLY until the user
   *  decides; `raw` is the one copy of their data, offered verbatim by Export. */
  | { kind: 'unreadable'; raw: string };

export interface MyDriverRepo {
  /** The bucket, with its failure states made explicit. */
  read(): MyDriversRead;
  /** Every saved driver, in saved order — `[]` when the bucket is unavailable or unreadable.
   *  Surfaces that must react to failure use `read()`. */
  list(): { uuid: string; driver: OpenISDDriver }[];
  /** Replace the whole collection — used by "reset to the demo samples". Refused (false)
   *  while the bucket is unreadable. Each entry mints a fresh uuid. */
  replaceAll(list: OpenISDDriver[]): boolean;
  /** Save one driver. `uuid` absent mints a fresh identity (a new entry); `uuid` present
   *  overwrites that entry. Returns the uuid it was saved under; null = refused (read-only). */
  upsert(d: OpenISDDriver, uuid?: string): { uuid: string; overwrote: boolean } | null;
  /** Remove the saved driver with this uuid. Refused (false) while unreadable. */
  remove(uuid: string): boolean;
  /** Remove ONE broken entry by its `BrokenEntry.key` — the surface challenges first. */
  removeBroken(key: number): boolean;
  /** The stored string, verbatim — what the unreadable-bucket Export downloads. */
  exportRaw(): string | null;
  /** Wipe the bucket and start fresh — the unreadable-bucket Delete, NEVER automatic; the
   *  surface challenges for an un-exported session before calling this. */
  deleteAll(): void;
}

export function createMyDriverRepo(storage: KeyValueStorage, engine: Engine): MyDriverRepo {
  const library: SavedEntries<OpenISDDriver> = createSavedEntries(storage, {
    key: MY_DRIVERS_KEY,
    schemaVersion: 1,
    open: (record) => OpenISDDriver.fromConformingRecord(record, engine),
    snapshot: (driver) => driver.cloneDriver(),
  });

  return {
    read() {
      const s = library.read();
      if (s.kind !== 'ok') return s;
      return { kind: 'ok', drivers: s.entries.map(e => ({ uuid: e.uuid, driver: e.value })), broken: s.broken };
    },
    list: () => library.list().map(e => ({ uuid: e.uuid, driver: e.value })),
    replaceAll: (list) => library.replaceAll(list),
    upsert: (d, uuid) => library.upsert(d, uuid),
    remove: (uuid) => library.remove(uuid),
    removeBroken: (key) => library.removeBroken(key),
    exportRaw: () => library.exportRaw(),
    deleteAll: () => library.deleteAll(),
  };
}
