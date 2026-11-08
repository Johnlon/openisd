# BUG_20261108_signal-angle-distance-padded-zeros

**Status:** RESOLVED

## Symptom
Original shell Signal tab: the Distance and Angle boxes show "1.000" and "0.0000", padded zeros past the 2nd decimal, against the QO454 rule.

## Evidence
`OriginalShell.vue` hard-coded `value="1.000"` and `value="0.0000"` on two disabled inputs (live review of test.openisd.app v20261108T0610Z). Grep for toFixed outside NumberField.format found no other box bypassing the rule (the rest are chart axes and filter descriptions).

## Cause
The two greyed inputs were literal strings, not NumberField.format output.

## Fix
Show `NumberField.SIGNAL_DISTANCE_M.format(1)` and `SIGNAL_ANGLE_RAD.format(0)`.

## Verification
original-signal-tab.browser.spec.ts: Distance reads "1.00", Angle reads "0.00".
