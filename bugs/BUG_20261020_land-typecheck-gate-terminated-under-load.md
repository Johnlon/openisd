# BUG_20261020_land-typecheck-gate-terminated-under-load

**Status:** CLOSED (no fix): killed by John during load 90

Recorded 20 Oct 2026 by bob, from the T480 landing.

## Symptom
`land.sh T480` was refused by the typecheck gate: "land: REFUSED by gate typecheck: failed (exit 143)".
The gate log shows `node scripts/typecheck.mjs` starting at 00:15:24Z and the line "Terminated" at
00:27:28Z (status 143, duration 737 s). Load average was about 70. The same typecheck passes when
re-run by hand in the worktree (6 min 54 s under the same load; about 49 s normally). A good change
was refused, and the task had to be landed again.

Log: the land log of the T480 retry, 20 Oct 2026 00:12–00:27Z (`END gate-typecheck status=143 duration_s=737`).

## Cause
John stopped processes by hand at 00:27:28Z, when the machine was at load 90 (found by fable, 20 Oct 2026).
The same stop took the openisd-preview service and several test runs. Not a defect in land.sh: `land.conf` sets
`TYPECHECK_DEADLINE_S=0`, and the gate's own deadline would show exit 124 or 137, not 143.

## Fix
None. T480 was landed again once the load fell.
