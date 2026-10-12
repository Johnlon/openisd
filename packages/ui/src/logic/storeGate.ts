/** The screen shown when the browser store cannot be opened as it is: it was written by a newer
 *  OpenISD, or it cannot be upgraded for lack of room. Nothing is loaded behind it. The user
 *  picks what happens to their data — restore a backup this version reads, read one without
 *  saving, or export everything — and the app starts once a store is open.
 *
 *  This module decides what the screen says; the component only shows it. */
import {shallowRef, type ShallowRef} from 'vue';
import {basicUtc, parseBasicUtc} from '@openisd/design/fields';
import {STORAGE_LAYOUT, type BackupInfo, type OpenStore, type StoreOpening} from '@openisd/persistence';

export interface GateBackupRow {
  readonly key: string;
  /** "Backup of 2026-10-12 21:30 (layout 1)". */
  readonly label: string;
}

export interface GateScreen {
  readonly title: string;
  readonly message: string;
  /** Backups this version can read; empty when none. */
  readonly backups: readonly GateBackupRow[];
}

type BlockedOpening = Exclude<StoreOpening, {kind: 'ready'}>;

export interface StoreGateDeps {
  readonly formatTime: (at: Date) => string;
  readonly download: (fileName: string, text: string) => void;
  readonly now: () => number;
  /** A store is open: start the app on it. */
  readonly onReady: (open: OpenStore) => void;
}

export interface StoreGateSession {
  readonly screen: ShallowRef<GateScreen>;
  /** Put this backup into the live store (the live store is backed up first). */
  restore(key: string): void;
  /** Run on this backup in memory; the live store is not touched. */
  readOnly(key: string): void;
  /** Download everything in this browser as it is. */
  exportEverything(): void;
}

function rowOf(info: BackupInfo, formatTime: (at: Date) => string): GateBackupRow {
  const taken = parseBasicUtc(info.takenAt);
  return {key: info.key, label: `Backup of ${taken === null ? info.takenAt : formatTime(taken)} (layout ${info.layout})`};
}

function screenOf(opening: BlockedOpening, formatTime: (at: Date) => string, note: string): GateScreen {
  switch (opening.kind) {
    case 'newer':
      return {
        title: 'This browser holds data from a newer OpenISD',
        message: `${note}This OpenISD reads storage layout ${STORAGE_LAYOUT}; the data here is layout ${opening.storeLayout}. Nothing has been changed. `
          + (opening.readable.length === 0
            ? 'There is no backup this OpenISD can read. Export everything to keep it safe, and open the newer OpenISD.'
            : 'Restore a backup this OpenISD can read, open one without saving, or export everything.'),
        backups: opening.readable.map(info => rowOf(info, formatTime)),
      };
    case 'blocked':
      return {
        title: 'Your saved data cannot be upgraded yet',
        message: opening.reason === 'noRoom'
          ? `${note}There is not enough room in this browser to back up your saved data before upgrading it. Nothing has been changed. `
            + 'Export everything, free some space, then reload.'
          : `${note}This OpenISD has no way to upgrade storage layout ${opening.storeLayout}. Nothing has been changed. Export everything to keep it safe.`,
        backups: [],
      };
  }
}

export function createStoreGateSession(first: BlockedOpening, deps: StoreGateDeps): StoreGateSession {
  let current = first;
  const screen = shallowRef(screenOf(current, deps.formatTime, ''));

  function follow(next: StoreOpening | null, failure: string): void {
    if (next !== null && next.kind === 'ready') { deps.onReady(next); return; }
    if (next !== null) current = next;
    screen.value = screenOf(current, deps.formatTime, failure);
  }

  return {
    screen,
    restore(key) {
      if (current.kind !== 'newer') return;
      follow(current.restore(key), 'That backup could not be restored. ');
    },
    readOnly(key) {
      if (current.kind !== 'newer') return;
      follow(current.readOnly(key), 'That backup could not be opened. ');
    },
    exportEverything() {
      deps.download(`openisd-everything-${basicUtc(deps.now())}.json`, current.exportRaw());
    },
  };
}
