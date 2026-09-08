import { stringify } from 'yaml';
import { openIsdDriverToWinIsdDriver, openIsdProjectToWinIsdProject, winIsdProjectToOpenIsdProject, winIsdDriverTextToOpenIsdDriver, WinISDProject, WinISDDriver } from '@openisd/design/winisd';
import { engine } from './appState.js';
/**
 * Design file I/O orchestration — Save/Save As the project (.openisd.json) to the filesystem,
 * export a WinISD .wpr project or a .wdr driver, copy a share link, import a .wdr/.wpr/.owdr/
 * JSON file, and the About text. Lives in a composable, not in the shell, so the toolbar and
 * the export menu reuse ONE implementation — no duplication.
 *
 * This file is ORCHESTRATION ONLY: filename bookkeeping and flashing messages, calling the
 * FOCUSED PROJECT's own file-IO methods (`.exportDriverWdr()`/`.exportWpr()`/`.importWpr()`/…,
 * QO78: file IO lives in the domain module that owns what it reads/writes)
 * and the injected `FileStorage` (WHERE bytes go AND the retained file handle, `fileStorage.ts`).
 * It holds no driver value in any form — the driver crosses this file only as the managed
 * layer's serialised text (`persistedDriver`, QO73) or as opaque export bytes.
 *
 * Save/Save As write to a file the user picked via the File System Access API (Chromium),
 * retaining the handle so Save overwrites the SAME file; browsers without the API
 * (Firefox/Safari) fall back to a plain download. WPR/driver export and Share stay
 * one-way downloads/links — there is nothing to "overwrite" for those.
 *
 * The file name IS the project name (@openisd/persistence projectFile.ts): picking a file on Save As
 * renames the project to match, and opening a file names the project after the file it came
 * from — the name stored inside the file never contradicts the name on disk.
 */
import { watch } from 'vue';
import {
  state, driverName, requireFocusedProject,
  markProjectSaved, applyLoadedProject, curvesData, currentProject, currentViewSnapshot,
} from './appState.js';
import { presentationState } from './presentationState.js';
import { parseLossMode } from './environment.js';
import { createFileSave, projectNameFromFilename, projectFilename, copyOfName, type FileStorage, type ProjectRepo, type FileNaming } from '@openisd/persistence';
import { setShareUrl } from './urlAppState.js';
import type { Logging } from '../logging/flash.js';
import { readDriverFileText } from './driverFileText.js';
import { DriverFileFormat, ProjectFileFormat, formatOf, sniff } from '../fileFormat.js';

declare const __BUILD_DATETIME__: string;

function sanitizeFilename(name: string | undefined): string {
  return (name || 'design').replace(/[^\w.-]+/g, '_');
}

// Closing the Tune panel after a save/export/share is UI cleanup, not state — the design itself
// is already whatever the panel last wrote, so there is nothing else to settle here.
function closeTunePanelAfterIO(): void {
  presentationState.editDriver = false;
}

export interface DesignIO {
  saveProject(): Promise<boolean>;
  saveProjectAs(): Promise<void>;
  shareLink(): Promise<void>;
  exportWdr(): void;
  exportWpr(): void;
  exportOwdr(): void;
  importFile(f: File): void;
  about(): void;
}

/**
 * Built ONCE by the composition root and handed to every consumer. Every shell's Save button
 * and the shared ExportMenu must agree on which file is open; a second construction would
 * give each its own `FileStorage` (and so its own retained handle), so Save As in the menu and
 * Save in the toolbar would track different files. Session-only either way — the File System
 * Access API does not persist handles across a page load.
 */
export function createApplicationIO(deps: { logging: Logging; fileStorage: FileStorage; projectRepo: ProjectRepo }): DesignIO {
  const flash = (msg: string) => deps.logging.flash(msg);
  const { download } = createFileSave();

  // Renaming the project retargets the file. Browsers cannot rename a file on disk, so the
  // honest equivalent is to let go of the retained handle: the next Save prompts for a
  // location, with the new name already filled in. Without this, renaming would keep silently
  // overwriting the file that still carries the OLD name — the one thing the name↔file rule
  // forbids. `FileStorage` retains the handle itself; this only asks it to forget.
  watch(() => state.project.name, (name) => {
    const openName = deps.fileStorage.openFileName();
    if (openName && projectNameFromFilename(openName) !== name) deps.fileStorage.forget();
  });

  function owprNaming(suggestedName: string): FileNaming {
    return { suggestedName, mime: ProjectFileFormat.Owpr.mime, label: ProjectFileFormat.Owpr.label, ext: '.' + ProjectFileFormat.Owpr.value };
  }

  /** Adopt the picked file's name as the project name — the file names the project. */
  function adoptFileName(fileName: string | null, fallbackFilename: string): void {
    state.project.name = projectNameFromFilename(fileName || fallbackFilename);
  }

  /** Save — overwrites the previously-picked file in place; first save behaves like Save As. */
  /** Returns true when the project was written, false when the user cancelled the file
   *  dialog — a caller doing "save, then close" must not close on a cancelled save. */
  async function saveProject(): Promise<boolean> {
    closeTunePanelAfterIO();
    const suggested = projectFilename(state.project.name);
    const result = await deps.projectRepo.saveToFile(currentProject(), owprNaming(suggested));
    if (result.cancelled) return false;
    adoptFileName(result.name, suggested);
    // SAVED means written to disk. Only a write that completed and closed proves that, so
    // only that clears the unsaved state. The download fallback (Firefox/Safari) hands the
    // bytes to the browser and hears nothing back — claiming "saved" there would be a guess
    // presented as a fact, and the user would lose work believing it was safe.
    if (!result.written) {
      flash('Project downloaded — the browser cannot confirm it was written, so it is still marked unsaved');
      return false;
    }
    markProjectSaved();
    flash('Project saved');
    return true;
  }

  /**
   * Save As — always prompts for a new file location. With a file already open this is
   * making a COPY of it, so the suggested name is "Copy of <project>": accepting the default
   * gives a genuinely new project rather than a second file claiming the same name.
   */
  async function saveProjectAs(): Promise<void> {
    closeTunePanelAfterIO();
    const hadOpenFile = deps.fileStorage.openFileName() != null;
    const suggested = projectFilename(hadOpenFile ? copyOfName(state.project.name) : state.project.name);
    const result = await deps.projectRepo.saveToNewFile(currentProject(), owprNaming(suggested));
    if (result.cancelled) return;
    adoptFileName(result.name, suggested);
    if (!result.written) {
      flash('Project downloaded — the browser cannot confirm it was written, so it is still marked unsaved');
      return;
    }
    markProjectSaved();
    flash('Project saved');
  }

  // shareLink() carries the WHOLE app state (human ruling 2026-08-14, persist.ts's
  // stateToUrl docstring) — chart cursor, panel layout, unit tokens — not just the domain
  // project `ManagedProject.encodeShareLink` models. It therefore calls the project
  // repo's `stateToUrl` rather than the managed method, whose share-link pair is scoped to
  // the project record alone (a narrower, domain-only link for other consumers).
  async function shareLink(): Promise<void> {
    const url = await deps.projectRepo.stateToUrl(currentProject(), currentViewSnapshot());
    setShareUrl(url);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(
        () => flash('Share link copied to clipboard'),
        () => prompt('Copy this share link:', url));
    } else { prompt('Copy this share link:', url); }
  }

  function exportWdr(): void {
    closeTunePanelAfterIO();
    const p = requireFocusedProject();
    const errors: any[] = [];
    const wd = openIsdDriverToWinIsdDriver(p.driver, engine, errors);
    if (!wd) { flash(`Cannot export .wdr: ${errors[0]?.message ?? 'incomplete'}`); return; }
    const bytes = new TextEncoder().encode(wd.toWdrIni());
    download(sanitizeFilename(driverName.value) + '.wdr', bytes, DriverFileFormat.Wdr.mime);
  }

  function exportOwdr(): void {
    closeTunePanelAfterIO();
    const p = requireFocusedProject();
    const txt = stringify(p.driver.toOpenIsdDeviceJson());
    const bytes = new TextEncoder().encode(txt);
    download(sanitizeFilename(driverName.value) + '.owdr', bytes, DriverFileFormat.Owdr.mime);
  }

  /** Export the current design as a WinISD .wpr project (WINISD_WPR_FILE_SCHEMA.md). The
   *  managed layer is the ONE `.wpr` writer; this supplies the one thing only the live sweep
   *  pipeline has — the current swept impedance curve, for the sealed-box resonance
   *  refinement — and the download plumbing. */
  function exportWpr(): void {
    closeTunePanelAfterIO();
    const p = requireFocusedProject();
    const { value: wp, errors } = openIsdProjectToWinIsdProject(p, engine);
    if (!wp) { flash(`Cannot export .wpr: ${errors[0]?.message ?? 'incomplete'}`); return; }
    const bytes = new TextEncoder().encode(wp.toWpr());
    download(sanitizeFilename(driverName.value) + '.wpr', bytes, ProjectFileFormat.Wpr.mime);
  }

  /** Load a driver/design from a picked File. */
  function importFile(f: File): void {
    void readDriverFileText(f).then(({ text }) => {
      try {
        const bytes = new TextEncoder().encode(text);
        const format = formatOf(f.name) ?? sniff(bytes);

        if (format === DriverFileFormat.Wdr) {
          const { value: driver, errors } = winIsdDriverTextToOpenIsdDriver(text, engine);
          if (!driver) throw new Error(errors[0]?.message ?? 'could not read .wdr');
          requireFocusedProject().setDriver(driver);
        } else if (format === ProjectFileFormat.Wpr) {
          const { value: loadedProj, errors } = winIsdProjectToOpenIsdProject(text, engine);
          if (!loadedProj) throw new Error(errors[0]?.message ?? 'could not read .wpr');
          applyLoadedProject(loadedProj);
          state.project.name = projectNameFromFilename(f.name);
        } else if (format === DriverFileFormat.Owdr) {
          requireFocusedProject().setDriver(winIsdDriverTextToOpenIsdDriver(text, engine).value as any);
        } else if (format === ProjectFileFormat.Owpr || /^\s*\{/.test(text)) {
          if (sniff(bytes) === DriverFileFormat.Owdr) {
            requireFocusedProject().setDriver(winIsdDriverTextToOpenIsdDriver(text, engine).value as any);
          } else {
            const upgraded = deps.projectRepo.readProjectText(text);
            if (!upgraded) throw new Error('the file could not be brought to the current schema');
            applyLoadedProject(upgraded as any);
            state.project.name = projectNameFromFilename(f.name);
          }
        } else {
          throw new Error('Unsupported or unrecognized file format');
        }
        deps.fileStorage.forget();
        flash('Opened ' + f.name);
      } catch (err) { alert('Could not read "' + f.name + '": ' + (err instanceof Error ? err.message : String(err))); }
    }, (err: Error) => { alert('Could not read "' + f.name + '": ' + err.message); });
  }

  function about(): void {
    alert(`OpenISD — opensource interactive speaker designer\nA community-owned tool modelling the Thiele/Small electro-mechano-acoustical system.\n\nBox types: sealed, vented, 4th-order bandpass, passive radiator\nCurves: SPL, excursion, port velocity, group delay, impedance, max SPL/power\n\nSee docs/MATHS.md for the circuit model and equations.\n\nBuild: ${__BUILD_DATETIME__}`);
  }

  return { saveProject, saveProjectAs, shareLink, exportWdr, exportWpr, exportOwdr, importFile, about };
}
