# Eight user-facing managed setters say `set()` where the action is an entry

## Status
FIXED

## Symptom

`ManagedOpenISDProject` delegated eight user-facing setters to the domain's `set()` — the
restore/wire verb — where the caller's action is a user entry, whose verb is `enter()`.
Sites in `packages/ui/src/logic/managedProject.ts` (verified 2026-08-23 at df29244):
`setEnvTempK` :324, `setEnvHumidityPct` :326, `setEnvPressurePa` :328, `setDriverCount`
:339, `setInputPower_W` :343, `setSeriesResistance_ohm` :346, `setVcTempRise` :366,
`setDriverAddedMass` :371 — the only `p.set(` calls in the file.

## Evidence

Found by opus2's adversarial review of P4b-1 (U1). Re-verified by reading
managedProject.ts:318-375. The review's escalation — that a cleared-then-retyped field
would silently skip its provenance mark — was tested and REFUTED against the domain:
`cell()` (openisdProject.ts:996-999) reports every relation-less field unconditionally
Entered ("stated facts... QO36-B4"), these fields are never tracked in `target.entered[]`,
and `enter()` (:1049-1050) delegates them to `set()` by documented design ("its enter IS
the plain write"). No provenance can be lost through either verb.

## Severity

No behavioural defect: for the eight relation-less fields, `enter()` and `set()` are the
same operation today. The cost is contract legibility — df29244's commit message defines
`set()` as the restore/wire verb, so a reader of these sites wrongly concludes the setters
are restore paths — and a latent trap: if any of the eight ever gains a relation,
`enter()` at the call site is required for the solve, and `set()` would silently skip it.

## Cause

P4b-1 introduced `set()` for `loadUiParams`'s wire-adoption path and converted the managed
setters mechanically to the new verb, instead of asking per site which verb the caller's
action is.

## Fix

The eight setters delegate `p.enter(<field>, value)`. Restore paths (`loadUiParams`) keep
`set()`. A test pins the QO36-B4 contract the refutation rests on: a relation-less field
reports Entered from `cell()` even after an explicit `clear()`.

## Not this bug: the 1.20096 air-density failure

`advanced-environment.browser.spec.ts:47` (ignore-checked air density 1.20096 ≠ 1.20095) was
initially attributed to this change because the first failing run had this diff on disk. A
baseline run with the diff stashed fails identically; the defect is the engine's `winisdAir()`
rewrite in c83e0ad — see
bugs/BUG_20260823_winisdair_recomputes_moist_air_instead_of_winisds_stored_constants.md.

## Verification

`grep -c "p.set(" packages/ui/src/logic/managedProject.ts` → 0; managedProject suite green
including the new contract pin.
