/** REPO: a single JSON snapshot of the store — projects, My Drivers, My Passive Radiators,
 *  favourites, view/prefs, app settings — and the one place that knows how to put one back.
 *
 *  Deliberately excludes the BUNDLED catalogues (drivers/passive radiators): those are static
 *  shipped assets fetched over HTTP, never written to this storage, so there is nothing here to
 *  exclude them FROM.
 *
 *  A restore KEEPS every key the file lacks, unless the user asks to replace everything: then
 *  every data key the file lacks is removed too, so the browser reverts to the file's point in
 *  time. Either way the whole store is backed up first (T058), and a file written by an older
 *  layout is migrated, one layout at a time, before it is written. A file from a newer layout is
 *  refused: this app cannot read it. The caller (the UI) confirms with the user before calling
 *  `importAll` — this repo does not ask. */
import type {ListableStorage} from '../storage/keyValueStorage.js';
import {createLayoutMigrator, type LayoutRules} from './layoutMigration.js';
import type {StorageBackup} from './storageBackup.js';
import {createStorageSnapshot, emptySnapshot, envelopeText, isStoreDataKey, readEnvelope} from './storageSnapshot.js';

export type RestoreResult =
  | {kind: 'ok'; keysRestored: number}
  | {kind: 'invalid'; reason: string}
  /** The backup of what is here now would not fit, so nothing was changed. */
  | {kind: 'refused'; reason: string};

export interface RestoreOptions {
  /** Remove every data key the file lacks, so the store becomes exactly the file. */
  readonly replaceEverything: boolean;
}

export interface BackupRepo {
  /** Every data key, as one JSON string ready to download. */
  exportAll(): string;
  /** Put a previously-exported JSON string back. Validates the envelope before writing anything
   *  — a malformed file changes nothing. */
  importAll(json: string, options: RestoreOptions): RestoreResult;
}

export function createBackupRepo(
  storage: ListableStorage, backup: StorageBackup, now: () => number,
  rules: LayoutRules,
  onReplaced: () => void,
): BackupRepo {
  const migrator = createLayoutMigrator(rules);
  const snapshots = createStorageSnapshot(storage, now);
  return {
    exportAll: () => envelopeText(snapshots.take() ?? emptySnapshot(rules.layout, now()), true),

    importAll(json, options) {
      const read = readEnvelope(json);
      if (read.kind === 'invalid') return read;
      const {snapshot} = read;
      if (snapshot.layout > rules.layout) {
        return {kind: 'invalid', reason: `This file was written by a newer OpenISD (storage layout ${snapshot.layout}; this one reads up to ${rules.layout}). Update the app to restore it.`};
      }
      const migrated = migrator.migrate(snapshot.data, snapshot.layout);
      if (migrated === null) return {kind: 'invalid', reason: `This file is layout ${snapshot.layout} and this app cannot migrate it.`};
      const incoming = Object.entries(migrated).filter(([key]) => isStoreDataKey(key));

      const guarded = backup.guard(() => {
        for (const [key, value] of incoming) storage.set(key, value);
        if (options.replaceEverything) {
          const kept = new Set(incoming.map(([key]) => key));
          for (const key of storage.keys()) if (isStoreDataKey(key) && !kept.has(key)) storage.remove(key);
        }
        return incoming.length;
      });
      if (guarded.kind === 'refused') {
        return {kind: 'refused', reason: 'The browser has no room to back up what is here now before restoring. Download a backup first, then restore.'};
      }
      onReplaced();
      return {kind: 'ok', keysRestored: guarded.value};
    },
  };
}
