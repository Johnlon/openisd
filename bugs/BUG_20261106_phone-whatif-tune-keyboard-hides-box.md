# BUG_20261106_phone-whatif-tune-keyboard-hides-box

**Status:** RESOLVED (fix in T700). John passed the fix on his Pixel on 7 Nov (board QO440).

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


## Reopened 6 Nov 2026 (T700) - John's Pixel 9, Chrome custom tab, test.openisd.app
John: "looks terrible cant see the field at all". Earlier: "I must be able to see the full field that I'm focusing on and ideal the ones above and below". Also a grey blank and hidden buttons whose space was not reclaimed. His screenshot (`ui-gallery/T698-keyboard/john-pixel-whatif-keyboard.png`) shows toolbar, a 3-line legend, a short chart, the What-if heading, Auto Y / Reset / Close and the tab bar on the keyboard, and no number rows at all.

### Cause (verified from the code and by measurement)
There are two things. (1) The T698 test kept the layout 705 high and shrank only the visual viewport; on John's phone the keyboard shrinks the layout itself (the viewport meta has no `interactive-widget`, and the screenshot shows an app area of about 341), a case no test covered. (2) A layout of 374 x 341 is wider than tall and under 500 high, so `isSidewaysPhone` took it for a phone turned sideways: the shell height became the window width (374 in a 341 window, the document scrolls) and the sheet got 41 px of rows. After the fix the legend, chart heading and tab bar, plus a 120 px chart minimum, were still taking the height the rows needed.

### Fix
- `visibleViewport.ts`: `isSidewaysShell`; a short wide window whose width is the last upright width is a keyboard, not sideways. `MobileShell-hooks.ts` remembers the upright width.
- `keyboardIsUp` (shell under 80% of its tallest height at this width) with a box in a Graph sheet focused sets `mob-sheet-typing` on the shell: legend, chart heading and tab bar go (the tab bar is `v-show`, so it returns), the chart keeps 80 px. Everything returns when the box loses focus or the keyboard goes.
- `MobileSheet-hooks.ts`: the list centres the focused row also when its own height changes (ResizeObserver).

### Verification
`mobile-sheet-keyboard-resize.browser.spec.ts` (new; stand-in shrinks the layout to 374 x 341 after focus, back to 374 x 705): Tune and What-if, boxes top, middle, bottom: box wholly in the list, uncovered at its corners and centre, neighbours visible and uncovered, footer at the bottom edge, no page scrollbars, tab bar, legend and chart heading back at 705. Red before the fix (shell 374 high in a 341 layout). Measured at 341: 45 head, 80 chart, 212 sheet (24 handle, 133 rows = 3 boxes, 53 footer). Still needs John's Pixel 9.
