/**
 * The sealed-box area of the engine: system resonance and Q under the chosen loss model, the
 * volume for a target Qtc and its inverse, the alignment options a picker offers, and the
 * handle solve that fills in whichever of Qtc/volume the project has not entered.
 */
import {LossMode} from '../../fields/lossMode.js';
import {SEALED_ALIGNMENT_OPTIONS} from '../../fields/options.js';
import type {SealedAlignmentOption} from '../types.js';
import type {SealedParams} from '../lossMode.js';
import {LOSSLESS_LIMIT, boxRatio, sealedResonanceWinisd} from '../lossMode.js';
import type {SealedAlignmentSolverParams} from '../solverTypes.js';
import {missingDependencies} from '../consistency.js';
import type {CalculationIssue} from '../consistency.js';

export type SealedAlignmentQuantityName = keyof SealedAlignmentSolverParams;
export type SealedAlignmentIssue = CalculationIssue<SealedAlignmentQuantityName>;

export interface SealedEngine {
  /** System resonance Fsc and Q Qtc for the selected loss model — the Box tab readout. Takes
   *  `Vas` directly. */
  resonance(mode: LossMode, p: SealedParams): { Fsc: number; Qtc: number };
  /** Box volume for a target system Q: `Qtc = Qts·√(1 + Vas/Vb)` → `Vb = Vas/((Qtc/Qts)² − 1)`.
   *  Null when `Qtc ≤ Qts` — no sealed volume reaches it.
   *  https://en.wikipedia.org/wiki/Thiele/Small_parameters#Small_signal_parameters */
  volumeForQtc(Qts: number, Vas_m3: number, Qtc: number): number | null;
  /** The lossless textbook Qtc a volume gives — the inverse of `volumeForQtc`. Null when any
   *  input is not positive. */
  qtcFromVolume(Qts: number, Vas_m3: number, Vb_m3: number): number | null;
  /** The named alignments a picker offers (Bessel, Butterworth, …), each with its Qtc. */
  alignmentOptions(): readonly SealedAlignmentOption[];
  /** The option whose Qtc is nearest to `Qtc`. */
  closestAlignment(Qtc: number): SealedAlignmentOption;
  /** The sealed-alignment handle solve (T10/T11): derive whichever of `Qtc`/`Vb_m3` is not
   *  entered from the driver's own `Qts`/`Vas_m3`, write it onto its `SolverField` via
   *  `setCalculated`, and return the issues the stated values carry. An entered value is never
   *  overwritten; an underivable member becomes `not-available`. */
  solve(params: SealedAlignmentSolverParams): SealedAlignmentIssue[];
}

interface SealedAlignmentWorkingSet {
  Qts?: number;
  Vas_m3?: number;
  Qtc?: number;
  Vb_m3?: number;
}

/** The driver quantities every sealed-alignment route needs, beside `Qtc`/`Vb_m3` themselves. */
const SEALED_ALIGNMENT_DRIVER_QUANTITIES: readonly (keyof SealedAlignmentWorkingSet & SealedAlignmentQuantityName)[] =
  Object.freeze(['Qts', 'Vas_m3']);

/** The stated sealed-alignment quantities that cannot yet solve because `Qts`/`Vas_m3` are
 *  incomplete — mirrors `solve`'s own route conditions. There is no inconsistent-inputs case: a
 *  sealed box has no THIRD input to `Qtc`/`Vb_m3` that could disagree with the pair, unlike the
 *  driver's Qts/Qes/Qms triple. */
function checkSealedAlignment(p: SealedAlignmentWorkingSet): SealedAlignmentIssue[] {
  const issues: SealedAlignmentIssue[] = [];
  const missingDriverQuantities = SEALED_ALIGNMENT_DRIVER_QUANTITIES.filter(f => {
    const v = p[f];
    return !(typeof v === 'number' && v > 0);
  });
  if (missingDriverQuantities.length === 0) return issues;

  if (p.Qtc != null && p.Vb_m3 == null) {
    issues.push(missingDependencies('Vb_m3',
      [{ formula: 'Vb_m3 = Vas_m3 / ((Qtc/Qts)² − 1)',
        required: ['Qtc', ...SEALED_ALIGNMENT_DRIVER_QUANTITIES], missing: missingDriverQuantities }]));
  } else if (p.Vb_m3 != null && p.Qtc == null) {
    issues.push(missingDependencies('Qtc',
      [{ formula: 'Qtc = Qts · √(1 + Vas_m3/Vb_m3)',
        required: ['Vb_m3', ...SEALED_ALIGNMENT_DRIVER_QUANTITIES], missing: missingDriverQuantities }]));
  }

  return issues;
}

export class SealedEngineImpl implements SealedEngine {
  resonance(mode: LossMode, p: SealedParams): { Fsc: number; Qtc: number } {
    const ratio = boxRatio(p.Vas, p.Vb);
    const fcLossless = p.Fs * ratio;
    const qtcLossless = p.Qts * ratio;

    if (mode === LossMode.Lossless) {
      return { Fsc: fcLossless, Qtc: qtcLossless };
    }
    if (mode === LossMode.ConventionalLossy) {
      // fc fixed; box losses combine into system Q (Small/Thiele).
      let invQ = 1 / qtcLossless;
      if (p.Ql > 0 && p.Ql < LOSSLESS_LIMIT) invQ += 1 / p.Ql;
      if (p.Qa > 0 && p.Qa < LOSSLESS_LIMIT) invQ += 1 / p.Qa;
      return { Fsc: fcLossless, Qtc: 1 / invQ };
    }
    return sealedResonanceWinisd(p); // WinisdLossy
  }

  volumeForQtc(Qts: number, Vas_m3: number, Qtc: number): number | null {
    const ratio = (Qtc / Qts) ** 2 - 1;
    return ratio <= 0 ? null : Vas_m3 / ratio;
  }

  qtcFromVolume(Qts: number, Vas_m3: number, Vb_m3: number): number | null {
    if (!(Qts > 0) || !(Vas_m3 > 0) || !(Vb_m3 > 0)) return null;
    return Qts * Math.sqrt(1 + Vas_m3 / Vb_m3);
  }

  alignmentOptions(): readonly SealedAlignmentOption[] {
    return SEALED_ALIGNMENT_OPTIONS;
  }

  closestAlignment(Qtc: number): SealedAlignmentOption {
    return SEALED_ALIGNMENT_OPTIONS.reduce((closest, option) =>
      Math.abs(option.value - Qtc) < Math.abs(closest.value - Qtc) ? option : closest,
    );
  }

  solve(params: SealedAlignmentSolverParams): SealedAlignmentIssue[] {
    const Qts = params.Qts.value;
    const Vas = params.Vas_m3.value;
    const Qtc = params.Qtc.value;
    const Vb = params.Vb_m3.value;

    if (Qtc != null && !params.Vb_m3.entered) {
      if (Qts != null && Vas != null) {
        const v = this.volumeForQtc(Qts, Vas, Qtc);
        if (v != null) {
          params.Vb_m3.setCalculated(v);
        } else {
          params.Vb_m3.setNotAvailable();
        }
      } else {
        params.Vb_m3.setNotAvailable();
      }
    } else if (Vb != null && !params.Qtc.entered) {
      if (Qts != null && Vas != null) {
        const Fs = params.Fs_hz.value;
        // Fs_hz is the gate (S10): only a caller that states it opts into the lossy readout —
        // every pre-S10 caller (Fs_hz absent) keeps the lossless textbook ratio unchanged.
        const v = Fs != null
          ? this.resonance(LossMode.parse(params.lossMode.value), {
              Fs, Vas, Qts, Vb, Ql: params.Ql.value ?? Infinity, Qa: params.Qa.value ?? Infinity,
            }).Qtc
          : this.qtcFromVolume(Qts, Vas, Vb);
        if (v != null) {
          params.Qtc.setCalculated(v);
        } else {
          params.Qtc.setNotAvailable();
        }
      } else {
        params.Qtc.setNotAvailable();
      }
    }

    const solved: SealedAlignmentWorkingSet = {
      Qts: Qts ?? undefined,
      Vas_m3: Vas ?? undefined,
      Qtc: params.Qtc.value ?? undefined,
      Vb_m3: params.Vb_m3.value ?? undefined,
    };
    return checkSealedAlignment(solved);
  }
}
