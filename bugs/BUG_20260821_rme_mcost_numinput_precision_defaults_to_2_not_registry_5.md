# Rme and Mcost NumInputs default to 2 dp while the registry declares precision 5

Status: OPEN

## Symptom

`DriverEditorModal.vue`'s Rme and Mcost `NumInput`s pass no `:precision`, so the component
default of 2 (`NumInput.vue:29`) applies. The field registry declares `precision: 5` for both,
and WinISD prints 5 dp. The displayed values are truncated relative to WinISD.

## Evidence

- `packages/ui/src/logic/fields/fieldRegistry.ts`: `Rme` precision 5, `Mcost` precision 5.
- `DriverEditorModal.vue`: every other unitized field passes `:precision="precision('<id>')"`;
  Rms passes a literal `4` that happens to match; Rme/Mcost pass nothing.
- The 2 also feeds `displayPrecision` as `baseDp` for the resistance unit toggle (QO51 work),
  so the wrong base is now load-bearing for the toggle's dp arithmetic.

## Cause

Missing `:precision` bindings; additionally `MAX_DP = 4` (`units.ts:37`) clamps any dp above 4,
so binding the registry's 5 would still display 4 — the correct target dp needs a ruling
(raise MAX_DP, or accept 4) before a fix.

## Fix

None yet — needs the MAX_DP ruling first.

## Verification

Closure = ruled dp bound applied, `:precision` bound from the registry on Rme/Mcost (and Rms's
literal replaced with the registry read), display matching WinISD's printout pinned by a test.
