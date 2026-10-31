# A passive radiator's Xmax was invented as twice the driver's Xmax

## Symptom

E150HE-PR states a mechanical limit of 19 mm (record field `Xlim_m`) and no Xmax. Picking it in the
wizard left the step's Xmax blank, but the created project's PR page showed Xmax = 2 x the driver's
Xmax (the box's starting rule, `STARTING.radiatorXmaxMultiple`). The 19 mm was nowhere on screen.

## Ruling (John, board QO327, 31 Oct 2026)

- c1: "on a passive radiator which don't have without a voice coil we can treat xmech as same as xmax".
- c2: "but do not invent a value for Xmax use the xmech in the charts".
- c3: "record them as separate fields".

So: Xmax and Xmech are two fields, each holding only what the record gives. Xmech is never copied
into Xmax. No Xmax is invented. The charts use Xmax, or Xmech when Xmax is blank.

## Fix

- `OpenIsdPassiveRadiatorSpec.excursionLimit_m` = Xmax, else Xmech (`Xlim_m`), else null. The PR
  excursion chart's limit line reads it (`appState.ts` and `compareOverlays.ts`, the `prXmax` param).
- `OpenISDBox.applyStartingValues` no longer writes Xmax on a radiator record that lacks one. The
  2x-driver-Xmax rule (`radiatorXmaxMultiple`) now sizes only the Placeholder "Dummy PR"
  (`#startDummyRadiator`), which is not a record.
- New field `NumberField.PR_XMECH_MM` ("Xmech"), shown next to Xmax on the wizard radiator step
  (`#np-pr-xmech`), the phone Box tab and the Original passive-radiator page. It reads and writes
  the radiator spec's existing `Xlim_m`, so the record format and saving are unchanged.
- A record with neither Xmax nor Xmech: both boxes stay blank, no limit is invented. The PR
  excursion chart then falls back to its own existing 10 mm line (`P.prXmax || 0.01` in
  `chart/series.ts`); that older default is untouched here.

## WinISD parity

WinISD's PR page and `.wpr` `[PassiveRadiator]` section carry Xmax; no Xmech key is known (not
probed under wine). The `.wpr` export writes Xmax only, so Xmech is not exported: a gap, no switch.
Not a calculation difference: Xmax only draws a chart limit line.

## Verification

- Unit: `packages/design/test/domain/pr-xmech-excursion-limit.test.ts` (Xlim only gives 19 mm limit
  and blank Xmax; both gives Xmax; neither gives blank; the wizard builder path writes no Xmax).
- Hooks: `packages/ui/test/hooks/OriginalNewProject-hooks.test.ts` (Xlim typed on the step reaches the project).
- Browser: `new-project-wizard-walk.browser.spec.ts` both skins: step shows Xmax blank and Xmech
  19 mm; project PR page shows Xmax blank and Xmech 19 mm.
