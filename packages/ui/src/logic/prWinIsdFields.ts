/**
 * WinISD-vocabulary <-> canonical passive-radiator field conversion.
 *
 * A PR's canonical state is Sd/Mmd/Cms/Rms (matches the driver's own T/S vocabulary), but
 * datasheets and WinISD both publish Sd/Fs/Qms/Vas instead. `prVas`/`prFs`/`prQms` in
 * `@openisd/engine` already give the forward direction (canonical -> WinISD vocabulary); this
 * module adds the inverse (WinISD vocabulary -> canonical), used both when editing an existing
 * PR's WinISD-style fields (PREditModal) and when defining a brand-new one from a datasheet
 * (PRDefineModal) — the same two formulas, so both panels apply the identical solve.
 */
import { RHO, C, prVas, prFs, prFsWithMass, prQms } from '@openisd/engine';
import type { UiParams } from '../types.js';

/** Vas (litres) implied by the PR's current Cms/Sd. */
export function prVasDisplay(P: UiParams): number {
  return prVas(P.prCms, P.prSd);
}

/** Free-air Fs (Hz) implied by the PR's current Mmd/Cms — no added mass. */
export function prFsDisplay(P: UiParams): number {
  return prFs(P.prMmd, P.prCms);
}

/** Fs (Hz) implied by the PR's current Mmd/Cms WITH the added mass — the tuned, not
 *  free-air, frequency. */
export function prFsWithMassDisplay(P: UiParams): number {
  return prFsWithMass(P.prMmd, P.prMadd, P.prCms);
}

/** Qms implied by the PR's current Mmd/Cms/Rms. */
export function prQmsDisplay(P: UiParams): number {
  return prQms(P.prMmd, P.prCms, P.prRms);
}

/** Enter a WinISD-vocabulary Fs (Hz): re-solves Mmd from the current Cms, holding Qms. */
export function setPrFsFromWinIsd(P: UiParams, newFsHz: number): void {
  if (!(newFsHz > 0)) return;
  const qms = prQmsDisplay(P) || 5;
  const newMmd = 1 / ((2 * Math.PI * newFsHz) ** 2 * P.prCms);
  P.prMmd = newMmd;
  P.prRms = Math.sqrt(newMmd / P.prCms) / qms;
}

/** Enter a WinISD-vocabulary Qms: re-solves Rms from the current Mmd/Cms. */
export function setPrQmsFromWinIsd(P: UiParams, newQms: number): void {
  if (!(newQms > 0)) return;
  P.prRms = Math.sqrt(P.prMmd / P.prCms) / newQms;
}

/** Enter a WinISD-vocabulary Vas (litres): re-solves Cms from Sd, holding Fs/Qms. */
export function setPrVasFromWinIsd(P: UiParams, newVasL: number): void {
  if (!(newVasL > 0)) return;
  const fsCurr = prFsDisplay(P) || 30;
  const qmsCurr = prQmsDisplay(P) || 5;
  const newCms = (newVasL / 1000) / (P.prSd * P.prSd * RHO * C * C);
  const newMmd = 1 / ((2 * Math.PI * fsCurr) ** 2 * newCms);
  P.prCms = newCms;
  P.prMmd = newMmd;
  P.prRms = Math.sqrt(newMmd / newCms) / qmsCurr;
}

/** A brand-new PR's datasheet fields, in WinISD vocabulary. */
export interface PrDatasheetInput {
  sdCm2: number;
  xmaxMm: number;
  fsHz: number;
  qms: number;
  vasL: number;
}

/** Canonical Sd/Xmax/Cms/Mmd/Rms solved from a brand-new PR's datasheet fields. */
export interface PrCanonical {
  sd: number;
  xmax: number;
  cms: number;
  mmd: number;
  rms: number;
}

export function prCanonicalFromDatasheet(input: PrDatasheetInput): PrCanonical {
  const sd = input.sdCm2 / 1e4;
  const vas = input.vasL / 1000;
  const cms = vas / (sd * sd * RHO * C * C);
  const mmd = 1 / ((2 * Math.PI * input.fsHz) ** 2 * cms);
  const rms = Math.sqrt(mmd / cms) / input.qms;
  const xmax = isFinite(input.xmaxMm) && input.xmaxMm >= 0 ? input.xmaxMm / 1000 : 0;
  return { sd, xmax, cms, mmd, rms };
}
