# BUG_20261017_main-folder-stuck-behind-main

**Status:** FIXED (T328)

## Symptom
The main folder (`/home/john/work/winisd/openisd`, the main checkout) stayed behind main for hours: on 17 Oct
2026 it sat at 59799d6d while main moved on, held by a stray `questions.yml` edit (inbox items QO182–184 raised
there). John had to bring it up to date by hand. "I refuse to work this way any longer"; "stuck main checkout
must be cleaned automatically".

## Cause
Work lands from task worktrees straight to GitHub. Nothing brought the main folder back to main, and any stray
edit there would have stopped a plain pull anyway. Tools such as `inbox.py` wrote into the main folder.

## Fix
- `scripts/land/sync-main-folder.sh`: commits stray edits as a WIP commit (nothing lost), then rebases onto the
  last commit whose GitHub run passed (post-land's last green, or the commit `land.sh` just pushed). Edits
  already on main drop out. A conflict cancels the rebase and is reported; so are commits not on main. Also
  keeps the lap:4000 preview copy (git config `openisd.syncedCopy`) there, detached, with `npm ci` only when
  `package-lock.json` changed.
- `land.sh` step 8 runs it after every push (land.conf `SYNC_MAIN_FOLDER=1`) and exits 4 when the folder is
  held: the landing agent fixes it. The watchdog runs it every tick and logs a held folder.
- `land.sh`, `claim.sh`, `integrate.sh`, `sync-driver-snapshot.sh` (`scripts/lib/main-folder.sh`) and
  `inbox.py` refuse to write in the main folder or a synced copy.
- Tests: `scripts/land/test/sync-main-folder.e2e.test.sh` (stray modified and untracked files, a conflict like
  today's, only passed commits, the preview, npm ci, overlap); `inbox_test.py` (3 refusal cases).
  `lint-requires.test.sh` was already red on main (it lacked paths.sh and three gate commands): fixed here.
