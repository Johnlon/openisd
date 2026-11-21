# BUG_20261121_your-data-picture-depends-on-save-time-and-browser

**Status:** FIXED in the visual harness (T955, the Your data picture fix). CI retake pending.

## Symptom

The picture review for PR 154 (run 44923383800) flagged the phone Options → Your data picture.
It read “This site uses 1.2 MB of the 2.3 GB this browser allows.” and the local usage line
changed from 20.5 KB to 20.6 KB across the pictures. The desktop Options dialog and both
Restore one project pictures use the same storage panel.

## Cause

- The site line already came from the visual harness's fixed `navigator.storage.estimate()`
  response. The browser's real persistence response still decided whether a warning appeared
  and which condition OpenISD stored in place of the fixture's old dismissal marker.
- Opening the fixture `.owpr` writes the saved project, the last project and the open session.
  The persistence code counted 19,920 characters for those records on main and 19,996 on the
  driver calculation review build, which adds `winisdChartFromFsVasQms` and stores the passive
  radiator's Vas with a different precision. Both totals display as 19.5 KB in the Projects row.
  With the 290-character startup backup and 829-character settings from the phone pictures,
  the overall totals round to 20.5 KB and 20.6 KB. The startup backup was created because the
  harness seeded a saved view with no storage-layout stamp.
- The project save's timestamp is fixed-width in the live store. A local run through the
  persistence code showed that changing it by milliseconds can change the compressed
  manual backup's length. The manual backup's own time also supplies the date seen in its row.

## Fix

The site line keeps the harness's fixed answer (1.2 MB of 2.3 GB); it was never the machine's quota. The visual harness now also gives the storage pictures a browser
that consistently refuses persistence. The saved view starts at the current storage layout
with the persistence warning already acknowledged. The Restore one project opener clicks
Save and Back up now at fixed browser times. OpenISD reads and writes the fixture's storage
normally, and the pictures show the amounts it actually computes.

## Tests

The four visual openers check the exact site line and backup rows before capture. Your data
starts with zero backups, and each Restore one project picker shows one backup at 14:00 UTC.
The sandbox blocked the local browser run. The four pictures need a CI retake.
