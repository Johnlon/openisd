/**
 * The Options "Your data" tab's Storage and Backups groups: what each kind of data takes, with
 * Empty Bin and Delete all backups; and everything kept in this browser as one list, newest
 * first — the whole-store backups and the kept copies — with the total size, Back up now, and
 * each row's actions. The entries and what each action does are decided by the persistence layer
 * (`StorageHistory`); this only words them for the page, asks the user to confirm, and keeps the
 * list current. The page shows what it is handed.
 */
import {ref, type Ref} from 'vue';
import {formatByteSize, formatCountOf, formatDateTime, parseBasicUtc, restoredProjectName, storageUsedLine} from '@openisd/design/fields';
import {type BackupReason, type HistoryEntry, type HistoryRow, type PreRepairCopy, type PreRepairKind, type RefusedCopy,
  type HistoryFile, type StorageHistory} from '@openisd/persistence';
import {useApp} from '../logic/app.js';
import {emptyBin as emptyBinAfterAsking} from '../logic/projectBinActions.js';
import {binTotalSize} from './storedProjectRows.js';

/** A whole-store backup, as its row shows it. */
export interface BackupRowView {
  readonly kind: 'backup';
  readonly key: string;
  /** When it was taken, as "14 Oct 2026, 14:01". */
  readonly takenAt: string;
  /** Why it was taken: "Before sync". */
  readonly reason: string;
  readonly size: string;
  /** "3 projects". */
  readonly projects: string;
  /** False: no Restore, and a line saying why. */
  readonly restorable: boolean;
  readonly note: string;
}

/** A copy kept of one record, as its row shows it. */
export interface CopyRowView {
  readonly kind: 'copy';
  readonly copy: PreRepairKind;
  readonly takenAt: string;
  readonly reason: string;
  readonly size: string;
  /** What the copy holds: "Saved projects". */
  readonly holds: string;
}

/** A project kept whole because it would not load, as its row shows it. */
export interface RefusedRowView {
  readonly kind: 'refused';
  readonly key: string;
  readonly takenAt: string;
  readonly reason: string;
  readonly size: string;
  /** 'Project "Sub 12"', or "Project (unreadable)". */
  readonly holds: string;
}

export type HistoryRowView = BackupRowView | CopyRowView | RefusedRowView;

/** A project inside a backup, as the Restore one project picker lists it. */
export interface PickerProject {
  readonly id: string;
  /** Its name; "Unreadable project" when it would not read. */
  readonly name: string;
  readonly readable: boolean;
}

/** The Restore one project picker, open on one backup. */
export interface ProjectPicker {
  readonly key: string;
  readonly projects: readonly PickerProject[];
}

export type RestoreOutcome =
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'restored'; readonly keysRestored: number }
  | { readonly kind: 'failed'; readonly reason: string };

/** One line of the Storage group: "Projects  0.9 MB". */
export interface UsageRowView {
  readonly label: string;
  readonly size: string;
}

export interface StorageHistoryAPI {
  /** "Using 2.1 MB of about 5 MB in this browser." */
  readonly usedLine: Ref<string>;
  readonly usageRows: Ref<readonly UsageRowView[]>;
  /** False: Empty Bin is disabled. */
  readonly binHasProjects: Ref<boolean>;
  readonly rows: Ref<readonly HistoryRowView[]>;
  /** The size of everything listed: "1.2 MB". */
  readonly totalSize: Ref<string>;
  /** What is kept and for how long, above the list. */
  readonly keepRule: string;
  emptyBin(): Promise<void>;
  deleteAllBackups(): Promise<void>;
  /** The open Restore one project picker, or null. */
  readonly picker: Ref<ProjectPicker | null>;
  backUpNow(): void;
  exportRow(row: HistoryRowView): void;
  restoreRow(key: string): Promise<RestoreOutcome>;
  openPicker(key: string): void;
  closePicker(): void;
  restoreProject(project: PickerProject): void;
  deleteRow(row: HistoryRowView): Promise<void>;
}

function timeText(stamp: string, none: string): string {
  const at = parseBasicUtc(stamp);
  return at === null ? none : formatDateTime(at);
}

function reasonText(reason: BackupReason | null): string {
  switch (reason) {
    case 'manual': return 'Back up now';
    case 'sync': return 'Before sync';
    case 'delete': return 'Before delete';
    case 'deleteForever': return 'Before delete forever';
    case 'binRestore': return 'Before restore from the Bin';
    case 'repair': return 'Before repair';
    case 'startUpRewrite': return 'Start-up rewrite';
    case 'restore': return 'Before restore';
    case 'reset': return 'Before reset';
    case 'overwrite': return 'Before an overwrite';
    case null: return 'Not recorded';
  }
}

function holdsText(kind: PreRepairKind): string {
  switch (kind) {
    case 'projects': return 'Saved projects';
    case 'openSessions': return 'Open projects list';
    case 'quarantineSession': return 'Open projects that would not load';
    case 'state': return 'Last project (older store)';
    case 'view': return 'Window layout';
    case 'appSettings': return 'Options';
  }
}

function backupView(row: HistoryRow): BackupRowView {
  const note = !row.readable ? 'This backup cannot be read. You can still export or delete it.'
    : !row.restorable ? 'Saved by a newer OpenISD. Update the app to restore it.'
    : '';
  return {
    kind: 'backup',
    key: row.key,
    takenAt: timeText(row.takenAt, 'Unknown'),
    reason: reasonText(row.reason),
    size: formatByteSize(row.size),
    projects: row.readable ? formatCountOf(row.projectCount, 'project') : '–',
    restorable: row.restorable,
    note,
  };
}

function copyView(copy: PreRepairCopy): CopyRowView {
  return {
    kind: 'copy',
    copy: copy.kind,
    takenAt: timeText(copy.takenAt, 'Unknown'),
    // The quarantined open session is kept when its entries would not load, not by a repair.
    reason: copy.kind === 'quarantineSession' ? 'Would not load' : 'Before repair',
    size: formatByteSize(copy.size),
    holds: holdsText(copy.kind),
  };
}

function refusedView(refused: RefusedCopy): RefusedRowView {
  return {
    kind: 'refused',
    key: refused.key,
    takenAt: timeText(refused.at, 'Unknown'),
    reason: 'Would not load',
    size: formatByteSize(refused.size),
    holds: refused.name === '' ? 'Project (unreadable)' : `Project "${refused.name}"`,
  };
}

function viewOf(entry: HistoryEntry): HistoryRowView {
  switch (entry.kind) {
    case 'backup': return backupView(entry.row);
    case 'copy': return copyView(entry.copy);
    case 'refused': return refusedView(entry.refused);
  }
}

function exportOf(history: Pick<StorageHistory, 'exportFile' | 'exportCopy' | 'exportRefused'>, row: HistoryRowView): HistoryFile | null {
  switch (row.kind) {
    case 'backup': return history.exportFile(row.key);
    case 'copy': return history.exportCopy(row.copy);
    case 'refused': return history.exportRefused(row.key);
  }
}

function removeOf(history: Pick<StorageHistory, 'remove' | 'removeCopy' | 'removeRefused'>, row: HistoryRowView): boolean {
  switch (row.kind) {
    case 'backup': return history.remove(row.key);
    case 'copy': return history.removeCopy(row.copy);
    case 'refused': return history.removeRefused(row.key);
  }
}

export function useStorageHistory(): StorageHistoryAPI {
  const { storageHistory, storageUsage, projectBin, designIO, confirmPort, logging } = useApp();
  const usedLine = ref('');
  const usageRows = ref<readonly UsageRowView[]>([]);
  const binHasProjects = ref(false);
  const rows = ref<readonly HistoryRowView[]>([]);
  const totalSize = ref('');
  const picker = ref<ProjectPicker | null>(null);
  const refresh = (): void => {
    const usage = storageUsage.report();
    usedLine.value = storageUsedLine(usage.total);
    usageRows.value = [
      {label: 'Projects', size: formatByteSize(usage.projects)},
      {label: 'My Drivers', size: formatByteSize(usage.myDrivers)},
      {label: 'Bin', size: formatByteSize(usage.bin)},
      {label: 'Backups', size: formatByteSize(usage.backups)},
      {label: 'Settings', size: formatByteSize(usage.settings)},
    ];
    binHasProjects.value = projectBin.binned().length > 0;
    rows.value = storageHistory.entries().map(viewOf);
    totalSize.value = formatByteSize(storageHistory.totalSize());
  };
  refresh();

  function backUpNow(): void {
    const result = storageHistory.backUpNow();
    if (result.kind === 'taken') logging.flash('Backed up everything in this browser.');
    else if (result.kind === 'nothingToBackUp') logging.flash('Nothing is saved in this browser yet, so there is nothing to back up.');
    else logging.flash('There is no room for another backup. Delete an old one, or export and delete.');
    refresh();
  }

  function exportRow(row: HistoryRowView): void {
    const file = exportOf(storageHistory, row);
    if (file === null) { logging.flash('That is no longer there.'); refresh(); return; }
    designIO.saveStoredBackup(file);
  }

  async function restoreRow(key: string): Promise<RestoreOutcome> {
    const confirmed = await confirmPort.port.ask({
      title: 'Restore everything from this backup?',
      message: 'Everything in this browser is replaced by what is in this backup: all projects, My Drivers, My Passive Radiators '
        + 'and preferences. A backup of what is here now is made first. Continue?',
      confirmLabel: 'Restore',
      cancelLabel: 'Cancel',
    });
    if (!confirmed) return { kind: 'cancelled' };
    const result = storageHistory.restore(key);
    refresh();
    return result.kind === 'ok' ? { kind: 'restored', keysRestored: result.keysRestored } : { kind: 'failed', reason: result.reason };
  }

  function openPicker(key: string): void {
    const projects = storageHistory.projectsIn(key).map((p): PickerProject =>
      ({id: p.id, name: p.name === '' ? 'Unreadable project' : p.name, readable: p.name !== ''}));
    picker.value = {key, projects};
  }

  function restoreProject(project: PickerProject): void {
    const open = picker.value;
    if (open === null) return;
    const result = storageHistory.restoreProject(open.key, project.id, restoredProjectName(project.name, new Date()));
    if (result.kind === 'restored') {
      logging.flash(`Added "${result.name}" to your saved projects.`);
      picker.value = null;
    } else {
      logging.flash(`Could not restore "${project.name}": ${result.reason}`);
    }
    refresh();
  }

  async function deleteRow(row: HistoryRowView): Promise<void> {
    const confirmed = await confirmPort.port.ask({
      title: row.kind === 'backup' ? 'Delete this backup?' : 'Delete this copy?',
      message: 'It is removed from this browser. Export it first if you may want it back. Continue?',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });
    if (!confirmed) return;
    const removed = removeOf(storageHistory, row);
    if (!removed) logging.flash('That is no longer there.');
    if (row.kind === 'backup' && picker.value?.key === row.key) picker.value = null;
    refresh();
  }

  async function emptyBin(): Promise<void> {
    const binned = projectBin.binned();
    if (binned.length === 0) return;
    const result = await emptyBinAfterAsking(projectBin, confirmPort.port, binned.length, binTotalSize(binned));
    if (result === 'done') logging.flash('Bin emptied.');
    else if (result === 'refused') logging.flash('There is no room for the backup taken first. Delete an old backup, or export and delete.');
    refresh();
  }

  async function deleteAllBackups(): Promise<void> {
    const confirmed = await confirmPort.port.ask({
      title: 'Delete all backups?',
      message: 'Every backup and kept copy is removed from this browser, including the one from before the last app update. '
        + 'Export any you may want first. Continue?',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });
    if (!confirmed) return;
    storageHistory.removeAllBackups();
    picker.value = null;
    logging.flash('All backups deleted.');
    refresh();
  }

  return {
    usedLine, usageRows, binHasProjects, emptyBin, deleteAllBackups,
    rows, totalSize, picker,
    keepRule: 'A backup of everything in this browser is made before anything is restored, repaired or deleted. '
      + 'The newest 3 are kept, plus the last one made before an app update; older ones are removed. '
      + 'Copies of records that were repaired or would not load stay until you delete them, or a save needs the room.',
    backUpNow, exportRow, restoreRow, openPicker, closePicker: () => { picker.value = null; }, restoreProject, deleteRow,
  };
}
