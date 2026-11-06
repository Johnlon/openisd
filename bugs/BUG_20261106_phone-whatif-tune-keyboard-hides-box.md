# BUG_20261106_phone-whatif-tune-keyboard-hides-box

**Status:** RESOLVED. Release blocker with priority over all other activities (John, 6 Nov 2026).

## Symptom
Phone, What-if and Tune: tap a number box and the keyboard comes up and hides the box completely. The bottom buttons are hidden while the keyboard is up, but their space is not reclaimed, so a grey blank area sits over the input. It is worse than before: the box used to stay visible, though narrow.

## Evidence
John's report, 6 Nov 2026, from using the app. Reproduced in `packages/ui/test/ui/mobile-sheet-keyboard.browser.spec.ts` with a scripted visual viewport (layout stays 705 high, the visible part shrinks to 423, the page pans to show the box), at 374 x 705. Red before the fix: a box in the middle of the list was left outside the visible rows; and with the page panned, every point of the shell below the old shell height hit the empty page (`elementFromPoint` returned the html element), not the box.

## Cause
There are two things. (1) When the keyboard pans the page, the phone shell is moved down by the pan (`top` on `.mobile-root`), but its parent `.app-root-mobile` keeps the unmoved height, so the lower part of the shell lies outside its parent: the parent clips and hit-tests only its own box, and the strip over the keyboard side is empty page. The sheet and the box sit in that strip. (2) On the Graph page the shell's resize handler only sets the content scroll to 0 (T529, `73777d9fe`, to stop the view being shoved); nothing scrolls the sheet's own list of rows, so a box in the middle of the list stays where it was before the keyboard shrank the list to about 3 rows.
Regressed by: the pan compensation (19 Oct, `top` on the shell, `visibleViewportTopPx`) opened (1); T529 (21 Oct) left (2). T679 (5 Nov, the sheet's boxes became the shared field) and T682 (5 Nov, sideways phone) did not touch either path; I could not show which of them made John see it worse. Not reproduced: the buttons being hidden and their space not reclaimed; with the fix the tab bar and the sheet's Close are in view at the keyboard's top edge.

## Fix
- `MobileShell.vue`: `margin-bottom` equal to the pan on `.mobile-root`, so its parent is as tall as the moved shell. No pan, no change.
- `MobileSheet-hooks.ts` / `MobileSheet.vue`: when the visible screen resizes, the sheet centres the focused box in its list of rows, so the rows above and below show too.

## Verification
`bash scripts/test.sh packages/ui/test/ui/mobile-sheet-keyboard.browser.spec.ts`: Tune and What-if, boxes at top, middle and bottom (port area excluded, it opens the port's fields): box wholly in the visible screen, nothing covering it, neighbours visible, the tab bar ends at the keyboard's top edge with the sheet directly above it (no blank), no page scrollbars, Close back in view when the keyboard goes. The keyboard is a scripted stand-in, not a real phone: needs John's Pixel 9 to confirm.
