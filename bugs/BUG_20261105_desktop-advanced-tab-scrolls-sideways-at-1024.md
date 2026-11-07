# BUG_20261105_desktop-advanced-tab-scrolls-sideways-at-1024

**Status:** OPEN

## Symptom
In the desktop (Original) skin at a 1024x768 window, the Advanced tab has a sideways scrollbar. The right-hand simulation options box (the WinISD switches) is cut off at the panel edge and has to be scrolled to.

## Evidence
Measured 5 Nov 2026 in T676 (Playwright probe, 1024x768, project open, Advanced tab active):
- the tab section is 691 px wide on screen (clientWidth 691) but its content is 909 px wide (scrollWidth 909): 218 px too wide;
- the section's right edge is at x=914; the simulation options box (`.sim-options-box`) ends at x=1131.6, 217 px past it.
The ? button added by T676 is not the cause: the spec `packages/ui/test/ui/desktop-help.browser.spec.ts` shows the scroll size is the same with it hidden.
Related: `BUG_20261019_desktop-advanced-winisd-bugs-group-cut` (same tab, 1280 wide).

## Cause
The Advanced tab lays the air fields and the option switches on the left and the simulation options box on the right, side by side; their widths add up to more than the panel at 1024. The section is `overflow-x:auto`, so it scrolls instead of fitting. Not yet traced to the exact rule.

## Fix
Make the Advanced tab fit at 1024: wrap the simulation options box under the left column, or narrow the columns. Needs a layout ruling.

## Verification
At 1024x768 and 1280x720 the Advanced tab has scrollWidth equal to clientWidth and the panel height is unchanged.
