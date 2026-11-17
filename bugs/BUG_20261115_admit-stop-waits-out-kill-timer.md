# admit.sh waits the whole 10 s KILL timer when the job dies before the wait starts

**Status:** FIXED (T819)

## Symptom
Suite on main 63dc2681 (15 Nov 2026, 11:23 UTC), job `shell`: `FAIL scripts/land/test/admit-term-group.test.sh (exit 1, 12s)`, `FAIL 2 members still alive 10 s after TERM`. It passed on 57253231 (2 s) and passes locally.

## Steps to reproduce
1. `bash scripts/land/test/admit-term-fast.test.sh` on the unfixed `scripts/admit.sh`: admit.sh is still running 8 s after TERM although its job died at once. (A debug trap holds the wait 0.5 s so the race is certain.)
2. Without the trap, the race is rare: about 1 in 90 runs of `admit-term-group.test.sh` run 30 at a time on a loaded machine.

## Evidence
The failed run listed 4 group members before TERM and 2 alive after 10 s. The 10 s is admit.sh's KILL timer, ending just as the test's 10 s look ended. A minimal script (child killed, then `wait -n -p gone "$child" "$timer"`) waits the full timer on bash 5.2.21 every time the child was reaped before `wait -n` began.

## Cause
`stop_job_group` sent TERM, started `sleep 10 &`, then `wait -n` on the job leader and the timer. The leader (job.sh) dies on TERM at once. If it died and was reaped before `wait -n` ran, bash no longer listed it, and the wait ended only when the timer did. KILL for the rest of the group then came at 10 s, not at once. Any killed run took 10 s to end; the test, which allows 10 s, lost the race on a loaded runner.

## Fix
Wait with `timeout 10 tail -s 0.1 --pid=$child -f /dev/null`, which returns at once for a pid that is already gone.

## Verification
`admit-term-fast.test.sh` fails before, passes after (ends 0 s after TERM). The admit tests (term-group, job-group, holder, per-repo, e2e, suite-admit) pass.
