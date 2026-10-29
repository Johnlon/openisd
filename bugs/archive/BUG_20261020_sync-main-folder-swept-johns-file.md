# BUG_20261020_sync-main-folder-swept-johns-file

**Status:** FIXED

Recorded 20 Oct 2026 by maryu (reported by fable).

## Symptom
John saved a ps listing as `lll1` in the main folder. At 00:29Z the next sync tick committed it to
`stray/20261020T002917Z` (commit 8174d89d5, "WIP main folder: stray edits, committed by sync-main-folder")
and it vanished from his folder.

## Cause
`scripts/land/sync-main-folder.sh` treats every untracked file as a stray edit: it checks
`git status --porcelain --untracked-files=all` and commits with `git add -A`, then returns the tree to
the branch, which removes the file from disk.

## Fix
1. Untracked files stay where they are. Only tracked edits (modified, staged, deleted) go to a stray branch
   (`git add -u`); every dirty check ignores untracked files.
2. An untracked file whose path the passed commit tracks would be overwritten by the move: the copy is held
   (not moved, logged, exit 1), naming the file. Nothing is overwritten.
3. A test in `scripts/land/test/sync-main-folder.e2e.test.sh`: an untracked file survives a sync on disk and is
   on no stray branch; a colliding untracked file holds the copy.

`lll1` was put back from 8174d89d5 by hand on 20 Oct 2026, and added to the main folder's
`.git/info/exclude` until this lands.

Fixed by T485.
