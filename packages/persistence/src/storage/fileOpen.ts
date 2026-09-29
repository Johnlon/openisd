/**
 * Filesystem read prompt — the File System Access API's open dialog where supported (Chromium:
 * Chrome/Edge/Opera). Unlike an `<input type="file" accept>`, whose filter the browser names
 * from the OS file-type registry, this dialog's filter carries the caller's own description.
 * Firefox/Safari lack the API; `pickFile` answers `unsupported` and the caller falls back to its
 * own file input. Wrapped in `createFileOpen()` so a consumer takes it as an injected
 * collaborator, never a ready-made import.
 */

/** One named filter in the open dialog: `accept` maps a MIME type to its extensions (with dot). */
export interface FilePickerFilter {
  description: string;
  accept: Record<string, string[]>;
}

// Not yet in TS's lib.dom.d.ts (Chromium-only File System Access API).
declare global {
  interface OpenFilePickerOptions { types?: FilePickerFilter[]; multiple?: false }
  function showOpenFilePicker(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>;
}

export type FilePick =
  | { kind: 'picked'; file: File }
  | { kind: 'cancelled' }
  | { kind: 'unsupported' };

export interface FileOpen {
  /** Prompts for one file through the system open dialog, filtered to `filter`. */
  pickFile(filter: FilePickerFilter): Promise<FilePick>;
}

export function createFileOpen(): FileOpen {
  async function pickFile(filter: FilePickerFilter): Promise<FilePick> {
    if (!('showOpenFilePicker' in globalThis) || typeof globalThis.showOpenFilePicker !== 'function') {
      return { kind: 'unsupported' };
    }
    try {
      const [handle] = await globalThis.showOpenFilePicker({ types: [filter], multiple: false });
      if (handle === undefined) return { kind: 'cancelled' };
      return { kind: 'picked', file: await handle.getFile() };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return { kind: 'cancelled' };
      throw err;
    }
  }

  return { pickFile };
}
