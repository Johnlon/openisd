# BUG_20260927_architecture-tests-time-out-on-mnt-c

**Status:** WONTFIX (environment)

## Symptom
`packages/ui/test/ui/import-from-declarer-only.test.ts` ("every first-party import in the tree
resolves to its declaring module") and `no-persistence-vocabulary-drift.test.ts` exceed vitest's
120 s timeout when the suite runs from a checkout on `/mnt/c` (WSL's 9p bridge to NTFS).
Reported by the mobile-skin session, 2026-09-27: ~100 s alone, ~232 s in the full suite; same on
f8086a3c, before its changes.

## Evidence
Native ext4 checkout (/home/john/work/winisd/openisd), 2026-09-27: both files together 5.5 s; the
slowest test 4.2 s.

## Cause
File I/O over 9p: both tests scan every source file with ts-morph. ~25–50× slower than ext4.

## Ruling (bug owner, 2026-09-27)
No timeout raise or test change: a 50× budget would hide real slowdowns on the normal checkout.
Run the suite from a native WSL ext4 checkout (e.g. under /home), not from /mnt/c.
