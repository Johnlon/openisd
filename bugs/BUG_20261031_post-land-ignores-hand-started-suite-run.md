# Post-land ignores a suite run started by hand on the exact sha (F59)

Found: 31 Oct 2026, F59 (again F60). Fixed 31 Oct 2026 by T635 (QO328: John said yes): post-land takes any suite run on the exact commit, push or hand start.

## What happened

Main moved by direct pushes during the release emergency (docs/SDLC_POLICY.md §1). The full suite was
started by hand (`workflow_dispatch`) on e366a72dc and went green (run 41225575863). Post-land then
opened F59, "red at cbbd0810ea": it found no suite run on e366a72dc after 600 s. Nothing was red.

## Cause

`scripts/land/post-land/actions.sh` line 48 asks for `gh run list ... --event push --commit <sha>`,
so a hand-started run on the same sha is never seen. The emergency route always produces such runs.

## Fix needed

Accept a completed `suite.yml` run on the exact sha whatever started it (push or workflow_dispatch).
`scripts/land/` is gate code: the change goes through John's approval on the board (T624 rule) and
the scratch-repo end-to-end test (processes.md rule 7).
