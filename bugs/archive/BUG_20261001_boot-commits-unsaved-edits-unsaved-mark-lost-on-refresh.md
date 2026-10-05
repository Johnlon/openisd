# BUG_20261001_boot-commits-unsaved-edits-unsaved-mark-lost-on-refresh

**Status:** FIXED 2026-10-05 — boot no longer calls markProjectSaved() after restoring an open-project session; only the legacy single-project and share-link paths do. A reload keeps unsaved edits unsaved (John ruled 2026-10-05).

## Symptom
Reloading the page silently marks the focused project's real unsaved edits as saved. After a
refresh the "unsaved" mark is gone and Revert has nothing to go back to: the edits have become
the saved design.

## Cause
[boot.ts](http://localhost:8000/winisd/openisd/packages/ui/src/logic/boot.ts#L99) ends the
restore with `markProjectSaved()`, which calls `save()` on the focused project. A restored
session that carried an edited layer has it folded into the saved record.

Seen 2026-10-01 while measuring the two-tab rewrite
(bugs/archive/BUG_20261001_boot-rewrites-open-sessions-and-other-tabs-rebuild.md): a session written with
`saved` plus an `edited` layer came back from the reading tab with the edits in `saved` and
`edited` null.

## History
Not recent. `markProjectSaved()` at the end of the boot dates from the session-restore work
(ade563bb, 2026-09-25; the boot's current form 437656d9, 2026-09-26).

## Question for John
Should a reload keep a project's unsaved edits as unsaved (mark and Revert intact)? WinISD's own
behaviour on reopen is unverified.
