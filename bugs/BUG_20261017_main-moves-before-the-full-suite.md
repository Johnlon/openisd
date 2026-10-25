# BUG_20261017_main-moves-before-the-full-suite

**Status:** FIXED (T301)

## Symptom
On the night of 16–17 Oct, main went red four times (F51, F52, F53) on failures that only the full suite
sees: architecture unit tests and changed browser specs. Each red blocked every landing not labelled fixes
until someone fixed it.

## Cause
land.sh pushed main after the fast laptop gates (lint, typecheck, the unit tests the change reaches,
done_test). The full suite ran only after main had moved, in post-land on GitHub Actions. Every failure it
found was already on main.

## Fix
- land.sh has a new gate, `candidate`, after the fast gates. It pushes the rebased commit to `land/<task>`,
  which starts the full suite on GitHub Actions (`.github/workflows/suite.yml` now also runs on
  `land/**`).
- `CANDIDATE_CMD` (`scripts/land/post-land/actions.sh`) waits for that run, within
  `CANDIDATE_DEADLINE_S` (1800 s).
- Main is pushed only when the run is green. A red run or a missing run refuses the landing, naming the
  failing specs and the run link; main is untouched. The branch is removed whatever the result.
- The landing lock is held throughout, so no other landing moves main between the candidate's run and the
  push.
- A land.conf without `CANDIDATE_CMD` refuses.
- The laptop runs no browser test for a landing.

Proof (processes.md rule 7), `scripts/land/test/land-candidate.e2e.test.sh`: the real land.sh and
actions.sh, real git and processes, and a fake `gh`.
- A green candidate: its run is found on its sha while main has not moved. Main then becomes the candidate,
  and the branch is gone.
- A red candidate is refused with the failing spec and the run link; main untouched; branch removed.
- No run appears: refused; main untouched.
- Two concurrent landings: the second candidate's run starts only after the first reached main, and its
  commit sits on top of the first.
- land.sh stopped while it waits: main untouched, branch removed, nothing left running.

The real proof is T301's own landing: its candidate `land/T301` is the first Actions run on a land branch.
