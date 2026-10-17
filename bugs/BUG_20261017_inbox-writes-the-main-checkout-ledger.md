# BUG_20261017_inbox-writes-the-main-checkout-ledger

**Status:** FIXED (T321)

## Symptom
Agents raise inbox items while working in their own worktree (openisd-tNNN). The items kept turning up as
uncommitted changes to `questions.yml` in the main checkout (openisd). The main checkout could then not
update to origin/main, so lap:4000 served an old build.

## Cause
`~/.claude/bin/inbox.py` read every workspace `*/questions.yml`, the worktrees beside the main checkout
included, each holding a copy of the QO ledger. `add` wrote to the first ledger with the prefix, and every id
lookup took the first match, in path order. Nothing preferred the checkout the command ran in. Agents' shells
also start in the main checkout, so items raised there by default went to the main checkout's ledger.

## Fix
`ledger_paths()` in `~/.claude/bin/inbox.py`:
- The ledgers from the run folder upward come first, nearest first, so `add`, `put`, `close` and the rest act on
  the checkout the command runs in.
- A linked worktree (its `.git` is a file) is never read as a workspace ledger.
- In a worktree, its own repo's main checkout ledger is not read beside it, so no question is listed twice.
- `INBOX_WORKSPACE` points the tests at a scratch workspace.

Tests: `~/.claude/bin/inbox_test.py`, 6 new cases (a worktree, a folder inside it, the main checkout, outside
any checkout, a note on a question in both copies, no double read). 28 of 28 pass; the first 5 failed before
the fix.

An agent raises an item from its worktree: `cd <worktree> && python3 ~/.claude/bin/inbox.py add QO …`. The
item then lands with that task.
