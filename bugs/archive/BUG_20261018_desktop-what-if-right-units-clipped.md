# BUG_20261018_desktop-what-if-right-units-clipped

**Status:** FIXED (T414)

## Symptom
Desktop (Original skin) What-if panel at 1280x720: the right-hand column's unit labels ran past the
panel's right edge (Sd "cm²" showed as "cm") and the panel scrolled sideways by 8 px.

## Cause
The panel had a fixed 340 px width; a row is label, input, stepper, dq mark and unit, two per line.

## Fix
The panel takes its content's width (`max-content`, still capped by the window). Test:
packages/ui/test/ui/what-if-panel.browser.spec.ts "every row fits inside the panel".
