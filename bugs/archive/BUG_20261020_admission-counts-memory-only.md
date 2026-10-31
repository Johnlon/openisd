# BUG_20261020_admission-counts-memory-only

**Status:** FIXED

Recorded 20 Oct 2026 by maryu. Fixed by T487.

## Symptom
At 01:20 on 20 Oct the 10-core box hit load 90 and John killed processes by hand. Every job had been
admitted because every job "fit" in 10.5 GB. Page loads then passed the 60 s navigation timeout.
Audit rows 2, 3 and 4 of `_agent_files/briefs/AUDIT_load_openisd-land-test_20261020.md`.

## Cause
There are three things. Admission (`scripts/budget.sh`) counts memory only, so nothing stops ten
4-worker runs sharing 10 cores. A landing gate's deadline (`scripts/land/core/gate.sh`) starts before the
gate has been admitted, so a gate that only waits for memory is killed as "no result within its deadline".
The landing typecheck (`land.conf` TYPECHECK_CMD) runs `heavy.sh` directly and is never admitted. An idle
1400 MB suite pool also sat unused since the suite moved to GitHub Actions.

## Fix
1. `budget.sh <pool> <MB> [--cpu <n>] -- cmd`: CPU tokens (one per core, `CPU_TOKENS`) beside memory tokens.
   A job holds its memory and its CPU tokens, or none; it waits on all busy tokens of both kinds.
   Costs in cores per job kind are in `budget.conf`; `budget-cost.sh` prints `<pool> <MB> <cores>`.
2. `budget.sh` works from any cwd, so other repos call it with an absolute path.
3. The suite pool goes into the general pool; `suite` stays as an alias of `general`.
4. `TYPECHECK_CMD` is `bash scripts/quiet-test.sh npm run typecheck`.
5. `run_gate` admits the gate first and starts the deadline only after admission; a stop reaches a waiting gate.
