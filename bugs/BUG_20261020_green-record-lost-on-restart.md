# BUG_20261020_green-record-lost-on-restart

**Status:** FIXED (T497, opi). Found by maryu, 20 Oct 2026.

The last green sha is kept in one place, `/run/user/1000/openisd/post-land.lock.green`, and a restart clears /run. We need it kept on disk (for example `~/.local/state/openisd/`), with the locks left on /run.

- Seen: after the 09:01Z restart on 20 Oct, sync-main-folder logged at 09:03:49Z "no passed commit recorded; nothing moved", and the watchdog raised "main folder cannot update". The record came back only when post-land ran again.
- Writer: `scripts/land/post-land/run.sh` (about line 338). Readers: `scripts/land/sync-main-folder.sh` (GREEN), `scripts/land.sh` (about line 289-299, green and tested), the red path in run.sh (line 111).
- Test first: wipe the runtime dir, then sync-main-folder still finds the last green.

**Fix:** post-land writes `post-land.green` and `post-land.tested` under `OPENISD_STATE_DIR` (`~/.local/state/openisd`, `scripts/paths.sh` `POST_LAND_RECORD`); the locks stay on /run. Test: `scripts/land/test/sync-main-folder.e2e.test.sh` case 12 wipes the runtime dir and the copies still move.
