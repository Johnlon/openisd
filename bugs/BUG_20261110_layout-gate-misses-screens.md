# The field layout gate never opened most screens that have a number box

Status: OPEN. John, 10 Nov 2026: "crucial: why are the UI tests not finding these layout issues"; "if new screens are added or popups then they must be auto included".

`field-layout-rules.browser.spec.ts` walked the project tabs, the New project wizard and the What-if panel only. It never opened the Edit driver popup, the phone Advanced page, Options, the radiator editor or the filter editors, and it never checked that a typed value fits its box (R11) or that a box has a gap before its up/down buttons (R10).

T742 adds the Edit driver popup tabs and the phone Advanced page, and `field-layout-surfaces.test.ts`, which fails when a component that draws a number box is not in the table in `packages/ui/test/fixtures/fieldLayoutSurfaces.ts`. Components with no opener yet are listed there with this bug file; each is deleted from the list when its screen is added to the spec.
