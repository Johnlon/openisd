# BUG_20261017_land-tests-read-the-machines-runtime-dir

**Status:** RESOLVED

## Symptom
land-squash, land-subject, land.e2e and suite-admit go red whenever the real main is red or the
machine's memory pool is full. They test a scratch repo but read the machine's own runtime state.

## Evidence
17 Oct 2026, t254, main red for 180 min (F49), with the general memory pool full:
- `bash scripts/test.sh scripts/land/test/land-subject.test.sh` exits 1. The scratch landing prints
  `land: REFUSED by gate red-main: main has been red for 180 min (last green a78dcbb7b8)`, which is the real main's state, not the scratch repo's.
- suite-admit exits 1: `budget: waiting for the suite pool: 1400 MB needed, not enough is free`, the real pool.
- The same four tests with `OPENISD_RUNTIME_DIR=<scratch dir>` set: all exit 0.

## Cause
The tests do not set `OPENISD_RUNTIME_DIR` (or `BUDGET_DIR`), so `scripts/paths.sh` points them at
`/run/user/<uid>/openisd`. There, land.sh's health gate (T121) reads the real post-land green and
tested files, and budget.sh reads the real memory pools.

## Fix
Each land test exports `OPENISD_RUNTIME_DIR="$SCRATCH/rt"` before it starts any script.

## Verification
The four tests pass while the real main is red and the real pool is full.

## Resolution
T254: land-squash, land-subject, land.e2e and suite-admit each export `OPENISD_RUNTIME_DIR="$SCRATCH/rt"`
right after making their scratch dir. land.e2e is locked by T001, so its sha256 in tasks/T001.yml is updated.
All four pass, and `land.sh --self-check` reports 0 wrong. On 17 Oct, with the real main red and the
real pool full, the same four passed with the variable set and failed without it.
