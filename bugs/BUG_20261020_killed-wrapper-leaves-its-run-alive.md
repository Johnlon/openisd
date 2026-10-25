# BUG_20261020_killed-wrapper-leaves-its-run-alive

**Status:** FIXED

Recorded 20 Oct 2026 by maryu. Audit rows 1, 5, 10, 11 of AUDIT_load_openisd-land-test_20261020.

## Symptom
At load 90 (20 Oct, 01:20) runs that an agent or a timeout had stopped were still alive: playwright, vite
and chrome (about 1.7 GB per browser run), vitest workers. quiet-test also stopped a starved typecheck as
"STALLED", and its own monitoring forked about 80 processes per poll per run.

## Cause
1. `scripts/test-browser.sh` re-execs with `exec setsid --fork --wait`. The run lives in a new session
   that quiet-test's `pkill -s` cannot reach, and `setsid --wait` does not pass TERM on.
2. `scripts/admit.sh` cleanup does `kill "$child"` on the direct child only; grandchildren live on and the
   slot is freed under them, so the next job runs on top of them.
3. quiet-test's idle (STALLED) kill applies to lint and typecheck, which have no timeout by rule.
4. `tree_cpu_ticks` forks `pgrep -P` and `cut` per process every poll.

## Fix
1. test-browser.sh starts the run with `setsid` in the background and traps TERM, INT, HUP and EXIT to
   TERM the whole group, then KILL after a short grace, then reap.
2. admit.sh starts the job in its own session and kills that group on any exit before it removes the record
   and the holder.
3. quiet-test skips the idle kill for lint, typecheck and tsc commands. Browser and vitest runs keep it.
4. `tree_cpu_ticks` reads /proc once per poll with one awk.

Tests: `scripts/land/test/test-browser-kill.test.sh`, `admit-job-group.test.sh`, `quiet-test-idle-lint.test.sh`.

Fixed by T488.
