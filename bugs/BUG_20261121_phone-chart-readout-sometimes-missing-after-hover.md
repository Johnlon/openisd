# The phone chart sometimes misses the first hover

## Symptom

Visual retake run 44914881724 (commit `518478eea`, which adds the scrolled driver-editor
help picture on branch `t744-lap`) timed out after 20 seconds waiting for the frequency
readout on `visual mobile dialog-shared-chart-readout`. Visual retake run 44912730900
(commit `17aec9956`, which makes the driver-editor help scroll within its 680 px panel)
drew the same screen. The chart and its opener are identical in both revisions.

## Cause

The phone Graph tab mounts a new `GraphPanel`. Its canvas has a visible CSS box immediately,
so `packages/ui/test/fixtures/viewOpenShared.ts:61–64` can move the mouse over it before
the first draw. `packages/ui/src/ui/components/GraphPanel.vue:270–281` used the canvas
resize observer to schedule that draw for a later animation frame. The canvas receives
`pointermove`, but the handler returns at line 189 while the plot geometry is still null.
The first draw then has no cursor frequency to display, and the pointer can stay over the
chart indefinitely without a readout. The visual test sets a phone-sized viewport and
selects the phone skin in a regular Chromium context.

## Fix

`GraphPanel.vue` now draws on mount when plot data is ready, so the first pointer move can
use the plot geometry. Resize notifications still schedule their redraws outside the
observer callback to avoid resize loops.

## Regression test

`packages/ui/test/ui/mobile-chart-readout.browser.spec.ts` loads the chart fonts, leaves
the Graph tab, and holds animation frames while reopening it. It moves the mouse onto the
canvas once, releases the frames, and checks that the frequency readout is visible.

A local component probe mounted the real chart with a complete SPL plot and held the
resize frame. The readout was empty after one pointer move before the fix and contained
`Hz` on all three runs after the fix. The sandbox blocks the browser test server's sockets,
so the Playwright case and the visual retake picture still need browser verification.
