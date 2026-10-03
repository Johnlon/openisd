# Plan: split the driver consistency solver into relations

Status: DRAFT for John's go-ahead. Nothing refactored yet. Delete this file when the work lands.
Bug file: [`bugs/BUG_20261003_driver-consistency-solver-is-one-925-line-function.md`](../../bugs/BUG_20261003_driver-consistency-solver-is-one-925-line-function.md).
Net: `packages/design/test/driver-solver-characterization.test.ts` (196 cases, golden in
`test/fixtures/driverSolverGolden.ts`, written before any refactor, green on the current solver).

## What exists

- `DriverEngineImpl.solveValues` (`engine/driver/DriverEngine.ts`): one fixed-point loop, up to 10
  passes, of 54 guarded rules in a fixed order, then a finish stage.
- A rule is `if (r.X == null && <inputs present> [&& <extra guard>]) setVal('X', formula)`.
  `setVal` writes only a null target and only a finite value above 0. Rejected results leave the
  target null, so a later rule can still fill it.
- An entered value is a value present in the input; it is never written. `solve()` feeds only
  entered values, so a calculated value is never read back as typed.
- `RELATIONS` (13 entries) restates 13 of the formulas for `checkConsistency`, which compares each
  entered value with what the others imply, within the fields' precision.
- `calculatedWidths` and `inheritedWidths` call `solveValues` repeatedly with one input nudged.
- Three more copies of Cms, Mms and Rms: `domain/driver/winisdCms.ts`, `winisdMms.ts`,
  `winisdRms.ts` (driver-model switch).
- `PrEngine.solveSpec` runs the radiator's seven figures through the whole driver solver.

## (a) Inventory of the blocks in `solveValues`

Order is the position in one pass. "Rules" is the count of `setVal` rules in the block.
Entered handling is the same everywhere (target must be null); exceptions are named.

| # | Block | Rules | Outputs | Inputs | Route / comment | Later blocks that read the output | Air |
|---|-------|-------|---------|--------|-----------------|-----------------------------------|-----|
| 1 | Sd and Dd | 2 | Sd, Dd | Dd or Sd | geometry | 4 (Cms, Vas), 7, 8, 9, 9b | no |
| 2 | Q trio | 3 | Qts, Qes, Qms | any two | parallel Q; Qes needs Qms > Qts, Qms needs Qes > Qts | 3, 5, 6, 10, 13 | no |
| 3 | Fs, five routes | 5 | Fs | rel 11 Mms, Cms; rel 14 no, Qes, Vas; rel 2 Qes, BL, Mms, Re; rel 4 Rme, Qes, Mms; rel 12 EBP, Qes | first ready route in this order wins, losers never revisited | 3b, 4, 5, 6, 13 | rel 14 |
| 3b | Mms from Fs, Cms | 1 | Mms | Fs, Cms | reverse of rel 11 | 4, 5, 6, 13 | no |
| 4a | Cms, Sd | 3 | Cms, Sd | Cms: Vas, Sd (first) or Fs, Mms; Sd: Vas, Cms | geometry route first by John's test 2026-09-01 | 3b, 4 Vas, 5, 6 | yes |
| 4b | no, four routes | 4 | no | rel 14 Fs, Vas, Qes; rel 15 BL, Sd, Mms, Re; rel 18 SPL; rel 18 SPLref | all before the Vas rules, per WinISD site order (FINDING-028) | 4c, 10, 11 | yes |
| 4c | Vas, two routes | 2 | Vas | rel 14 no, Qes, Fs (first); rel 10 Cms, Sd | efficiency first, compliance last (FINDING-027/028) | 3 rel 14, 4b rel 14, 10 | yes |
| 5 | Rms, Qms, Mms | 3 | Rms, Qms, Mms | Fs plus two of Mms, Qms, Rms | no route gives Fs from this triple | 13 | no |
| 6 | Qes, Re, BL, Mms | 4 | Qes, Re, BL, Mms | the other four of Qes, BL, Fs, Mms, Re | Fs from this group is block 3 rel 2 | 12, 13 | no |
| 7 | Xmax, Hc, Hg | 4 | Xmax, Hc, Hg | gap pair, or Xmax with one of them, or Vd and Sd | gap route wins on its result: equal Hc and Hg gives 0 and falls through to Vd over Sd | 8, 9, 13 | no |
| 8 | Sd from Vd, Xmax | 1 | Sd | Vd, Xmax | fallback | 9 | no |
| 9 | Vd | 1 | Vd | Sd, Xmax | | 13 | no |
| 9b | DVol, Depth, MagDepth, Magnet | 4 | one missing of the four | the other three, Dd, Vcd | `dvolRelation.ts` returns null on a degenerate geometry, so `setVal` is not reached | none | no |
| 10 | Qes from no | 1 | Qes | no, Fs, Vas | | 6, 13 | yes |
| 11 | SPLref, SPL from no | 2 | SPLref, SPL | no | | 12, 13 | yes |
| 12 | USPL, Re, SPLref | 3 | USPL, Re, SPLref | stated SPL else SPLref, Re or USPL | 2.83 V reference, `2.83²` not 8 | 13 | no |
| 13 | Advanced figures | 9 | Rme (2), Mpow (2), gamma, SPLmax, Gloss, SPLmaxLF, Mcost | Fs, Mms, Qes, BL, Re, Xmax, Pe, Vd, Hc, Hg | Rme motional route first; Mpow from BL and Re, not root Rme; Mcost only above zero gap | none | SPLmaxLF |
| 14 | Znom | 1, bypasses `setVal` | Znom | Re | accepts a computed 0 when Re < 2/3 | none | no |
| 24 | KLe | 1 | KLe | Le, fLe | one direction only, by design | none | no |

Finish stage, after the loop, run once and never iterated:

| Step | What | Reads |
|------|------|-------|
| c and roo | fill from the record's own `driverC` / `driverRho` | stated c or roo, else reference air |
| EBP | Fs/Qes when Qes > 0 | Fs, Qes |
| Re terminal, BL terminal | wiring-dependent values, from the final Re and BL | numVC, wiring |

## (b) Proposed shape

Two nouns, a list and a loop. No new string routing: targets and inputs stay the compiler-checked
property names of `DriverSolverParams` (the existing field registry).

| Part | Role |
|------|------|
| `SolveRoute` (class, one instance per rule, 54) | states `target`, `inputs`, an optional extra guard, and the formula as a method. `ready(working)` is "target null and all inputs present and the extra guard". `value(working, air)` is the formula. No instance holds state. |
| `DriverRoutes` (frozen ordered list) | the 54 routes in exactly today's order, each commented with its block and rel number. The order is data, copied from the blocks. |
| `RouteGroup` (class) | holds an ordered list of routes. `run(stated)` is the loop: up to 10 passes, per route `ready` then `setVal` semantics (finite and above 0, else leave null), until a pass changes nothing. Znom's bypass is a route flag, not a special case in the loop. |
| `DriverAir` | reads the working set each time (`c(r)`, `rho(r)`: stated, else derived, else reference air), exactly `driverC` and `driverRho` today. Passed to `value`. |
| Finish stage | a short ordered list of finishers run once after `run`. Stays in the driver, not a route: iterating them would fix terminal values to a Re the loop then moved. |
| Relation (checker) | each `RELATIONS` entry becomes a `predict` on the route group's relation record, so the formula text appears once. `checkConsistency` iterates the same objects. |

Decisions inside the shape:

- **Entered wins:** it stays the single rule "target must be null in the working set", enforced in
  `ready`. No route can write an entered value.
- **Conflict and DQ:** stay in `checkConsistency`, which reads each route group relation's
  `predict` and the precision-based tolerance. Not inside the loop.
- **Efficiency chain (eta0, SPLref, USPL):** the chain is made of ordinary routes (4b, 4c, 10, 11,
  12), so it moves with them, in the same positions. It is not a unit. The constants
  (`efficiency.ts`) stay where they are and are called from the routes.
- **Air:** passed to every route as `DriverAir`, never read from a module value. Same priority as
  today. No route constructs air.
- **Radiator:** `PrEngine` declares its subset as an explicit ordered list of ten routes (Sd from
  Vas and Cms; Cms from Vas and Sd, then from Fs and Mms; Mms from Fs and Cms; Fs from Mms and Cms;
  Vas from Cms and Sd; Rms; Qms; Mms from Fs, Qms, Rms), taken from `DriverRoutes` by member, not by
  name. `PrEngine` builds its own `RouteGroup` from them, so its constructor no longer takes the
  driver engine. The radiator cases in the characterization suite are the proof that the seven
  figures come out equal to the full solver's.
- **Driver-model switch:** `winisdCms`, `winisdMms`, `winisdRms` call the route's `value` for the
  formula and keep only what is theirs: the slot, and the "not a positive number: use the entered
  field" fall-back. Decision 3 below.

Conforms to `packages/design/AGENTS.md`: no module-level mutable state (routes and lists are
frozen, instances stateless), no casts, no `any`, no inline object types, no forwarding methods.

## (c) The six risks of the bug file

| # | Risk | Plan |
|---|------|------|
| 1 | Route order decides the winner when several could fill a field. | Order is a frozen data list copied from the blocks, one entry per rule, so the diff against the old file is one-to-one. Competing-route cases in the suite (18) fail if any pair swaps; mutation check done on the Vas pair (11 red) and the Rme pair (66 red). Each step keeps the full golden green. |
| 2 | Entered-versus-calculated and conflict rules are spread through the blocks. | Entered wins in one place, `ready`. Conflict stays in `checkConsistency`. Suite has stated-value-kept, inconsistent-record and Qts-trio cases; record cases check each field's entered flag and the issues. |
| 3 | The efficiency chain and air share the function. | The chain stays as ordinary routes in place. Air goes in as `DriverAir`. Eight air cases (pressure, temperature, stated c only, stated roo only) and the chain cases pin it. |
| 4 | 925 lines, about 35 quantities. | Seven steps below, each green on its own and its own commit. Step 1 changes shape only. |
| 5 | Existing tests may miss routes and precedence. | Done first: 196 cases. Every block alone (69), route competitions (18), consistent records (4), leave-one-out and leave-two-out of a consistent record (12 + 66), inconsistent records (11), air (8), radiator subsets (8). Two mutation checks proved it goes red. |
| 6 | The radiator would depend on the driver solver. | The radiator names its ten routes and owns its `RouteGroup`. It depends on route objects, not on `DriverEngine`. |

## (d) Steps

Each step is one commit, ends green on: the characterization suite untouched, the WinISD parity
tests, `domain.test.ts`, `engine-wiring.test.ts`, `bash scripts/compat.sh all` (same 2
disagreements), typecheck, the architecture tests.

1. **Routes as data, loop unchanged in behaviour.** Convert each `if (…) setVal(…)` into a
   `SolveRoute` in `DriverRoutes`, add `RouteGroup`, make `solveValues` call it. Finish stage moves
   as it is. No file other than the driver area changes.
2. **Group routes by relation.** Name the formula once per relation; routes of one relation
   (for example Fs, Mms and Cms from `Fs = 1/(2π√(Mms·Cms))`) share it.
3. **Merge `RELATIONS` into the relation records.** `checkConsistency` and the width functions
   read the same objects. Delete the duplicate list.
4. **Radiator subset.** `PrEngine` builds its own `RouteGroup` from its ten routes; its
   constructor drops the driver engine; `Engine.ts` wiring follows.
5. **Driver-model functions.** `winisdCms`, `winisdMms`, `winisdRms` reuse the route formulas.
6. **Delete.** Dead helpers (`valuesFrom` if unused, the old `driverC` / `driverRho` free functions
   once `DriverAir` replaces them).
7. **Docs.** Update the bug file, close it, delete this plan.

## (e) Deleted at the end

- The 54 `if` blocks in `solveValues` (step 1).
- The 13-entry `RELATIONS` list, as a separate copy of the formulas (step 3).
- The Cms, Mms and Rms formulas in `winisdCms.ts`, `winisdMms.ts`, `winisdRms.ts`; the files stay
  only if Decision 3 keeps the slot-and-fallback wrappers (step 5).
- `PrEngine`'s dependency on `DriverEngine` (step 4).

## Decisions for John

Recommendation first in each.

1. **Where the routes live.** Recommend a folder `engine/driver/routes/` with one file per block
   group and `DriverRoutes.ts` holding the ordered list. Alternative: one file.
2. **Keys.** Recommend keeping the existing typed property names of `DriverSolverParams` as
   targets and inputs. Alternative: a new static enumeration of fields (your 2026-09-28 ruling on
   the field registry). Not recommended: it would be a second registry beside `DriverSolverParams`.
3. **The three driver-model files.** Recommend they stay as thin wrappers that call the route's
   formula and add the slot and fall-back (they reshape, so they are not forwards). Alternative:
   delete them and put the slot logic in `OpenIsdDriverSpec.solverParams`.
4. **Radiator subset.** Recommend an explicit ten-route list in `PrEngine`. Alternative: derive the
   subset by filtering `DriverRoutes` to routes whose inputs and target are among the radiator's
   seven; shorter, but the membership would no longer be readable in one place.
5. **Finish stage.** Recommend it stays a short ordered list of finishers inside the driver.
   Alternative: fold c and roo into routes; rejected, they must not iterate.
6. **Checker.** Recommend the `predict` formulas move onto the relation records (step 3).
   Alternative: leave `RELATIONS` as a second list; rejected, it is the duplication this bug is about.
