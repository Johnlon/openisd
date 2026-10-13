/** REPO: the load rules — the one place that decides, before anything is read, whether this
 *  build may use the browser store.
 *
 *   - Same layout: open it. No backup, no prompt. Swapping between builds of one layout is silent.
 *   - Older layout: back the whole store up (named for the build that wrote it), migrate it one
 *     layout at a time, stamp it. If the backup does not fit the upgrade stops and the user
 *     exports first.
 *   - Newer layout: do not open the live store. Offer a backup this layout can read — restored
 *     into the live store (the live store is backed up first) or opened read-only — or a raw
 *     export of the live store. Never a silent loss.
 *
 *  A fresh store (no data) is opened as it is. */
import {BuildStamp} from './buildStamp.js';
import type {ListableStorage} from '../storage/keyValueStorage.js';
import {createBackupRepo} from './backupRepo.js';
import {createLayoutMigrator, type LayoutRules, type StoreData} from './layoutMigration.js';
import {type BackupInfo, createStorageBackup, type StorageBackup} from './storageBackup.js';
import {type LostKey, createStorageLog, type StorageLog} from './storageLog.js';
import {OPENISD_STORAGE_LAYOUT_KEY} from './storageKeys.js';
import {createStorageSnapshot, emptySnapshot, envelopeText, isStoreDataKey, readEnvelope} from './storageSnapshot.js';
import {createStampedStore, stampStore} from './stampedStore.js';

/** A store the app may use, with everything the composition root hands to the repos. */
export interface OpenStore {
  /** Every write goes through this: stamped with the app's layout and build, and kept in step
   *  with the storage log. */
  readonly storage: ListableStorage;
  readonly backup: StorageBackup;
  readonly log: StorageLog;
  /** Keys that were in the browser at the previous start and are gone now. */
  readonly lostKeys: readonly LostKey[];
  /** True when the app runs on a backup held in memory: nothing it does is saved. */
  readonly readOnly: boolean;
}

export type BlockReason = 'noRoom' | 'noStep';

export type StoreOpening =
  | ({kind: 'ready'} & OpenStore)
  /** The upgrade cannot go on. `exportRaw` is the live store, as it is, for the user to keep. */
  | {kind: 'blocked'; reason: BlockReason; storeLayout: number; exportRaw(): string}
  /** The store was written by a newer layout than this app reads. */
  | {
      kind: 'newer';
      storeLayout: number;
      /** Backups this layout can read, newest first. */
      readable: readonly BackupInfo[];
      /** Put a readable backup into the live store (after backing the live store up); the opening
       *  that follows. */
      restore(key: string): StoreOpening;
      /** Run on a readable backup held in memory; the live store is not touched. Null when the
       *  backup cannot be read. */
      readOnly(key: string): StoreOpening | null;
      exportRaw(): string;
    };

export interface OpenStoreDeps {
  readonly build: BuildStamp;
  readonly now: () => number;
  /** The layout this build writes and its migrations. */
  readonly rules: LayoutRules;
  /** A fresh storage held in memory, seeded with `initial` — where a backup is opened read-only. */
  readonly memoryStorage: (initial: Record<string, string>) => ListableStorage;
}

export function createStoreOpening(
  raw: ListableStorage,
  deps: OpenStoreDeps,
  onReplaced: () => void,
): StoreOpening {
  const {rules} = deps;
  const {layout} = rules;
  const stamp = {layout, build: deps.build};
  const migrator = createLayoutMigrator(rules);
  const snapshots = createStorageSnapshot(raw, deps.now);

  function rawExport(): string {
    return envelopeText(snapshots.take() ?? emptySnapshot(layout, deps.now()), true);
  }

  function openLive(): StoreOpening {
    const log = createStorageLog(raw, deps.now);
    const lostKeys = log.recordStart();
    const storage = createStampedStore(log.observe(raw), stamp);
    return {kind: 'ready', storage, backup: createStorageBackup(raw, deps.now), log, lostKeys, readOnly: false};
  }

  /** Write `next` over the store's data, removing keys it lacks. */
  function writeData(next: StoreData): void {
    for (const [key, value] of Object.entries(next)) if (raw.get(key) !== value) raw.set(key, value);
    for (const key of Object.keys(snapshots.data())) if (!(key in next)) raw.remove(key);
  }

  const data = snapshots.data();
  const found = snapshots.layout();
  if (found === null || found === layout) return openLive();

  if (found < layout) {
    const taken = createStorageBackup(raw, deps.now).take();
    if (taken.kind === 'noRoom') return {kind: 'blocked', reason: 'noRoom', storeLayout: found, exportRaw: rawExport};
    const migrated = migrator.migrate(data, found, (reached, stepData) => {
      writeData(stepData);
      raw.set(OPENISD_STORAGE_LAYOUT_KEY, String(reached));
    });
    if (migrated === null) return {kind: 'blocked', reason: 'noStep', storeLayout: found, exportRaw: rawExport};
    stampStore(raw, stamp);
    onReplaced();
    return openLive();
  }

  const backup = createStorageBackup(raw, deps.now);
  return {
    kind: 'newer',
    storeLayout: found,
    readable: backup.list().filter(info => info.layout >= 1 && info.layout <= layout),
    restore(key) {
      const text = backup.read(key);
      if (text === null) return openingAfterFailedRestore();
      const repo = createBackupRepo(createStampedStore(raw, stamp), backup, deps.now, rules, onReplaced);
      const result = repo.importAll(text, {replaceEverything: true});
      if (result.kind !== 'ok') return openingAfterFailedRestore();
      return createStoreOpening(raw, deps, onReplaced);
    },
    readOnly(key) {
      const text = backup.read(key);
      const read = text === null ? null : readEnvelope(text);
      if (read === null || read.kind === 'invalid' || read.snapshot.layout > layout) return null;
      const migrated = migrator.migrate(read.snapshot.data, read.snapshot.layout);
      if (migrated === null) return null;
      const memory = deps.memoryStorage(Object.fromEntries(Object.entries(migrated).filter(([k]) => isStoreDataKey(k))));
      const log = createStorageLog(memory, deps.now);
      return {kind: 'ready', storage: memory, backup: createStorageBackup(memory, deps.now), log, lostKeys: [], readOnly: true};
    },
    exportRaw: rawExport,
  };

  /** A restore that did not happen leaves the store as it was: the same decision again. */
  function openingAfterFailedRestore(): StoreOpening {
    return createStoreOpening(raw, deps, onReplaced);
  }
}

