/** REPO: the ONE whole-store backup. Copies every data key of the store to
 *  `openisd_backup_<build stamp of the app that wrote the store>`, and runs every destructive
 *  write behind that copy.
 *
 *  John's ruling (12 Oct 2026, T058): a backup MUST ALWAYS take place. Any write that removes or
 *  replaces a stored key — restore, delete, migrate, repair write-back, reset — first goes
 *  through `guard`. There is no path without it, and `storageBackup.test.ts` enumerates them.
 *
 *  Space: the copy is measured by writing it. When it does not fit, the oldest backups go until
 *  it does — never the newest backup of any layout. If it still does not fit, nothing is
 *  written and the destructive write is REFUSED: the user exports first (repair rule). */
import type {ListableStorage} from '../storage/keyValueStorage.js';
import type {BuildStamp} from './buildStamp.js';
import {createStorageSnapshot, envelopeText, readEnvelope} from './storageSnapshot.js';
import {OPENISD_BACKUP_PREFIX} from './storageKeys.js';

/** What the user is told when a write that would remove or replace saved data is refused because
 *  the whole-store backup that must come first does not fit. Nothing was changed. */
export const NO_ROOM_TO_BACK_UP =
  'Nothing was changed. There is no room in this browser to back up your saved data first. Export it, then try again.';

/** Backups kept, oldest dropped first. */
export const MAX_BACKUPS = 10;

export interface BackupInfo {
  /** The storage key the backup lives under. */
  readonly key: string;
  /** The layout of the app that wrote the data this backup holds; 0 when the backup is unreadable. */
  readonly layout: number;
  /** The build of the app that wrote that data. */
  readonly build: BuildStamp | null;
  /** When the backup was taken, ISO 8601 basic UTC; '' when unreadable. */
  readonly takenAt: string;
  /** Length of the backup text, in characters. */
  readonly size: number;
}

export type BackupResult =
  | {kind: 'taken'; key: string}
  /** The store holds no data, so there is nothing a write could lose. */
  | {kind: 'nothingToBackUp'}
  /** The copy does not fit, even with every droppable backup gone. Export first. */
  | {kind: 'noRoom'};

export type Guarded<T> =
  | {kind: 'ran'; value: T}
  | {kind: 'refused'};

export interface StorageBackup {
  /** Copy the whole store to its backup key. */
  take(): BackupResult;
  /** Run `destructive` only after the whole store is backed up; refuse it when the backup does
   *  not fit. THE door for every write that removes or replaces a stored key. */
  guard<T>(destructive: () => T): Guarded<T>;
  /** Every backup held, newest first. */
  list(): BackupInfo[];
  /** The backup text under `key` (an envelope, as `readEnvelope` reads it), or null. */
  read(key: string): string | null;
}

function byAge(a: BackupInfo, b: BackupInfo): number {
  return a.takenAt === b.takenAt ? a.key.localeCompare(b.key) : a.takenAt.localeCompare(b.takenAt);
}

export function createStorageBackup(storage: ListableStorage, now: () => number): StorageBackup {
  const snapshots = createStorageSnapshot(storage, now);
  function infoOf(key: string): BackupInfo {
    const text = storage.get(key) ?? '';
    const read = readEnvelope(text);
    if (read.kind === 'invalid') return {key, layout: 0, build: null, takenAt: '', size: text.length};
    return {key, layout: read.snapshot.layout, build: read.snapshot.build, takenAt: read.snapshot.exportedAt, size: text.length};
  }

  function list(): BackupInfo[] {
    return storage.keys().filter(key => key.startsWith(OPENISD_BACKUP_PREFIX)).map(infoOf).sort((a, b) => byAge(b, a));
  }

  /** The oldest backup that may go: not `keep`, and not the newest of its layout. */
  function droppable(keep: string): BackupInfo | null {
    const all = list();
    const newestOfLayout = new Set<string>();
    const seen = new Set<number>();
    for (const info of all) { // newest first
      if (!seen.has(info.layout)) { seen.add(info.layout); if (info.layout !== 0) newestOfLayout.add(info.key); }
    }
    const candidates = all.filter(info => info.key !== keep && !newestOfLayout.has(info.key));
    return candidates.length === 0 ? null : candidates[candidates.length - 1];
  }

  /** Write `text` under `key`, dropping the oldest droppable backups until it reads back. */
  function place(key: string, text: string): boolean {
    for (;;) {
      storage.set(key, text);
      if (storage.get(key) === text) return true;
      const victim = droppable(key);
      if (victim === null) return false;
      storage.remove(victim.key);
    }
  }

  function trim(keep: string): void {
    while (list().length > MAX_BACKUPS) {
      const victim = droppable(keep);
      if (victim === null) return;
      storage.remove(victim.key);
    }
  }

  function take(): BackupResult {
    const snapshot = snapshots.take();
    if (snapshot === null) return {kind: 'nothingToBackUp'};
    const key = OPENISD_BACKUP_PREFIX + snapshot.build.text;
    if (!place(key, envelopeText(snapshot, false))) return {kind: 'noRoom'};
    trim(key);
    return {kind: 'taken', key};
  }

  return {
    take,
    guard<T>(destructive: () => T): Guarded<T> {
      if (take().kind === 'noRoom') return {kind: 'refused'};
      return {kind: 'ran', value: destructive()};
    },
    list,
    read: key => storage.get(key),
  };
}
