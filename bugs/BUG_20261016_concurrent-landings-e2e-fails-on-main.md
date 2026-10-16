# BUG_20261016_concurrent-landings-e2e-fails-on-main

**Status:** OPEN

## Symptom
`bash scripts/land/test/runtime-paths-concurrent.e2e.test.sh` fails its first test on unchanged main:

    FAIL concurrent landings (r1=1 r2=1)

Test 1 ("two concurrent land.sh runs serialize on LAND_LOCK under $OPENISD_RUNTIME_DIR") starts two
`land.sh` runs at once in a scratch repo, each with its own task (T1 changes a.txt, T2 changes b.txt).
It expects both to exit 0 and both commits on the scratch origin's main. Both exit 1.

## Evidence
- Reproduced 16 Oct 2026 on a clean worktree of origin/main at f765dba1 (after ea13f9d1d1), and on
  branch t219 on top of it. The other tests in that file and the rest of scripts/land/test pass.
- Each run's output is in `$SCRATCH/out.w1` / `out.w2`; the test deletes the scratch dir on exit, so
  the refusal text was not kept. ⚠ unverified which gate refuses.

## Cause
Unknown. Found while landing T219 (maryu); not investigated.

## Fix
Keep the scratch dir on failure, read the two land.sh refusals, and fix the gate or the test.
