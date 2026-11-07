# BUG_20261104_empty-input-event-does-not-hand-entry

**Status:** FIXED (T669) - not an app bug: the test filled an unfocused box, and focus selects only the last digit, so fill('') left "7" typed; the test now clicks first.

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

Verdict (5 Nov 2026): incorrect. Not an app bug: the test filled an unfocused box; T669 corrected the test (22fdd4980).
