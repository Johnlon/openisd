# BUG_20261108_desktop-640x360-save-revert-cut-off-and-unreachable

**Status:** OPEN

## Symptom
Desktop skin in a 640x360 window (a 1280x720 window at 200% zoom, mouse): the "Save" and "Revert" buttons (and on Signal and Advanced a split-toggle button) are cut off by the hidden overflow of the main area and cannot be scrolled to. On the passive-radiator tab "What-if" overlaps a box by 81x26 px. In the Driver Editor a box sits left of the page origin.

## Evidence
`packages/ui/test/ui/screen-sizes.browser.spec.ts`, "may-scroll desktop text zoom 200% (640x360 window)": all four tests marked test.fail with this bug id.

## Cause
Not investigated.

## Fix
Not fixed here. T747 only records and tests the sizes (UI-5, sizes proposed in QO471).
