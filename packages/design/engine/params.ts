/**
 * Enclosure-parameter precondition — the box-side counterpart to `sweep`'s own driver-side
 * precondition, `circuitQuantities` (CODE_REVIEW.md §18, ENGINE_HARDENING.md "Residual input
 * guards").
 *
 * `solve()` divides by these values without guarding, once per frequency:
 *   Cab = Vb/(ρc²)  then  cInv(Cab)      circuit.ts — sealed, vented, pr, bandpass4
 *   Cabf = Vf/(ρc²) then  cInv(Cabf)     circuit.ts — bandpass4 front chamber
 *   Map = ρ·Leff/Sp                      circuit.ts — vented + bandpass4 port branch
 *   Cap = prCms·prSd², Map = Mmd/prSd²   circuit.ts — passive radiator
 *
 * A zero or absent value therefore yields `Infinity`/`NaN` at EVERY frequency. The sweep
 * postcondition (`classifyFinite`) does catch that, but it can only say "no usable values"
 * — it cannot know WHICH field caused it. Validating the inputs here names the field, so
 * the message points at the box volume the user actually has to change.
 *
 * Communicated through the `{ values, issues }` result every other node solve now uses (T9) —
 * no throw (.claude/rules/openisd-result-contract.md).
 *
 * This is input validation only: it changes no formula and no computed number.
 */

import type {BoxType, EnclosureParams} from './types.js';
import type {CalculationIssue} from './consistency.js';

export type BoxParamsQuantityName = keyof EnclosureParams;
export type BoxParamsIssue = CalculationIssue<BoxParamsQuantityName>;

/** `solveBoxParams`'s one result: the enclosure parameters unchanged (`values`) when every
 *  field the circuit divides by is present, or `null` with `issues` naming what is missing. */
export interface BoxParamsSolveResult {
  readonly values: EnclosureParams | null;
  readonly issues: readonly BoxParamsIssue[];
}

/** One enclosure parameter `solve()` divides by, with the human wording for its message. */
interface RequiredParam {
  /** The `SweepParams` key — also the `DriverError.field`, so the UI can point at the input. */
  readonly field: keyof EnclosureParams;
  /** How the field is named to a human, matching the UI's own label. */
  readonly label: string;
  /** What goes wrong in the circuit when it is absent or non-positive. */
  readonly consequence: string;
}


/**
 * Which parameters `box`'s circuit actually divides by, and why — the one table `solveBoxParams()`
 * reads. Lives INSIDE the function that
 * builds it, not at module scope: a module-scoped `const` object is shared mutable state
 * however it is declared, because `const` freezes the binding and not the contents
 * (packages/design/AGENTS.md).
 *
 * A TOTAL map over `BoxType` (../AGENTS.md §"A CLOSED SET IS AN ENUM"): giving the
 * circuit a new topology is a compile error here rather than a silent hole in the precondition.
 * `Sp` is required for `bandpass4` as well as `vented` — the bandpass front chamber calls the
 * same `portImpedance()` (circuit.ts), so it divides by `Sp` identically.
 */
export function requiredParamsFor(box: BoxType): readonly RequiredParam[] {
  const VB: RequiredParam = {
    field: 'Vb',
    label: 'Box volume (Vb)',
    consequence: 'the box compliance Cab = Vb/(ρc²) collapses to zero, which makes the enclosure impedance infinite at every frequency',
  };

  const VF: RequiredParam = {
    field: 'Vf',
    label: 'Front chamber volume (Vf)',
    consequence: 'a 4th-order bandpass needs both chambers, and the front compliance Vf/(ρc²) collapses to zero',
  };

  const SP: RequiredParam = {
    field: 'Sp',
    label: 'Vent area (Sp)',
    consequence: 'the port mass Map = ρ·Leff/Sp is infinite — enter a vent diameter',
  };

  const PR_SD: RequiredParam = {
    field: 'prSd',
    label: 'Passive-radiator piston area (prSd)',
    consequence: 'every PR element is referred to the acoustic domain through prSd², so the whole PR branch is undefined',
  };

  const PR_CMS: RequiredParam = {
    field: 'prCms',
    label: 'Passive-radiator compliance (prCms)',
    consequence: 'the PR acoustic compliance Cap = prCms·prSd² collapses to zero, giving it infinite impedance',
  };

  const PR_MMD: RequiredParam = {
    field: 'prMmd',
    label: 'Passive-radiator moving mass (prMmd)',
    consequence: 'a massless radiator has no resonance, so there is nothing for the box to tune against',
  };

  const REQUIRED_BY_BOX: Record<BoxType, readonly RequiredParam[]> = {
    sealed:                 [VB],
    vented:                 [VB, SP],
    'box-passive-radiator': [VB, PR_SD, PR_CMS, PR_MMD],
    bandpass4:              [VB, VF, SP],
    // `Bandpass6Box`/`AbcBox` never call `port.ts`'s `portImpedance()` (their port masses come
    // from `Fr`/`Ff`, not from `Sp`/`Leff` geometry — `SweepParams.Spr`'s own doc), so unlike
    // `bandpass4`'s front chamber neither needs `Sp` here: only the two chamber volumes are a
    // genuine divide-by-zero (`Cabr = Vb/(ρc²)`, `Cabf = Vf/(ρc²)`, both denominators elsewhere).
    bandpass6:              [VB, VF],
    abc:                    [VB, VF],
  };

  return REQUIRED_BY_BOX[box];
}

