# BUG_20261019_driver-editor-unit-buttons-overflow

**Status:** FIXED in T470 (test: packages/ui/test/ui/driver-editor-phone-fixes.browser.spec.ts).

Recorded 19 Oct 2026 by fable, from bob's button sweep of test.openisd.app at 374x705
(ui-gallery/screens/buttons/README.md in the workspace repo).

## Symptom
In the driver editor the unit buttons "mm/N" (Parameters), "1000/K" and "kg/m³" (Advanced) are
wider than their 34 px box (37, 43 and 37 px). The text runs past the box and the dotted
underline stops short of the text, so the unit looks broken.

## Cause
Not yet found. The unit button has a fixed 34 px width sized for two-character units.

## Fix
A unit test or browser spec that measures every unit button in the editor and fails when the
text is wider than its box. Then the button takes its width from its text with a 34 px minimum.

## Fixed
Fixed in T470 (driver-editor-phone-fixes.browser.spec.ts). Before/after: ui-gallery/fixes-20261019/driver-editor/.
