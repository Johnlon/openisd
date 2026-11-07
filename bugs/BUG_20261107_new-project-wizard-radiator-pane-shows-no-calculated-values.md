# BUG_20261107_new-project-wizard-radiator-pane-shows-no-calculated-values

**Status:** RESOLVED

## Symptom
New Project wizard, passive radiator step: pick SEAS SP22R. Qms and Fs are empty. The project's own radiator pane shows Qms 4.813 and Fs 23.22 for the same radiator.

## Evidence
- `packages/ui/public/drivers/seas/sp22r.json` states Vas, Mms, Cms, Rms and Sd, and no Qms or Fs (read 7 Nov 2026).
- Accuton P173 states neither Qms nor Rms, so its Qms stays empty in both panes (QO424). ASP190 and ASP250 state Rms and no Qms.
- `passiveRadiatorView` in `packages/ui/src/hooks/OriginalNewProject-hooks.ts` reads the raw record; nothing calculates on the wizard's copy.
- `NewProjectPassiveRadiatorStep.vue` draws the boxes with `UIFixedField`: every value is coloured as stated and an emptied box is refused, so a typed value cannot be cleared.

## Cause
The main pane runs `adoptDatasheetFigures` and `resolve` on the project's radiator. The wizard runs neither.

## Fix
John chose this in QO442: a pick moves straight on to the project page, as picking a driver does. The step's boxes are for defining a radiator by hand, and no engine runs in the wizard, because a typed Vas, Qms, Fs or Sd cannot be worked out from the other three. Back still shows a picked radiator's unstated boxes blank; John accepted that. The step now says "Select a Passive Radiator or define one below", on both skins.

## Verification
`packages/ui/test/ui/new-project-wizard-radiator-pick.browser.spec.ts`, desktop and phone: the line shows, a pick reaches the project page, Back shows the picked radiator, Define new stays on the step.
