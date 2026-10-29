# BUG_20261017_second-actions-run-on-main

**Status:** FIXED (T322)

## Symptom
Since T301 every landing ran the full suite on GitHub Actions twice: once on its candidate branch
`land/<task>` (the gate), and again when the same commit reached main. About 4 minutes of runners per
landing, for no new information.

## Cause
`.github/workflows/suite.yml` still triggered on pushes to main as well as `land/**`, and post-land looked
for the main push's run.

## Fix
- `suite.yml` triggers on `land/**` only. Main gets the candidate's commit, so post-land
  (`scripts/land/post-land/actions.sh`) finds the candidate's run by sha and records its result.
- A commit that reaches main without a candidate and changes only task files (post-land's own F open and
  close commits, a task file fixed by hand) takes the result of its nearest ancestor that changes anything
  else; the suite reads none of those files. A code commit with no run is still red.
- Test: `scripts/land/test/post-land-actions.e2e.test.sh` case 10.
- Proven over 3+ green candidate landings first (T309, T311, T313, T321), as fable set.
