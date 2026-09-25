/**
 * Project defaults a new project is born with — THE values, declared once. `prototypeProjectJson`
 * writes them into the record; the New Project wizard previews with them before the record exists.
 */

/** Amplifier series resistance `Rs_ohm` (WinISD Signal tab "Series resistance", `.wpr`
 *  `[SignalSource] Rg`): 0.1 Ω. Folded into Qes wherever the driver is designed for as driven
 *  (`Engine.sourceLoadedQts`), which is why the wizard's vented box comes out ~3 % larger than
 *  the bare datasheet Qts would give (`docs/research/VENTED_ALIGNMENT_FORMULAS.md` §1). */
export const DEFAULT_SOURCE_RESISTANCE_OHM = 0.1;
