/**
 * The Options dialog's "Backup" section — download every persisted key as one JSON file, or
 * restore one. Acts immediately on click, unlike the rest of the dialog's General tab: there
 * is no draft to apply later, and a restore replaces browser storage wholesale, which the
 * dialog's own Cancel could never plausibly undo.
 *
 * Thin orchestration only: the actual read/write lives in `DesignIO.exportBackup`/`importBackup`
 * (`useApplicationIO.ts`, the one place in `ui/logic` allowed to reach into `@openisd/persistence` —
 * a hook never imports that package directly, QO80's layer-edge matrix).
 */
import {useApp} from '../logic/app.js';

export interface BackupSettingsAPI {
  /** Download a snapshot of every persisted key as one JSON file. */
  downloadBackup(): void;
  /** Restore from a previously-downloaded backup file. Caller confirms with the user and
   *  reloads the page on success — this only writes storage. */
  restoreFromFile(file: File): Promise<{ ok: true; keysRestored: number } | { ok: false; reason: string }>;
}

export function useBackupSettings(): BackupSettingsAPI {
  const { designIO } = useApp();

  function downloadBackup(): void {
    designIO.exportBackup();
  }

  async function restoreFromFile(file: File): Promise<{ ok: true; keysRestored: number } | { ok: false; reason: string }> {
    const text = await file.text();
    const result = designIO.importBackup(text);
    return result.kind === 'invalid' ? { ok: false, reason: result.reason } : { ok: true, keysRestored: result.keysRestored };
  }

  return { downloadBackup, restoreFromFile };
}
