# A passive radiator's Xmax was invented as twice the driver's Xmax

## Symptom

E150HE-PR states a mechanical limit of 19 mm (record field `Xlim_m`) and no Xmax. Picking it in the
wizard left the step's Xmax blank, but the created project's PR page showed Xmax = 2 x the driver's
Xmax (the box's starting rule, `STARTING.radiatorXmaxMultiple`). The 19 mm was nowhere on screen.

## Ruling (John, board QO327, 31 Oct 2026)

Final, c4: "ok compromise stick xmech in the Xmax field as that's what a Human would do". Earlier
c1 ("treat xmech as same as xmax" on a passive radiator, which has no voice coil), c2 (leave Xmax
blank, charts read Xmech) and c3 (separate fields) are superseded.

## Fix

- `OpenIsdPassiveRadiatorSpec.pickedXmax_m`: the record's Xmax, else its Xlim, else null.
  `adoptDatasheetFigures` (run by `configurePR`) writes it into Xmax, with the Xlim's precision, when
  Xmax is not stated. The wizard step view reads the same getter, so the step shows 19 mm and the
  project keeps it. No new field; Xlim itself is left as the record gave it.
- `OpenISDBox.applyStartingValues`: the twice-the-driver's-Xmax rule now only reaches a radiator with
  neither Xmax nor Xmech (commented there). The "Dummy PR" placeholder is sized the same way as before.
- A record with neither Xmax nor Xmech: unchanged, Xmax = 2 x the driver's Xmax.

## WinISD parity

WinISD's PR has Xmax only. A picked radiator's Xmax is a chart limit line, not a calculation, so no
switch and no Difference cue; trivial. WinISD behaviour for a PR with no Xmax not probed.

## Verification

- Unit: `packages/design/test/domain/pr-xmax-from-xmech.test.ts` (Xlim only gives Xmax 19 mm on the
  builder path; both keeps own Xmax; neither keeps the 2x fallback; the step getter).
- Browser: `new-project-wizard-walk.browser.spec.ts` (desktop and phone) and
  `new-project-wizard.browser.spec.ts`: step and PR page show Xmax 19 mm.
