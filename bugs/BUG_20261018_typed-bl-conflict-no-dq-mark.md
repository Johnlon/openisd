# BUG_20261018_typed-bl-conflict-no-dq-mark

**Status:** OPEN

## Symptom
Since T403 the charts use the BL implied by Re, Fs, Qes and Vas (Two-BL switch unticked). A typed BL that disagrees
with it is not read, but the BL field gets no dq mark unless Mms is also typed; with no Mms the conflict shows on
Fs, Mms and Cms instead.

## Cause
The consistency solver has no direct BL-from-Qes relation. Adding one (T403 WIP acc2fa9f) put false marks on
consistent records and moved 21 solver-golden cases — likely a tolerance problem with rounded datasheet values.

## Fix
Add the relation with a tolerance that clears the consistent records in the solver golden set; pin both directions.
