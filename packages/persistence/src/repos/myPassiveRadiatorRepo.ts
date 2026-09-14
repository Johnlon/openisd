/** REPO: the passive radiators the USER saved. Takes a storage, returns domain objects.
 *
 *  The radiator counterpart of `myDriverRepo` — same role, same lifecycle, and the SAME stored
 *  envelope (`savedEntries.ts`): writable, held in the browser's key-value storage, and nothing
 *  to do with the read-only radiators that ship in the bundle. This file supplies only the two
 *  things specific to a radiator: which storage key, and which domain seam validates a record. */
import { OpenISDPassiveRadiatorStandalone } from '@openisd/design';
import type { Engine } from '@openisd/design/engine';
import type { KeyValueStorage } from '../storage/keyValueStorage.js';
import { createSavedEntries, type BrokenEntry, type SavedEntries } from './savedEntries.js';
import { OPENISD_MY_PASSIVE_RADIATORS_KEY } from './storageKeys.js';

export const MY_PASSIVE_RADIATORS_KEY = OPENISD_MY_PASSIVE_RADIATORS_KEY;

export type MyPassiveRadiatorsRead =
  /** Bucket readable. `broken` entries are preserved in storage and surfaced, never hidden. */
  | { kind: 'ok'; passiveRadiators: { uuid: string; passiveRadiator: OpenISDPassiveRadiatorStandalone }[]; broken: BrokenEntry[] }
  /** Storage itself is inaccessible (private mode, browser policy). Not a corruption. */
  | { kind: 'unavailable' }
  /** The bucket's string is not a readable envelope. READ-ONLY until the user decides. */
  | { kind: 'unreadable'; raw: string };

export interface MyPassiveRadiatorRepo {
  /** The bucket, with its failure states made explicit. */
  read(): MyPassiveRadiatorsRead;
  /** Every saved radiator, in saved order — `[]` when unavailable or unreadable. */
  list(): { uuid: string; passiveRadiator: OpenISDPassiveRadiatorStandalone }[];
  /** Replace the whole collection. Refused (false) while the bucket is unreadable. */
  replaceAll(list: OpenISDPassiveRadiatorStandalone[]): boolean;
  /** Save one radiator. `uuid` absent mints a fresh identity; `uuid` present overwrites that
   *  entry. Returns the uuid it was saved under; null = refused (read-only). */
  upsert(pr: OpenISDPassiveRadiatorStandalone, uuid?: string): { uuid: string; overwrote: boolean } | null;
  /** Remove the saved radiator with this uuid. Refused (false) while unreadable. */
  remove(uuid: string): boolean;
  /** Remove ONE broken entry by its `BrokenEntry.key` — the surface challenges first. */
  removeBroken(key: number): boolean;
  /** The stored string, verbatim — what the unreadable-bucket Export downloads. */
  exportRaw(): string | null;
  /** Wipe the bucket and start fresh — NEVER automatic. */
  deleteAll(): void;
}

export function createMyPassiveRadiatorRepo(storage: KeyValueStorage, engine: Engine): MyPassiveRadiatorRepo {
  const library: SavedEntries<OpenISDPassiveRadiatorStandalone> = createSavedEntries(storage, {
    key: MY_PASSIVE_RADIATORS_KEY,
    schemaVersion: 1,
    open: (record) => OpenISDPassiveRadiatorStandalone.fromConformingRecord(record, engine),
    snapshot: (pr) => pr.clonePassiveRadiator(),
  });

  return {
    read() {
      const s = library.read();
      if (s.kind !== 'ok') return s;
      return {
        kind: 'ok',
        passiveRadiators: s.entries.map(e => ({ uuid: e.uuid, passiveRadiator: e.value })),
        broken: s.broken,
      };
    },
    list: () => library.list().map(e => ({ uuid: e.uuid, passiveRadiator: e.value })),
    replaceAll: (list) => library.replaceAll(list),
    upsert: (pr, uuid) => library.upsert(pr, uuid),
    remove: (uuid) => library.remove(uuid),
    removeBroken: (key) => library.removeBroken(key),
    exportRaw: () => library.exportRaw(),
    deleteAll: () => library.deleteAll(),
  };
}
