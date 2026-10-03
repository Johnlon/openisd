# BUG_20261001_view-and-options-bad-value-silently-resets-whole-record

**Status:** CLOSED 2026-10-03 — fixed in e87e04e9 (bug filed and fixed in one commit, never closed). View and Options records keep good fields; appSettingsRepo.test.ts passes.

## Symptom
One bad value in the stored chart view or in Options makes the whole record read as defaults,
and the next save overwrites the stored record. The user's other settings are lost silently.

## Cause
[viewStateRepo.ts](http://localhost:8000/winisd/openisd/packages/persistence/src/repos/viewStateRepo.ts#L28-L82)
and [appSettingsRepo.ts](http://localhost:8000/winisd/openisd/packages/persistence/src/repos/appSettingsRepo.ts#L38-L48)
return null for the whole record on any bad field.

## Fix
Keep every good field, default only the bad ones, back up the original first, and say what was
reset.
