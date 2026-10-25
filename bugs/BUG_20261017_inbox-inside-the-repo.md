# BUG_20261017_inbox-inside-the-repo

**Status:** FIXED (T332)

## Symptom
openisd's inbox, `questions.yml`, lived in the repo. Raising an item from the main folder left it with a stray
edit (17 Oct 2026: QO182–184), which held it behind main; raised in a worktree, the item went to that worktree's
copy. Each repo (openisd, winisd_drivers, winisd_tools) had a ledger of its own, plus the workspace's.

## Fix
John, 17 Oct 2026: "move all questions.yml to the parent winisd only", "one inbox".
- One inbox, `/home/john/work/winisd/questions.yml`, holds every item with its old id (QP, QO, QD, QT); `next:`
  counts each prefix on its own. Merged from the four ledgers, 292 items, the stray QO182–184 included.
- `inbox.py` reads and writes only that file (tests: `inbox_test.py`).
- `questions.yml` is removed from openisd (this task), winisd_drivers and winisd_tools.
