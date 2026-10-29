# BUG_20261013_land-stamps-previous-task-outside-allowlist

**Status:** RESOLVED

## Symptom
Landing a task right after another task landed fails with
"check-commit: task T<new> may not touch: tasks/T<previous>.yml" and "land: squash commit failed"
(exit 2). The worker's task never touched that file. Seen 13 Oct 2026 three times in a row:
T086 refused over tasks/T085.yml, T079 over tasks/T086.yml; T080 needed tasks/T079.yml allowed; T089 (this record) was refused over tasks/T084.yml.

## Evidence
After the refusal, `git diff --cached tasks/T085.yml` in the T086 worktree showed one added line,
`landed: fd5965c5…`, which no person or worker wrote: land.sh adds it to the previously landed task's
file inside the next landing's squash commit, and the pre-commit allowlist check (check-commit.sh)
then refuses the commit.

## Cause
land.sh step 2b (T064, `scripts/land.sh` after the rebase) gives every done task that lacks `landed:` the sha of its commit on main, then squashes the branch with `git add -A`. The pre-commit allowlist (`check-commit.sh`) saw that one-line change to the earlier task's file as the worker's.

## Fix
T091: `check-commit.sh` passes a `tasks/*.yml` file outside the allowlist when its only staged change is one added `landed: <sha>` line. Any other change to such a file still refuses. `scripts/land/test/check-commit-landed-stamp.test.sh` covers both.

## Verification
Two tasks landed back to back from separate worktrees: both land with exit 0 and no allowlist
edits; the first task's file carries its `landed:` sha on main.
