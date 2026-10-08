# BUG_20261008_vite-watchdog-test-reads-the-stopped-process-too-early

**Status:** FIXED in the test (this commit). Not a bug in `scripts/vite-watchdog.sh`.

## What it is
`packages/ui/test/scripts/vite-watchdog.test.ts` "stops the run when nothing listens on the port for
3 polls" failed in the first post-land dry run (2026-10-08, load average 14): the watchdog printed
`WATCHDOG: nothing listens on port 4100 (3 polls)` and sent SIGTERM, but the test read the stand-in
process's state at once, saw it still running, and asserted `stopped === true` as false.

## Cause
The script sends SIGTERM and returns. The test read `/proc/<pid>/stat` one time right after. Under
load the signal has not been delivered yet. The test depended on how fast the machine is.

## Fix
The test runs the watchdog asynchronously and awaits the stand-in process's `exit` event: no deadline,
no count of looks; a stop that never comes ends at the test timeout. A run that must not be stopped
is checked still alive when the watchdog ends. The script is unchanged.
