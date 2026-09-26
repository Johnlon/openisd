# BUG_20260926_drag-select-draws-one-level-line-not-two

**Status:** OPEN

## Symptom

Dragging out a frequency band on the chart is meant to leave a horizontal level line at each of
the two selection cursors. Only one line is drawn.

## Evidence

`packages/ui/test/ui/original-layout.browser.spec.ts:155` ("a drag-select draws a horizontal
level line for BOTH selection cursors") fails at line 165: `levelLineClusters(page)` polls to 1
where the test requires 2. Reproduced 2026-09-26 running that one test alone on a freshly
isolated vite, so it is neither a port collision nor load — it failed in every run of the day,
including runs where every other test in the file passed.

The neighbouring test at :147 ("hovering the chart draws ONE horizontal level line where the
cursor crosses the curve") passes, so the single-cursor path works and the second cursor is what
is missing.

## Cause

⚠ unverified. Not investigated. The chart's view state was reworked the same day for
`BUG_20260926_sweep-range-and-y-ranges-not-persisted` (27ab3a1e, 9c07df36), which is the nearest
change to this behaviour and the first place to look.

## Fix

Unknown until the cause is found.

## Verification

`npx playwright test packages/ui/test/ui/original-layout.browser.spec.ts:155` passes, and :147
still passes with it.
