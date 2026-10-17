# BUG_20261017_task-id-reused-overwrites-landed-record

**Status:** FIXED (T323)

## Symptom
17 Oct 2026: right after maryu's T321 landed, a second commit titled "T321" (fable's agent: T055 conflict
markers, two inbox events) landed and rewrote `tasks/T321.yml` with its own owner, goal and status. The
landed T321's record was gone from main. The same agent had also created a worktree with a name already in
use: `new-worktree.sh` failed, its next commands ran in maryu's openisd-t313, and T313 swept its edit in.

## Cause
- The second task's id was typed by hand, not claimed with `scripts/new-task.sh`, and land.sh never checked
  that `tasks/<id>.yml` on main belonged to the landing task.
- `_agent_files/bin/new-worktree.sh` failed on an existing folder with git's own error and no clear refusal,
  and the caller's next command (`cd` into that folder) ran anyway.

## Fix
- land.sh step 2a: a `tasks/<id>.yml` on main under another owner refuses the landing (gate `task-id`), naming
  the owner and goal. Re-landing one's own id goes on. Test: `scripts/land/test/land-task-id.e2e.test.sh`
  (on the old land.sh the second task lands and main's record changes owner).
- `new-worktree.sh` (workspace repo) refuses with exit 2 and "REFUSED: …, nothing was made", before anything
  is made, when the folder or the branch exists. Test: `_agent_files/bin/test_new_worktree.sh`.
- DEV_PROCESS: chain what follows `new-task.sh` with `&&`, or check its exit code.
- Records: `tasks/T321.yml` restored (maryu, done, landed 6484a3d5); fable's work recorded as `tasks/T324.yml`
  (fable, done, landed 6dae9aab); `tasks/T313.yml` notes the swept-in F55 flake fix, which is wanted.
