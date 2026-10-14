/** REPO: the ONE whole-store backup. Copies every data key of the store to
 *  `openisd_backup_<build stamp of the app that wrote the store>_<time taken, to the second>` (plus `_01`.. when that key is already held), and runs every destructive
 *  write behind that copy.
 *
 *  John's ruling (12 Oct 2026, T058): a backup MUST ALWAYS take place. Any write that removes or
 *  replaces a stored key — restore, delete, migrate, repair write-back, reset — first goes
 *  through `guard`. There is no path without it, and `storageBackup.test.ts` enumerates them.
 *
 *  Space: the copy is measured by writing it. When it does not fit, these go, in order, until it
 *  does: the older backups (oldest first), then the pre-repair copies, then the newest backup of
 *  each layout — a copy of live data outranks a copy of yesterday's (John, 14 Oct 2026, T153).
 *  Only when live data alone cannot be copied is nothing written and the destructive write
 *  REFUSED: the user exports first (repair rule).
 *
 *  One backup per guarded operation: a guard that starts while another runs takes none, since
 *  the outer backup already holds the whole store (a sync run's pulled writes, T153). */
import type {ListableStorage} from '../storage/keyValueStorage.js';
import type {BuildStamp} from './buildStamp.js';
import {createStorageSnapshot, envelopeText, readEnvelope} from './storageSnapshot.js';
import {OPENISD_BACKUP_KEYS, OPENISD_BACKUP_PREFIX, OPENISD_QUARANTINE_SESSION_KEY} from './storageKeys.js';

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
  /** Delete the backup under `key`. False, and nothing deleted, when `key` is not a backup. A
   *  backup is not itself backed up: it is the copy. */
  discard(key: string): boolean;
  /** Write a data key, dropping backups oldest first until it fits, the newest last. False when it
   *  does not fit even with every backup gone. Live data outranks its own backups: a save never
   *  fails for want of room a backup is using. */
  write(key: string, text: string): boolean;
}

/** The copies a repair keeps of a record it rewrote, dropped in this order when a backup needs room. */
const PRE_REPAIR_COPIES: readonly string[] = [
  OPENISD_BACKUP_KEYS.projects, OPENISD_BACKUP_KEYS.openSessions, OPENISD_QUARANTINE_SESSION_KEY,
  OPENISD_BACKUP_KEYS.state, OPENISD_BACKUP_KEYS.view, OPENISD_BACKUP_KEYS.appSettings,
];

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

  /** `place`, then, for live data only, every remaining backup oldest first: a save of the
   *  user's work outranks a copy of it. False only when the store cannot hold the data at all. */
  function writeData(key: string, text: string): boolean {
    if (place(key, text)) return true;
    for (const info of list().reverse()) {
      storage.remove(info.key);
      storage.set(key, text);
      if (storage.get(key) === text) return true;
    }
    return false;
  }

  /** What goes when even `droppable` has nothing left: the pre-repair copies, then the newest
   *  backups, oldest first. Never `keep`, never live data. */
  function lastResort(keep: string): string | null {
    const copy = PRE_REPAIR_COPIES.find(key => storage.get(key) !== null);
    if (copy !== undefined) return copy;
    const backups = list().filter(info => info.key !== keep);
    return backups.length === 0 ? null : backups[backups.length - 1].key;
  }

  /** `place`, then the last resort: false only when live data alone cannot be copied. */
  function placeCopy(key: string, text: string): boolean {
    if (place(key, text)) return true;
    for (let victim = lastResort(key); victim !== null; victim = lastResort(key)) {
      storage.remove(victim);
      storage.set(key, text);
      if (storage.get(key) === text) return true;
    }
    return false;
  }

  function trim(keep: string): void {
    while (list().length > MAX_BACKUPS) {
      const victim = droppable(keep);
      if (victim === null) return;
      storage.remove(victim.key);
    }
  }

  /** `base`, or `base_01` .. `base_99` when a backup is already held under it (same build, same second). */
  function freeKey(base: string): string | null {
    if (storage.get(base) === null) return base;
    for (let n = 1; n <= 99; n++) {
      const key = `${base}_${String(n).padStart(2, '0')}`;
      if (storage.get(key) === null) return key;
    }
    return null;
  }

  function take(): BackupResult {
    const snapshot = snapshots.take();
    if (snapshot === null) return {kind: 'nothingToBackUp'};
    const key = freeKey(`${OPENISD_BACKUP_PREFIX}${snapshot.build.text}_${snapshot.exportedAt}`);
    if (key === null) return {kind: 'noRoom'};
    if (!placeCopy(key, envelopeText(snapshot, false))) return {kind: 'noRoom'};
    trim(key);
    return {kind: 'taken', key};
  }

  let guarding = false;

  return {
    take,
    guard<T>(destructive: () => T): Guarded<T> {
      if (guarding) return {kind: 'ran', value: destructive()};
      if (take().kind === 'noRoom') return {kind: 'refused'};
      guarding = true;
      try {
        return {kind: 'ran', value: destructive()};
      } finally {
        guarding = false;
      }
    },
    list,
    read: key => storage.get(key),
    write: writeData,
    discard(key) {
      if (!key.startsWith(OPENISD_BACKUP_PREFIX) || storage.get(key) === null) return false;
      storage.remove(key);
      return true;
    },
  };
}
