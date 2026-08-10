/**
 * Filesystem save for the OpenISD project (.openisd.json) — File System Access API where
 * supported (Chromium: Chrome/Edge/Opera), so Save writes back to the SAME file the user
 * picked and Save As lets them pick a new one; Firefox/Safari lack the API entirely, so
 * they fall back to a plain download (the browser, not the user, decides the destination —
 * there is no in-place overwrite in that fallback, only a fresh file each time).
 *
 * The retained `FileSystemFileHandle` is session-only (kept in a Vue ref by the caller,
 * useDesignIO.ts) — this module never persists it across a reload.
 */
import { download } from './persist.js';

// Not yet in TS's lib.dom.d.ts (Chromium-only File System Access API) — FileSystemFileHandle
// itself IS declared there; only the global entry point is missing.
declare global {
  interface SaveFilePickerAcceptType { description?: string; accept: Record<string, string[]> }
  interface SaveFilePickerOptions { suggestedName?: string; types?: SaveFilePickerAcceptType[] }
  function showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
}

export interface SaveResult {
  /** The handle to retain for a subsequent in-place Save, or null if this save was a plain
   *  download (no handle exists) or the user cancelled the picker. */
  handle: FileSystemFileHandle | null;
  /** True only when the user dismissed the picker — not an error, just a no-op. */
  cancelled: boolean;
  /**
   * True only when bytes were WRITTEN AND THE STREAM CLOSED — i.e. the file exists on disk.
   *
   * False on the download fallback (Firefox/Safari): `<a download>.click()` returns
   * immediately and the browser reports nothing back, so we cannot know whether a file was
   * written, where it went, or whether the user cancelled the download. A caller must not
   * treat an unconfirmed save as a save — "saved" means written to disk, not attempted.
   */
  written: boolean;
}

export function fileSystemAccessSupported(): boolean {
  return typeof (globalThis as { showSaveFilePicker?: unknown }).showSaveFilePicker === 'function';
}

async function writeToHandle(handle: FileSystemFileHandle, text: string): Promise<void> {
  const stream = await handle.createWritable();
  await stream.write(text);
  await stream.close();
}

/** Save As — always prompts for a NEW location; falls back to a download when unsupported. */
export async function saveProjectAs(text: string, suggestedName: string): Promise<SaveResult> {
  if (!fileSystemAccessSupported()) {
    download(suggestedName, text, 'application/json');
    return { handle: null, cancelled: false, written: false };   // triggered, not confirmed
  }
  try {
    const handle = await globalThis.showSaveFilePicker({
      suggestedName,
      types: [{ description: 'OpenISD project (*.owpr)', accept: { 'application/json': ['.owpr'] } }],
    });
    await writeToHandle(handle, text);
    return { handle, cancelled: false, written: true };
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') return { handle: null, cancelled: true, written: false };
    throw err;
  }
}

/**
 * Save — writes in place to a previously-picked handle. With no handle yet (first save in
 * the session, or the browser lacks the API), it behaves exactly like Save As. If the
 * retained handle has gone stale (file moved/deleted, permission revoked), it re-prompts
 * via Save As rather than silently failing.
 */
export async function saveProject(
  text: string, suggestedName: string, handle: FileSystemFileHandle | null,
): Promise<SaveResult> {
  if (!handle) return saveProjectAs(text, suggestedName);
  try {
    await writeToHandle(handle, text);
    return { handle, cancelled: false, written: true };
  } catch {
    return saveProjectAs(text, suggestedName);
  }
}

/**
 * Save arbitrary text through the SYSTEM save dialog — the user picks the folder and the
 * final name, exactly as a desktop app would. Falls back to a plain download on browsers
 * without the File System Access API (Firefox/Safari), where the browser chooses the
 * destination and there is no dialog to offer.
 *
 * Distinct from saveProjectAs: this retains no handle, because a driver export is a one-way
 * write with nothing to overwrite in place later.
 */
export async function saveTextAs(
  text: string, suggestedName: string, description: string, mime: string, ext: string,
): Promise<SaveResult> {
  if (!fileSystemAccessSupported()) {
    download(suggestedName, text, mime);
    return { handle: null, cancelled: false, written: false };   // triggered, not confirmed
  }
  try {
    const handle = await globalThis.showSaveFilePicker({
      suggestedName,
      types: [{ description, accept: { [mime]: [ext] } }],
    });
    await writeToHandle(handle, text);
    return { handle, cancelled: false, written: true };
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') return { handle: null, cancelled: true, written: false };
    throw err;
  }
}
