# BUG_20261007_driver-browser-ok-spec-click-times-out-under-load

**Status:** RESOLVED 21 Oct 2026 (T557, opi). Machine load, as the Fix section allows. Opening the project driver
editor 5 times on the dev server (load 13) gave one long task each of 298 to 724 ms, nowhere near the 20 s the
click waited; and the spec has not failed in the last 100 GitHub Actions suite runs (17 to 21 Oct), where the full
suite now runs instead of the loaded laptop. Its last failure was the laptop post-land run of 15 Oct (F31), also
under load. The spec is left as it is.

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
