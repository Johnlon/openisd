import {sealedFromQtc, sealedQtcFromVolume} from '../boxDesign.js';
import {LossMode, sealedResonance} from '../lossMode.js';
import type {SealedAlignmentSolverParams} from '../solverTypes.js';
import type {CalculationIssue} from '../consistency.js';

interface SealedAlignmentWorkingSet {
    Qts?: number;
    Vas_m3?: number;
    Qtc?: number;
    Vb_m3?: number;
}

export type SealedAlignmentQuantityName = keyof SealedAlignmentSolverParams;
export type SealedAlignmentIssue = CalculationIssue<SealedAlignmentQuantityName>;

// `solveSealedAlignmentGroup` (a p:SealedAlignmentWorkingSet->SealedAlignmentWorkingSet twin of
// `Engine.solveSealedAlignment`) was deleted: it had zero callers. `Engine.solveSealedAlignment`
// is the only sealed-alignment solve route reachable from `Engine`, and `testSolver.ts`'s
// exported `solveSealedAlignmentGroup` is a same-named but unrelated helper that calls
// `engine.solveSealedAlignment` — it does not reach this module's private function.

/** The driver quantities every sealed-alignment route needs, beside `Qtc`/`Vb_m3` themselves.
 *  Typed over `SealedAlignmentWorkingSet`'s own keys (not the wider `SealedAlignmentQuantityName`,
 *  which S10 grew to include the Vb→Qtc route's read-only loss inputs) — `checkSealedAlignment`
 *  indexes `p: SealedAlignmentWorkingSet` with these, and that type carries only Qts/Vas_m3/Qtc/Vb_m3. */
const SEALED_ALIGNMENT_DRIVER_QUANTITIES: readonly (keyof SealedAlignmentWorkingSet & SealedAlignmentQuantityName)[] =
  Object.freeze(['Qts', 'Vas_m3']);

/** The stated sealed-alignment quantities that cannot yet solve because `Qts`/`Vas_m3` are
 *  incomplete — mirrors `Engine.solveSealedAlignment`'s own route conditions. There is no
 *  inconsistent-inputs case here: a sealed box has no THIRD input to `Qtc`/`Vb_m3` that could
 *  disagree with the pair, unlike the driver's Qts/Qes/Qms triple. */
function checkSealedAlignment(p: SealedAlignmentWorkingSet): SealedAlignmentIssue[] {
  const issues: SealedAlignmentIssue[] = [];
  const missingDriverQuantities = SEALED_ALIGNMENT_DRIVER_QUANTITIES.filter(f => {
    const v = p[f];
    return !(typeof v === 'number' && v > 0);
  });
  if (missingDriverQuantities.length === 0) return issues;

  if (p.Qtc != null && p.Vb_m3 == null) {
    issues.push({
      kind: 'missing-dependencies', target: 'Vb_m3',
      routes: [{ formula: 'Vb_m3 = Vas_m3 / ((Qtc/Qts)² − 1)',
        required: ['Qtc', ...SEALED_ALIGNMENT_DRIVER_QUANTITIES], missing: missingDriverQuantities }],
    });
  } else if (p.Vb_m3 != null && p.Qtc == null) {
    issues.push({
      kind: 'missing-dependencies', target: 'Qtc',
      routes: [{ formula: 'Qtc = Qts · √(1 + Vas_m3/Vb_m3)',
        required: ['Vb_m3', ...SEALED_ALIGNMENT_DRIVER_QUANTITIES], missing: missingDriverQuantities }],
    });
  }

  return issues;
}

/** The sealed-alignment handle solve (T10/T11): derive whichever of `Qtc`/`Vb_m3` is not
 *  entered from the driver's own `Qts`/`Vas_m3`, write it onto its `SolverField` via
 *  `setCalculated`, and return the issues the stated values carry. An entered value is never
 *  overwritten; an underivable member becomes `not-available`. */
export function solveSealedAlignment(params: SealedAlignmentSolverParams): SealedAlignmentIssue[] {
  const Qts = params.Qts.value;
  const Vas = params.Vas_m3.value;
  const Qtc = params.Qtc.value;
  const Vb = params.Vb_m3.value;

  if (Qtc != null && !params.Vb_m3.entered) {
    if (Qts != null && Vas != null) {
      const v = sealedFromQtc(Qts, Vas, Qtc);
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
        ? sealedResonance(LossMode.parse(params.lossMode.value), {
            Fs, Vas, Qts, Vb, Ql: params.Ql.value ?? Infinity, Qa: params.Qa.value ?? Infinity,
          }).Qtc
        : sealedQtcFromVolume(Qts, Vas, Vb);
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
