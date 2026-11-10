# BUG_20261108_desktop-800x600-driver-tab-buttons-overlap-fields

**Status:** OPEN

## Symptom
Desktop skin in an 800x600 window, Driver tab (vented and passive-radiator project): the "Save" button sits on top of a number box (55x15 px overlap), and "Select Driver" overlaps its neighbouring input by 3 px. On the Vented tab the "What-if" button overlaps a box by 22x3 px. 800x600 may scroll, but controls must not overlap.

## Evidence
`packages/ui/test/ui/screen-sizes.browser.spec.ts`, "may-scroll desktop 800x600: vented project, every tab" and "box-passive-radiator project, every tab", both marked test.fail with this bug id.

## Cause
Not investigated.

## Fix
Not fixed here. T747 only records and tests the sizes (UI-5, sizes proposed in QO471).
