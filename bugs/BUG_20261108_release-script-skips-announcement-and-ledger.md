# BUG_20261108_release-script-skips-announcement-and-ledger

**Status:** FIXED (T716). release.sh refuses (publish, --prepare, --approve-prepared) when the snapshot has no announcement openisd-<n.n.n>; after publishing it deploys the production announcements Worker from the snapshot and checks the live list; the RELEASES.md row now lands itself through new-task.sh and land.sh. Covered by release.test.sh.

## Symptom
1. `scripts/release.sh` published OpenISD 7.0.958 with no announcement: nothing checks one exists, and nothing deploys the announcements Worker.
2. `scripts/release.sh` writes the RELEASES.md row into the folder it runs in and says "commit it". Run from the main folder (which only mirrors main), the next sync moved the row onto branch `stray/main-folder`; the 7.0.959 row had to be landed by hand as T714.

## Evidence
- 7.0.958 released 7 Nov 2026; its announcement landed afterwards as T708.
- `build/test-logs/sync-main-folder.log`, 2026-11-08T00:43:17Z: "STRAY main folder: kept on branch stray/main-folder ... RELEASES.md".

## Cause
1. release.sh has no announcement step.
2. release.sh leaves the ledger edit for the caller; main moves only through land.sh.

## Fix
1. release.sh refuses (before any outward step) when the snapshot commit has no announcement `openisd-<n.n.n>`; after publishing it deploys the production announcements Worker and checks the live list carries that id.
2. release.sh lands the ledger row itself: a new task worktree, the row, land.sh.

## Verification
`bash scripts/land/test/release.test.sh`
