# BUG_20261108_desktop-skin-menus-and-links-cut-at-phone-width

**Status:** RESOLVED

## Symptom
Desktop skin in a 374 px window: the Save As / Export menu is wider than the window (x 214..452), the empty-graph links "Open project" (330..407) and "Import project" run off the right, "Reset to defaults" in the Options Environment group (256..387) runs off the right, and the project drawer's "Bin" and "Export all" can be cut.

## Evidence
AI live review of test, ui-gallery/live-review/20261108T091258Z/*/after.checks.json ("cut by"). Reproduced at 374x705 in desktop-toolbar-fits-window.browser.spec.ts: menu items 214..452, Open project 330..407, Import project 419..496, Reset to defaults 256..387.

## Cause
Menu list was left-anchored with nowrap items; the empty-graph box and actions could not shrink or wrap; the Options dialog kept its 14/12 px padding so 318 px field rows pushed the group to 370 px inside a 344 px dialog; the drawer footer buttons did not wrap.

## Fix
Menu anchors to the trigger's right edge, max width the window, items wrap. Empty-graph box min-width 0 with wrapping links. Options dialog takes the window width with smaller padding under 420 px. Drawer footer buttons wrap.

## Verification
desktop-toolbar-fits-window.browser.spec.ts (Save As menu, project drawer, Options, empty-graph links at 374x705 and 1024x768).
