/**
 * The T/S consistency-group adapter for `OpenISDDriver` (ARCHITECTURE.md AD-8).
 *
 * The formulas themselves live in exactly one place — `solveConsistencyGroup` in
 * `@openisd/engine` (`engine/driver.ts`), which is what this function, `Driver#derive()`
 * (`winisd/driver.ts`), and `wdr.ts` all now call instead of each keeping their own copy.
 * This file's only remaining job is the adapter: OpenISDDriver stores T/S fields nested
 * (`readings[origin].read_value`), the solver needs a flat `Record<string, number>`.
 *
 * The two extra directions solveConsistencyGroup covers beyond a one-directional E/C/N
 * pass (Fs from Mms+Cms; Re from Qes+BL+Fs+Mms) came from this file originally — see that
 * function's docstring for the fixture proof and the still-open BUG-006 caveat on Re.
 * GAPS.md §A4 ("E/C/N derivation is one-directional; WinISD's is a group solver") stays
 * open — these two additions are partial coverage, not a full small-system solver.
 */
import { RHO, C, deriveDriver, solveConsistencyGroup } from '@openisd/engine';
import type { DriverRaw, DriverError } from '@openisd/engine';

export interface OpenISDDerivation {
  /** Every derivable field, SI units — both entered (passed through unchanged) and
   *  newly computed. Matches Derivation.fields' contract in driver.ts. */
  fields: Record<string, number>;
  errors: DriverError[];
}

/**
 * Solve every derivable field from `entered` (already-present flat SI numbers — i.e.
 * winningReading(entry).read_value for whatever is present in an OpenISDDriver's specs).
 * An entered value is NEVER overwritten — WinISD's fixed-E override semantics, same
 * guarantee `#derive()` makes.
 */
export function deriveOpenISDFields(entered: Readonly<Record<string, number>>): OpenISDDerivation {
  const filtered: Record<string, number> = {};
  for (const k in entered) {
    const v = entered[k];
    if (typeof v === 'number' && isFinite(v)) filtered[k] = v;
  }
  if (filtered.Dia != null && filtered.Dd == null) filtered.Dd = filtered.Dia;

  const r = solveConsistencyGroup(filtered, { full: true }) as Record<string, number>;

  if (r.Dia == null && r.Dd != null) r.Dia = r.Dd;

  // no/SPL — NOT part of solveConsistencyGroup (three disagreeing constants exist
  // across the codebase; see its docstring). Kept here, unchanged from before.
  if (r.no == null && r.Fs != null && r.Vas != null && r.Qes != null)
    r.no = 4 * Math.PI ** 2 / C ** 3 * r.Fs ** 3 * r.Vas / r.Qes;
  if (r.SPL == null && r.no != null && r.no > 0) r.SPL = 112.1 + 10 * Math.log10(r.no);

  if (r.c == null) r.c = C;
  if (r.roo == null) r.roo = RHO;

  // Same validation authority #derive() uses — unchanged, not part of this extraction's
  // scope to replace. `DriverRaw`'s retirement (AD-9) is a separate, focused pass.
  const { errors } = deriveDriver(r as unknown as DriverRaw);
  return { fields: r, errors };
}
