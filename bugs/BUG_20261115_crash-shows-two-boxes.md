# BUG_20261115_crash-shows-two-boxes

**Status:** OPEN (found reviewing the T793 baselines; not fixed there)

## Symptom
Crash shows a diagnostics dialog and a second "Something went wrong." report box.

Two boxes carry nearly the same title at once. May be by design (the report form is a separate card); John's call. On the phone the form also covers the dialog footer: see BUG_20261115_crash-report-card-covers-diagnostics-buttons.

## Evidence
Baseline picture(s): desktop-dialog-crash, mobile-dialog-crash.

## Fix
Not done in T793. Test first when taken.
