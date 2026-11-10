/**
 * Project defaults a new project is born with — THE values, declared once. `prototypeProjectJson`
 * writes them into the record; the New Project wizard previews with them before the record exists.
 */

/** Amplifier series resistance `Rs_ohm` (WinISD Signal tab "Series resistance", `.wpr`
 *  `[SignalSource] Rg`): 0.1 Ω. Folded into Qes wherever the driver is designed for as driven
 *  (`Engine.sourceLoadedQts`), which is why the wizard's vented box comes out ~3 % larger than
 *  the bare datasheet Qts would give (`docs/research/VENTED_ALIGNMENT_FORMULAS.md` §1). */
export const DEFAULT_SOURCE_RESISTANCE_OHM = 0.1;

/** Box leakage `Ql` (`.wpr` `[Box] Qlr`) a new vented box is born with: 10 — WinISD's own
 *  default (Qa 100, Qp 100 alongside it; `domain/boxDefaults.ts` builds the triples from this).
 *  The New Project wizard's vented preview reads this same value, so its design can never
 *  disagree with the project the wizard creates. */
export const DEFAULT_NEW_PROJECT_VENTED_QL = 10;

/** Box absorption `Qa` a new box is born with: 100, WinISD's own default beside `Ql` 10. */
export const DEFAULT_NEW_PROJECT_QA = 100;

/** Box passive-port loss `Qp` a new box is born with: 100, WinISD's own default (Ql 10, Qa 100 beside it).
 *  The engine's fallback when a sweep names none reads this same value. */
export const DEFAULT_NEW_PROJECT_QP = 100;

/** Interchamber loss `Qicl` a new bandpass or ABC box is born with: 100, WinISD's own default. */
export const DEFAULT_NEW_PROJECT_QICL = 100;

/** Front-to-rear interchamber loss `Qiclfr` a new bandpass or ABC box is born with: 100, WinISD's own default. */
export const DEFAULT_NEW_PROJECT_QICLFR = 100;

/** A sealed box's starting volume, litres: the New Project wizard's value, and the volume a project
 *  opened from a bare driver file and a passive-radiator or bandpass4 rear chamber start at. */
export const DEFAULT_SEALED_VOLUME_L = 7;

/** The sealed box's starting target Qtc: 0.707, the flat (Butterworth) alignment. */
export const DEFAULT_SEALED_QTC = 0.707;

/** Points a sweep steps through when it names no count: 400 steps, 401 frequencies. */
export const DEFAULT_SWEEP_POINTS = 400;
