# BUG_20261019_land-lint-gate-took-two-hours

**Status:** OPEN

Recorded 19 Oct 2026 by worker-lint.

## Symptom
The lint gate was not slow. The clock jumped two hours while it ran. `land.sh T445` logged
`START gate-lint 18:27:53Z` and `END gate-lint 20:28:37Z duration_s=7243`, and four other landings
looked as if they had waited two hours for the landing lock.

## Cause
The machine's wall clock stepped forward about two hours during the run (WSL freeze or sleep).
The user journal's monotonic stamps for the lint scope run 240955.99 to 240990.12: 34 s, 57 s CPU, 1.1 GB.
The watchdog tick before it ended at 18:24:45Z (monotonic 240767) and the lint started 188 s later,
so the jump came after the lint started and before it ended. Every log that stamps by wall clock
(housekeeping.log, handover-watch, watchdog) shows the same silent gap 18:27Z to 20:28Z. Nothing was
waiting on a lock, the budget gate or the suite. `run_end` in `scripts/lib/ts-log.sh` computes
duration from `date +%s%N`, so a clock step becomes a false duration.

## Fix
1. `ts-log.sh` `run_start`/`run_end` measure duration from the monotonic clock (`/proc/uptime`), not `date`.
2. When wall-clock duration and monotonic duration differ by more than 60 s, `run_end` adds `clock_step_s=<n>` to the end line, so a freeze is named.
3. A shell test in `scripts/land/test/` with a faked `date` that jumps: the end line shows the monotonic duration and `clock_step_s`.
4. No timeout is added (lint and typecheck stay without one).
5. Landing waiters are not slowed by a clock step because flock waits are kernel waits; no change there.

Live gate scripts are not edited here; `ts-log.sh` is used by them, so it goes in under the processes.md rule 7 proof.
