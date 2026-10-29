# BUG_20261021_phone-whatif-close-chart-not-restored-sometimes

**Status:** FIXED by T556 (a spec bug: the before-picture was taken while the import flash strip was up).

Recorded 21 Oct 2026 by opi, from the T547 candidate run.

## Symptom
`packages/ui/test/ui/mobile-sheet.browser.spec.ts:116` ("What-if: stepping a field changes charts but not the
project; Close puts curve back") failed once: after Close on the What-if sheet, the chart picture never came back
to the one taken before the sheet opened (line 137, 20 s poll). The same code (main d66441886f) passed the spec
on T537's candidate run an hour earlier, so it fails only some of the time.

## Evidence
- Red run: https://github.com/Johnlon/openisd/actions/runs/39670707908 (land/T547, a docs-only change on
  d66441886f). Expected picture hash 20944220…, received 69d2a0d1….
- Green run on the same code: https://github.com/Johnlon/openisd/actions/runs/39667878499 (land/T537).

## Cause
Spec bug, not an app bug. `openAMobileProject` leaves the import's flash strip (`flash-strip`, a 42 px bar at the
bottom of the page) up for about two seconds. While it is up the chart is 604 px high; when it goes the chart grows
to 646 px and is redrawn. The spec took `closedPicture` straight after tapping Graph, usually while the strip was
still up: that picture is hash 20944220... (the CI "expected"); the settled one is 69d2a0d1... (the CI "received").
After Close the chart is the settled one, so the check failed whenever the picture was taken before the strip went.
Evidence: a timeline probe polled the chart after the Graph tap: 20944220... (canvas 604 px, `mob-update-banner`
42 px present), then about 1.5 s later 69d2a0d1... (canvas 646 px, banner gone). The same two hashes as CI. A first
attempt (wait for a stable picture only) still failed 1 run in 5, because the picture is stable while the strip is up.

## Fix
`mobile-sheet.browser.spec.ts`: `openGraph` waits for the flash strip to go, and the before pictures use
`settledChartPicture` (What-if, Tune, drag-down tests). The app is right: Close restores the settled chart.
