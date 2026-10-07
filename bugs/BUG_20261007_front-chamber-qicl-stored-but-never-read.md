# BUG_20261007_front-chamber-qicl-stored-but-never-read

**Status:** OPEN

## Symptom
A 4th-order bandpass, 6th-order bandpass or ABC project stores a Qicl on each chamber, but WinISD has one (`Qiclfr`)
and the sweep reads only the rear chamber's. The front chamber's `losses.Qicl` is dead storage: nothing shows it or
reads it, and a file that gives it a different value keeps it silently.

## Evidence
Checked 2026-10-07: `projectSweep.ts` and `winIsdProjectConverter.ts` read and write only `rear.losses.Qicl`
(`Qiclfr`); WinISD probe e7c754c shows one Qicl in both chamber panels.

## Fix
Drop `Qicl` from the front chamber's stored losses (schema, `CoupledVentedLosses` window, defaults) so the model has
one Qicl; load of an older file ignores the front value.

## Verification
Unit: the front chamber has no Qicl field; an older file with a front Qicl still loads and the sweep is unchanged.
