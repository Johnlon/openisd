# BUG_20261021_le-rms-zero-passes-plausibility

**Status:** FIXED

Recorded 21 Oct 2026 from the tools session. Fixed by T546.

## Symptom
A datasheet that prints Le = 0 or Rms = 0 (winisd_drivers/db/datasheets/volt/vm528: both; vm754: Rms)
keeps the 0 as an entered value (state E). Qts, Qes, Qms, Mms, Cms, Vas and BL at 0 fall to N.

## Cause
In `packages/design/fields/field.ts`, Le and Rms had a plausible lower limit of 0, so the plausibility
check (`rangeIssue`, which does not special-case 0) accepted a printed 0.

## Fix
John's ruling, 21 Oct: a printed zero is kept as read and gets state N plus the standard data-quality mark.
Le plausible minimum is now 1e-6 H (smallest real value in the drivers db: 3.1e-6 H). Rms plausible minimum is now
0.01 kg/s (smallest real value: 0.0458 kg/s). Test: `packages/design/test/engine/isPhysicallyPlausible.test.ts`.
