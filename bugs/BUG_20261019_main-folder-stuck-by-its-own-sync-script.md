# Main folder stuck for hours by its own sync script

**Status:** FIXED (T476)

## What happened
`scripts/land/sync-main-folder.sh` committed stray edits in the main folder as WIP commits onto the
main folder's own `main`. Main then landed the finished version of the same bug file, so every later
sync hit a conflict and stopped. The only fix was a history rewrite, which the permission check
refuses. The watchdog sent the alert to lots, whose session had ended. Three agents (opi, maryu,
fable) hit the same refusal; it was raised twice (QO275, QO283). Every landing ended "the main
folder did not update" until John approved the rewrite by hand on 19 Oct.

John: "the point of processes and automation is to avoid fuckups".

## Fix
1. sync-main-folder commits stray edits to a `stray/<utc time>` branch, never to `main`; local
   `main` only fast-forwards to the last green commit, so it cannot conflict or need a rewrite.
2. A guard refuses file edits inside the main folder; all work is in worktrees.
3. A watchdog alert whose named owner has no live session goes to the coordinator.
(Done already: new-worktree.sh bases on origin/main, workspace 71518d3. One board item per
problem: inbox skill.)

## Tests
- sync-main-folder e2e: stray edit + a landed change to the same file -> main fast-forwards, the
  stray edit is on a stray/ branch, exit 0, nothing lost.
