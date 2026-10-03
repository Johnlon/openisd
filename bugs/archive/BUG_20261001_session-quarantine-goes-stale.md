# BUG_20261001_session-quarantine-goes-stale

**Status:** CLOSED 2026-10-03 — fixed in e87e04e9 (bug filed and fixed in one commit, never closed). Refused entries are repaired, not dropped; the pre-repair text goes to a backup the dialog offers for download.

## Symptom
When boot refuses an open project, the whole open-session text is copied to
`openisd_quarantine_session`, and the refused project is dropped from the tabs. Nothing offers
that copy back, and the user is not told how to get the dropped project.

## Cause
[projectRepo.ts](http://localhost:8000/winisd/openisd/packages/persistence/src/repos/projectRepo.ts#L300-L327):
`loadOpenProjects` skips refused entries; `quarantineOpenSession` copies the text aside.

## Fix
Refused entries are repaired instead of dropped (see
BUG_20261001_one-bad-field-refuses-a-whole-project); the pre-repair text goes to a backup the
user can download.
