/**
 * Tells people that Cloud sync sends only SAVED versions (John, 18 Nov 2026, QO946.c244/c245:
 * "if cloud sync isn't enabled then don't tell user to save"; "ok do that"). Everything here is
 * for Cloud sync ON; with sync off nothing in this file is used and the app reads as it always did.
 * Texts, the 5-minute rule and the dialog's list live here, so the screens only show them.
 */
import type {SyncStatus} from './syncStatus.js';

/** How long a project must hold unsaved edits before the bar asks the user to save it. */
export const UNSAVED_ASK_AFTER_MS = 5 * 60 * 1000;

export const UNSAVED_SYNC_TEXT = {
  /** The Save button's tooltip while Cloud sync is on; it starts with "Save - " as the Save button's tooltip always did. */
  saveTooltip: 'Save - to send this version to your other devices',
  /** The Cloud sync dialog's list of open projects whose unsaved changes are not synced. */
  listHeading: 'Not on your other devices yet',
  listNote: 'Cloud sync sends saved versions only. These projects have unsaved changes.',
  listSave: 'Save',
  /** Shown in the list's place when no project holds unsaved changes, so the dialog keeps its size. */
  listEmpty: 'Every open project is saved.',
  /** The bar after 5 minutes of unsaved edits. */
  barText: 'Your changes are not on your other devices yet.',
  barSave: 'Save',
  barLater: 'Later',
} as const;

/** Cloud sync is on once the user has connected: every status but off. */
export function cloudSyncIsOn(status: SyncStatus): boolean {
  return status.kind !== 'off';
}

/** An open project holding unsaved changes: `id` identifies it, `name` is shown. */
export interface UnsavedProject {
  readonly id: string;
  readonly name: string;
}

/** One line of the dialog's list. */
export interface UnsavedSyncRow {
  readonly id: string;
  readonly name: string;
  readonly saveLabel: string;
  readonly saveAria: string;
}

/** The dialog's list, drawn with a fixed space whenever sync is on; null (nothing drawn) while sync is off. */
export interface UnsavedSyncList {
  readonly heading: string;
  readonly note: string;
  readonly rows: readonly UnsavedSyncRow[];
  /** The line shown when `rows` is empty. */
  readonly empty: string;
}

export function unsavedSyncList(syncOn: boolean, projects: readonly UnsavedProject[]): UnsavedSyncList | null {
  if (!syncOn) return null;
  return {
    heading: UNSAVED_SYNC_TEXT.listHeading,
    note: UNSAVED_SYNC_TEXT.listNote,
    empty: UNSAVED_SYNC_TEXT.listEmpty,
    rows: projects.map(p => ({id: p.id, name: p.name, saveLabel: UNSAVED_SYNC_TEXT.listSave, saveAria: `Save ${p.name}`})),
  };
}

/** The Save button's tooltip: the sync one while Cloud sync is on, otherwise `usual`, unchanged. */
export function saveTooltip(syncOn: boolean, usual: string): string {
  return syncOn ? UNSAVED_SYNC_TEXT.saveTooltip : usual;
}

/** The bar's content for one project. */
export interface UnsavedBar {
  readonly id: string;
  readonly text: string;
  readonly save: string;
  readonly later: string;
}

export function unsavedBarOf(project: UnsavedProject): UnsavedBar {
  return {id: project.id, text: UNSAVED_SYNC_TEXT.barText, save: UNSAVED_SYNC_TEXT.barSave, later: UNSAVED_SYNC_TEXT.barLater};
}
