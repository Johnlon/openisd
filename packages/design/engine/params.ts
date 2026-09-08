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
 * Communicated through the same `DriverError` channel as every other engine precondition — no
 * throw (.claude/rules/openisd-result-contract.md).
 *
 * This is input validation only: it changes no formula and no computed number.
 */

import type { BoxType, SimulatableBoxType, EnclosureParams, DriverError } from './types.js';
import { simulatableBoxType } from './types.js';

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
 * Validate the enclosure parameters for `box`. Returns one blocking `error` per unmet
 * requirement, or an empty array when every value the circuit divides by is a finite
 * positive number. Never throws.
 *
 * Deliberately NOT exhaustive over everything that could go non-finite: `Leff`, the loss
 * Q's and the filter chain can each produce a singularity at one frequency without being
 * invalid inputs. Those are the postcondition's job (`classifyFinite`) — this layer only
 * rejects values that break the solve at EVERY frequency, which is the class a precondition
 * can decide from the inputs alone.
 */
export function validateParams(box: BoxType, P: EnclosureParams): DriverError[] {
  // The tables live INSIDE the function that reads them: a module-scoped `const` object is
  // shared mutable state however it is declared, because `const` freezes the binding and not
  // the contents (packages/design/AGENTS.md).
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

  // A box type the circuit has no model for is refused BY NAME, here, rather than being
  // inexpressible in the type. The domain can hold such a design; the engine simply declines to
  // simulate it, and says which one it declined.
  const simulatable = simulatableBoxType(box);
  if (simulatable === null) {
    return [{
      level: 'error',
      field: 'Vb',
      message: `The engine has no circuit model for a ${box} enclosure, so this design cannot be simulated.`,
    }];
  }

  /**
   * Which parameters each enclosure actually divides by. A TOTAL map over
   * `SimulatableBoxType` (../AGENTS.md §"A CLOSED SET IS AN ENUM"): giving the circuit a new
   * topology is a compile error here rather than a silent hole in the precondition.
   *
   * `Sp` is required for `bandpass4` as well as `vented` — the bandpass front chamber calls
   * the same `portImpedance()` (circuit.ts), so it divides by `Sp` identically.
   */
  const REQUIRED_BY_BOX: Record<SimulatableBoxType, readonly RequiredParam[]> = {
    sealed:                 [VB],
    vented:                 [VB, SP],
    'box-passive-radiator': [VB, PR_SD, PR_CMS, PR_MMD],
    bandpass4:              [VB, VF, SP],
  };

  const errors: DriverError[] = [];
  for (const p of REQUIRED_BY_BOX[simulatable]) {
    const v = P[p.field];
    // Finite as well as positive: `Infinity > 0` is true, so a bare `> 0` would admit a
    // value that is itself already the poison this guard exists to stop.
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) continue;
    errors.push({
      level: 'error',
      field: p.field,
      message: `${p.label} must be greater than zero — ${p.consequence}.`,
    });
  }
  return errors;
}
