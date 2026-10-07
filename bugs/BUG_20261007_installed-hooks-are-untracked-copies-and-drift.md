# BUG_20261007_installed-hooks-are-untracked-copies-and-drift

**Status:** OPEN (fix later, not tonight)

## Symptom
The commit and push hooks that actually run, `.git/hooks/pre-commit` and `.git/hooks/pre-push`, are plain file
copies of `scripts/hooks-local/pre-commit` and `pre-push`. Nothing installs them and nothing checks that they still
match. Tonight the live hooks and `scripts/hooks-local` differed: the live pre-commit dated 27 Sep ran the old
gate with no queue, while the tracked one had been through 4f1c4f07 (queue held out) and its revert (queue back in).
A change to the tracked hook does nothing until someone copies it by hand, and nobody is told.

## Evidence
Checked 2026-10-07 in the shared tree with `cmp`: `.git/hooks/pre-commit` and `pre-push` differ from the tracked
files at the queue-restored commit; `commit-msg` is identical. `git config core.hooksPath` is unset. `git grep`
finds no script that installs the hooks. `.git/hooks` is not tracked, so a hand-copied hook has no history.

## Cause
Hooks are installed by copying, once, and then forgotten. A worktree shares `.git/hooks` with the shared tree, so
one stale copy governs every worktree.

## Fix (later)
- One install script that copies `scripts/hooks-local/*` to the shared `.git/hooks` and keeps the previous copy as
  `<hook>.prev`.
- A check (a unit test or a line in `health-check.sh`) that fails when a file in `.git/hooks` differs from
  `scripts/hooks-local`.
- Or set `core.hooksPath` to `scripts/hooks-local`, so there is no copy to drift (the hooks then run from the
  worktree that commits, which is what the queue wants).

## Verification
Edit a tracked hook without installing it: the check fails and names the hook. Run the install script: the check
passes.

## Done so far
2026-10-07: the queue-restored `pre-commit` and `pre-push` were copied into `.git/hooks` by hand, after saving the
previous ones as `pre-commit.pre-queue` and `pre-push.pre-queue`.
