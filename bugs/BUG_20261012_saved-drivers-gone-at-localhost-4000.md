# BUG_20261012_saved-drivers-gone-at-localhost-4000

**Status:** OPEN - cause unknown, baseline recorded, detector planned (T058)

## Symptom
John, 12 Oct 2026: saved drivers he had at http://localhost:4000/ are gone. The store at that address holds no `openisd_my_drivers` key at all. He did not use Restore or Import.

## Evidence
Console dump, 12 Oct 2026 evening, http://localhost:4000/:

| key | length |
|---|---|
| openisd_open_sessions | 19808 |
| openisd_view | 101 |
| openisd_state | 17736 |
| openisd_projects | 19773 |

No `openisd_my_drivers`, `openisd_app_settings`, favourites or radiator keys.

The only app code that removes that key is Restore from backup (`backupRepo.ts` importAll clears keys the file lacks). John did not restore. No other path removes it.

## Baseline
12 Oct 2026, evening: John created and saved one project at http://localhost:4000/. The store is the four keys above. John will not delete this project. If it is missing at a later check, the loss is the app's or the browser's, not his. This is the reference.

## Plan
T058: storage log at every start, on-screen notice when a key seen before is gone, telemetry carries it. Ruling: every destructive storage write snapshots the whole store first.
