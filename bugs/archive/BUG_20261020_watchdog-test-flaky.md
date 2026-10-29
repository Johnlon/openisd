# BUG_20261020_watchdog-test-flaky

**Status:** FIXED

Recorded 20 Oct 2026 by maryu. Fixed by T485.

## Symptom
`bash scripts/land/test/watchdog.test.sh` failed about 3 runs in 5, on origin/main too, a different check each
time: "F3", "j1", "carol's alert", "snapshot left behind (0 -> 1)". The code under test was fine.

## Cause
Two causes, both in the test.

1. **Alert checks piped `cat` into `grep -q`.** The test has `set -o pipefail`. `al F-F3 | grep -q '^for lots: F3'`
   runs `cat <alert file>` and `grep -q`. `grep -q` quits at its first match; if `cat` has not finished exiting
   it gets SIGPIPE and the pipeline reports failure although the alert is right. Measured on a loop of 3000
   such pipelines in a pipefail shell: 61 failed (2 percent), more on a busy machine. The failure message then
   printed the correct alert text. Checks hit: `F1`, `F3`, `j1`, "a live owner", "carol's alert", "reused pid",
   and the `git show | grep -q "^stray$"` check.
2. **The snapshot check counted every `watchdog-tools.*` folder in /tmp.** The tick under test makes one in /tmp
   and removes it. The real watchdog timer (every 5 minutes) and any other test run on the machine make and
   remove the same folders, so the count moved between "before" and "after": "snapshot left behind (0 -> 1)".

## Fix
1. `alerted <key> <regex>` in the test: `grep -q` reads the alert file itself, no pipe. The stray-branch check
   reads `git show` into a here-string.
2. The snapshot tick runs with `TMPDIR` set to a folder in the test's scratch dir; only that folder is counted.

Nothing in `scripts/land/watchdog.sh` changed.

## Seen once, not explained
One loaded run (load 20) also failed case 1 ("killed before the threshold", "holder kept", "kill not logged",
"leader not told"). It did not come back in 4 quiet runs, 3 synthetic-load runs or the 10 runs after the fix.
If it is seen again it gets its own bug file with the run's log.
