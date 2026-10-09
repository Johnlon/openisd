# BUG_20261009_pr-added-mass-can-be-cleared-to-blank

**Status:** OPEN. John, 2026-10-09: it was a mistake to allow the passive radiator's added mass to
go blank; it should be 0. Other fields may need a sensible default when blanked.

There are two things, the added-mass box and the tuning-goal box on a passive radiator. They are a
pair: entering one makes the other calculated (`packages/design/domain/box/openISDBox.ts:342-356`,
`pairedField`). Clearing the added mass leaves neither entered, so the box is blank and the
calculation has no input. A default of 0 is applied only on one path (`openISDBox.ts:554`:
`if (!addedMass.entered && !tuning.entered) addedMass.set(0)`); clearing the box in the UI does not
reach it.

We need: clearing the added mass sets it to 0 (entered), exactly as the default does.

Then a sweep, ask John per field: list every entered field that can be cleared to blank (use the
Field enum in packages/design) and for each name the sensible default a clear should give, or say
"blank is meaningful". Write the answers into the fields, test first, one test per field.
