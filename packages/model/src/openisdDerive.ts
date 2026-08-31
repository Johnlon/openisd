// PACKAGE DECOMMISSIONED — John Lonergan, 2026-08-31: "I don't want to discuss the model package
// any more unless we are borrowing a concept from it - immediately comment out all code in that
// package".
//
// Every line below is commented out. The package exports nothing and compiles to nothing. It is
// kept, rather than deleted, ONLY as a reference to borrow a concept from while
// docs/plans/PLAN_DELETE_PACKAGES_MODEL.md moves the app onto packages/design. Delete the
// directory once that plan is finished.

// /**
//  * The T/S consistency-group adapter for `OpenISDDriver`.
//  *
//  * The formulas themselves live in exactly one place — `solveConsistencyGroup` in
//  * `@openisd/engine` (`engine/driver.ts`), which is what this function, `Driver#derive()`
//  * (`winisd/driver.ts`), and `wdr.ts` all now call instead of each keeping their own copy.
//  * The η₀ → SPL constant likewise has one home, `@openisd/engine`'s `efficiency.ts`.
//  * This file's only remaining job is the adapter: OpenISDDriver stores T/S fields nested
//  * (`readings[origin].read_value`), the solver needs a flat `Record<string, number>`.
//  *
//  * The two extra directions solveConsistencyGroup covers beyond a one-directional E/C/N
//  * pass (Fs from Mms+Cms; Re from Qes+BL+Fs+Mms) came from this file originally — see that
//  * function's docstring for the fixture proof and the still-open BUG-006 caveat on Re.
//  * GAPS.md §A4 ("E/C/N derivation is one-directional; WinISD's is a group solver") stays
//  * open — these two additions are partial coverage, not a full small-system solver.
//  */
// import { Engine } from '@openisd/design/engine';
// import type { DriverError } from '@openisd/design/engine';
//
// export interface OpenISDDerivation {
//   /** Every derivable field, SI units — both entered (passed through unchanged) and
//    *  newly computed. Matches Derivation.fields' contract in driver.ts. */
//   fields: Record<string, number>;
//   errors: DriverError[];
// }
//
// /**
//  * Solve every derivable field from `entered` (already-present flat SI numbers — i.e.
//  * winningReading(entry).read_value for whatever is present in an OpenISDDriver's specs).
//  * An entered value is NEVER overwritten — WinISD's fixed-E override semantics, same
//  * guarantee `#derive()` makes.
//  */
// export function deriveOpenISDFields(entered: Readonly<Record<string, number>>): OpenISDDerivation {
//   const engine = new Engine();
//   const filtered: Record<string, number> = {};
//   for (const k in entered) {
//     const v = entered[k];
//     if (typeof v === 'number' && isFinite(v)) filtered[k] = v;
//   }
//   if (filtered.Dia != null && filtered.Dd == null) filtered.Dd = filtered.Dia;
//
//   const r = engine.solveConsistencyGroup(filtered) as Record<string, number>;
//
//   if (r.Dia == null && r.Dd != null) r.Dia = r.Dd;
//
//   // η₀ and SPL through the ONE implementation in @openisd/engine, evaluated at this
//   // driver's own air — c/roo are already filled by solveConsistencyGroup above, the same
//   // entered-or-computed path as every other derivable field. `no`/`SPLref` are likewise
//   // already filled; `SPL` is the `.wdr` spelling of the same quantity.
//   if (r.SPL == null && r.no != null && r.no > 0) r.SPL = engine.splFromEfficiency(r.no, { rho: r.roo, c: r.c });
//
//   // Same validation authority #derive() uses.
//   const { errors } = engine.deriveEngineDriver(r);
//   return { fields: r, errors };
// }
//