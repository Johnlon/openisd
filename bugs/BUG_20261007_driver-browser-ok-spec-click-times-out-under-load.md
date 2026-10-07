# BUG_20261007_driver-browser-ok-spec-click-times-out-under-load

**Status:** OPEN (recorded, no fix)

## Symptom
`packages/ui/test/ui/driver-browser.browser.spec.ts:680` ("OK on the project driver updates the project") failed
once in a full health check with `locator.click: Timeout 20000ms exceeded` on the Edit button in
`openProjectDriverEditor` (line 631). Passes alone (the whole spec file, 42 tests).

## Evidence
Checked 2026-10-07, health check on 561496dc in a clean worktree (log `scratchpad/hc.log`, line 857). The call
log shows the button resolved, visible, enabled and stable, scrolled into view, and "performing click action",
then nothing for 20 s. So no wait was missing: the click was issued and the page did not answer. Two workers
were running 573 browser tests at the time.

## Cause
Not known. The page was unresponsive for 20 s after the click, under load. It is not the missing-wait kind that
`what-if-panel.browser.spec.ts:33` had (a value read before the charts had drawn).

## Fix
Find whether opening the full driver editor can block the page for seconds (a long synchronous step on open); if it
can, that is a product defect. If not, treat the failure as machine load and leave the spec.

## Verification
Open the project driver editor in a profiled run and look for a long task; or a repeat of the spec 10 times under a
loaded machine without a timeout.
