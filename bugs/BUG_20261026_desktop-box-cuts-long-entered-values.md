# Desktop box cuts an entered value with many digits

- Status: open
- Found: 26 Oct 2026, by the desktop field-row sweep (`desktop-field-rows.browser.spec.ts`, T606).

## What is wrong

On the desktop Box and enclosure tabs with the sample project, Vas shows "6.267153900", Fpr
"31.83098862" and the vented Tuning freq (Fb) a value of the same length. Each is wider than the
90 px box, so the first digits are scrolled out of view until the box is focused.

## Cause

An entered value keeps the digits it was entered with (read value = verbatim evidence). The box is
sized for the values the app formats, not for an entered string of eleven digits.

## Open choice (John)

Either the box shows an entered value at the field's display precision until it is focused, or the
box grows for it. Both are data-model or layout choices; neither is made without John
(feedback-no-data-model-change-without-john, feedback-no-unilateral-layout-changes). The sweep's
"no value is cut" test is marked expected-to-fail on these pages until this is decided.
