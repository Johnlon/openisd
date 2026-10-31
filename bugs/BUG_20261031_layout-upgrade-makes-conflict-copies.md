# BUG_20261031_layout-upgrade-makes-conflict-copies

**Status:** FIXED 31 Oct 2026 (T622). A data-integrity bug in the layout upgrade itself, present for every layout bump, not only 2 to 3.

## John's rulings, 31 Oct 2026
- On losing the sync record: "isn't an upgrade it is a corruption".
- On the comparison: "its not a conflict if we upgrade the project we are importing the same way we upgrade a project we find in memory".

## Symptom
A browser synced with Google Drive at storage layout 2 loads the layout-3 app. After the upgrade, sync made a "(conflict, ...)" copy of every project, on Drive and in the browser, although nothing was edited on either side. Unseen-conflict notices from before the upgrade were also lost.

## Cause (two things)
- **The upgrade forgot the sync record.** The store upgrade (`storeGate.ts`) called `onReplaced`, which in `main.ts` is `forgetCloudSyncRecord`. The ledger (what was synced, which Drive revision, which hash) and the conflict notices were wiped. With no ledger row, a project present on both sides is a conflict.
- **The comparison used the wrong hash.** When sync downloads a Drive doc below the app layout it upgrades the body with the same layout steps as the local store, but kept comparing the hash Drive holds, which is of the old body, with the hash of the upgraded local text. They differ, so the rules saw two edits and kept both.

## Fix
- The upgrade no longer forgets the record. `storeGate.ts` tells `projectRewritten` (the same ledger-follows-rewrite used for stored-text compaction, `ledgerFollowsRewrite.ts`) of each saved project whose text the migration changed, so the ledger hash moves to the upgraded text and the project is not seen as edited. Conflict notices stay. `onReplaced` is now only for restore, reset and repair.
- Sync compares the upgraded remote body, not Drive's hash: after a remote body is upgraded the engine uses the hash of the upgraded body (`syncEngine.ts`). One upgrade path serves local and remote (the layout steps); there is no second copy of it.
- A remote doc below the app layout that is the same once upgraded is pushed up, so Drive now holds the new layout in the same file (`syncEngine.ts`, `pushUpdate` in place of `nothing` or `adopt`).
- Limit: the ledger follows saved projects only. The layout steps so far (1 to 2, 2 to 3) change no other synced doc's text. A later step that does must tell the ledger the same way.

## Tests
- `packages/persistence/test/cloud/forgetOnReplace.test.ts`: a migration does not call `onReplaced` and tells `projectRewritten` of each changed project.
- `packages/persistence/test/cloud/syncEngine.test.ts`: a remote doc below the app layout that upgrades to the local body makes no conflict copy and is pushed at the new layout.
- `packages/ui/test/ui/cloud-layout-upgrade.browser.spec.ts`: a layout-2 store synced with a layout-2 Drive stub (ledger in step, one unseen conflict notice) loads in the layout-3 app and syncs: no new conflict copy, Drive holds layout 3 in the same file, the old notice is still shown.

## Not done
A project edited on both devices during the upgrade still conflicts, as it should.
