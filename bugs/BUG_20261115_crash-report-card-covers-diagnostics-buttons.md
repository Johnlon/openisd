# BUG_20261115_crash-report-card-covers-diagnostics-buttons

**Status:** OPEN (found while reviewing the T793 baseline `mobile-dialog-crash`; not fixed there)

## Symptom
On a crash, the phone (390x844) shows the diagnostics dialog "Something went wrong" and, over its bottom, the report form
("What were you doing?", "How can we reach you?", Send report, Not now). The form covers the lower part of the dialog and
half of the first footer button at the left edge, so that button can be neither read nor pressed while the form is up.

## Cause
It is the app's real layout, not the way the fault is injected: `CrashScreen.vue` draws `.crash` as `position: fixed; right: 12px; bottom: 12px; z-index: 10000`,
above the diagnostics backdrop (9999) that raises on the same error. The test only dispatches the page's own `error` event, as any uncaught error does.

## Fix
Not done here. The report form and the diagnostics footer must not overlap at phone width (place the form in the dialog's flow, or above the footer).
Test first: open `crash`, assert no footer button's box intersects `[data-testid="crash-screen"]` at 390x844.
