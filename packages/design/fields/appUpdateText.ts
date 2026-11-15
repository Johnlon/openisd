/** What both skins say about a newer build (John, 16 Oct 2026). */
export const APP_UPDATE_TEXT = {
  offer: 'New version available',
  reload: 'Reload',
  later: 'Not now',
  forceRefresh: 'Force refresh',
  forceRefreshNote: 'Loads the newest version. Your projects stay.',
} as const;

/** What a reload really loses. Unsaved edits are NOT here: they live in the stored session and come back
 *  still unsaved, so reloading never loses them (T829, John 2026-11-15). These are the exceptions. */
export type ReloadLoss =
  /** Unsaved edits the browser's storage did not take (full, refused), so no session holds them. */
  | 'unstoredEdits'
  /** The app runs on a backup held in memory: nothing done to it is stored. */
  | 'readOnlyStore'
  /** Values typed in the open driver editor, not applied with OK. */
  | 'editorDraft'
  /** Values tried in the What-if panel, which is never stored. */
  | 'whatIf';

const RELOAD_LOSS_TEXT: Readonly<Record<ReloadLoss, string>> = {
  unstoredEdits: "Some of your unsaved changes could not be kept in this browser's storage, so reloading loses them.",
  readOnlyStore: 'This is a read-only backup, so reloading loses every change you made to it.',
  editorDraft: 'The values you typed in the driver editor are not applied yet, so reloading loses them.',
  whatIf: 'The values you are trying in What-if are only an experiment, so reloading loses them.',
};

/** The question before a reload that would lose something: it says exactly what. */
export function reloadLossConfirm(losses: readonly ReloadLoss[]) {
  return {
    title: 'Discard changes?',
    message: losses.map(loss => RELOAD_LOSS_TEXT[loss]).join(' '),
    confirmLabel: APP_UPDATE_TEXT.reload,
    cancelLabel: 'Keep',
  } as const;
}
