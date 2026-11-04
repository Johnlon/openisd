# BUG_20261104_empty-input-event-does-not-hand-entry

**Status:** OPEN (found by T663, 4 Nov 2026)

## Symptom

Sealed box, Fsc typed as 70, then Fsc emptied by a single input event with an empty value.
Expected: Volume becomes the entered box and Fsc the calculated one, as when another box is
typed. Actual: Fsc stays the entered box and Volume stays calculated.

## Found by

Test "an input event with an empty value also hands the Fsc entry to Volume" in
`packages/ui/test/ui/sealed-triple.browser.spec.ts`, carried from branch t607-fix-c2 (commit
4f45ba5b6). Desktop and mobile both fail on current main. The test is marked `test.fail` with
this bug id until the app is fixed. A keyboard clear (select, Delete) is covered by the other
specs and passes.
