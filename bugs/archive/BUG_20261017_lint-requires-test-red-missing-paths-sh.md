# BUG_20261017_lint-requires-test-red-missing-paths-sh

**Status:** FIXED (scratch copy by T328/T497, gate by T400; closed by T544)

## Symptom
`scripts/land/test/lint-requires.test.sh` is red on main and on t254. No task's done_test, CI job or
post-land suite runs it, so nobody sees it fail.

## Evidence
- 17 Oct 2026, fresh worktree of origin/main 7f0989b9: `bash scripts/quiet-test.sh bash scripts/land/test/lint-requires.test.sh`
  exits 1 with `FAIL node_modules present (r=1: scripts/land.sh: line 42: .../w/c/scripts/paths.sh: No such file or directory`.
- `git grep lint-requires -- tasks .github scripts` finds no caller other than the test itself.

## Cause
The test's scratch copy (line 21) copies `scripts/land.sh` and `scripts/land/` only. Since 11 Oct
(6d14d28c), `land.sh` sources `scripts/paths.sh`, and the test was never updated.

## Fix
Copy `scripts/paths.sh` (and `scripts/lib/`, which land.sh now loads for timing) into the scratch copy,
and add the test to a done_test or the post-land suite so a red is seen.

## Verification
The test passes on main, and it runs in some gate.

## Resolution (21 Oct 2026, T544)
- The scratch copy now takes `scripts/paths.sh` and `scripts/lib/` (T328, T497).
- Every `scripts/**/test/*.test.sh` runs in the landing's candidate run, job shell, through
  `scripts/test-shell.sh` (T400), so a red is seen.
- `bash scripts/land/test/lint-requires.test.sh` on main 436be50c0: both cases ok.
