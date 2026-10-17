# BUG_20261017_dead-branches-and-worktrees-pile-up

**Status:** FIXED (T334)

## Symptom
Task branches (103 local), `land/<task>` candidate branches on origin, worktrees and leftover `openisd-*` folders
piled up. The watchdog removed only clean worktrees of landed branches, after an hour, and never deleted branches
on origin or folders that were no longer worktrees. An abandoned task had no way to be recorded or removed, so its
worktree and branch stayed for ever.

## Fix
- `scripts/land/tidy-branches.sh`, run by the watchdog every tick:
  - a worktree goes when it is clean, no running program is inside it, and its commits are on origin/main (or in
    its abandoned task's archive); a stale claim does not keep it;
  - a task branch, local or on origin, goes on the same terms, and so does a landed `land/<task>` branch;
  - a leftover folder with only generated folders goes.
  The main folder and the synced copies are never touched. Every removal is logged.
- `scripts/abandon.sh T<n> --by <who> "<why>"` keeps the branch as `refs/archive/T<n>` (here and on origin), lands
  `status: abandoned` with who, when, why and the archived commit, then removes the worktree and branch. An
  abandoned worktree with uncommitted work is kept and becomes an agent alert until that work is committed.
- T337: `land.sh` squashes, so a landed task's branch shas are never on main and the first live run kept such
  branches (t303, t314). A branch now also counts as landed when merging it into main changes nothing, apart from
  its own task file once main says the task is done. `abandon.sh` also takes a task whose task file never reached
  main (it reads it from the branch).
- Test: `scripts/land/test/tidy-branches.e2e.test.sh` (real git, real land.sh); `watchdog.test.sh` case 7.
