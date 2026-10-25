# BUG_20261019_new-worktree-bases-on-unlanded-main-folder-commits

**Status:** RESOLVED

There is one script, `_agent_files/bin/new-worktree.sh`, and it starts a new branch from local main when local main is ahead of origin/main; local main is ahead only because sync-main-folder adds "WIP main folder: stray edits" commits that never land, so every new branch carries them. New branches must start from origin/main.

## Symptom
On 19 Oct 2026 five bug-fix branches (worktrees openisd-t440b, -t445, -t450, -t460, t440-d) each inherited three WIP commits (bda316a9, 89c5c456, ae6ac8f5). After T439 landed a newer copy of `bugs/BUG_20261019_phone-field-jumps-when-stepper-closes-keyboard.md`, each `land.sh` run stopped on a rebase conflict in that file.

## Evidence
- Old script chose "the newer of local main and origin/main" as the base.
- `scripts/new-task.sh` already bases on origin/main.
- New test cases in `_agent_files/bin/test_new_worktree.sh`: with an extra local commit on main, the new worktree must equal origin/main. Failed before the fix, passes after.

## Cause
Base rule "newer of local main and origin/main" assumes local main only moves by landed work. In the main checkout it also moves by WIP commits.

## Fix
Default base is origin/main after the fetch; local main only when origin/main is missing. The explicit `[base]` argument is kept. Header comment updated. Workspace commit 71518d3.

## Verification
`bash _agent_files/bin/test_new_worktree.sh` in the workspace repo: all passed.
