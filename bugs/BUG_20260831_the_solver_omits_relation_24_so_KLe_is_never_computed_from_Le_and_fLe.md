# The solver omits relation 24, so `KLe` is never computed from `Le` and `fLe`

Status: FIXED

## Symptom

A driver stating `Le` and `fLe` but not `KLe` gets NO `KLe`. WinISD computes it. Our solver has
no relation connecting the three, so the value is simply absent — in the driver editor, and in
every `.wdr` this repo emits.

`Le` and `fLe` are likewise never offered as derivable from `KLe`'s presence, but that half is
correct and not part of this bug (see "Scope" below).

## Evidence

**John, 2026-08-31, manual test against real WinISD: WinISD DOES relate these fields.** That is
the primary evidence, and it is what makes this a defect rather than a documentation question.

**The relation, `docs/design/WINISD_SCHEMA.md` §rel-24 (line 355 and 1040), recorded as "read
directly from WinISD's calculation engine":**

```
KLe = Le · √(2π·fLe)          members: KLe, Le, fLe
```

**Our tree implements no part of it.** Every `KLe` occurrence, found by grep 2026-08-31:

| site | what it is |
| --- | --- |
| `packages/design/domain/project.ts:174` | `readonly KLe?: SpecEntryJson` — a record field |
| `packages/design/domain/project.ts:1185,1305` | `KLe_H_sqrtHz: Field<number>`, read from the record |
| `packages/winisd/src/winisdDriver.ts:69` | a key in `INI_ROWS` |
| `packages/winisd/src/parstate.ts:51` | ParState slot 7 |
| `packages/winisd/src/driverYmlToOpenisdAndWdr.ts:89` | passed straight through to `.wdr` |

There is no arithmetic anywhere — no multiplication, no `Math.sqrt`, nothing referencing `fLe`
alongside `Le`.

**`SolverQuantities` (`packages/design/engine/solverQuantities.ts`) declares none of the three.**
Grepped for `Le`, `KLe`, `fLe`, `inductance`: zero matches in that file. `Le` reaches the physics
only as a SEPARATE parameter on the sweep signature —
`Engine.sweep(drv: SolverQuantities, Le_H: number | undefined, …)` (`Engine.ts:238`), consumed at
`circuit.ts:121` as coil impedance. That electrical path is correct and unaffected; it is a
different role from rel-24.

**`consistency.ts` mentions `Le` zero times**, so nothing flags a record whose stated `KLe`
contradicts its stated `Le`/`fLe` either.

**Already recorded as a known output gap:** `docs/spec/SPEC_ENGINE.md:459` lists `fLe` and `KLe`
first among 16 fields the superseded Python writer omitted that "every genuine save carries".

## Cause

`SolverQuantities` is documented as "WHAT THE SOLVER IS GIVEN" — the quantities the consistency
fixpoint operates over. `Le`, `fLe` and `KLe` were left out of it, so rel-24 had nowhere to live
and was never written. The omission then reads as deliberate: the type's own docstring justifies
excluding *terminal* values ("always derived, never stated"), which invites the reader to assume
every other absence is equally considered. It was not.

## Scope — what is and is not wrong

- **`KLe` derivable from `Le` and `fLe`: MISSING.** This is the defect.
- **`Le` and `fLe` not derivable from anything: CORRECT.** `WINISD_SCHEMA.md` §rel-24 states the
  relation is "one direction only — nothing anywhere calculates `Le` or `fLe`, which is why both
  are always either typed in or absent." A fix must NOT make them computable.
- **`Le_H` as a separate sweep parameter: CORRECT.** That is its impedance role
  (`circuit.ts:129`, `Zcoil = Rdc + jωLe`), independent of rel-24.

## Fix

Applied 2026-08-31 on John's explicit instruction ("implement the missing feature"), which is the
permission `AGENTS.md` §"Calculation logic" requires.

**`packages/design/engine/solverQuantities.ts`** — added `Le_H`, `fLe_hz`, `KLe_H_sqrtHz`, and
added all three to `QUANTITY_NAMES` (the completeness proof rejects the class otherwise).

**`packages/design/engine/solver.ts`** — relation 24 after the `Znom` block, ONE-DIRECTIONAL:

```ts
if (r.KLe_H_sqrtHz == null && r.Le_H != null && r.fLe_hz != null && r.fLe_hz > 0) {
  setVal('KLe_H_sqrtHz', r.Le_H * Math.sqrt(TAU * r.fLe_hz));
}
```

**`packages/design/engine/consistency.ts`** — the same relation in `KLe`-target form, so a stated
`KLe` contradicting a stated `Le`/`fLe` is marked (John, 2026-08-31: *"yes if things dont add up we
want the screen to [carry] a mark"*, and that is the rule for EVERY derivation, not this one alone).
WinISD does not check this trio; we do.

**`packages/design/domain/project.ts`** — `fields()` now passes `Le`, `fLe` and `KLe` to the solver.
Without this the relation is green in a direct engine call and DEAD from the app, because `fields()`
is the only route the domain feeds the solver by. Made by session `api-design`, who owns that file.

## Verification

Engine, then domain, then contradiction — each measured, not assumed:

| check | result |
| --- | --- |
| `solveConsistencyGroup({Le_H: 0.0007, fLe_hz: 1000})` | `KLe = 0.055486582166484145` = `0.0007·√(2π·1000)` |
| the same via `driverFromConformingRecord` + `driver.solveConsistencyGroup()` | identical value, so the app path is live |
| stated `KLe` at twice its true value | flagged by `checkConsistency`, naming `KLe_H_sqrtHz` |
| `Le`/`fLe` from a stated `KLe` | never derived — one-directionality holds |

`packages/design/test/engine/driver.test.ts` — 6 tests, 24/24 green. Each gate made to FAIL ON
PURPOSE before being trusted: breaking the solver formula goes red; adding the inverse trips the
one-directional guard; breaking the consistency predict trips the agreement test; removing a name
from `QUANTITY_NAMES` fails the completeness proof with TS2322.

`consistency.test.ts` is 6 red / 18 passed both WITH and WITHOUT this change — measured by
reverting the entry and re-running. Those 6 are the `EngineQuantities`→`SolverQuantities` rename
(tests still using bare `Fs`, `DVol`), not this work.

## Still open

The `.wdr` writer (`packages/winisd/src/driverYmlToOpenisdAndWdr.ts`) reads STATED record values,
not solved ones, so a computed `KLe` still does not reach the emitted file — it writes a filler and
ParState carries no `C` marks at all. That is a separate gap covering every derived quantity, not
just this relation.
