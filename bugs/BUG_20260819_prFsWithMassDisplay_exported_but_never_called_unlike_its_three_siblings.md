# `prFsWithMassDisplay` is exported and documented but has zero callers, unlike its three siblings

# Status
RESOLVED (2026-08-21) — `PREditModal.vue:4,23` imports and calls `prFsWithMassDisplay`.

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

## Human ruling (2026-08-21)

Case 2 — add the missing row.

## Fix

Applied: `PREditModal.vue` now imports `prFsWithMassDisplay`, adds `prFsWithMassShown` computed,
and a read-only "Fs (with mass)" row (no setter — this value depends on `prMadd`, edited at the
box/design level, not the PR component's own datasheet properties) between `Fs` and `Qms`.

## Verification

`npx vue-tsc --noEmit -p packages/ui` — clean (pre-existing unrelated `App.vue` module-resolution
error only).
