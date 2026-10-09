# BUG_20261009_stored-project-list-holds-copies

**Status:** OPEN

## Symptom
John, 9 Oct 2026: "I've seen my projects list multiple times". The stored project list (File → Open dialog) shows the same project as several separate entries, one per time a file was opened and saved across app reloads.

## Steps to reproduce
1. File → Open a `.owpr`, then Save. One stored entry exists.
2. Close the tab, and reload the app.
3. File → Open the SAME file again, then Save. Open the open-project dialog.
   - Observed: two entries with the same name.
   - Expected: one entry.

## Evidence
Re-checked in this change:
- `packages/persistence/src/repos/projectRepo.ts:330` — a save keys the entry by `storedIdentity.get(project) ?? project.uuid()`.
- `packages/design/domain/project/openISDProject.ts:446` — a file parse (`wrap`) mints a fresh `appContext.newId()`; a file-opened project is never given a store identity until it is saved.
- So each fresh parse of the same file saves under a new id: `readStoredEntries()` (`projectRepo.ts:265`) returns every entry and nothing merges them.

## Cause
The store has no way to recognise that a newly parsed file is the same project as an entry it already holds: the file carries no store id, and no read/start-up step merges entries that name the same project.

## Fix
Merge stored duplicates of one project into a single entry at start-up (and on read), keeping the newest by last modified, with every dropped copy copied to the backup key first. This is a persistence change (`packages/persistence`), outside T024's file allowance.

## Verification
A store holding the same project three times loads as one entry (the newest by modified), and the backup key holds all three originals.
