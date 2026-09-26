# Loss mode is app-wide, so the Fsc/Qtc readout is wrong for every project but the last one touched

Status: RESOLVED (re-verified 2026-09-26) — loss mode is the project field `advanced.lossMode`.

## Symptom

The sealed-box loss model is one value for the whole application, not a property of a design.

1. Open two projects in two tabs. Set the loss mode on one. The other project's Fsc/Qtc readout
   changes too, though nothing about that design changed.
2. Save an `.owpr`, close the app, reopen the file. The readout is computed with whatever loss
   mode the browser last held — not the one the design was modelled with. The file carries no
   record of it.

## Evidence

- `packages/ui/src/logic/presentationState.ts:63` — `lossMode: string` on `PresentationState`,
  one instance per application (`buildPresentationState()`, `:79`, default `'winisd-lossy'`).
- `packages/ui/src/ui/shells/original/OriginalShell.vue:986` — the `<select>` is bound with
  `v-model="presentationState.lossMode"`, straight onto that single app-wide object. The
  selector's PLACEMENT is correct — it sits on the Box tab beside Box Type, shown only for a
  sealed box (`:983-989`). Only its storage is wrong.
- `packages/persistence/src/repos/projectRepo.ts:39` — `lossMode?: string` is a field of
  `ViewSnapshot`, the view/UI blob, not of the project record.
- `packages/ui/test/logic/persist.test.ts:199` — the test
  `'the stored payload carries no ui/cursor/graphs/lossMode'` asserts, deliberately, that a saved
  file does NOT carry it (QO90).
- `packages/design/engine/lossMode.ts` already declares a `LossMode` type and
  `Engine.sealedResonance()` takes it as a parameter — so the engine models it as an input, while
  nothing durable supplies one.

## Cause

QO90 ruled that view/UI preferences persist under their own storage key, separate from the
project. `lossMode` was placed in `ViewSnapshot` alongside genuine chrome (panel/unit
preferences, chart colours, username).

It is not chrome. It selects a physical model and changes a displayed number
(`ManagedOpenISDProject.sealedResonance()`'s Fsc/Qtc). It is the same kind of value as
`envTempK` / `envPressurePa` / `envHumidityPct` / `envUseWinisdAirModel`, which ARE project
fields (commit `611844f`).

## Fix

Move the selection onto `OpenISDProject`, beside the environment accessors, typed as the
engine's `LossMode` rather than a bare `string`. `ViewSnapshot.lossMode` is deleted; the
`<select>` binds to the focused project; the readout reads its own project's value.
`persist.test.ts:199` inverts — the saved file MUST carry it.

Needs a ruling: this reverses the `lossMode` half of QO90.

## Verification

Not yet fixed.
