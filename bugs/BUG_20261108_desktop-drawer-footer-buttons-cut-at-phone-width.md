# BUG_20261108_desktop-drawer-footer-buttons-cut-at-phone-width

**Status:** RESOLVED (T737)

## Symptom
Desktop skin in a 374 px window: the project drawer's Export all and Bin (0) buttons (and the list rows) are cut off. Found by the AI live review of the T736 build (sweep-other-skin-phone).

## Evidence
New spec `packages/ui/test/ui/desktop-drawer-footer-fits.browser.spec.ts` with a project open: the drawer box is 16 px tall (y 166..182) while Export all / Bin sit at y 301..319; "New", "Import", "Open", "All" also outside it.

## Cause
The grid's top row is `1fr` and the bottom tab panel (`auto`) is about 420 px tall at phone width, leaving the top row 99 px. `.quad-projects-wrap` had `min-height:0` and `overflow:hidden`, so it shrank to 16 px and clipped its header, list and footer. T736 made the footer wrap but not the height.

## Fix
`.quad-projects-wrap` in OriginalShell.vue gets `min-height:180px`; the nav column (already `overflow-y:auto`) scrolls instead of the drawer clipping. The duplicate `min-height:0` in OriginalProjectList.vue is removed.

## Verification
The new spec passes at 374x705 with and without a project.
