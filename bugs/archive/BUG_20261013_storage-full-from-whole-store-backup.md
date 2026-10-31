# BUG_20261013_storage-full-from-whole-store-backup

**Status:** RESOLVED

## Symptom
On openisd.app (release v20261013T1646Z) every project save failed with "Could not save. Browser storage is full." John's store: 10 projects. And the failed save left the project showing no unsaved changes.

## Cause
Diagnostics report, 13 Oct 2026 17:01: live data 0.9 MB, old single-record pre-repair copies (`openisd_projects_backup`, `openisd_open_sessions_backup`, `openisd_state_backup`) and the quarantined session 1.5 MB, and one whole-store backup `openisd_backup_vunknown_20261013T144110Z` of 2.8 MB. Total 5.2 MB, Chrome's localStorage limit. The whole-store backup copied the pre-repair copies too, so it was a backup of backups. A plain project save never dropped a backup to make room (T075 dropped only backups older than the newest of their layout; with one backup, nothing). And `saveProject` called `project.save()` before the storage write, so a refused write left the project clean.

## Fix
`isBackedUpKey` (`storageSnapshot.ts`): a whole-store backup skips the pre-repair copies. `StorageBackup.write`: a data write that still does not fit drops every backup, oldest first, the newest last; live data outranks its copies. `saveProject` and `saveAllProjects` write to storage first and mark the project saved only on success.
