# Two EBP methods disagree; the driver editor shows the computed one over the datasheet's

Status: OPEN

## Symptom

`OpenISDDriver` has two EBP accessors whose names differ only in case, and they return different
numbers for the same driver:

- `EBP()` / `EBPCell()` (`packages/model/src/openisdDriver.ts`, generated over `#cell('EBP')`) —
  the stated reading when the record has one (`Entered`), else the solver's value
  (`Calculated`), else null.
- `ebp()` (`packages/model/src/openisdDriver.ts:678`) — ALWAYS recomputes `Fs/Qes`, explicitly
  bypassing the cell. Its own docstring says it "carries no ENTERED/CALCULATED distinction".

`DriverEditorModal.vue:520` returns `draftDriver.value.ebp()`, so the editor shows the computed
figure even when the datasheet printed a different one.

## Evidence

Over the 1893 bundled drivers (`packages/ui/src/drivers-bundle.json`):

- **209 records state an EBP of their own.**
- **42 of those disagree with their own `Fs/Qes` by more than 1%.**

Named cases:

| driver | stated `EBP` | `Fs/Qes` |
| --- | --- | --- |
| FaitalPRO 10FE400-4 | 135 | 136.36 |
| FaitalPRO 12FE330-8 | 68 | 68.75 |
| FaitalPRO 12PR310-16 | 77 | 78.57 |

For FaitalPRO 10FE400-4 the editor shows 136.36 where the manufacturer printed 135.

That such records exist is already known to the codebase: `packages/design/engine/consistency.ts:112`
declares the relation `EBP = Fs/Qes` precisely so the disagreement can be REPORTED. `ebp()`
silently resolves it instead, in favour of the computed value.

## Cause

`ebp()` was added as a "live-editor display shortcut" and hard-codes one side of a relation the
record can legitimately state both sides of. Provenance is not a display concern: the same field
reached through `EBPCell()` carries `Entered`/`Calculated`, and reached through `ebp()` carries
nothing, so the editor cannot mark it and cannot show the datasheet's own figure.

It also constructs `new Engine()` on every call.

## Fix

Not yet applied — needs John's ruling, because it changes a displayed number.

The candidate is to delete `ebp()` and have `DriverEditorModal.vue:520` read `EBPCell()`, which
gives it the value AND the provenance the rest of the editor's fields already carry. The
disagreement then surfaces as a consistency issue, which is what `consistency.ts:112` exists for.

## Verification

Not yet run.
