# BUG_20261108_desktop-options-dialog-taller-than-short-window

**Status:** OPEN

## Symptom
Desktop skin, Options dialog, in the window a 1366x768 or 1536x864 screen leaves after browser bars (1366x657, 1536x754): the dialog is taller than the window. At 1366x657 an input (y 688..701) and "Reset to Metric" (y 752..782) are below the bottom edge; at 1536x754 "Reset to Metric" is 1 px below. The dialog does scroll inside, but UI-5 says these sizes must fit with nothing off screen.

## Evidence
`packages/ui/test/ui/screen-sizes.browser.spec.ts`, "must-fit desktop 1366x768 screen: Options dialog" and "1536x864 screen (dpr 1.25)", both marked test.fail with this bug id.

## Cause
Not investigated. The dialog's height is not capped to the window.

## Fix
Not fixed here. T747 only records and tests the sizes (UI-5, sizes proposed in QO471).
