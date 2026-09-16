# openisd

## TDD — mandatory for every code change

Say you are doing TDD when you start. Never begin by editing a source file.

1. Write a test that reproduces the bug or specifies the feature.
2. Watch it fail, for the right reason.
3. Implement.
4. Watch it pass.
5. Run the domain suite.

Reference: the `/test-driven-development` skill.

## Work in progress is never discarded

Several agent sessions work this tree at once, so uncommitted changes you did not make are another session's live work.

Rule — COMMIT FIRST: never discard uncommitted work, yours or anyone else's, until it has been COMMITTED. A WIP commit is fine. Committed work is recoverable; uncommitted work is not.

- Covers `git checkout`, `git restore`, `git clean`, `git reset --hard`, and `git stash` (read-only `stash list` / `stash show` are fine).
- Covers every other route to the same outcome: writing a file back from `git show` or `git cat-file`, restoring a backup, copying an older version over a modified one, or re-editing a file to a previous state. Same violation as the blocked command.
- Order: 1. COMMIT the work in progress. 2. Then revert.
- Wanting to undo work is a WARNING SIGN, not a step. An agent reaching for a revert is probably in a tail spin: it has stopped applying analysis and design, and stopped following the plan. Stop there and work the problem with the other agents (leader + collaborators) before touching anything.
- Every tail-spin event RAISES AN INBOX ITEM, so the human can see afterwards that the agents struggled and what the issue was. Use the `inbox` skill's "raise a question" flow: a new entry in `questions.yml` at the repo root, taking the file's `next` QO number, `status: open`. Write it in plain English for a reader with no context — what task you were on, what you were trying to do, what went wrong, what you were about to undo and why, who you coordinated with and what was decided. Facts only; no code identifiers or jargon unless a file name is the fact. Raise it BEFORE resuming work.
- A guard blocked the command? STOP and report to the human. Never look for another way round it.
- Stage by filename. Never `git add -A`, never stash.

## Two sessions, one tree

- The leader assigns each task a disjoint set of files. Work only inside your assignment; never touch a file outside it, and never another session's package.
- The leader dispatches serially for tricky or cross-package work, or when a worker is making mistakes, and in parallel only for disjoint mechanical tasks.
