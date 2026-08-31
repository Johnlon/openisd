// COMMENTED OUT — John Lonergan, 2026-08-31: "comment out all persistence methods too except for
// building driver from the bundle of drivers and pr's - no repos needed at the moment".
//
// What survives in this package is ONLY the bundle -> domain construction:
// `driverRepo.ts`'s bundled-entry seam and `bundledPassiveRadiatorRepo.ts`. Storage, My Drivers,
// projects, prefs and view state are all inert. Restore a piece when the app needs it again;
// until then it is not carried through the packages/model -> packages/design migration
// (docs/plans/PLAN_DELETE_PACKAGES_MODEL.md).

// /**
//  * Filesystem write mechanics — File System Access API where supported (Chromium:
//  * Chrome/Edge/Opera); Firefox/Safari lack the API entirely, so writes fall back to a plain
//  * download (the browser, not the user, decides the destination — there is no in-place
//  * overwrite in that fallback, only a fresh file each time).
//  *
//  * Handle RETENTION lives in `fileStorage.ts` (the `FileStorage` port), session-only — this
//  * module only writes: `writeToHandle` for an already-retained handle, `saveTextAs` for a fresh
//  * prompt-and-write. Wrapped in `createFileSave()` for the same reason every module under
//  * `persistence/` is: a consumer takes it as an injected collaborator, never a ready-made import.
//  */
//
// // Not yet in TS's lib.dom.d.ts (Chromium-only File System Access API) — FileSystemFileHandle
// // itself IS declared there; only the global entry point is missing.
// declare global {
//   interface SaveFilePickerAcceptType { description?: string; accept: Record<string, string[]> }
//   interface SaveFilePickerOptions { suggestedName?: string; types?: SaveFilePickerAcceptType[] }
//   function showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
// }
//
// export interface SaveResult {
//   /** The handle to retain for a subsequent in-place Save, or null if this save was a plain
//    *  download (no handle exists) or the user cancelled the picker. */
//   handle: FileSystemFileHandle | null;
//   /** True only when the user dismissed the picker — not an error, just a no-op. */
//   cancelled: boolean;
//   /**
//    * True only when bytes were WRITTEN AND THE STREAM CLOSED — i.e. the file exists on disk.
//    *
//    * False on the download fallback (Firefox/Safari): `<a download>.click()` returns
//    * immediately and the browser reports nothing back, so we cannot know whether a file was
//    * written, where it went, or whether the user cancelled the download. A caller must not
//    * treat an unconfirmed save as a save — "saved" means written to disk, not attempted.
//    */
//   written: boolean;
// }
//
// export interface FileSave {
//   /** `body` is BYTES for any format with its own encoding — a `.wdr`/`.wpr` newline sentinel is
//    *  one byte that UTF-8 cannot express, so those callers encode first and hand the bytes over. */
//   download(name: string, body: string | Uint8Array<ArrayBuffer>, mime?: string): void;
//   /** Writes through an ALREADY-RETAINED handle — `fileStorage.ts`'s `FileStorage.save()` uses
//    *  this for the same mechanics `saveTextAs` uses internally, rather than a second
//    *  implementation. */
//   writeToHandle(handle: FileSystemFileHandle, text: string | Uint8Array<ArrayBuffer>): Promise<void>;
//   /**
//    * Save arbitrary text through the SYSTEM save dialog — the user picks the folder and the
//    * final name, exactly as a desktop app would. Falls back to a plain download on browsers
//    * without the File System Access API (Firefox/Safari), where the browser chooses the
//    * destination and there is no dialog to offer.
//    *
//    * Retains no handle itself — the caller (`fileStorage.ts`) decides whether the returned
//    * handle is worth keeping for a later in-place write.
//    */
//   saveTextAs(
//     text: string | Uint8Array<ArrayBuffer>, suggestedName: string, description: string, mime: string, ext: string,
//   ): Promise<SaveResult>;
// }
//
// function fileSystemAccessSupported(): boolean {
//   return typeof (globalThis as { showSaveFilePicker?: unknown }).showSaveFilePicker === 'function';
// }
//
// export function createFileSave(): FileSave {
//   function download(name: string, body: string | Uint8Array<ArrayBuffer>, mime?: string): void {
//     const a = document.createElement('a');
//     a.href = URL.createObjectURL(new Blob([body], { type: mime || 'text/plain' }));
//     a.download = name; a.click();
//   }
//
//   async function writeToHandle(handle: FileSystemFileHandle, text: string | Uint8Array<ArrayBuffer>): Promise<void> {
//     const stream = await handle.createWritable();
//     await stream.write(text);
//     await stream.close();
//   }
//
//   async function saveTextAs(
//     text: string | Uint8Array<ArrayBuffer>, suggestedName: string, description: string, mime: string, ext: string,
//   ): Promise<SaveResult> {
//     if (!fileSystemAccessSupported()) {
//       download(suggestedName, text, mime);
//       return { handle: null, cancelled: false, written: false };   // triggered, not confirmed
//     }
//     try {
//       const handle = await globalThis.showSaveFilePicker({
//         suggestedName,
//         types: [{ description, accept: { [mime]: [ext] } }],
//       });
//       await writeToHandle(handle, text);
//       return { handle, cancelled: false, written: true };
//     } catch (err) {
//       if ((err as Error)?.name === 'AbortError') return { handle: null, cancelled: true, written: false };
//       throw err;
//     }
//   }
//
//   return { download, writeToHandle, saveTextAs };
// }
//