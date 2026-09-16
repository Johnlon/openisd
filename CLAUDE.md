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

This repo is worked by several agent sessions at once, in the same tree. Uncommitted changes you did not make are someone else's live work.

Never run any operation that reverts, discards or overwrites work in progress — yours or another session's — until that work has been COMMITTED first.

- Covers `git checkout`, `git stash`, `git stash pop`, `git restore`, `git reset --hard`, `git clean`.
- Covers every other route to the same outcome: writing a file back from `git show` or `git cat-file`, restoring a backup, copying an older version over a modified one, or re-editing a file to a previous state. Same violation as the blocked command.
- Order, no exceptions:
  1. COMMIT the work in progress — that is what makes it recoverable.
  2. ASK — send the revert request to the leader session and every other collaborating session, and wait for permission.
  3. Only with permission AND after that commit may the revert happen.
- A guard blocked the command? STOP and report to the human. Never look for another way round it.
- Stage by filename. Never `git add -A`, never stash, never touch another session's package.
- Why: committed work is recoverable, uncommitted work is not. Agent stash/checkout decisions have destroyed hours of work here, including the in-flight work of other sessions.
