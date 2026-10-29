# BUG_20261017_watchdog-unit-runs-the-checkout

**Status:** FIXED (T304); the live install follows the landing

## Symptom
After T291 (the watchdog runs from an origin/main snapshot) and T297 (housekeeping stops dead-owner tagged
processes) landed, the old watchdog and the old housekeeping kept running. The orphaned vite previews on
4103 and 4104 lived on, and housekeeping logged "0 slots freed" every 5 minutes.

## Cause
There are two things, the watchdog and the systemd unit that starts it. T291 made the watchdog run from a
snapshot of origin/main, but the unit ran `/home/john/work/winisd/openisd/scripts/land/watchdog.sh` from
the main checkout. The unit files were also symlinks into that checkout. The checkout was 22 commits behind
main, held by an uncommitted file, so systemd kept running a watchdog from before T291.

## Fix
- New `scripts/land/watchdog-boot.sh`: it fetches origin/main and runs origin/main's `watchdog.sh`, which
  then runs from its snapshot (T291).
- `watchdog-install.sh` copies the boot script to `~/.local/libexec/openisd/` and copies the units,
  replacing the old symlinks. The unit runs only that installed copy:
  `ExecStart=/usr/bin/bash %h/.local/libexec/openisd/watchdog-boot.sh`.
- Test: `scripts/land/test/watchdog-boot.test.sh`:
  - with a lagging checkout that holds an uncommitted watchdog, the boot runs origin/main's newest one and
    leaves the checkout untouched;
  - no watchdog on origin/main gives exit 2 and runs nothing;
  - the installer copies the units and the boot script, replacing a symlink;
  - the unit names only the boot script.
