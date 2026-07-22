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
 */
import { ref } from 'vue';
import {
  state, driver, driverRaw, driverJSON, getDriverModel, setDriverFromWdr, setDriverFromSerialized,
} from '../store.js';
import { serialize, stateToUrl, download } from '../utils/persist.js';
import { flash } from '../utils/flash.js';
import { saveProject as fsSaveProject, saveProjectAs as fsSaveProjectAs } from '../utils/fileSave.js';
import { buildWprInput } from '../utils/wprMapping.js';
import { toWpr } from '@openisd/winisd';

function sanitizeFilename(name: string | undefined): string {
  return (name || 'design').replace(/[^\w.-]+/g, '_');
}

export function useDesignIO() {
  // Session-only — the retained handle for in-place Save. Resets on reload (by design;
  // the File System Access API doesn't persist handles across page loads on its own).
  const fileHandle = ref<FileSystemFileHandle | null>(null);

  function projectJsonText(): string {
    return JSON.stringify(serialize(state, driverJSON.value, state.compare), null, 2);
  }

  function suggestedProjectName(): string {
    return sanitizeFilename(state.project.name) + '.openisd.json';
  }

  /** Save — overwrites the previously-picked file in place; first save behaves like Save As. */
  async function saveProject(): Promise<void> {
    const result = await fsSaveProject(projectJsonText(), suggestedProjectName(), fileHandle.value);
    if (result.cancelled) return;
    fileHandle.value = result.handle;
    flash(result.handle ? 'Project saved' : 'Project downloaded');
  }

  /** Save As — always prompts for a new file location. */
  async function saveProjectAs(): Promise<void> {
    const result = await fsSaveProjectAs(projectJsonText(), suggestedProjectName());
    if (result.cancelled) return;
    fileHandle.value = result.handle;
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
          const o = JSON.parse(text);
          if (o.driver) setDriverFromSerialized(o.driver);
          if (o.box) state.box = o.box;
          if (o.P) Object.assign(state.P, o.P);
          if (Array.isArray(o.graphs) && o.graphs.length) state.graphs = o.graphs;
        }
        // A freshly-loaded design has no relationship to any previously-picked save file.
        fileHandle.value = null;
      } catch (err) { alert('Could not read "' + f.name + '": ' + (err as Error).message); }
    };
    rd.readAsText(f);
  }

  function about(): void {
    alert(`OpenISD — open loudspeaker enclosure simulator\nA community-owned tool modelling the Thiele/Small electro-mechano-acoustical system.\n\nBox types: sealed, vented, 4th-order bandpass, passive radiator\nCurves: SPL, excursion, port velocity, group delay, impedance, max SPL/power\n\nSee docs/MATHS.md for the circuit model and equations.`);
  }

  return { saveProject, saveProjectAs, shareLink, exportWdr, exportWpr, importFile, about };
}
