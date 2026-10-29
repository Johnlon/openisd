# BUG_20261020_phone-10k-20k-labels-nearly-touch

**Status:** FIXED (T491)

Recorded 20 Oct 2026 by bob's worker, after T480.

## Symptom
On the phone chart (374x705) the "10.0k" and "20.0k" frequency labels nearly touch.

## Cause
T480 moved the last label in from the right edge so it is not cut. The 10.0k and 20.0k grid lines are only about 32 px apart on the phone and each label is about 25 px wide, so the moved label left a gap of a few px.

## Fix
`ChartLayout.freqLabelCentres` (packages/design/chart/layout.ts) places a row of labels: each inside the panel, and moved left as far as needed to keep `MIN_FREQ_LABEL_GAP_PX` (6 px) clear before the label on its right. `canvas.ts` draws each label at the x it returns. Unit test: packages/design/test/chart/chart-layout.test.ts ("frequency label placement").

## Verification
Pictures (before = main, after = T491): ui-gallery/fixes-20261019/phone-10k-20k-labels-touch/ (phone 374x705).
