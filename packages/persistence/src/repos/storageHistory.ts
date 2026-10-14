/** SERVICE: the Backups page's data — everything kept in this browser, as rows a person can act on.
 *  Whole-store backups (why each was taken, its layout, projects and size: Restore everything,
 *  Restore one project, Download, Delete, and Back up now) and the copies repairs kept (Download,
 *  Delete). Everything is decided here; the page shows the rows and calls these. */
import type {BackupRepo, RestoreResult} from './backupRepo.js';
import type {LayoutRules} from './layoutMigration.js';
import type {BackupInfo, BackupResult, PreRepairCopy, PreRepairKind, RefusedCopy, StorageBackup} from './storageBackup.js';
import type {ProjectRepo} from './projectRepo.js';
import type {BackupReason} from './storageSnapshot.js';
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
  /** Why it was taken; null when not recorded. */
  readonly reason: BackupReason | null;
  /** False for a backup this app cannot read at all: it can be exported and deleted, not restored. */
  readonly readable: boolean;
  /** False for a backup written by a newer layout than this app reads. */
  readonly restorable: boolean;
}

export interface HistoryFile {
  readonly fileName: string;
  readonly text: string;
}

/** One saved project inside a backup, as the Restore one project picker lists it. */
export interface BackupProject {
  /** The project's id in the backup; the handle `restoreProject` takes. */
  readonly id: string;
  /** Its name; '' when its text would not read. */
  readonly name: string;
}

export type RestoreProjectResult =
  | {readonly kind: 'restored'; readonly name: string}
  | {readonly kind: 'refused'; readonly reason: string};

/** One thing the Backups page lists: a whole-store backup, or a copy a repair kept. */
export type HistoryEntry =
  | {readonly kind: 'backup'; readonly row: HistoryRow}
  | {readonly kind: 'copy'; readonly copy: PreRepairCopy}
  | {readonly kind: 'refused'; readonly refused: RefusedCopy};

function takenAtOf(entry: HistoryEntry): string {
  switch (entry.kind) {
    case 'backup': return entry.row.takenAt;
    case 'copy': return entry.copy.takenAt;
    case 'refused': return entry.refused.at;
  }
}

function sizeOf(entry: HistoryEntry): number {
  switch (entry.kind) {
    case 'backup': return entry.row.size;
    case 'copy': return entry.copy.size;
    case 'refused': return entry.refused.size;
  }
}

export interface StorageHistory {
  /** Everything kept, newest first; an entry with no date last. */
  entries(): HistoryEntry[];
  /** The size of everything kept, in characters. */
  totalSize(): number;
  /** Every backup, newest first. */
  rows(): HistoryRow[];
  backUpNow(): BackupResult;
  /** The backup as a file to save, or null when there is no such backup. */
  exportFile(key: string): HistoryFile | null;
  /** Put the backup into the live store, replacing it; the live store is backed up first. */
  restore(key: string): RestoreResult;
  /** Delete the backup. False when `key` is not a backup held. */
  remove(key: string): boolean;
  /** The saved projects the backup holds, in its order. */
  projectsIn(key: string): BackupProject[];
  /** Add project `id` of the backup to the saved projects under `name`, touching nothing else. */
  restoreProject(key: string, id: string, name: string): RestoreProjectResult;
  /** The copies repairs kept of records they rewrote. */
  copies(): PreRepairCopy[];
  /** Delete the copy of `kind`. False when none is held. */
  removeCopy(kind: PreRepairKind): boolean;
  /** The copy as a file to save, or null when none is held. */
  exportCopy(kind: PreRepairKind): HistoryFile | null;
  /** The project a refused copy holds, as a file to save, or null when it is no longer held. */
  exportRefused(key: string): HistoryFile | null;
  /** Delete the refused copy under `key`. False when it is not held. */
  removeRefused(key: string): boolean;
  /** Delete every backup and kept copy. Returns how many went. */
  removeAllBackups(): number;
}

interface HeldEntry { readonly id: string; readonly text: string }

/** The saved-project entries a backup's projects record holds; none when it will not read. */
function entriesOf(data: Readonly<Record<string, string>>): HeldEntry[] {
  const text = data[OPENISD_PROJECTS_KEY];
  if (text === undefined) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return []; }
  if (typeof parsed !== 'object' || parsed === null || !('entries' in parsed) || !Array.isArray(parsed.entries)) return [];
  return parsed.entries.flatMap((e: unknown): HeldEntry[] =>
    typeof e === 'object' && e !== null && 'id' in e && typeof e.id === 'string' && 'text' in e && typeof e.text === 'string'
      ? [{id: e.id, text: e.text}] : []);
}

function projectCountOf(data: Readonly<Record<string, string>>): number {
  const text = data[OPENISD_PROJECTS_KEY];
  if (text === undefined) return 0;
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null && 'entries' in parsed && Array.isArray(parsed.entries) ? parsed.entries.length : 0;
  } catch { return 0; }
}

export function createStorageHistory(
  backup: StorageBackup, restoreRepo: BackupRepo, rules: LayoutRules, projects: Pick<ProjectRepo, 'readProjectText' | 'importArchive'>,
): StorageHistory {
  /** The entries of the backup under `key`, when it reads and this app reads its layout. */
  function heldEntries(key: string): HeldEntry[] {
    const read = readEnvelope(backup.read(key) ?? '');
    return read.kind === 'ok' && read.snapshot.layout <= rules.layout ? entriesOf(read.snapshot.data) : [];
  }
  function rowOf(info: BackupInfo): HistoryRow {
    const read = readEnvelope(backup.read(info.key) ?? '');
    if (read.kind === 'invalid') {
      return {key: info.key, build: 'vunknown', layout: 0, projectCount: 0, size: info.size, takenAt: '', reason: null, readable: false, restorable: false};
    }
    const {snapshot} = read;
    return {
      key: info.key, build: snapshot.build.text, layout: snapshot.layout, projectCount: projectCountOf(snapshot.data),
      size: info.size, takenAt: snapshot.exportedAt, reason: read.reason, readable: true, restorable: snapshot.layout <= rules.layout,
    };
  }
  function entries(): HistoryEntry[] {
    const all: HistoryEntry[] = [
      ...backup.list().map((info): HistoryEntry => ({kind: 'backup', row: rowOf(info)})),
      ...backup.preRepairCopies().map((copy): HistoryEntry => ({kind: 'copy', copy})),
      ...backup.refusedCopies().map((refused): HistoryEntry => ({kind: 'refused', refused})),
    ];
    return all.sort((a, b) => takenAtOf(b).localeCompare(takenAtOf(a)));
  }
  return {
    entries,
    totalSize: () => entries().reduce((sum, e) => sum + sizeOf(e), 0),
    rows: () => backup.list().map(rowOf),
    backUpNow: () => backup.take('manual'),
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
    projectsIn: key => heldEntries(key).map(entry => {
      const project = projects.readProjectText(entry.text);
      return {id: entry.id, name: Array.isArray(project) ? '' : project.name.value};
    }),
    restoreProject(key, id, name) {
      const entry = heldEntries(key).find(e => e.id === id);
      if (entry === undefined) return {kind: 'refused', reason: 'That project is no longer in this backup.'};
      const project = projects.readProjectText(entry.text);
      if (Array.isArray(project)) return {kind: 'refused', reason: `The project would not load: ${project.join('; ')}`};
      project.name.set(name);
      projects.importArchive([project]);
      return {kind: 'restored', name: project.name.value};
    },
    copies: () => backup.preRepairCopies(),
    removeCopy: kind => backup.discardCopy(kind),
    removeAllBackups: () => backup.discardAll(),
    exportRefused(key) {
      const record = backup.readRefused(key);
      if (record === null) return null;
      return {fileName: `openisd-would-not-load-${record.at === '' ? 'undated' : record.at}.owpr`, text: record.text};
    },
    removeRefused: key => backup.discardRefused(key),
    exportCopy(kind) {
      const text = backup.readPreRepairCopy(kind);
      return text === null ? null : {fileName: `openisd-before-repair-${kind}.json`, text};
    },
  };
}
