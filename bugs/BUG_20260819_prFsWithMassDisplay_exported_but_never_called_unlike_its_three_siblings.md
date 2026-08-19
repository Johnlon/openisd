# `prFsWithMassDisplay` is exported and documented but has zero callers, unlike its three siblings

# Status
OPEN

## Symptom

`packages/ui/src/logic/prWinIsdFields.ts` declares four PR display-formula wrappers:
`prVasDisplay`, `prFsDisplay`, `prFsWithMassDisplay`, `prQmsDisplay`. `PREditModal.vue:4` imports
and uses three of them (`prVasDisplay`, `prFsDisplay`, `prQmsDisplay`) — `prFsWithMassDisplay`
is not imported anywhere, in that file or any other.

The underlying value it would display — Fs with the radiator's added mass, the tuned (not
free-air) frequency — IS shown elsewhere in the app: `OriginalShell.vue:1299` reads it directly
via `managedProject.prFsWithMass_hz()`, bypassing this file entirely.

## Cause

Not established. Two candidate explanations, and picking between them needs a product
decision, not a guess:
1. `PREditModal.vue` (editing the PR component's own datasheet-derived properties: Vas, free-air
   Fs, Qms) legitimately does NOT need the with-added-mass tuning, because that value depends on
   the box/design context (`prMadd`), not the component alone — `OriginalShell.vue` showing it
   is correct, and this wrapper function is simply dead, unused code.
2. `PREditModal.vue` was meant to show all four PR-derived values for symmetry/completeness and
   this one row was left out when the modal was built — a genuine, if minor, UI gap.

## Fix

Not applied — needs a decision on which of the two above is true before doing anything: delete
`prFsWithMassDisplay` (case 1), or add the missing row to `PREditModal.vue` (case 2).

## Verification

Not yet — no fix applied.
