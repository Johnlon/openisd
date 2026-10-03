# BUG_20261003_driver-consistency-solver-is-one-925-line-function

**Status:** OPEN — refactor todo, not a wrong number

## Symptom
There is one solver, `solveConsistencyGroup` in `packages/design/engine/driver/DriverEngine.ts`
(file is 925 lines). It is a chain of `if` blocks tied to a driver's full field set, in an order
that decides which route fills a field. The formulas also exist a second time in
`RELATIONS` in the same file, and in three driver functions (`winisdCms/Mms/Rms.ts`).
The passive radiator needs only Fs, Qms, Vas, Sd, Mms, Cms and Rms. It reuses the solver as it
stands, so the radiator now depends on the driver's whole solver.

## Steps to see it
1. `wc -l packages/design/engine/driver/DriverEngine.ts` gives 925.
2. `git grep -n "solveConsistencyGroup" packages/design` shows one private function, no relation classes.
3. `ls packages/design/engine/solvers` holds one file, `driverQuantities.ts`.

## Wanted
Componentise: one class per relation (inputs, output, `solve`) and a small group solver that runs
a given set of relations to a fixed point. The driver passes all of them, the radiator passes the
motor-less ones. One formula set replaces the three copies.

## Risks, each needs a written plan before any code
Whoever picks this up writes a plan that answers every row below and gets John's go-ahead. No
refactor code until the plan exists and the characterization tests (row 5) are committed and green
against the current solver.

| # | Risk | What the plan must state |
|---|------|--------------------------|
| 1 | Block order decides which route fills a field when several could (Vas: efficiency first, compliance last; no route for Fs from Mms and Cms). Splitting into relations can change which route wins, giving a different calculated value with no crash. | The route order as a data list, copied from the current blocks, and a test per field that has more than one route showing the same winner. |
| 2 | Entered-versus-calculated and conflict rules are spread through the blocks. A move can overwrite an entered value or drop a DQ. | Where each rule lives after the move, and a test per rule: entered value kept, calculated value replaced, conflicting entered values flagged. |
| 3 | The efficiency chain (η₀, SPLref, USPL) and the air share the function. | Whether the chain moves with the relations or stays one unit, and how the air is passed to it. Tests on η₀ and SPLref at non-default air. |
| 4 | 925 lines and about 35 quantities: every driver field in the app is touched. | The split into steps small enough that each is green on its own, in order, each its own commit. |
| 5 | The existing tests may not cover every route and precedence case. | Characterization suite: a fixed grid of entered-field subsets run through the current solver, every calculated value and DQ recorded, the new solver required to match exactly (no tolerance beyond float last digits, and any last-digit change reported by test and size). |
| 6 | The radiator now depends on the driver solver. | How the radiator's relation set is declared, so it names its seven fields and stays independent of motor fields. |

## Order of work
1. Plan covering the rows above, reviewed by John.
2. Characterization suite committed, green on the current solver.
3. Pure move, no behaviour change, its own commit, after the radiator solver work is green.
4. Gates: WinISD parity tests, domain tests, `bash scripts/compat.sh all`.

## Done
