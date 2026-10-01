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
 *  disagree with the project the wizard creates (plan FIX_WIZARD_VENTED-remains #3). */
export const DEFAULT_NEW_PROJECT_VENTED_QL = 10;
