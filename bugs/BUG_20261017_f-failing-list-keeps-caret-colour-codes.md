# BUG_20261017_f-failing-list-keeps-caret-colour-codes

**Status:** FIXED (T298)

## Symptom
F53's failing list showed vitest lines as `unit (1): ^[[41m^[[1m FAIL ^[[22m^[[49m ...`.

## Cause
GitHub's failed-job log (`gh run view --log-failed`) prints colour codes in caret notation, as the
two characters `^[` followed by `[41m`. post-land removed only real ESC bytes.

## Fix
`scripts/land/post-land/run.sh` also removes `^[[<n>m`. Test: `scripts/land/test/post-land-red-base.test.sh`,
"the F lists only the failing specs, with no markers or colour codes", now with a caret-notation line.
