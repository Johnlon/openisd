# BUG_20261009_stored-project-list-holds-copies

**Status:** RESOLVED

## Symptom
John, 9 Oct 2026: "I've seen my projects list multiple times". The stored project list (File → Open dialog) shows the same project as several separate entries, one per time a file was opened and saved across app reloads.

## Steps to reproduce
1. File → Open a `.owpr`, then Save. One stored entry exists.
2. Close the tab, and reload the app.
3. File → Open the SAME file again, then Save. Open the open-project dialog.
   - Observed: two entries with the same name.
   - Expected: one entry.

## Evidence
- `packages/persistence/src/repos/projectRepo.ts:330` previously minted a fresh `project.uuid()` on save whenever `storedIdentity.get(project)` was unset.
- `packages/design/domain/project/openISDProject.ts:446` file parsing (`wrap`) mints a fresh id per read, leaving file-opened projects with no store identity until saved.
- `readStoredEntries()` returned all entries verbatim with no deduplication or merge step.

## Cause
The store had no identity linking a freshly wrapped project to an existing stored project with the same name, and no start-up or read step deduplicated entries that named the same project.

## Fix
- `saveToStorage` in `packages/persistence/src/repos/projectRepo.ts` matches incoming projects by name against existing stored entries before generating a new id, updating the existing entry in place.
- `readStoredEntries` deduplicates stored entries with the same project name at start-up and on read, keeping the newest by `modified` and backing up the original collection to `OPENISD_BACKUP_KEYS.projects` before writing the merged entries.

## Verification
- Vitest suite in `packages/persistence/test/projectRepo.test.ts` ("stored duplicate project copies (BUG_20261009_stored-project-list-holds-copies)"):
  - Verified a store with the same project 3 times loads as 1 entry and the backup key holds all 3 originals.
  - Verified saving twice (both direct and after reopening the same project from text) leaves exactly 1 entry.
- `bash scripts/test.sh packages/persistence/test/projectRepo.test.ts` passed (30/30 passed).
