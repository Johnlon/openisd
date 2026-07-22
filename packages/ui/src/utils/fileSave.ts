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
    return { handle: null, cancelled: false };
  }
  try {
    const handle = await globalThis.showSaveFilePicker({
      suggestedName,
      types: [{ description: 'OpenISD project', accept: { 'application/json': ['.json'] } }],
    });
    await writeToHandle(handle, text);
    return { handle, cancelled: false };
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') return { handle: null, cancelled: true };
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
    return { handle, cancelled: false };
  } catch {
    return saveProjectAs(text, suggestedName);
  }
}
