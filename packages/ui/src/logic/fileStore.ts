/**
 * `FileStore` — WHERE bytes go and come from (docs/design/FILEIO_API_PROPOSALS.md). Knows no
 * format. A thin adapter over `fileSave.ts`'s existing File System Access API + download-
 * fallback mechanics (`writeToHandle`, `saveTextAs`), which already implement this shape
 * closely enough to wrap directly — no rewrite of what already works.
 *
 * The port RETAINS the picked `FileSystemFileHandle` itself (session-only, lost on reload) —
 * `save()` writes in place to it, prompting only the first time; the caller never threads a
 * handle through its own calls. `openFileName()`/`forget()` are the caller's only way to
 * observe or drop it: `useDesignIO.ts`'s rename-retargets-the-file watch calls `forget()` when
 * the project name no longer matches the retained file's name, rather than reaching into this
 * module's own state.
 *
 * WRITE-side only: file READS reach the app through a plain `<input type="file">` element,
 * which hands `useDesignIO.ts` a `File` directly — no picker this module drives.
 */
import { saveTextAs, writeToHandle } from './fileSave.js';

export interface SaveResult {
  /** The name of the file actually written, when a handle now exists to retain. Null when
   *  this save was a plain download (no handle — Firefox/Safari, or the picker fell through)
   *  or the user cancelled. Never the raw `FileSystemFileHandle` — nothing outside this
   *  module needs the browser object, only the name it names. */
  name: string | null;
  /** True only when the user dismissed the picker — not an error, just a no-op. */
  cancelled: boolean;
  /** True only when bytes were WRITTEN AND THE STREAM CLOSED — i.e. the file exists on disk.
   *  False on the download fallback: the browser reports nothing back, so an unconfirmed save
   *  must never be treated as a save. */
  written: boolean;
}

export interface FileStore {
  /** Write to the RETAINED destination, prompting via `saveAs` the first time, or when the
   *  retained handle has gone stale (file moved/deleted, permission revoked). */
  save(
    bytes: Uint8Array<ArrayBuffer> | string, suggestedName: string, mime: string, description: string, ext: string,
  ): Promise<SaveResult>;
  /** Always prompt for a new destination; falls back to a plain download when unsupported.
   *  On success, RETAINS the new handle for the next `save()`. */
  saveAs(
    bytes: Uint8Array<ArrayBuffer> | string, suggestedName: string, mime: string, description: string, ext: string,
  ): Promise<SaveResult>;
  /** The retained handle's own file name, or null if none is retained. */
  openFileName(): string | null;
  /** Drop the retained handle — the next `save()` behaves like `saveAs()` again. For a caller
   *  whose project was renamed: browsers cannot rename a file on disk, so letting go of the
   *  stale handle and re-prompting on the next Save is the honest equivalent. */
  forget(): void;
}

export function createFileStore(): FileStore {
  let retained: FileSystemFileHandle | null = null;

  async function saveAs(
    bytes: Uint8Array<ArrayBuffer> | string, suggestedName: string, mime: string, description: string, ext: string,
  ): Promise<SaveResult> {
    const result = await saveTextAs(bytes, suggestedName, description, mime, ext);
    retained = result.handle;
    return { name: result.handle?.name ?? null, cancelled: result.cancelled, written: result.written };
  }

  async function save(
    bytes: Uint8Array<ArrayBuffer> | string, suggestedName: string, mime: string, description: string, ext: string,
  ): Promise<SaveResult> {
    if (!retained) return saveAs(bytes, suggestedName, mime, description, ext);
    try {
      await writeToHandle(retained, bytes);
      return { name: retained.name, cancelled: false, written: true };
    } catch {
      return saveAs(bytes, suggestedName, mime, description, ext);
    }
  }

  function openFileName(): string | null { return retained?.name ?? null; }
  function forget(): void { retained = null; }

  return { save, saveAs, openFileName, forget };
}
