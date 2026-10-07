# BUG_20261007_shared-main-moved-under-a-running-commit-hook

**Status:** OPEN (fix later, not tonight)

## Symptom
A commit in the shared tree ran its pre-commit hook for 2 hours, passed, and then failed with
`cannot lock ref HEAD: is at b8c95ffe but expected 2922df22`. Another worktree had fast-forwarded the shared
`main` while the hook ran. Nothing was lost (the files stayed staged) but the 2 hours of tests were wasted and
had to be run again.

## Evidence
2026-10-07, about 13:00 to 15:00. The commit was bob's step-2 commit in `/home/john/work/winisd/openisd`.
Between its start and its ref update, a worker session ran `git merge --ff-only` in the shared tree from the
`openisd-queue` worktree, twice (to 2922df22, then to b8c95ffe).

## Cause
There are two things, the queue and the branch ref. The queue makes slow test runs wait their turn. Nothing makes
a change to the `main` ref wait for a run that was started from the old `main`, so a fast-forward lands under a
running hook and the hook's commit then fails.

## Fix (later)
- A fast-forward, merge or commit that moves the shared `main` takes a queue ticket, like a test run, or
- work from other worktrees lands only by committing in the shared tree, never by a fast-forward from outside.
- A hook that fails on `cannot lock ref` says so and names what moved `main`.

## Verification
A test with a fake slow hook in one process and a fast-forward in another: the fast-forward waits until the hook
ends.
