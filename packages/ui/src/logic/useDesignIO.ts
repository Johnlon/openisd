/**
 * Design file I/O — Save/Save As the project (.openisd.json) to the filesystem, export
 * a WinISD .wpr project or a .wdr driver, copy a share link, import a .wdr/.json, and the
 * About text. Lives in a composable, not in the shell, so the toolbar and the export menu
 * reuse ONE implementation — no duplication.
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
  state, driverName, driverRecord, managedProject, setDriverFromWdr,
  markProjectSaved, applyState, curvesData,
} from './store.js';
import { presentationState } from './presentationState.js';
import { serialize, stateToUrl, download } from './persist.js';
import { setShareUrl } from './urlAppState.js';
import type { Logging } from '../logging/flash.js';
import { saveProject as fsSaveProject, saveProjectAs as fsSaveProjectAs } from './fileSave.js';
import { projectNameFromFilename, projectFilename, copyOfName } from './projectFile.js';
import { readDriverFileText } from './driverFileText.js';
import { buildWprInput } from './wprMapping.js';
import { prCanonicalFromDatasheet } from './prWinIsdFields.js';
import { toWpr, wdrTextToBytes } from '@openisd/winisd';
import { OpenISDDriver } from '@openisd/model';
import type { SerializedState, UiParams } from '../types.js';

function sanitizeFilename(name: string | undefined): string {
  return (name || 'design').replace(/[^\w.-]+/g, '_');
}

// A live what-if is an uncommitted preview that can never be saved, exported or shared
// (ARCHITECTURE.md §3). That guard is STRUCTURAL, not a call every I/O function must remember:
// `driverRecord` reads ManagedOpenISDProject.readModified(), which cancels an active what-if itself. A
// per-call-site guard is what let shareLink() ship without one while every sibling had it.
// Closing the Tune panel is the only part left to the caller, since the panel is UI, not state.
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
 * give each its own handle, so Save As in the menu and Save in the toolbar would track
 * different files. Session-only either way — the File System Access API does not persist
 * handles across a page load.
 */
export function createDesignIO(deps: { logging: Logging }): DesignIO {
  const flash = (msg: string) => deps.logging.flash(msg);

  const fileHandle = ref<FileSystemFileHandle | null>(null);

  // Renaming the project retargets the file. Browsers cannot rename a file on disk, so the
  // honest equivalent is to let go of the handle: the next Save prompts for a location, with
  // the new name already filled in. Without this, renaming would keep silently overwriting the
  // file that still carries the OLD name — the one thing the name↔file rule forbids.
  watch(() => state.project.name, (name) => {
    const open = fileHandle.value;
    if (open?.name && projectNameFromFilename(open.name) !== name) fileHandle.value = null;
  });

  function projectJsonText(): string {
    return JSON.stringify(
      serialize(state.box, state.project, presentationState, driverRecord.value, managedProject.toUiParams()),
      null, 2);
  }

  /** Adopt the picked file's name as the project name — the file names the project. */
  function adoptFileName(handle: FileSystemFileHandle | null, fallbackFilename: string): void {
    state.project.name = projectNameFromFilename(handle?.name || fallbackFilename);
  }

  /** Save — overwrites the previously-picked file in place; first save behaves like Save As. */
  /** Returns true when the project was written, false when the user cancelled the file
   *  dialog — a caller doing "save, then close" must not close on a cancelled save. */
  async function saveProject(): Promise<boolean> {
    closeTunePanelAfterIO();
    const suggested = projectFilename(state.project.name);
    const result = await fsSaveProject(projectJsonText(), suggested, fileHandle.value);
    if (result.cancelled) return false;
    fileHandle.value = result.handle;
    adoptFileName(result.handle, suggested);
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
    const suggested = projectFilename(fileHandle.value ? copyOfName(state.project.name) : state.project.name);
    const result = await fsSaveProjectAs(projectJsonText(), suggested);
    if (result.cancelled) return;
    fileHandle.value = result.handle;
    adoptFileName(result.handle, suggested);
    if (!result.written) {
      flash('Project downloaded — the browser cannot confirm it was written, so it is still marked unsaved');
      return;
    }
    markProjectSaved();
    flash('Project saved');
  }

  async function shareLink(): Promise<void> {
    const url = await stateToUrl(
      serialize(state.box, state.project, presentationState, driverRecord.value, managedProject.toUiParams()));
    setShareUrl(url);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(
        () => flash('Share link copied to clipboard'),
        () => prompt('Copy this share link:', url));
    } else { prompt('Copy this share link:', url); }
  }

  function exportWdr(): void {
    closeTunePanelAfterIO();
    // The ADT's own toWdr is lossless — carried fields + live ParState provenance.
    // OpenISDDriver.fromJsonRecord(record) here is a recorded layering gap (ledger QO57).
    const record = driverRecord.value;
    if (!record) { flash('Cannot export .wdr: no driver has been chosen'); return; }
    const { value: wdr, errors } = OpenISDDriver.fromJsonRecord(record).toWdrText();
    if (!wdr) { flash(`Cannot export .wdr: ${errors[0]?.message ?? 'the driver is incomplete'}`); return; }
    download(sanitizeFilename(driverName.value) + '.wdr', wdrTextToBytes(wdr), 'text/plain');
  }

  function exportOwdr(): void {
    closeTunePanelAfterIO();
    const record = driverRecord.value;
    if (!record) { flash('Cannot export .owdr: no driver has been chosen'); return; }
    download(sanitizeFilename(driverName.value) + '.owdr', JSON.stringify(record, null, 2), 'application/json');
  }

  /** Export the current design as a WinISD .wpr project (WINISD_WPR_FILE_SCHEMA.md). */
  function exportWpr(): void {
    closeTunePanelAfterIO();
    // See exportWdr()'s comment: this OpenISDDriver.fromJsonRecord() is a known gap, QO57.
    const record = driverRecord.value;
    if (!record) { flash('Cannot export .wpr: no driver has been chosen'); return; }
    const { value: wdr, errors } = OpenISDDriver.fromJsonRecord(record).toWdrText();
    if (!wdr) { flash(`Cannot export .wpr: ${errors[0]?.message ?? 'the driver is incomplete'}`); return; }
    const input = buildWprInput(
      state.box, managedProject.toUiParams(), managedProject.toEngineDriver(), wdr, state.project, new Date(),
      managedProject.ventArea_m2(), curvesData.value,
    );
    download(sanitizeFilename(driverName.value) + '.wpr', wdrTextToBytes(toWpr(input)), 'text/plain');
  }

  function parseWprToState(text: string): SerializedState {
    const sections: Record<string, Record<string, string>> = {};
    let currentSection: Record<string, string> | null = null;
    const lines = text.split(/\r?\n/);
    const driverLines: string[] = [];
    let inDriver = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) continue;
      
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        const secName = trimmed.slice(1, -1).trim();
        currentSection = {};
        sections[secName] = currentSection;
        
        if (secName === 'Driver') {
          inDriver = true;
          driverLines.push(trimmed);
        } else {
          inDriver = false;
        }
      } else {
        if (inDriver) {
          driverLines.push(line);
        }
        if (currentSection) {
          const idx = line.indexOf('=');
          if (idx !== -1) {
            const k = line.slice(0, idx).trim();
            const v = line.slice(idx + 1).trim();
            currentSection[k] = v;
          }
        }
      }
    }

    // The .wpr's [Driver] block IS .wdr text — the serialiser reads it as-read, then projects
    // it into the app's own record. One reader, not a second parse invented here.
    const driverWdr = driverLines.join('\r\n');
    const driverJson = OpenISDDriver.fromWdrText(driverWdr).toJsonRecord();

    const boxSec = sections['Box'] || {};

    // A key the file does not carry, or carries empty, is ABSENT — never a number invented here.
    // A fabricated value is indistinguishable downstream from one WinISD wrote, and the app
    // would simulate, plot and re-export it as if it were real
    // (bugs/BUG_20260821_wpr_import_fabricates_sixteen_driver_and_box_values_for_absent_keys.md).
    const numOrAbsent = (sec: Record<string, string>, key: string): number | undefined => {
      const raw = sec[key];
      if (raw == null || raw.trim() === '') return undefined;
      const n = Number(raw);
      return Number.isFinite(n) ? n : undefined;
    };

    // BType is the box's IDENTITY. A .wpr that does not state it is not a vented box — it is a
    // file this reader cannot honestly interpret, so it refuses rather than guessing.
    const bType = numOrAbsent(boxSec, 'BType');
    const BOX_OF_BTYPE: Record<number, 'sealed' | 'vented' | 'bandpass4' | 'pr'> =
      { 0: 'sealed', 1: 'vented', 2: 'bandpass4', 4: 'pr' };
    const boxType = bType == null ? undefined : BOX_OF_BTYPE[bType];
    if (boxType == null) {
      throw new Error(bType == null
        ? '.wpr has no [Box] BType — the box type is not stated, and this reader will not assume one'
        : `.wpr states BType=${bType}, which is not a box type OpenISD models (0/1/2/4)`);
    }

    const pSec = sections['ProjectInfo'] || {};
    const sigSec = sections['SignalSource'] || {};

    const ventFrontSec = sections['VentFront'] || {};
    const ventRearSec = sections['VentRear'] || {};
    const activeVentSec = boxType === 'bandpass4' ? ventFrontSec : ventRearSec;
    const simOptSec = sections['SimulatorOptions'] || {};

    const vcInductance = simOptSec['vcInductance'] === '1';
    const flatResponse = simOptSec['flatResponse'] === '1';
    const tlPorts = simOptSec['tlPorts'] === '1';

    // The passive radiator exists ONLY when the file carries the four values that define one.
    // A partial [PassiveRadiator] section describes no radiator, so none is built — rather than
    // a fully-specified one assembled out of literals.
    const prSec = sections['PassiveRadiator'] || {};
    const prSd = numOrAbsent(prSec, 'Sd');
    const prVasM3 = numOrAbsent(prSec, 'Vas');   // [PassiveRadiator].Vas is SI m³
    const prFs = numOrAbsent(prSec, 'Fs');
    const prQms = numOrAbsent(prSec, 'Qms');
    const hasPr = prSd != null && prSd > 0 && prVasM3 != null && prFs != null && prFs > 0
      && prQms != null && prQms > 0;
    if (boxType === 'pr' && !hasPr) {
      throw new Error('.wpr states BType=4 (passive radiator) but [PassiveRadiator] does not '
        + 'carry Sd, Vas, Fs and Qms — the radiator cannot be reconstructed and will not be invented');
    }

    // `.wpr` carries SI (m², m³, m); `prCanonicalFromDatasheet` takes datasheet units
    // (cm², litres, mm) — the one conversion between them happens here, at the file boundary.
    const prXmaxM = numOrAbsent(prSec, 'Xmax');
    const pr = hasPr
      ? prCanonicalFromDatasheet({
          sdCm2: prSd * 1e4,
          vasL: prVasM3 * 1000,
          fsHz: prFs,
          qms: prQms,
          xmaxMm: prXmaxM == null ? NaN : prXmaxM * 1000,
        })
      : undefined;

    const P: Partial<UiParams> = {
      circuitModel: vcInductance ? 'gyrator' : 'winisd',
      tlPortModel: tlPorts,
      forceFlatResponse: flatResponse,
    };
    // Every field below is written ONLY when the file states it. An absent key leaves the field
    // untouched, so `applyState` keeps whatever the app already had rather than adopting a lie.
    const assign = <K extends keyof UiParams>(k: K, v: UiParams[K] | undefined): void => {
      if (v !== undefined) P[k] = v;
    };
    assign('Vb', numOrAbsent(boxSec, 'Vr'));
    assign('Vf', numOrAbsent(boxSec, 'Vf'));
    assign('Ql', numOrAbsent(boxSec, 'Ql'));
    assign('Qa', numOrAbsent(boxSec, 'Qa'));
    assign('Qp', numOrAbsent(boxSec, 'Qp'));
    assign('Pin', numOrAbsent(sigSec, 'P'));
    assign('Rs', numOrAbsent(sigSec, 'Rg'));
    assign('ventD', numOrAbsent(activeVentSec, 'dia'));
    assign('ventL', numOrAbsent(activeVentSec, 'len'));
    assign('endCorrection', numOrAbsent(activeVentSec, 'endCorrection'));
    assign('prNum', numOrAbsent(boxSec, 'npr'));
    if (pr) {
      assign('prSd', pr.sd);
      assign('prXmax', prXmaxM);
      assign('prMadd', numOrAbsent(prSec, 'Me'));
      assign('prCms', pr.cms);
      assign('prMmd', pr.mmd);
      assign('prRms', pr.rms);
    }

    const project = {
      name: pSec['Description'] || 'Imported Design',
      description: pSec['Description'] || '',
      creator: pSec['Creator'] || '',
      created: pSec['CreateDate'] || '',
      modified: '',
    };

    return {
      v: 2,
      box: boxType,
      P: P as UiParams,
      driver: driverJson,
      project,
      graphs: [],
    };
  }

  /** Load a driver/design from a picked File. */
  function importFile(f: File): void {
    const nameLower = f.name.toLowerCase();
    const isWdr = nameLower.endsWith('.wdr');
    const isWpr = nameLower.endsWith('.wpr');
    const isOwdr = nameLower.endsWith('.owdr');
    const isOwpr = nameLower.endsWith('.owpr');

    void readDriverFileText(f).then(({ text }) => {
      try {
        if (isWdr || (nameLower.endsWith('.wdr') || (/^\s*\[Driver\]/.test(text) && !/\[Box\]/.test(text)))) {
          setDriverFromWdr(text);
        } else if (isWpr || /\[Box\]/.test(text)) {
          const stateObj = parseWprToState(text);
          applyState(stateObj);
          state.project.name = projectNameFromFilename(f.name);
        } else if (isOwdr || nameLower.endsWith('.json') || isOwpr) {
          const parsed = JSON.parse(text);
          if (parsed && typeof parsed === 'object' && ('specs' in parsed) && !('box' in parsed)) {
              managedProject.loadDriverRecord(parsed);
          } else {
            applyState(parsed as SerializedState);
            state.project.name = projectNameFromFilename(f.name);
          }
        } else {
          if (/^\s*\{/.test(text)) {
            const parsed = JSON.parse(text);
            if (parsed && typeof parsed === 'object' && ('specs' in parsed) && !('box' in parsed)) {
                  managedProject.loadDriverRecord(parsed);
            } else {
              applyState(parsed as SerializedState);
              state.project.name = projectNameFromFilename(f.name);
            }
          } else {
            throw new Error('Unsupported or unrecognized file format');
          }
        }
        fileHandle.value = null;
        flash('Opened ' + f.name);
      } catch (err) { alert('Could not read "' + f.name + '": ' + (err as Error).message); }
    }, (err: Error) => { alert('Could not read "' + f.name + '": ' + err.message); });
  }

  function about(): void {
    alert(`OpenISD — opensource interactive speaker designer\nA community-owned tool modelling the Thiele/Small electro-mechano-acoustical system.\n\nBox types: sealed, vented, 4th-order bandpass, passive radiator\nCurves: SPL, excursion, port velocity, group delay, impedance, max SPL/power\n\nSee docs/MATHS.md for the circuit model and equations.`);
  }

  return { saveProject, saveProjectAs, shareLink, exportWdr, exportWpr, exportOwdr, importFile, about };
}
