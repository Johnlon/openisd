/**
 * Design file I/O — Save/Save As the project (.openisd.json) to the filesystem, export
 * a WinISD .wpr project or a .wdr driver, copy a share link, import a .wdr/.json, and the
 * About text. Extracted from AppHeader so every shell's chrome (modern header, classic
 * toolbar, original toolbar) reuses ONE implementation — no duplication.
 *
 * Save/Save As write to a file the user picked via the File System Access API (Chromium),
 * retaining the handle so Save overwrites the SAME file; browsers without the API
 * (Firefox/Safari) fall back to a plain download. WPR/driver export and Share stay
 * one-way downloads/links — there is nothing to "overwrite" for those.
 *
 * The file name IS the project name (utils/projectFile.ts): picking a file on Save As
 * renames the project to match, and opening a file names the project after the file it came
 * from — the name stored inside the file never contradicts the name on disk.
 */
import { ref, watch } from 'vue';
import {
  state, driver, driverRaw, driverJSON, getDriverModel, setDriverFromWdr, applyState,
} from '../store.js';
import { serialize, stateToUrl, download } from '../utils/persist.js';
import { flash } from '../utils/flash.js';
import { saveProject as fsSaveProject, saveProjectAs as fsSaveProjectAs } from '../utils/fileSave.js';
import { projectNameFromFilename, projectFilename, copyOfName } from '../utils/projectFile.js';
import { buildWprInput } from '../utils/wprMapping.js';
import { toWpr } from '@openisd/winisd';
import type { SerializedState } from '../types.js';

function sanitizeFilename(name: string | undefined): string {
  return (name || 'design').replace(/[^\w.-]+/g, '_');
}

// MODULE-scoped, not per-composable-call: every shell's Save button and the shared
// ExportMenu each call useDesignIO(), and they must agree on which file is open. A ref
// created inside the function gave each caller its own handle, so Save As in the menu and
// Save in the toolbar tracked different files. Session-only either way — the File System
// Access API does not persist handles across a page load.
const fileHandle = ref<FileSystemFileHandle | null>(null);

// Renaming the project retargets the file. Browsers cannot rename a file on disk, so the
// honest equivalent is to let go of the handle: the next Save prompts for a location, with
// the new name already filled in. Without this, renaming would keep silently overwriting the
// file that still carries the OLD name — the one thing the name↔file rule forbids.
watch(() => state.project.name, (name) => {
  const open = fileHandle.value;
  if (open?.name && projectNameFromFilename(open.name) !== name) fileHandle.value = null;
});

export function useDesignIO() {
  function projectJsonText(): string {
    return JSON.stringify(serialize(state, driverJSON.value, state.compare), null, 2);
  }

  /** Adopt the picked file's name as the project name — the file names the project. */
  function adoptFileName(handle: FileSystemFileHandle | null, fallbackFilename: string): void {
    state.project.name = projectNameFromFilename(handle?.name || fallbackFilename);
  }

  /** Save — overwrites the previously-picked file in place; first save behaves like Save As. */
  async function saveProject(): Promise<void> {
    const suggested = projectFilename(state.project.name);
    const result = await fsSaveProject(projectJsonText(), suggested, fileHandle.value);
    if (result.cancelled) return;
    fileHandle.value = result.handle;
    adoptFileName(result.handle, suggested);
    flash(result.handle ? 'Project saved' : 'Project downloaded');
  }

  /**
   * Save As — always prompts for a new file location. With a file already open this is
   * making a COPY of it, so the suggested name is "Copy of <project>": accepting the default
   * gives a genuinely new project rather than a second file claiming the same name.
   */
  async function saveProjectAs(): Promise<void> {
    const suggested = projectFilename(fileHandle.value ? copyOfName(state.project.name) : state.project.name);
    const result = await fsSaveProjectAs(projectJsonText(), suggested);
    if (result.cancelled) return;
    fileHandle.value = result.handle;
    adoptFileName(result.handle, suggested);
    flash(result.handle ? 'Project saved' : 'Project downloaded');
  }

  async function shareLink(): Promise<void> {
    const url = await stateToUrl(serialize(state, driverJSON.value, state.compare));
    try { history.replaceState(null, '', url); } catch { /* replaceState can throw on some file:// origins — non-fatal */ }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(
        () => flash('Share link copied to clipboard'),
        () => prompt('Copy this share link:', url));
    } else { prompt('Copy this share link:', url); }
  }

  function exportWdr(): void {
    // The ADT's own toWdr is lossless — carried fields + live ParState provenance.
    download(sanitizeFilename(driverRaw.value.name) + '.wdr', getDriverModel().toWdr(), 'text/plain');
  }

  /** Export the current design as a WinISD .wpr project (WINISD_WPR_FILE_SCHEMA.md). */
  function exportWpr(): void {
    const driverSection = getDriverModel().toWdr();
    const input = buildWprInput(state.box, state.P, driver.value, driverSection, state.project, new Date());
    download(sanitizeFilename(driverRaw.value.name) + '.wpr', toWpr(input), 'text/plain');
  }

  /** Load a driver/design from a picked File (.wdr or an OpenISD .json project). */
  function importFile(f: File): void {
    const rd = new FileReader();
    const isWdr = /\.wdr$/i.test(f.name);
    rd.onload = () => {
      const text = rd.result as string;
      try {
        if (isWdr || /^\s*\[Driver\]/.test(text)) {
          setDriverFromWdr(text);
        } else {
          // The store's applyState — the SAME loader the hash and localStorage paths use, so
          // an opened project restores everything a saved one holds, not a subset of it.
          applyState(JSON.parse(text) as SerializedState);
          // The file names the project, overriding whatever name the file's own body carries:
          // a project renamed by renaming its file must show the name the user can see on disk.
          state.project.name = projectNameFromFilename(f.name);
        }
        // The design came from a file the browser only handed us as a File — a read-only
        // snapshot, not a writable handle — so Save must prompt for a location.
        fileHandle.value = null;
        flash('Opened ' + f.name);
      } catch (err) { alert('Could not read "' + f.name + '": ' + (err as Error).message); }
    };
    rd.readAsText(f);
  }

  function about(): void {
    alert(`OpenISD — open loudspeaker enclosure simulator\nA community-owned tool modelling the Thiele/Small electro-mechano-acoustical system.\n\nBox types: sealed, vented, 4th-order bandpass, passive radiator\nCurves: SPL, excursion, port velocity, group delay, impedance, max SPL/power\n\nSee docs/MATHS.md for the circuit model and equations.`);
  }

  return { saveProject, saveProjectAs, shareLink, exportWdr, exportWpr, importFile, about };
}
