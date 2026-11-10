# BUG_20261108_desktop-options-dialog-taller-than-short-window

**Status:** FIXED (T746)

## Symptom
Desktop skin, Options dialog, in the window a 1366x768 or 1536x864 screen leaves after browser bars (1366x657, 1536x754): the dialog is taller than the window. At 1366x657 an input (y 688..701) and "Reset to Metric" (y 752..782) are below the bottom edge; at 1536x754 "Reset to Metric" is 1 px below. The dialog does scroll inside, but UI-5 says these sizes must fit with nothing off screen.

## Evidence
`packages/ui/test/ui/screen-sizes.browser.spec.ts`, "must-fit desktop 1366x768 screen: Options dialog" and "1536x864 screen (dpr 1.25)", both marked test.fail with this bug id.

## Cause
The dialog was one 560 px column. The General tab's sections stood 722 px tall, and the body has 487 px in a 1366x657 window, so the rest sat below the window edge inside the body's scroll.

## Fix
T746: in a window at least 1180 px wide the dialog is up to 1080 px wide and each tab's sections flow into two balanced columns (`OptionsModal.vue`). General is then 388 px tall, Plot Window 442, Your data 350. A narrower window keeps one column and scrolls inside the body, footer always shown. Test: `options-dialog.browser.spec.ts`, "at WxH every Options control shows on every tab, nothing to scroll", at 1366x657, 1536x754, 1440x790 and 1440x900. T747's `test.fail` entries for Options at 1366x768 and 1536x864 come out when both tasks are on main.
