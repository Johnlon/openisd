# BUG_20261005_cleared-pr-field-saved-as-zero

**Status:** RESOLVED

## Symptom
Clearing a passive radiator box (Vas, Qms, Fs, Sd or Xmax) in either shell stores 0 in the project instead of
leaving the field empty. The user ends up with a radiator whose Vas is 0, which they never typed.

## Evidence
Checked 2026-10-05:
- `packages/ui/src/ui/components/NumInput.vue:192-197`: an empty box emits `null`.
- Every PR field handler turns that null into 0 with `set(v ?? 0)`:
  - `packages/ui/src/ui/shells/mobile/MobileEnclosureTab.vue:172,178,185,191,197` (Vas, Qms, Fs, Sd, Xmax)
  - `packages/ui/src/ui/shells/original/OriginalShell.vue:558,559,568,569,572` (Vas, Qms, Fs, Sd, Xmax)
- `packages/design/test/domain/pr-spec-resolve.test.ts` passes 12/12 (vitest): a 0 does not crash the solver,
  but the 0 is still stored.

## Cause
Not a calculation. The UI handler swaps the empty box's `null` for `0` before it reaches the model.

## Fix
Done 2026-10-05. New `packages/ui/src/logic/enterOrClear.ts`: a `null` from an emptied box calls `clear()`;
a number calls `set()`. Both shells now use it for PR Vas, Qms, Fpr, Sd, Xmax and Target tuning (Fp).
Left as `?? 0` on purpose: added mass, VC temp rise, alfaVC and Rs, where 0 means "none". Also the vent
W/H/D handlers, which are not in this bug's scope.

## Verification
`original-pr-tab.browser.spec.ts` › "emptying a PR box clears its field rather than storing 0": fills
then empties each of the six boxes. No box reads 0, and no stored spec value is 0. Passes, and the full
file passes 13/13. `vue-tsc --noEmit` is clean.
