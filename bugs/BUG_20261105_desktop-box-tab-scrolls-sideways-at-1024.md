# BUG_20261105_desktop-box-tab-scrolls-sideways-at-1024

**Status:** OPEN

## Symptom
In the desktop (Original) skin at a 1024x768 window, the Box tab has a sideways scrollbar. The box diagram on the right of the tab is partly pushed beyond the panel and has to be scrolled to.

## Evidence
Measured 5 Nov 2026 in T676 (Playwright probe, 1024x768, project open, vented box, Box tab active):
- the tab section is 691 px wide on screen (clientWidth 691) but its content is 935 px wide (scrollWidth 935): 244 px too wide;
- the section's right edge is at x=914; the box diagram column (`.box-diagram-col`) ends at x=994, 80 px past it.
- The Driver tab at the same size does not scroll (691 / 691).
The ? buttons added by T676 are not the cause: the spec `packages/ui/test/ui/desktop-help.browser.spec.ts` shows the scroll size is the same with them hidden.

## Cause
The Box tab's field column is fixed at 412 px and the diagram column sits beside it; together they are wider than the tab panel at 1024. The tab section is `overflow-x:auto`, so it scrolls instead of fitting. Not yet traced to the exact rule.

## Fix
Make the Box tab fit at 1024: let the diagram column shrink or wrap, or narrow the field column. Needs a layout ruling because the classic WinISD layout must be kept.

## Verification
At 1024x768 and 1280x720 the Box tab has scrollWidth equal to clientWidth for every box type, and the panel height is unchanged.
