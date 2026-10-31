# BUG_20261020_chart-last-frequency-label-cut

**Status:** FIXED (T480)

Recorded 20 Oct 2026 by fable's worker, from bob's QO269 and QO276 prod captures.

## Symptom
On the chart (desktop and phone) the last frequency label "20.0k" is cut at the right edge of the chart, so it reads "20.0" or "20.0 ". Pictures: ui-gallery/QO269/prod-desktop-box.png, ui-gallery/QO276/prod-graph.png.

## Cause
The 20 kHz grid line is the plot's right edge. The label is drawn centred on its line. The label is about 25 px wide and the right margin is 10 px, so the right half of the label falls outside the canvas.

## Fix
`ChartLayout.freqLabelCentreX` (packages/design/chart/layout.ts) moves a label in just far enough to stay inside the panel; `canvas.ts` centres each frequency label on that x. Unit test: packages/design/test/chart/chart-layout.test.ts ("frequency label placement").

## Verification
Pictures (before = main, after = T480): ui-gallery/fixes-20261019/chart-last-frequency-label-cut/ (desktop 1280x800, phone 374x705).
