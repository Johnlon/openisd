# BUG_20261007_4th-order-bandpass-merges-per-chamber-losses

**Status:** OPEN

## Symptom
WinISD's 4th-order bandpass keeps losses per chamber. OpenISD keeps one set for the box, so the two chambers
cannot have different Ql/Qa/Qp.

## Evidence
Reported 2026-10-07 by the coordinator session while fixing
`BUG_20261006_box-losses-popup-blank-for-6th-and-abc.md`. Not yet probed under wine.

## Fix
Probe WinISD under wine for the 4th-order bandpass losses dialog, then give `bandpass4` one losses set per
chamber, shown through `Box.lossGroupsOf` like `bandpass6` and `abc`.

## Verification
Browser spec: on a 4th-order bandpass the popup shows a Rear and a Front chamber set; edits and Reset reach both.
