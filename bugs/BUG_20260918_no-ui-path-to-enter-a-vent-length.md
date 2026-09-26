# BUG_20260918_no-ui-path-to-enter-a-vent-length

Status: OPEN (re-verified 2026-09-26) — the vent length input is editable only when the length is already entered.

## Symptom / gap
The UI offers no way to *type* a port length. A vent is defined by bore (`Vent diameter`) and
`Target Tuning Freq`; the length is always solver-derived (`—` until it solves) and can only be
changed through those two entries. The vent group solves length from tuning exactly, so a length
can be reached only *by* the pair — there is no direct control with which to set it.

Found while strengthening `packages/ui/test/ui/app.browser.spec.ts`: the vented test exercises
the target-→-length direction (Fb 37.9 → 10.6 cm), and the bandpass4/PR work surfaced the same
shape across chambers. Whether real WinISD lets a user type a length directly was not verified —
if it does, this is a parity gap; if it also solves lengths only, it may be an intentional shape
and this file should be downgraded to a design note (verify against the real WinISD .wpr/project
editors before acting).

## If fixing
Add a length input that writes the vent's length directly (the paired tuning then becomes the
derived side of the same one-stored-value pair), for the vented box's vent, bandpass4's front
vent(s) and bandpass6/ABC where applicable. Note in the project: both sides of a pair share one
stored value, so typing a length must flip which side is "entered".