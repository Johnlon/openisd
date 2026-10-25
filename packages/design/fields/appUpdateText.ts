/** What both skins say about a newer build (John, 16 Oct 2026). */
export const APP_UPDATE_TEXT = {
  offer: 'New version available',
  reload: 'Reload',
  later: 'Not now',
  forceRefresh: 'Force refresh',
  forceRefreshNote: 'Loads the newest version. Your projects stay.',
} as const;

/** The question before a reload that would lose unsaved edits. */
export const UNSAVED_RELOAD_CONFIRM = {
  title: 'Discard changes?',
  message: 'Reloading discards all unsaved changes.',
  confirmLabel: 'Reload',
  cancelLabel: 'Keep',
} as const;
