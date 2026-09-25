# `sectionFor` maps an undeclared `driver_type` to `woofer`, indistinguishable from valid data — and the model cannot see the enum that defines its own discriminator

Status: OPEN

## Symptom

`packages/model/src/openisdDriver.ts`, `sectionFor()`: every value that is not `tweeter`,
`amt` or `passive-radiator` returns `'woofer'`. An undeclared value (`'banana'`) therefore
takes the identical branch as the nine driver types that legitimately read the woofer
section — nothing downstream can report the record as defective. `packages/ui/src/driverType.ts`'s `DriverType.parse` states the house
semantics for exactly this case: an undeclared value is INVALID data returning a
distinguishable null "while the record stays reportable as a data defect".

## Evidence

Both sites read 2026-08-21 during the D7 review. Structural root: `driver_type` is typed
`_ScrapedField<string>` (`openisdDriver.ts:95`) and the closed vocabulary (`DriverType`) lives
in `@openisd/ui`, which `@openisd/model` cannot depend on (dependency direction is
model→engine/winisd only) — the record model has nothing to validate its own discriminator
against. Contrast: `AlignmentKind` in `openisdProject.ts` is handled by an exhaustive
no-default `switch` (TypeScript-enforced totality) — the house pattern `sectionFor` lacks.
`packages/model/test/openisdDriver.test.ts` pins the fallback behaviour with an arbitrary
undeclared value, since every undeclared value takes that one branch.

## Cause

The vocabulary lives in the wrong package for the model that consumes it; `sectionFor`'s
ternary has no distinguishable arm for undeclared values.

## Fix

Not yet applied. Direction: move the `DriverType` vocabulary into a package the model can see
(engine or model itself), validate the discriminator against it, and give `sectionFor` (or its
caller) a distinguishable outcome for an undeclared value, following the exhaustive-switch
house pattern.

## Verification

Closure = an undeclared driver_type is reportable as a data defect (test constructs one and
observes the report), declared values unchanged, model/ui suites green.
