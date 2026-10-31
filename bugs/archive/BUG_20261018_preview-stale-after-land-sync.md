# BUG_20261018_preview-stale-after-land-sync

**Status:** FIXED (T427)

## Symptom
After several landings, http://localhost:4000 showed "OpenISD could not start": the requested module
`packages/design/fields/index.ts?t=...` "does not provide an export named acknowledgementInPlaceOfBannerMark",
although the file on disk exports it. `bash scripts/preview-4000.sh` cured it.

## Cause
The openisd-preview unit runs Vite on the main checkout. sync-main-folder.sh moves that checkout to the new main
with a git rebase, and its header said "Vite reloads the preview by itself". It does not: a rebase rewrites many
files at once, Vite's module graph and cache go stale, and it serves a mix of old and new modules.

## Fix
After sync-main-folder moves the main folder to a new commit, it restarts the openisd-preview user unit when that
unit exists. A failed restart is logged and makes the sync exit 1. Test: scripts/land/test/sync-main-folder.e2e.test.sh
(systemctl stub, case 9).
