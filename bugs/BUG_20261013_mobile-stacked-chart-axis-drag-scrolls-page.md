# BUG_20261013_mobile-stacked-chart-axis-drag-scrolls-page

**Status:** RESOLVED

## Symptom
On the phone, with more than one chart on the Graph page, dragging up or down on a chart's Y-axis
strip scrolls the page instead of stretching or moving the chart's level range. The three Y-axis
drag zones (top quarter zooms the top, middle moves, bottom quarter zooms the bottom) worked before
multi-charts were added; the X-axis strip still works for sideways drags, but a vertical movement
on it also scrolls the page. Reported by John, 13 Oct 2026.

## Evidence
- `packages/ui/src/ui/shells/mobile/MobileChartView.vue:147`:
  `.mob-chart-stack.stacked :deep(canvas) { touch-action: pan-y; }` — in a stack the whole canvas
  lets the browser take vertical touch movement for page scroll.
- `packages/ui/src/ui/components/GraphPanel.vue:55-80`: `yAxisZone` / `xAxisZone` locate the
  axis strips inside the one canvas; the canvas is one element, so `touch-action` cannot differ
  between the plot body and the axis strips.

## Cause
A Y-axis drag is a vertical touch movement. With `touch-action: pan-y` on the canvas the browser
claims it as a page scroll (pointercancel), so GraphPanel's Y-axis drag never runs. The X-axis drag
survives only because its movement is sideways.

## Fix
John's ruling: the axis strips are chart controls only, never page-scroll grab areas; the plot body
keeps scrolling the stack. Sized axis strip overlays (`.axis-overlay.y-axis-overlay` and
`.axis-overlay.x-axis-overlay`) in `GraphPanel.vue` with `touch-action: none` cover the Y and X
margins, capturing pointers on `e.currentTarget` with `setPointerCapture`. The plot body on the
canvas continues to have `pan-y` in stacked mode.

## Verification
`packages/ui/test/ui/mobile-chart-axis-drag.browser.spec.ts` at 390x844 with real touch events via CDP:
- Vertical touch drag on Y-axis strip (top/middle/bottom zones) updates chart Y range without scrolling stack.
- Vertical drag on X-axis strip does not scroll stack.
- Vertical swipe on plot body scrolls stack.
- Single chart Y-axis drags still work across top, middle, and bottom zones.
Also verified unchanged desktop mouse drags in `original-chart-view.browser.spec.ts` (14 passed),
`mobile-chart-view.browser.spec.ts` (5 passed), and `mobile-chart-auto-y.browser.spec.ts` (1 passed).
