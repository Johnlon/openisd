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
  state, driver, driverRaw, driverJSON, getDriverModel, setDriverFromWdr, setDriverFromSerialized, markProjectSaved, applyState
} from '../store.js';
import { serialize, stateToUrl, download } from '../utils/persist.js';
import { flash } from '../utils/flash.js';
import { saveProject as fsSaveProject, saveProjectAs as fsSaveProjectAs } from '../utils/fileSave.js';
import { projectNameFromFilename, projectFilename, copyOfName } from '../utils/projectFile.js';
import { buildWprInput } from '../utils/wprMapping.js';
import { toWpr } from '@openisd/winisd';
import type { SerializedState, DriverJSON, UiParams } from '../types.js';

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
    return JSON.stringify(serialize(state, driverJSON.value), null, 2);
  }

  /** Adopt the picked file's name as the project name — the file names the project. */
  function adoptFileName(handle: FileSystemFileHandle | null, fallbackFilename: string): void {
    state.project.name = projectNameFromFilename(handle?.name || fallbackFilename);
  }

  /** Save — overwrites the previously-picked file in place; first save behaves like Save As. */
  /** Returns true when the project was written, false when the user cancelled the file
   *  dialog — a caller doing "save, then close" must not close on a cancelled save. */
  async function saveProject(): Promise<boolean> {
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
    const url = await stateToUrl(serialize(state, driverJSON.value));
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

  function exportOwdr(): void {
    download(sanitizeFilename(driverRaw.value.name) + '.owdr', JSON.stringify(driverJSON.value, null, 2), 'application/json');
  }

  /** Export the current design as a WinISD .wpr project (WINISD_WPR_FILE_SCHEMA.md). */
  function exportWpr(): void {
    const driverSection = getDriverModel().toWdr();
    const input = buildWprInput(state.box, state.P, driver.value, driverSection, state.project, new Date());
    download(sanitizeFilename(driverRaw.value.name) + '.wpr', toWpr(input), 'text/plain');
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

    const driverWdr = driverLines.join('\r\n');
    const driverModel = ((getDriverModel().constructor as unknown) as { fromWdr: (wdr: string) => { toJSON: () => Record<string, unknown> } }).fromWdr(driverWdr);
    const driverJson = driverModel.toJSON() as unknown as DriverJSON;

    const boxSec = sections['Box'] || {};
    const bType = parseInt(boxSec['BType'] || '1', 10);
    let boxType: 'sealed' | 'vented' | 'bandpass4' | 'pr' = 'vented';
    if (bType === 0) boxType = 'sealed';
    else if (bType === 1) boxType = 'vented';
    else if (bType === 2) boxType = 'bandpass4';
    else if (bType === 4) boxType = 'pr';

    const pSec = sections['ProjectInfo'] || {};
    const sigSec = sections['SignalSource'] || {};
    const vr = parseFloat(boxSec['Vr'] || '0.030');
    const vf = parseFloat(boxSec['Vf'] || '0.015');
    const npr = parseInt(boxSec['npr'] || '1', 10);

    const ventFrontSec = sections['VentFront'] || {};
    const ventRearSec = sections['VentRear'] || {};
    const activeVentSec = boxType === 'bandpass4' ? ventFrontSec : ventRearSec;
    const ventD = parseFloat(activeVentSec['dia'] || '0.05');
    const ventL = parseFloat(activeVentSec['len'] || '0.10');
    const endCorrection = parseFloat(activeVentSec['endCorrection'] || '0.732');

    const simOptSec = sections['SimulatorOptions'] || {};
    const vcInductance = simOptSec['vcInductance'] === '1';
    const flatResponse = simOptSec['flatResponse'] === '1';
    const tlPorts = simOptSec['tlPorts'] === '1';

    const prSec = sections['PassiveRadiator'] || {};
    const prSd = parseFloat(prSec['Sd'] || '0.0133');
    const prXmax = parseFloat(prSec['Xmax'] || '0.012');
    const prMadd = parseFloat(prSec['Me'] || '0');
    const prVasLitres = parseFloat(prSec['Vas'] || '20.0');
    const prFs = parseFloat(prSec['Fs'] || '20.0');
    const prQms = parseFloat(prSec['Qms'] || '5.0');

    const prVasM3 = prVasLitres / 1000;
    const RHO = 1.20095;
    const C = 343.68;
    const prCms = prVasM3 / (prSd * prSd * RHO * C * C);
    const prMmd = prFs > 0 && prCms > 0 ? 1 / (4 * Math.PI * Math.PI * prFs * prFs * prCms) : 0.010;
    const prRms = prQms > 0 && prCms > 0 ? Math.sqrt(prMmd / prCms) / prQms : 1.0;

    const P = {
      Vb: vr,
      Vf: vf,
      ventD,
      ventL,
      Ql: parseFloat(boxSec['Ql'] || '10'),
      Qa: parseFloat(boxSec['Qa'] || '100'),
      Qp: parseFloat(boxSec['Qp'] || '100'),
      nDrivers: 1,
      wiring: 'parallel',
      Pin: parseFloat(sigSec['P'] || '1'),
      Rs: parseFloat(sigSec['Rg'] || '0.1'),
      prName: 'Custom PR',
      prSd,
      prNum: npr,
      prMmd,
      prMadd,
      prCms,
      prRms,
      prXmax,
      prMode: 'winisd',
      fmin: 1,
      fmax: 20000,
      N: 400,
      circuitModel: vcInductance ? 'gyrator' : 'winisd',
      filters: [],
      vcTempRise: 0,
      alfaVC: 0.0039,
      driverAddedMass: 0,
      endCorrection,
      rgAtDriverSide: true,
      tlPortModel: tlPorts,
      forceFlatResponse: flatResponse,
      splXmaxLimited: false,
    };

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
      P: P as unknown as UiParams,
      driver: driverJson,
      project,
      graphs: [],
    };
  }

  /** Load a driver/design from a picked File. */
  function importFile(f: File): void {
    const rd = new FileReader();
    const nameLower = f.name.toLowerCase();
    const isWdr = nameLower.endsWith('.wdr');
    const isWpr = nameLower.endsWith('.wpr');
    const isOwdr = nameLower.endsWith('.owdr');
    const isOwpr = nameLower.endsWith('.owpr');

    rd.onload = () => {
      const text = rd.result as string;
      try {
        if (isWdr || (nameLower.endsWith('.wdr') || (/^\s*\[Driver\]/.test(text) && !/\[Box\]/.test(text)))) {
          setDriverFromWdr(text);
        } else if (isWpr || /\[Box\]/.test(text)) {
          const stateObj = parseWprToState(text);
          applyState(stateObj);
          state.project.name = projectNameFromFilename(f.name);
        } else if (isOwdr || nameLower.endsWith('.json') || isOwpr) {
          const parsed = JSON.parse(text);
          if (parsed && typeof parsed === 'object' && ('inputs' in parsed) && !('box' in parsed)) {
              setDriverFromSerialized(parsed);
          } else {
            applyState(parsed as SerializedState);
            state.project.name = projectNameFromFilename(f.name);
          }
        } else {
          if (/^\s*\{/.test(text)) {
            const parsed = JSON.parse(text);
            if (parsed && typeof parsed === 'object' && ('inputs' in parsed) && !('box' in parsed)) {
                  setDriverFromSerialized(parsed);
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
    };
    rd.readAsText(f);
  }

  function about(): void {
    alert(`OpenISD — opensource interactive speaker designer\nA community-owned tool modelling the Thiele/Small electro-mechano-acoustical system.\n\nBox types: sealed, vented, 4th-order bandpass, passive radiator\nCurves: SPL, excursion, port velocity, group delay, impedance, max SPL/power\n\nSee docs/MATHS.md for the circuit model and equations.`);
  }

  return { saveProject, saveProjectAs, shareLink, exportWdr, exportWpr, exportOwdr, importFile, about };
}
