# BUG_20261115_upgrade-backup-fills-store-and-skips-silently

**Status:** OPEN

## Symptom
The first start of a build that reads saved projects at schemaVersion 4 rewrites every stored project behind a
whole-store backup. A store at 46% of the browser's 5 MB becomes 92% or more full and the first start shows
"Storage is nearly full". A store at 60% cannot hold the backup, so the rewrite is skipped and nothing tells the user.

## Steps to reproduce
1. Store the saved projects of a multi-coil user (fixture `packages/persistence/test/fixtures/stored-v3-projects.json`, real v3 texts) repeated until the store is 46% of a 5 MB quota.
2. Run `createStoredTextCompaction(storage, backup, ...).run()`.
3. Observed: a `openisd_backup_*` key as large as the store exists; use is about 2x. Expected: a backup that is small (compressed) and a store well under the nearly-full line.
4. Repeat at 60%. Observed: outcome `refused`, texts stay v3, no message. Expected: texts v4, or the user told.

## Evidence
Release-readiness run 15 Nov 2026 (2.28 MB store -> 96%; 3.0 MB store -> silent skip). `storedTextCompaction.ts` run() uses `backup.guard('startUpRewrite')`; `main.ts` ignores the result.

## Cause
The optional rewrite takes a whole-store copy first; a refusal is dropped.

## Fix
T827 (QO940.c4, John: "compress"): the whole-store backup is written compressed, so it fits and no longer drives the store to nearly full; a rewrite whose backup still cannot fit tells the user nothing was changed.

## Verification
The tests named in T827.
