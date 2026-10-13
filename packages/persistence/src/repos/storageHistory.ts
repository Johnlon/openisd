/** SERVICE: the storage history — the backups held in this browser, as rows a person can act on.
 *  One row per backup: when its data was written, its layout, how many projects it holds and its
 *  size, with Export, Restore, Delete and Back up now. Everything is decided here; the page shows
 *  the rows and calls these. */
import type {BackupRepo, RestoreResult} from './backupRepo.js';
import type {LayoutRules} from './layoutMigration.js';
import type {BackupInfo, BackupResult, StorageBackup} from './storageBackup.js';
import {OPENISD_PROJECTS_KEY} from './storageKeys.js';
import {readEnvelope} from './storageSnapshot.js';

export interface HistoryRow {
  /** The storage key, the handle every action takes. */
  readonly key: string;
  /** Build stamp of the app that wrote the data (`v20260101T0102Z`); `vunknown` when none was recorded. */
  readonly build: string;
  readonly layout: number;
  /** Saved projects the backup holds. */
  readonly projectCount: number;
  /** Length of the backup text, in characters. */
  readonly size: number;
  /** When the backup was taken, ISO 8601 basic UTC. */
  readonly takenAt: string;
  /** False for a backup this app cannot read at all: it can be exported and deleted, not restored. */
  readonly readable: boolean;
  /** False for a backup written by a newer layout than this app reads. */
  readonly restorable: boolean;
}

export interface HistoryFile {
  readonly fileName: string;
  readonly text: string;
}

export interface StorageHistory {
  /** Every backup, newest first. */
  rows(): HistoryRow[];
  backUpNow(): BackupResult;
  /** The backup as a file to save, or null when there is no such backup. */
  exportFile(key: string): HistoryFile | null;
  /** Put the backup into the live store, replacing it; the live store is backed up first. */
  restore(key: string): RestoreResult;
  /** Delete the backup. False when `key` is not a backup held. */
  remove(key: string): boolean;
}

function projectCountOf(data: Readonly<Record<string, string>>): number {
  const text = data[OPENISD_PROJECTS_KEY];
  if (text === undefined) return 0;
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null && 'entries' in parsed && Array.isArray(parsed.entries) ? parsed.entries.length : 0;
  } catch { return 0; }
}

export function createStorageHistory(backup: StorageBackup, restoreRepo: BackupRepo, rules: LayoutRules): StorageHistory {
  function rowOf(info: BackupInfo): HistoryRow {
    const read = readEnvelope(backup.read(info.key) ?? '');
    if (read.kind === 'invalid') {
      return {key: info.key, build: 'vunknown', layout: 0, projectCount: 0, size: info.size, takenAt: '', readable: false, restorable: false};
    }
    const {snapshot} = read;
    return {
      key: info.key, build: snapshot.build.text, layout: snapshot.layout, projectCount: projectCountOf(snapshot.data),
      size: info.size, takenAt: snapshot.exportedAt, readable: true, restorable: snapshot.layout <= rules.layout,
    };
  }
  return {
    rows: () => backup.list().map(rowOf),
    backUpNow: () => backup.take(),
    exportFile(key) {
      const text = backup.read(key);
      if (text === null) return null;
      const read = readEnvelope(text);
      const stamp = read.kind === 'ok' ? read.snapshot.exportedAt : key.slice(key.lastIndexOf('_') + 1);
      return {fileName: `openisd-backup-${stamp}.json`, text};
    },
    restore(key) {
      const text = backup.read(key);
      if (text === null) return {kind: 'invalid', reason: 'That backup is no longer held.'};
      return restoreRepo.importAll(text, {replaceEverything: true});
    },
    remove: key => backup.discard(key),
  };
}
