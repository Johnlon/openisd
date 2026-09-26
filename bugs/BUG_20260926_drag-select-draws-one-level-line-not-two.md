# BUG_20260926_drag-select-draws-one-level-line-not-two

**Status:** RESOLVED 2026-09-26 — the test was wrong twice over; the app draws both lines.

## Symptom

`packages/ui/test/ui/original-layout.browser.spec.ts:155` required two horizontal level lines
after a drag-select and counted one. It had never passed: calc-bug reproduced the same failure
in clean worktrees at 27ab3a1e, at origin/main 4e49de87, and at ade563bb, the release squash
that introduced it.

## Cause

The app is correct. The test was wrong in two independent ways, and each alone was enough.

1. **It started the drag outside the plot.** The drag began at 5% of the canvas width, which is
   the Y-axis strip — `GraphPanel.vue`'s level pan/zoom control. `onPointerDown` hands that
   gesture to `yDrag` and never sets `dragOrigin`, so no band was created at all and the one
   line being counted was the ordinary crosshair's.

2. **A level line hides under the curve.** The upper level line sits at the curve's own level,
   and where the response is flat the curve is drawn on top of it for most of the plot width.
   The helper required a dark run over 20% of the scanned width; the covered line came in under
   that and went uncounted. Measured on a corrected drag: rows [30, 78] at a 10% threshold,
   only [78] at 20%.

Instrumenting `onPointerDown`, `onPointerMove` and `redraw()` showed the app doing the right
thing throughout a corrected drag — `dragOrigin` set, `buttons=1` on every move, `dragRange`
reaching `drawOne` as `[22.57, 119.79]` Hz on the final frame.

## Fix

The test, not the app. It now double-clicks the X-axis strip first, which resets the window to
1 Hz – 20 kHz so the fractions mean fixed frequencies whatever view state was restored; drags
from 34% to 50% of the width, inside the plot and across the bass knee (≈22–120 Hz); and counts
a level line at 10% coverage instead of 20%. The assertion is unchanged: still two distinct
horizontal lines.

## Verification

`npx playwright test packages/ui/test/ui/original-layout.browser.spec.ts` — 11 passed, including
both this test and the single-cursor hover test at :147 that shares the helper.
