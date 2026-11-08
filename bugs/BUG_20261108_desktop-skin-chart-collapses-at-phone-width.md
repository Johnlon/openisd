# BUG_20261108_desktop-skin-chart-collapses-at-phone-width

**Status:** RESOLVED (T741)

## Symptom
Desktop skin in a 374x705 window with a project open: the chart is a thin strip (canvas 80 px on test, 30 px by the live probe) where production shows 146 px. The What-if dialog's right column is cut off the window.

## Evidence
Live probe, 8 Nov: openisd.app chart y=99 h=146; test.openisd.app (c6c7f9608) chart y=215 h=30. New spec `packages/ui/test/ui/desktop-chart-fits-phone-width.browser.spec.ts` failed before the fix with "canvas 80.4px"; What-if content was 158 px wider than its box.

## Cause
The grid's bottom row is `auto` = the tallest tab (about 420 px at phone width), and the wrapped toolbar (T734) is 156 px, so the `1fr` chart row got what was left (98 px). Nothing set a minimum for the chart row or let the tab panel shrink. What-if: its hint line, a single long line, widened the max-content label tracks past the window.

## Fix
`mainStyle` rows are `minmax(150px, 1fr) 7px minmax(0, auto)`; `.content-tabs` scrolls (`overflow-y:auto`) when the panel is shorter than its tab. What-if: the hint takes `width:0; min-width:100%`, and under 520 px the two columns stack into one.

## Verification
The new spec passes at 374x705 (canvas >= 120 px, drawer buttons inside the window, What-if inside the window); desktop-drawer-footer-fits and desktop-toolbar-fits-window still pass.
