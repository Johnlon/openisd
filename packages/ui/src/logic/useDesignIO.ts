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
export function createDesignIO(deps: { logging: Logging; fileStorage: FileStorage; projectRepo: ProjectRepo }): DesignIO {
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
    const { value: bytes, errors } = requireFocusedProject().exportDriverWdr();
    if (!bytes) { flash(`Cannot export .wdr: ${errors[0]?.message ?? 'the driver is incomplete'}`); return; }
    download(sanitizeFilename(driverName.value) + '.wdr', bytes, DriverFileFormat.Wdr.mime);
  }

  function exportOwdr(): void {
    closeTunePanelAfterIO();
    // Always succeeds: a driver is always present (docs/design/DRIVER_NON_NULL_INVARIANT.md)
    // and .owdr is the record's own JSON, always representable.
    const bytes = requireFocusedProject().exportDriverOwdr();
    download(sanitizeFilename(driverName.value) + '.owdr', bytes, DriverFileFormat.Owdr.mime);
  }

  /** Export the current design as a WinISD .wpr project (WINISD_WPR_FILE_SCHEMA.md). The
   *  managed layer is the ONE `.wpr` writer; this supplies the one thing only the live sweep
   *  pipeline has — the current swept impedance curve, for the sealed-box resonance
   *  refinement — and the download plumbing. */
  function exportWpr(): void {
    closeTunePanelAfterIO();
    const { value: bytes, errors } = requireFocusedProject().exportWpr(
      new Date(), curvesData.value, parseLossMode(presentationState.lossMode));
    if (!bytes) { flash(`Cannot export .wpr: ${errors[0]?.message ?? 'the driver is incomplete'}`); return; }
    download(sanitizeFilename(driverName.value) + '.wpr', bytes, ProjectFileFormat.Wpr.mime);
  }

  /** Load a driver/design from a picked File. */
  function importFile(f: File): void {
    void readDriverFileText(f).then(({ text }) => {
      try {
        const bytes = new TextEncoder().encode(text);
        const format = formatOf(f.name) ?? sniff(bytes);

        if (format === DriverFileFormat.Wdr) {
          requireFocusedProject().loadDriverFromWdrText(text);
        } else if (format === ProjectFileFormat.Wpr) {
          const { value: meta, errors } = requireFocusedProject().importWpr(bytes);
          if (!meta) throw new Error(errors[0]?.message ?? 'could not read .wpr');
          // `state.project` mirrors the loaded project's own meta — leaving the PREVIOUS
          // project's creator/description in place re-exports them into the next .wpr
          // (bugs/BUG_20260822_wpr_import_leaves_previous_projects_meta_in_state_and_
          // reexports_it.md). The name alone comes from the FILE, per the name↔file rule.
          state.project.description = meta.description;
          state.project.creator = meta.creator;
          state.project.created = meta.created;
          state.project.modified = meta.modified;
          state.project.name = projectNameFromFilename(f.name);
        } else if (format === DriverFileFormat.Owdr) {
          requireFocusedProject().loadDriverFromOwdrText(text);
        } else if (format === ProjectFileFormat.Owpr || /^\s*\{/.test(text)) {
          // A `.owpr`-NAMED file can still contain a bare driver record — `sniff` is the one
          // content classifier (the same rule `formatOf`-by-extension cannot see), so the
          // JSON-content dispatch asks it rather than keeping a second copy of the rule.
          if (sniff(bytes) === DriverFileFormat.Owdr) {
            requireFocusedProject().loadDriverFromOwdrText(text);
          } else {
            // An opened file is a persisted payload like any other — it goes through the same
            // schema upgrade as localStorage and the share-link hash
            // (bugs/BUG_20260822_share_links_and_file_imports_bypass_the_schema_upgrade.md).
            const upgraded = deps.projectRepo.readProjectText(text);
            if (!upgraded) throw new Error('the file could not be brought to the current schema');
            applyLoadedProject(upgraded);
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
