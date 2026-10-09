# BUG_20261009_retired-field-reset-notice-on-every-load

**Status:** OPEN

## Symptom
John, 9 Oct 2026, mobile (openisd.app): every saved project shows, on every load, a notice that never goes away:
"“o1” loaded with 3 field(s) reset to the default — Reset: saved.box.bandpass4.front.losses.Qicl, saved.box.bandpass6.front.losses.Qicl, saved.box.abc.front.losses.Qicl", repeated per project.

## Evidence
Reported by John from the live app. The three paths name the front chamber's Qicl, which was removed from the model (the front chamber has no Qicl).

## Cause
⚠ unverified: the loader treats a retired field as an unknown value and reports it as "reset to the default"; the repaired project is not written back, so the same notice comes back on every load.

## Fix
- A retired field is dropped by a migration, silently: it is not a reset and raises no notice.
- The stored database is repaired, not just the copy in memory: at start-up every stored project, open session and backup is migrated and written back (after the existing backup key is updated, so nothing is lost). John, 9 Oct: "there is no repair to the Db it seems".
- A notice is shown once, at the repair, not on every load.
- Notices can be dismissed.

## Verification
Test: a stored project carrying `box.*.front.losses.Qicl` loads with no notice and is rewritten without the field; a second load shows nothing.
