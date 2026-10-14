/**
 * The Options "Storage history" page: every backup held in this browser as a row, with Export,
 * Restore, Delete and Back up now. The rows and what each action does are decided by the
 * persistence layer (`StorageHistory`); this only words them for the page, asks the user to
 * confirm, and keeps the list current. The page shows what it is handed.
 */
import {ref, type Ref} from 'vue';
import {formatByteSize, formatCountOf, formatDateTime, parseBasicUtc} from '@openisd/design/fields';
import type {HistoryRow, PreRepairCopy, PreRepairKind} from '@openisd/persistence';
import {useApp} from '../logic/app.js';

export interface StorageHistoryRowView {
  readonly key: string;
  /** When the app that wrote the data was built, as "5 Oct 2026, 23:32"; "Unknown build" when not recorded. */
  readonly build: string;
  readonly layout: string;
  /** "3 projects". */
  readonly projects: string;
  readonly size: string;
  /** When the backup was taken. */
  readonly takenAt: string;
  /** False: no Restore, and a line saying why. */
  readonly restorable: boolean;
  readonly note: string;
}

/** A copy a repair kept of a record it rewrote, as the page lists it. */
export interface PreRepairCopyView {
  readonly kind: PreRepairKind;
  /** What the copy holds, in plain words. */
  readonly label: string;
  readonly size: string;
}

export type RestoreOutcome =
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'restored'; readonly keysRestored: number }
  | { readonly kind: 'failed'; readonly reason: string };

export interface StorageHistoryAPI {
  readonly rows: Ref<readonly StorageHistoryRowView[]>;
  readonly copies: Ref<readonly PreRepairCopyView[]>;
  deleteCopy(copy: PreRepairCopyView): Promise<void>;
  backUpNow(): void;
  exportRow(key: string): void;
  restoreRow(key: string): Promise<RestoreOutcome>;
  deleteRow(key: string): Promise<void>;
}

function timeText(stamp: string, none: string): string {
  const at = parseBasicUtc(stamp);
  return at === null ? none : formatDateTime(at);
}

function viewOf(row: HistoryRow): StorageHistoryRowView {
  const note = !row.readable ? 'This backup cannot be read. You can still export or delete it.'
    : !row.restorable ? 'Saved by a newer OpenISD. Update the app to restore it.'
    : '';
  return {
    key: row.key,
    build: timeText(row.build, 'Unknown build'),
    layout: row.readable ? String(row.layout) : '–',
    projects: row.readable ? formatCountOf(row.projectCount, 'project') : '–',
    size: formatByteSize(row.size),
    takenAt: timeText(row.takenAt, 'Unknown'),
    restorable: row.restorable,
    note,
  };
}

function copyLabel(kind: PreRepairKind): string {
  switch (kind) {
    case 'projects': return 'Saved projects';
    case 'openSessions': return 'Open projects list';
    case 'quarantineSession': return 'Open projects that would not load';
    case 'state': return 'Last project (older store)';
    case 'view': return 'Window layout';
    case 'appSettings': return 'Options';
  }
}

const copyViewOf = (copy: PreRepairCopy): PreRepairCopyView => ({kind: copy.kind, label: copyLabel(copy.kind), size: formatByteSize(copy.size)});

export function useStorageHistory(): StorageHistoryAPI {
  const { storageHistory, designIO, confirmPort, logging } = useApp();
  const rows = ref<readonly StorageHistoryRowView[]>(storageHistory.rows().map(viewOf));
  const copies = ref<readonly PreRepairCopyView[]>(storageHistory.copies().map(copyViewOf));
  const refresh = (): void => {
    rows.value = storageHistory.rows().map(viewOf);
    copies.value = storageHistory.copies().map(copyViewOf);
  };

  function backUpNow(): void {
    const result = storageHistory.backUpNow();
    if (result.kind === 'taken') logging.flash('Backed up everything in this browser.');
    else if (result.kind === 'nothingToBackUp') logging.flash('Nothing is saved in this browser yet, so there is nothing to back up.');
    else logging.flash('There is no room in this browser for another backup. Delete an old one, or export and delete.');
    refresh();
  }

  function exportRow(key: string): void {
    const file = storageHistory.exportFile(key);
    if (file === null) { logging.flash('That backup is no longer there.'); refresh(); return; }
    designIO.saveStoredBackup(file);
  }

  async function restoreRow(key: string): Promise<RestoreOutcome> {
    const confirmed = await confirmPort.port.ask({
      title: 'Restore this backup?',
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

  async function deleteRow(key: string): Promise<void> {
    const confirmed = await confirmPort.port.ask({
      title: 'Delete this backup?',
      message: 'The backup is removed from this browser. Export it first if you may want it back. Continue?',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });
    if (!confirmed) return;
    if (!storageHistory.remove(key)) logging.flash('That backup is no longer there.');
    refresh();
  }

  async function deleteCopy(copy: PreRepairCopyView): Promise<void> {
    const confirmed = await confirmPort.port.ask({
      title: 'Delete this copy?',
      message: `The copy of "${copy.label}" kept before a repair is removed from this browser. Continue?`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });
    if (!confirmed) return;
    if (!storageHistory.removeCopy(copy.kind)) logging.flash('That copy is no longer there.');
    refresh();
  }

  return { rows, copies, backUpNow, exportRow, restoreRow, deleteRow, deleteCopy };
}
