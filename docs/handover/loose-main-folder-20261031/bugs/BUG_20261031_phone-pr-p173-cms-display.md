# P173 Cms appears missing in the phone passive-radiator UI

## Report

On the `test.openisd.app` phone UI, Accuton P173 appears not to show its Cms value,
while Cms is visible for some other passive radiators.

## Verified facts

- P173's bundled record is `packages/ui/public/drivers/accuton/p173.json`.
  It contains `Cms_m_per_N.value = 0.00101`, with source text `1.01 mm/n`.
- `packages/ui/public/passive-radiators-index.json` has the P173 row with
  `Cms_m_per_N: 0.00101`.
- The deployed test URLs were checked and expose the same P173 value:
  `/drivers/accuton/p173.json` and `/passive-radiators-index.json`.
- The local catalogue has 80 passive-radiator rows: 73 have a non-null
  `Cms_m_per_N`; 7 genuinely have `null`. P173 is not one of those seven.

## Browser-row path

1. `packages/persistence/src/repos/bundledPassiveRadiatorRepo.ts` reads the
   index row, including `Cms_m_per_N`.
2. `packages/ui/src/logic/driverDisplay.ts` turns each index row into a
   `PassiveRadiatorRow`. `radiatorRow()` formats Cms as `—` only when the input
   is actually `null`.
3. `packages/ui/src/ui/components/PRBrowser.vue` renders the phone row with
   `PhonePrBrowserText.specsLine(p.sd, p.mms, p.cms)` for every bundled row.
4. `packages/design/fields/phoneText.ts` always includes `Cms = ...` in that
   line. There is no P173-specific branch in this path.

## Selection path (not an explanation of the browser-row report)

`packages/design/domain/box/openISDBox.ts` calls
`getRadiator().spec.deriveFromWinisdFigures(...)` after every selected radiator
is copied into the project. The method is in
`packages/design/domain/passiveRadiator/openIsdPassiveRadiatorSpec.ts`.

That method can change entered Mms/Cms/Rms values into calculated values when a
derivation exists. It is not P173-specific and does not itself set Cms to null.
It therefore does **not** explain a missing Cms in the catalogue browser row.
Whether this state conversion should exist is a separate product decision.

## Unresolved / next investigation

Reproduce the exact phone sequence and state where the field is absent:

- the passive-radiator catalogue row;
- after selecting P173 in a project; or
- the passive-radiator editor after selection.

Inspect the live DOM and the selected field's `value`, `entered`, and
`calculated` state at that point. Do not alter catalogue data or add a
P173-specific fallback: the record is already correct.

## Work performed

No source change was retained for this issue. No test suite was run.
