/** REPO: domain access to the My Drivers collection. Takes a storage, returns domain objects. */
import {OpenISDDriver, type OpenISDDriverStandalone} from '@openisd/design';
import type {Engine} from '@openisd/design/engine';
import type {KeyValueStorage} from '../storage/keyValueStorage.js';
import {type BrokenEntry, createSavedEntries, type SavedEntries, type SavedWrite} from './savedEntries.js';
import type {StorageBackup} from './storageBackup.js';
import {OPENISD_MY_DRIVERS_KEY} from './storageKeys.js';

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
  | { kind: 'ok'; drivers: { uuid: string; driver: OpenISDDriverStandalone }[]; broken: BrokenEntry[] }
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
  list(): { uuid: string; driver: OpenISDDriverStandalone }[];
  /** Replace the whole collection — used by "reset to the demo samples". Refused (false)
   *  while the bucket is unreadable. Each entry mints a fresh uuid. */
  replaceAll(list: OpenISDDriverStandalone[]): SavedWrite;
  /** Save one driver. `uuid` absent mints a fresh identity (a new entry); `uuid` present
   *  overwrites that entry. Returns the uuid it was saved under; null = refused (read-only). */
  upsert(d: OpenISDDriverStandalone, uuid?: string): { uuid: string; overwrote: boolean } | null;
  /** Remove the saved driver with this uuid. Refused (false) while unreadable. */
  remove(uuid: string): SavedWrite;
  /** Remove ONE broken entry by its `BrokenEntry.key` — the surface challenges first. */
  removeBroken(key: number): SavedWrite;
  /** The stored string, verbatim — what the unreadable-bucket Export downloads. */
  exportRaw(): string | null;
  /** Wipe the bucket and start fresh — the unreadable-bucket Delete, NEVER automatic; the
   *  surface challenges for an un-exported session before calling this. */
  deleteAll(): 'done' | 'noRoom';
}

export function createMyDriverRepo(storage: KeyValueStorage, engine: Engine, backup: StorageBackup, onSaved: () => void): MyDriverRepo {
  const library: SavedEntries<OpenISDDriverStandalone> = createSavedEntries(storage, {
    key: MY_DRIVERS_KEY,
    open: (record) => OpenISDDriver.fromConformingRecord(record, engine),
    snapshot: (driver) => driver.cloneDriver(),
  }, backup);

  return {
    read() {
      const s = library.read();
      if (s.kind !== 'ok') return s;
      return { kind: 'ok', drivers: s.entries.map(e => ({ uuid: e.uuid, driver: e.value })), broken: s.broken };
    },
    list: () => library.list().map(e => ({ uuid: e.uuid, driver: e.value })),
    replaceAll: (list) => {
      const res = library.replaceAll(list);
      if (res === 'done') onSaved();
      return res;
    },
    upsert: (d, uuid) => {
      const res = library.upsert(d, uuid);
      if (res !== null) onSaved();
      return res;
    },
    remove: (uuid) => {
      const res = library.remove(uuid);
      if (res === 'done') onSaved();
      return res;
    },
    removeBroken: (key) => {
      const res = library.removeBroken(key);
      if (res === 'done') onSaved();
      return res;
    },
    exportRaw: () => library.exportRaw(),
    deleteAll: () => {
      const res = library.deleteAll();
      if (res === 'done') onSaved();
      return res;
    },
  };
}

