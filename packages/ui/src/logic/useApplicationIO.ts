import {
  driverToOwdrBytes,
  driverToWdrBytes,
  owdrTextToDriver,
  owprTextToProject,
  projectToWprBytes,
  wdrTextToDriver,
  wprTextToProject,
} from './fileImportExport.js';
/**
 * Design I/O orchestration — Save the committed project to browser storage, Save As the project
 * (.owpr) to the filesystem,
 * export a WinISD .wpr project or a .wdr driver, copy a share link, import a .wdr/.wpr/.owdr/
 * .owpr file, and the About text. Lives in a composable, not in the shell, so the toolbar and
 * the export menu reuse ONE implementation — no duplication.
 *
 * This file is ORCHESTRATION ONLY: filename bookkeeping and flashing messages, calling the
 * FOCUSED PROJECT's own file-IO methods (`.exportDriverWdr()`/`.exportWpr()`/`.importWpr()`/…,
 * QO78: file IO lives in the domain module that owns what it reads/writes)
 * and the injected `FileStorage` (WHERE bytes go AND the retained file handle, `fileStorage.ts`).
 * It holds no driver value in any form — the driver crosses this file only as the managed
 * layer's serialised text (`persistedDriver`, QO73) or as opaque export bytes.
 *
 * Save As writes to a file the user picked via the File System Access API (Chromium),
 * retaining the handle so Save As overwrites the SAME file; browsers without the API
 * (Firefox/Safari) fall back to a plain download. WPR/driver export and Share stay
 * one-way downloads/links — there is nothing to "overwrite" for those.
 *
 * The file name IS the project name (@openisd/persistence projectFile.ts): picking a file on Save As
 * renames the project to match, and opening a file names the project after the file it came
 * from — the name stored inside the file never contradicts the name on disk.
 */
import {watch} from 'vue';
import {
  addProject,
  currentProject,
  currentViewSnapshot,
  driverName,
  focusedProject,
  markProjectSaved,
  newProjectDriver,
  requireFocusedProject,
} from './appState.js';
import {presentationState} from './presentationState.js';
import {
  copyOfName,
  createFileSave,
  type FileNaming,
  type FileStorage,
  projectFilename,
  projectNameFromFilename,
  type ProjectRepo
} from '@openisd/persistence';
import {setShareUrl} from './urlAppState.js';
import type {Logging} from '../logging/flash.js';
import {readDriverFileText} from './driverFileText.js';
import {DriverFileFormat, formatOf, ProjectFileFormat, sniff} from '../fileFormat.js';

declare const __BUILD_DATETIME__: string;

function sanitizeFilename(name: string | undefined): string {
  return (name || 'design').replace(/[^\w.-]+/g, '_');
}

// Save/export/share operate on committed project state. An active Tune session is transient, so
// these boundaries cancel it before reading or promoting anything.
function closeTunePanelAfterIO(): void {
  focusedProject()?.cancelWhatIf();
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
  watch(() => focusedProject()?.name.value ?? null, (name) => {
    if (name === null) return;
    const openName = deps.fileStorage.openFileName();
    if (openName && projectNameFromFilename(openName) !== name) deps.fileStorage.forget();
  });

  function owprNaming(suggestedName: string): FileNaming {
    return { suggestedName, mime: ProjectFileFormat.Owpr.mime, label: ProjectFileFormat.Owpr.label, ext: '.' + ProjectFileFormat.Owpr.value };
  }

  /** Adopt the picked file's name as the project name — the file names the project. */
  function adoptFileName(fileName: string | null, fallbackFilename: string): void {
    requireFocusedProject().name.set(projectNameFromFilename(fileName || fallbackFilename));
  }

  /** Save — commit the edited project and refresh the browser-storage copy. */
  async function saveProject(): Promise<boolean> {
    closeTunePanelAfterIO();
    const project = currentProject();
    project.save();
    deps.projectRepo.saveToStorage(project);
    markProjectSaved();
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
    const currentName = currentProject().name.value;
    const suggested = projectFilename(hadOpenFile ? copyOfName(currentName) : currentName);
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
    const { value: bytes, errors } = driverToWdrBytes(requireFocusedProject().driver);
    if (!bytes) { flash(`Cannot export .wdr: ${errors[0]?.message ?? 'incomplete'}`); return; }
    download(sanitizeFilename(driverName.value) + '.wdr', bytes, DriverFileFormat.Wdr.mime);
  }

  function exportOwdr(): void {
    closeTunePanelAfterIO();
    const bytes = driverToOwdrBytes(requireFocusedProject().driver);
    download(sanitizeFilename(driverName.value) + '.owdr', bytes, DriverFileFormat.Owdr.mime);
  }

  /** Export the current design as a WinISD .wpr project (WINISD_WPR_FILE_SCHEMA.md). */
  function exportWpr(): void {
    closeTunePanelAfterIO();
    const { value: bytes, errors } = projectToWprBytes(requireFocusedProject());
    if (!bytes) { flash(`Cannot export .wpr: ${errors[0]?.message ?? 'incomplete'}`); return; }
    download(sanitizeFilename(driverName.value) + '.wpr', bytes, ProjectFileFormat.Wpr.mime);
  }

  /** Load a driver/design from a picked File. */
  function importFile(f: File): void {
    void readDriverFileText(f).then(({ text }) => {
      try {
        const format = formatOf(f.name) ?? sniff(new TextEncoder().encode(text));

        if (format === DriverFileFormat.Wdr || format === DriverFileFormat.Owdr) {
          const { value: driver, errors } = format === DriverFileFormat.Wdr
            ? wdrTextToDriver(text) : owdrTextToDriver(text);
          if (!driver) throw new Error(errors[0]?.message ?? `could not read ${format.value}`);
          // A driver file with a project open SWAPS the driver in place; with none open it is
          // recognised as a DRIVER (not a project) and starts the New Project wizard with it
          // pre-loaded — the user then chooses the box type and volume (BUG_20260912).
          const open = focusedProject();
          if (open) {
            open.loadDriver(driver);
          } else {
            newProjectDriver.value = driver;
            presentationState.newProjectOpen = true;
          }
        } else if (format === ProjectFileFormat.Wpr) {
          const { value: project, errors } = wprTextToProject(text);
          if (!project) throw new Error(errors[0]?.message ?? 'could not read .wpr');
          // Opening a project file is opening a NEW project — it never folds into whatever is
          // already open (a project already open keeps its own tab and contents).
          project.name.set(projectNameFromFilename(f.name));
          // Naming it after the file it came from is part of LOADING it, not a user edit: the
          // loaded design is the ground state, so it is committed before the project is opened.
          // Without this every opened project reads as unsaved — Revert armed, the unsaved dot
          // lit, and closing it challenges the user over changes nobody made.
          project.save();
          addProject(project);
        } else if (format === ProjectFileFormat.Owpr || /^\s*\{/.test(text)) {
          const { value: project, errors } = owprTextToProject(deps.projectRepo, text);
          if (!project) {
            // `errors[0]` alone is what the alert shows — one line is all a modal has room for —
            // but a schema mismatch commonly raises several field-level issues at once (QO152),
            // and the FIRST one is rarely the most informative. Logging every one to the console
            // is what turns "the browser suite times out for 60s" into a diagnosable failure.
            // eslint-disable-next-line no-console
            console.error(`Could not read "${f.name}":`, errors.map(e => e.message).join('\n'));
            throw new Error(errors[0]?.message ?? 'could not read the project file');
          }
          project.name.set(projectNameFromFilename(f.name));
          project.save();   // the loaded design is the ground state — see the .wpr branch above
          addProject(project);
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
