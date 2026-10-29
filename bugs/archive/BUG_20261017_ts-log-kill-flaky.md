# BUG_20261017_ts-log-kill-flaky

**Status:** FIXED (T292)

## Symptom
`scripts/land/test/ts-log-kill.test.sh` failed "TERM to the wrapper: no survivor: got 2, want 0" in about 2 of 5 runs.

## Cause
A real leak, not a test race. On TERM the wrapper `scripts/lib/ts-log.sh` started a detached subshell
(`( sleep 1; kill -KILL ... ) &`) as the 1 s grace timer. When the command died at once, the wrapper
exited, and the subshell and its `sleep 1` (the 2 survivors, both carrying `OPENISD_RUN_ID`) lived on
for up to 1 s. Reproduced by listing the run's pids right after the wrapper exited: `bash ts-log.sh ...`
and `sleep 1`, 3 times in 8.

## Fix
The grace timer is a plain `sleep 1` child of the wrapper. The wrapper waits on the command and the timer
together (`wait -n -p`), so a command exit or the timer ends the wait. On exit the wrapper kills and reaps
the timer. No timer outlives the wrapper. The test is unchanged.
